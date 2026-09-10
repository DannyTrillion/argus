/**
 * Pure numeric helpers the agent uses to turn raw OHLCV candles into
 * risk and return statistics. No I/O here, so it is easy to unit test.
 */
import type { Candle } from "../cmc/endpoints.js";

export interface SeriesStats {
  symbol: string;
  days: number;
  first_close: number;
  last_close: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  /** Annualized volatility of daily log returns, in percent. */
  annualized_volatility_pct: number;
  best_day: { date: string; return_pct: number } | null;
  worst_day: { date: string; return_pct: number } | null;
  avg_daily_volume: number;
  /** Ratio of the last 7 days' average volume to the whole-window average. >1 means volume is picking up. */
  volume_trend_ratio: number | null;
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function maxDrawdown(closes: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const c of closes) {
    if (c > peak) peak = c;
    const dd = peak > 0 ? (c - peak) / peak : 0;
    if (dd < worst) worst = dd;
  }
  return worst;
}

export function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const x = a.slice(-n);
  const y = b.slice(-n);
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? null : num / den;
}

export function summarizeCandles(symbol: string, candles: Candle[]): SeriesStats {
  const closes = candles.map((c) => c.close);
  const rets = logReturns(closes);
  const first = closes[0] ?? 0;
  const last = closes[closes.length - 1] ?? 0;
  let best: SeriesStats["best_day"] = null;
  let worst: SeriesStats["worst_day"] = null;
  for (let i = 1; i < candles.length; i++) {
    const r = candles[i - 1].close > 0 ? (candles[i].close / candles[i - 1].close - 1) * 100 : 0;
    const date = candles[i].time_close.slice(0, 10);
    if (!best || r > best.return_pct) best = { date, return_pct: round(r) };
    if (!worst || r < worst.return_pct) worst = { date, return_pct: round(r) };
  }
  const volumes = candles.map((c) => c.volume).filter((v) => Number.isFinite(v));
  const avgVol = volumes.length ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
  const recent = volumes.slice(-7);
  const recentAvg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  return {
    symbol,
    days: candles.length,
    first_close: first,
    last_close: last,
    total_return_pct: first > 0 ? round((last / first - 1) * 100) : 0,
    max_drawdown_pct: round(maxDrawdown(closes) * 100),
    annualized_volatility_pct: round(stddev(rets) * Math.sqrt(365) * 100),
    best_day: best,
    worst_day: worst,
    avg_daily_volume: Math.round(avgVol),
    volume_trend_ratio: avgVol > 0 && recent.length ? round(recentAvg / avgVol, 2) : null,
  };
}

/** Align two candle series by close date and return the correlation of their daily log returns. */
export function correlationByDate(a: Candle[], b: Candle[]): number | null {
  const mapB = new Map(b.map((c) => [c.time_close.slice(0, 10), c.close]));
  const pairs: Array<[number, number]> = [];
  for (const c of a) {
    const other = mapB.get(c.time_close.slice(0, 10));
    if (other !== undefined) pairs.push([c.close, other]);
  }
  const ra = logReturns(pairs.map((p) => p[0]));
  const rb = logReturns(pairs.map((p) => p[1]));
  const r = pearson(ra, rb);
  return r === null ? null : round(r, 3);
}
