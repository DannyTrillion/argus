/**
 * JSON API consumed by the React app. Thin handlers over services/market.ts.
 */
import { Hono } from "hono";
import * as market from "../services/market.js";
import { recentCalls, CmcApiError } from "../cmc/http.js";
import { config } from "../config.js";
import { currentBrief, getBrief, refreshBrief } from "../services/brief.js";
import { status } from "../services/status.js";
import { explainMove, type Window } from "../services/explain.js";
import { findings, scan } from "../services/watch.js";
import { stream } from "../services/stream.js";
import { getSettings, setAutomationPaused } from "../services/settings.js";
import { createShare, readShare } from "../services/share.js";
import { KEY_HEADER, keyStatus, resolveAnthropicKey, testAnthropicKey } from "../services/keys.js";
import { analyzePortfolio, type Holding } from "../services/portfolio.js";

export const api = new Hono();

api.onError((err, c) => {
  if (err instanceof CmcApiError) {
    return c.json({ error: err.message, code: err.errorCode, endpoint: err.endpoint }, 502);
  }
  console.error(err);
  return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
});

api.get("/health", (c) => c.json({ ok: true, model: config.model, keyless: config.keyless }));
api.get("/calls", (c) => c.json(recentCalls(100)));

api.get("/market/overview", async (c) => c.json(await market.overview()));
api.get("/market/history", async (c) => c.json(await market.history(Number(c.req.query("days")) || 90)));
api.get("/market/movers", async (c) => c.json(await market.movers()));
api.get("/market/sectors", async (c) => c.json(await market.sectors()));

api.get("/coins", async (c) => c.json(await market.coins(Number(c.req.query("limit")) || 200)));
api.get("/coins/search", async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (!q) return c.json([]);
  return c.json(await market.search(q));
});
api.get("/coins/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
  return c.json(await market.coin(id));
});
api.get("/coins/:id/history", async (c) => {
  const id = Number(c.req.param("id"));
  const range = (c.req.query("range") ?? "30d") as market.Range;
  if (!["24h", "7d", "30d", "90d", "1y"].includes(range)) return c.json({ error: "invalid range" }, 400);
  return c.json(await market.coinHistory(id, range));
});

api.get("/compare", async (c) => {
  const symbols = (c.req.query("symbols") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (symbols.length < 1) return c.json({ error: "symbols required" }, 400);
  return c.json(await market.compare(symbols, Number(c.req.query("days")) || 90));
});

// Automated brief: GET returns the latest (generating on first call), POST forces a refresh.
api.get("/brief", async (c) => {
  const cached = currentBrief();
  if (cached) return c.json(cached);
  return c.json(await getBrief());
});
api.post("/brief/refresh", async (c) => c.json(await refreshBrief()));

api.get("/status", async (c) => c.json(await status()));

// Move explainer: deterministic attribution, no LLM.
api.get("/explain", async (c) => {
  const symbol = (c.req.query("symbol") ?? "").trim();
  const window = (c.req.query("window") ?? "24h") as Window;
  if (!symbol) return c.json({ error: "symbol required" }, 400);
  if (!["1h", "24h", "7d"].includes(window)) return c.json({ error: "invalid window" }, 400);
  return c.json(await explainMove(/^\d+$/.test(symbol) ? Number(symbol) : symbol.toUpperCase(), window));
});

// Argus noticed: findings feed and a manual scan trigger for demos.
api.get("/findings", (c) => c.json(findings()));
api.post("/watch/scan", async (c) => {
  // Scheduled scans run on the deployment's key every few hours. A manual scan runs only on
  // the visitor's own key, sent per request and never stored, so the shared key stays capped.
  const own = resolveAnthropicKey(c.req.header(KEY_HEADER));
  if (!own) return c.json({ error: "own_key_required", message: "Scan now runs on your own Anthropic key. Add it on the Keys page. It stays in your browser and is never stored in a database." }, 401);
  const fresh = await scan(own);
  return c.json({ fresh, ...findings() });
});

// Portfolio analysis. Holdings arrive with the request, are priced and decomposed, and are
// discarded; nothing about a visitor's positions is stored on the server.
api.post("/portfolio", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { holdings?: Holding[] };
  const holdings = Array.isArray(body.holdings) ? body.holdings : [];
  if (holdings.length > 100) return c.json({ error: "too many holdings" }, 400);
  return c.json(await analyzePortfolio(holdings));
});

// Bring your own key: what this deployment has, and a one-token test of a caller's key.
// The key in the test body is used for that call only and never stored or logged.
api.get("/keys", (c) => c.json(keyStatus()));
api.post("/keys/test", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { key?: string };
  const key = (body.key ?? "").trim();
  if (!key) return c.json({ ok: false, error: "key is required" }, 400);
  return c.json(await testAnthropicKey(key));
});

// Unified story stream for the Home carousel.
api.get("/stream", (c) => c.json(stream()));

// Automation switch: pauses the scheduled brief and the watch loop (manual runs still work).
api.get("/automation", (c) => c.json({ ...getSettings(), analystModel: config.model, automationModel: config.automationModel }));
api.post("/automation", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { paused?: boolean };
  return c.json({ ...setAutomationPaused(Boolean(body.paused)), analystModel: config.model, automationModel: config.automationModel });
});

// Read-only conversation shares.
api.post("/share", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { title?: unknown; messages?: unknown };
  try {
    const s = createShare(body);
    return c.json({ id: s.id, url: `/s/${s.id}` });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});
api.get("/share/:id", (c) => {
  const s = readShare(c.req.param("id"));
  return s ? c.json(s) : c.json({ error: "not found" }, 404);
});
