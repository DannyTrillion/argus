import { test } from "node:test";
import assert from "node:assert/strict";
import { takeSharedQuestion, resetLimits, sharedQuestionsToday } from "../src/services/limits.js";

const limits = { perHour: 2, perDay: 3 };
const t0 = Date.parse("2026-09-15T10:00:00Z");

test("per-visitor hourly cap, then the daily cap for everyone", () => {
  resetLimits();
  assert.equal(takeSharedQuestion("a", t0, limits).ok, true);
  assert.equal(takeSharedQuestion("a", t0 + 1000, limits).ok, true);
  const third = takeSharedQuestion("a", t0 + 2000, limits);
  assert.equal(third.ok, false);
  assert.equal(third.ok === false && third.reason, "hour");
  assert.equal(takeSharedQuestion("b", t0 + 3000, limits).ok, true);
  const dayCapped = takeSharedQuestion("c", t0 + 4000, limits);
  assert.equal(dayCapped.ok === false && dayCapped.reason, "day");
  assert.equal(sharedQuestionsToday(t0 + 5000), 3);
});

test("the hour window slides and the day resets at midnight UTC", () => {
  resetLimits();
  const wide = { perHour: 1, perDay: 100 };
  assert.equal(takeSharedQuestion("a", t0, wide).ok, true);
  assert.equal(takeSharedQuestion("a", t0 + 30 * 60_000, wide).ok, false);
  assert.equal(takeSharedQuestion("a", t0 + 61 * 60_000, wide).ok, true);
  const tight = { perHour: 10, perDay: 1 };
  resetLimits();
  assert.equal(takeSharedQuestion("z", t0, tight).ok, true);
  assert.equal(takeSharedQuestion("z", t0 + 1000, tight).ok, false);
  assert.equal(takeSharedQuestion("z", Date.parse("2026-09-16T00:00:01Z"), tight).ok, true);
});
