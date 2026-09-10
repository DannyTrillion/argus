import { test } from "node:test";
import assert from "node:assert/strict";
import { correlationByDate, maxDrawdown, pearson, stddev, summarizeCandles } from "../src/agent/analytics.ts";
import type { Candle } from "../src/cmc/endpoints.ts";

function candles(closes: number[], startDay = 1): Candle[] {
  return closes.map((close, i) => {
    const d = new Date(Date.UTC(2026, 0, startDay + i));
    const iso = d.toISOString();
    return { time_open: iso, time_close: iso, open: close, high: close, low: close, close, volume: 100 + i, market_cap: close * 1000 };
  });
}

test("maxDrawdown finds the deepest peak-to-trough fall", () => {
  assert.equal(maxDrawdown([100, 120, 60, 90, 130]), -0.5);
  assert.equal(maxDrawdown([1, 2, 3]), 0);
});

test("stddev of a constant series is zero", () => {
  assert.equal(stddev([5, 5, 5, 5]), 0);
});

test("pearson correlation is 1 for identical series and -1 for opposite", () => {
  assert.equal(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  assert.equal(pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1);
  assert.equal(pearson([1, 2], [1, 2]), null);
});

test("summarizeCandles computes return, drawdown and best/worst day", () => {
  const s = summarizeCandles("TST", candles([100, 110, 99, 120]));
  assert.equal(s.total_return_pct, 20);
  assert.equal(s.max_drawdown_pct, -10);
  assert.equal(s.best_day?.return_pct, 21.21);
  assert.equal(s.worst_day?.return_pct, -10);
  assert.equal(s.days, 4);
});

test("correlationByDate aligns by date and ignores unmatched days", () => {
  const a = candles([1, 2, 3, 4, 5], 1);
  const b = candles([2, 4, 6, 8, 10], 1);
  assert.equal(correlationByDate(a, b), 1);
  // Same daily returns as `a` on days 2-5 (a = 2,3,4,5 there), shifted to start on day 2.
  const offset = candles([4, 6, 8, 10, 12], 2); // 4 overlapping days -> 3 daily returns
  assert.equal(correlationByDate(a, offset), 1);
  const tooShort = candles([2, 4, 6, 8, 10], 4); // 2 overlapping days -> 1 return, not enough
  assert.equal(correlationByDate(a, tooShort), null);
});
