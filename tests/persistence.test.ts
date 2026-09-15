/**
 * State survives a restart. node --test runs each file in its own process, so pointing
 * the state files at a temp dir before the dynamic import gives a clean module load.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "argus-persist-"));
const now = new Date().toISOString();
const finding = (id: string, symbol: string) => ({
  id, kind: "coin_move", title: `${symbol} moved`, detail: "d", summary: "s", headline: "h", deck: "k",
  subject: { type: "coin", id: 1, symbol }, metric: 5, severity: 1, question: "q", investigatedAt: now, calls: 1, credits: 1,
});
writeFileSync(join(dir, "watch.json"), JSON.stringify({
  findings: [finding("a", "BTC"), finding("b", "USDT"), finding("c", "SOL")],
  cooldowns: {}, lastScanAt: now, nextScanAt: null, investigationsToday: { day: "", count: 0 }, lastFearGreed: null,
}));
process.env.WATCH_STATE_FILE = join(dir, "watch.json");
process.env.SETTINGS_FILE = join(dir, "settings.json");

test("watch findings load from disk at module init, stablecoins filtered", async () => {
  const w = await import("../src/services/watch.js");
  const ids = w.findings().findings.map((f) => f.id);
  assert.deepEqual(ids, ["a", "c"]);
});
