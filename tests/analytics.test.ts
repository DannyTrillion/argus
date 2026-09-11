import { test } from "node:test";
import assert from "node:assert/strict";
import { correlationByDate, maxDrawdown, pearson, stddev, summarizeCandles } from "../src/agent/analytics.ts";
import type { Candle } from "../src/cmc/endpoints.ts";
import { basketRisk, normalizeHoldings } from "../src/services/portfolio.js";

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

// ---- portfolio basket maths ----

test("basketRisk reports drawdown in percent, not as a fraction", () => {
  // Peak 120, trough 90: a 25% drawdown.
  const risk = basketRisk([100, 120, 90, 110]);
  assert.ok(risk);
  assert.equal(risk.max_drawdown_pct, -25);
  assert.equal(risk.days, 4);
  assert.equal(risk.return_pct, 10);
});

test("basketRisk finds the best and worst day and the correlation with BTC", () => {
  const risk = basketRisk([100, 110, 99, 99], [200, 220, 198, 198]);
  assert.ok(risk);
  assert.equal(risk.best_day_pct, 10);
  assert.equal(risk.worst_day_pct, -10);
  // The basket is a fixed multiple of BTC here, so returns move together exactly.
  assert.equal(risk.correlation_to_btc, 1);
});

test("basketRisk needs at least three points", () => {
  assert.equal(basketRisk([100, 101]), null);
});

test("normalizeHoldings merges duplicates and drops junk amounts", () => {
  const out = normalizeHoldings([
    { id: 1, amount: 0.5 },
    { id: 1, amount: 0.25 },
    { id: 1027, amount: 0 },
    { id: 5426, amount: -3 },
    { id: 74, amount: Number.NaN },
    { id: 1839, amount: 12 },
  ]);
  assert.deepEqual(out, [
    { id: 1, amount: 0.75 },
    { id: 1839, amount: 12 },
  ]);
});
