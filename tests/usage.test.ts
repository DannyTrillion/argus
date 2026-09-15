import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.USAGE_FILE = join(mkdtempSync(join(tmpdir(), "argus-usage-")), "usage.json");

test("cost estimate uses published per-million rates, cache at 0.1x read and 1.25x write", async () => {
  const { estimateUsd } = await import("../src/services/usage.js");
  const M = 1_000_000;
  assert.equal(estimateUsd("claude-opus-5", { input: M, output: 0, cacheRead: 0, cacheWrite: 0 }), 5);
  assert.equal(estimateUsd("claude-sonnet-5", { input: 0, output: M, cacheRead: 0, cacheWrite: 0 }), 10);
  assert.equal(estimateUsd("claude-opus-5", { input: 0, output: 0, cacheRead: M, cacheWrite: 0 }), 0.5);
  assert.equal(estimateUsd("claude-sonnet-5", { input: 0, output: 0, cacheRead: 0, cacheWrite: M }), 2.5);
  assert.equal(estimateUsd("some-unknown-model", { input: M, output: M, cacheRead: 0, cacheWrite: 0 }), null);
});

test("only the site's key is costed; visitor runs are counted separately", async () => {
  const { recordUsage, usageSummary } = await import("../src/services/usage.js");
  const now = Date.parse("2026-09-15T12:00:00Z");
  recordUsage("analyst", "claude-opus-5", { input: 100_000, output: 10_000, cacheRead: 0, cacheWrite: 0 }, true, now);
  recordUsage("brief", "claude-sonnet-5", { input: 50_000, output: 5_000, cacheRead: 0, cacheWrite: 0 }, true, now);
  recordUsage("analyst", "claude-opus-5", { input: 999_999, output: 999_999, cacheRead: 0, cacheWrite: 0 }, false, now);
  const s = usageSummary(now);
  assert.equal(s.today.runs, 2);
  assert.equal(s.today.visitorRuns, 1);
  assert.equal(Math.round(s.today.usd * 100) / 100, 0.9);
  assert.equal(s.today.kinds.analyst.runs, 1);
  assert.equal(s.days.length, 7);
});
