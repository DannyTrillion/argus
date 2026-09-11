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
  const fresh = await scan();
  return c.json({ fresh, ...findings() });
});
