/**
 * A saved brief survives a restart even when it is older than the refresh window, so
 * Home never goes blank while automation is paused or the Anthropic key is down.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "argus-brief-"));
const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3_600_000).toISOString();
writeFileSync(join(dir, "brief.json"), JSON.stringify({ text: "## Market backdrop\n**Old but useful.**\nBody.", generatedAt: twoDaysAgo, model: "m", calls: 1, credits: 1, durationMs: 1 }));
process.env.BRIEF_CACHE_FILE = join(dir, "brief.json");
process.env.SETTINGS_FILE = join(dir, "settings.json");

test("stale brief still loads at module init", async () => {
  const b = await import("../src/services/brief.js");
  const cur = b.currentBrief();
  assert.ok(cur, "expected the saved brief to load");
  assert.equal(cur.generatedAt, twoDaysAgo);
});
