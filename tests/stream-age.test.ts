/** Old findings leave the Home carousel and brief cards fill the space. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "argus-stream-"));
const now = Date.now();
const f = (id: string, hoursAgo: number) => ({
  id, kind: "coin_move", title: id, detail: "d", summary: "s", headline: `h-${id}`, deck: "k",
  subject: { type: "coin", id: 1, symbol: "SOL" }, metric: 5, severity: 1, question: "q",
  investigatedAt: new Date(now - hoursAgo * 3_600_000).toISOString(), calls: 1, credits: 1,
});
writeFileSync(join(dir, "watch.json"), JSON.stringify({ findings: [f("fresh", 2), f("stale", 93)], cooldowns: {}, lastScanAt: null, nextScanAt: null, investigationsToday: { day: "", count: 0 }, lastFearGreed: null }));
const sections = ["Market backdrop", "Movers that matter", "Sector rotation", "Leverage and risk", "Watch list"].map((h) => `## ${h}\n**${h} headline.**\nBody for ${h}.`).join("\n\n");
writeFileSync(join(dir, "brief.json"), JSON.stringify({ text: sections, generatedAt: new Date(now - 3_600_000).toISOString(), model: "m", calls: 1, credits: 1, durationMs: 1 }));
process.env.WATCH_STATE_FILE = join(dir, "watch.json");
process.env.BRIEF_CACHE_FILE = join(dir, "brief.json");
process.env.SETTINGS_FILE = join(dir, "settings.json");
process.env.USAGE_FILE = join(dir, "usage.json");

test("a finding from four days ago is not shown; brief cards pad to five", async () => {
  const { stream } = await import("../src/services/stream.js");
  const s = stream();
  const findingIds = s.stories.filter((x) => x.type === "finding").map((x) => x.id);
  assert.deepEqual(findingIds, ["fresh"]);
  assert.equal(s.stories.length, 5);
  assert.equal(s.stories.filter((x) => x.type === "brief").length, 4);
});
