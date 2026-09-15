import { test } from "node:test";
import assert from "node:assert/strict";
import { daysLeft, dailyBudget, isLeanPlan } from "../src/services/budget.js";
import { memo } from "../src/api/cache.js";
import { setPlan } from "../src/cmc/plan.js";

test("days left runs to the end of the month, or to BUDGET_UNTIL when sooner", () => {
  const sep15 = Date.parse("2026-09-15T12:00:00Z");
  assert.equal(daysLeft(sep15), 16);
  assert.equal(daysLeft(sep15, "2026-09-20T00:00:00Z"), 5);
  assert.equal(daysLeft(sep15, "2026-09-01T00:00:00Z"), 16);
});

test("judging window on Basic: 15,000 credits from Oct 1 until Oct 19 is 833 a day", () => {
  assert.equal(dailyBudget(15_000, Date.parse("2026-10-01T00:00:00Z"), "2026-10-19T00:00:00Z"), 833);
});

test("Basic-sized plans are lean, Startup is not", () => {
  assert.equal(isLeanPlan(15_000), true);
  assert.equal(isLeanPlan(450_000), false);
  assert.equal(isLeanPlan(null), false);
});

test("when the budget is spent, the cache keeps serving the last value instead of fetching", async () => {
  setPlan({ frozen: false, ttlScale: 1 });
  let calls = 0;
  const first = await memo("budget-test", 1, async () => { calls += 1; return "fresh"; });
  assert.equal(first, "fresh");
  await new Promise((r) => setTimeout(r, 10));
  setPlan({ frozen: true });
  const second = await memo("budget-test", 1, async () => { calls += 1; return "should not fetch"; });
  assert.equal(second, "fresh");
  assert.equal(calls, 1);
  setPlan({ frozen: false });
});
