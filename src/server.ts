/**
 * Web UI and JSON API for Argus.
 *
 *   GET  /              chat UI
 *   POST /api/chat      { sessionId, message } -> Server-Sent Events of AgentEvent
 *   GET  /api/calls     recent CoinMarketCap calls (evidence of live data)
 *   GET  /api/health    liveness + config summary
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { serve } from "@hono/node-server";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages";
import { config } from "./config.js";
import { recentCalls } from "./cmc/http.js";
import { runAgent, describeError } from "./agent/agent.js";

const here = dirname(fileURLToPath(import.meta.url));
const indexHtml = readFileSync(join(here, "..", "public", "index.html"), "utf8");

const sessions = new Map<string, BetaMessageParam[]>();
const MAX_HISTORY_MESSAGES = 40;

const app = new Hono();

app.get("/", (c) => c.html(indexHtml));

app.get("/api/health", (c) => c.json({ ok: true, model: config.model, sessions: sessions.size }));

app.get("/api/calls", (c) => c.json(recentCalls(100)));

app.post("/api/chat", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { sessionId?: string; message?: string };
  const sessionId = (body.sessionId ?? "").trim() || crypto.randomUUID();
  const message = (body.message ?? "").trim();
  if (!message) return c.json({ error: "message is required" }, 400);

  const history = sessions.get(sessionId) ?? [];
  const messages: BetaMessageParam[] = [...history, { role: "user", content: message }];

  return streamSSE(c, async (stream) => {
    let id = 0;
    // Writes are serialized through a promise chain so events keep their order and the
    // stream is not closed while the final "done" event is still in flight.
    let chain: Promise<void> = Promise.resolve();
    const send = (event: string, data: unknown): Promise<void> => {
      chain = chain.then(() => stream.writeSSE({ event, data: JSON.stringify(data), id: String(id++) })).catch(() => undefined);
      return chain;
    };
    await send("session", { sessionId });
    try {
      const result = await runAgent({
        messages,
        onEvent: (e) => {
          void send(e.type, e);
        },
      });
      sessions.set(sessionId, result.messages.slice(-MAX_HISTORY_MESSAGES));
    } catch (err) {
      await send("error", { type: "error", message: describeError(err) });
    }
    await chain;
  });
});

app.delete("/api/session/:id", (c) => {
  sessions.delete(c.req.param("id"));
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`Argus listening on http://localhost:${info.port} (model: ${config.model})`);
});
