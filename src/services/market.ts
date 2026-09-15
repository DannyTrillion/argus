/**
 * Read models for the UI. Each function composes one or more CoinMarketCap
 * endpoints into the exact shape a screen needs, behind a short cache.
 */
import * as cmc from "../cmc/endpoints.js";
import { CmcApiError } from "../cmc/http.js";
import { correlationByDate, summarizeCandles, type SeriesStats } from "../agent/analytics.js";
import { memo, MINUTE } from "../api/cache.js";

const PLAN_LIMIT = 1006;

async function optional<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CmcApiError && (err.errorCode === PLAN_LIMIT || err.httpStatus === 403)) return null;
    throw err;
  }
}

export function overview() {
  return memo("overview", MINUTE, async () => {
    const [global, fearGreed, altcoinSeason, liquidations] = await Promise.all([
      cmc.globalMetrics(),
      cmc.fearGreedLatest(),
      cmc.altcoinSeason(),
      optional(() => cmc.liquidations()),
    ]);
    return { global, fearGreed, altcoinSeason, liquidations, updatedAt: new Date().toISOString() };
  });
}

export function history(days: number) {
  const d = Math.min(365, Math.max(7, days));
  return memo(`history:${d}`, 10 * MINUTE, async () => {
    const [global, fearGreed] = await Promise.all([
      cmc.globalMetricsHistorical({ count: d, interval: "daily" }),
      optional(() => cmc.fearGreedHistorical(d)),
    ]);
    return { global, fearGreed: fearGreed ?? [] };
  });
}

export function movers() {
  return memo("movers", 5 * MINUTE, async () => {
    const [gainers, losers] = await Promise.all([
      cmc.gainersLosers({ direction: "gainers", limit: 12 }),
      cmc.gainersLosers({ direction: "losers", limit: 12 }),
    ]);
    const liquid = (c: cmc.Coin) => (c.quote.volume_24h ?? 0) >= 5_000_000 && (c.quote.market_cap ?? 0) >= 50_000_000;
    return { gainers: gainers.filter(liquid).slice(0, 8), losers: losers.filter(liquid).slice(0, 8) };
  });
}

/**
 * CMC "categories" mix real sectors with taxonomies (SEC/CFTC lists, VC portfolios,
 * bankruptcy estates). Keep the ones a person would call a sector, one per label,
 * choosing the largest matching category when CMC has several.
 */
const SECTORS: Array<{ label: string; match: RegExp }> = [
  { label: "Layer 1", match: /^layer 1$/i },
  { label: "Layer 2", match: /^layer 2$/i },
  { label: "DeFi", match: /^defi$/i },
  { label: "Stablecoins", match: /^stablecoin$/i },
  { label: "Memes", match: /^memes?$/i },
  { label: "AI & Big Data", match: /^ai & big data$|^ai agents$/i },
  { label: "Gaming", match: /^gaming$/i },
  { label: "RWA", match: /real world assets?|^rwa$/i },
  { label: "Privacy", match: /^privacy$/i },
  { label: "Exchange tokens", match: /^centralized exchange|^exchange-based tokens?$/i },
  { label: "DEX", match: /^decentralized exchange|^dex$/i },
  { label: "Lending", match: /^lending|borrowing/i },
  { label: "Liquid staking", match: /liquid staking/i },
  { label: "Perpetuals", match: /perpetual/i },
  { label: "Oracles", match: /^oracles?$/i },
  { label: "Interoperability", match: /^interoperability$/i },
  { label: "Storage", match: /^storage$|^filesharing$/i },
  { label: "DePIN", match: /^depin$/i },
  { label: "NFT", match: /^collectibles & nfts?$|^nft$/i },
  { label: "Payments", match: /^payments$/i },
  { label: "Modular", match: /^modular/i },
  { label: "Restaking", match: /restaking/i },
  { label: "Launchpads", match: /^launchpad$|launchpads?$/i },
  { label: "Prediction markets", match: /prediction market/i },
  { label: "Social", match: /^socialfi$|^social$/i },
  { label: "Wallets", match: /^wallets?$/i },
  { label: "Yield", match: /^yield farming$|^yield aggregator/i },
];

/** Pure: pick one category per curated sector label, largest by market cap. Exported for tests. */
export function pickSectors(all: cmc.Category[]): Array<cmc.Category & { label: string }> {
  const picked = new Map<string, cmc.Category & { label: string }>();
  for (const c of all) {
    if (!(c.market_cap && c.market_cap > 0) || (c.num_tokens ?? 0) < 3) continue;
    const hit = SECTORS.find((s) => s.match.test(c.name));
    if (!hit) continue;
    const cur = picked.get(hit.label);
    if (!cur || (c.market_cap ?? 0) > (cur.market_cap ?? 0)) picked.set(hit.label, { ...c, label: hit.label });
  }
  return [...picked.values()]
    .sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0))
    .map((c) => ({ ...c, name: c.label }));
}

export function sectors() {
  return memo("sectors", 5 * MINUTE, async () => pickSectors(await cmc.categories({ limit: 500 })));
}

export interface CoinRow extends cmc.Coin {
  sparkline: number[];
}

export function coins(limit: number) {
  const n = Math.min(500, Math.max(10, limit));
  return memo(`coins:${n}`, MINUTE, async () => {
    const list = await cmc.listings({ limit: n });
    const sparks = await memo(`sparks:${n}`, 6 * 60 * MINUTE, () => cmc.sparklines(list.map((c) => c.id), 8));
    const rows: CoinRow[] = list.map((c) => ({ ...c, sparkline: sparks.get(c.id) ?? [] }));
    return { coins: rows, updatedAt: new Date().toISOString() };
  });
}

export interface CoinDetail {
  coin: cmc.Coin;
  info: cmc.CoinInfo | null;
  performance: cmc.PerformanceStats | null;
  risk: (SeriesStats & { correlation_with_btc: number | null; source: cmc.Series["source"] }) | null;
}

export function coin(id: number): Promise<CoinDetail> {
  return memo(`coin:${id}`, 2 * MINUTE, async () => {
    const [quotes, info, perf, series, btc] = await Promise.all([
      cmc.quotes({ ids: [id] }),
      optional(() => cmc.info([id])),
      optional(() => cmc.pricePerformance({ ids: [id] })),
      optional(() => cmc.ohlcv({ id, count: 91 })),
      id === 1 ? Promise.resolve(null) : optional(() => cmc.ohlcv({ id: 1, count: 91 })),
    ]);
    const c = quotes[0];
    if (!c) throw new Error(`Unknown coin id ${id}`);
    const risk = series
      ? {
          ...summarizeCandles(c.symbol, series.candles),
          correlation_with_btc: id === 1 ? 1 : btc ? correlationByDate(btc.candles, series.candles) : null,
          source: series.source,
        }
      : null;
    return { coin: c, info: info?.[0] ?? null, performance: perf?.[0] ?? null, risk };
  });
}

export type Range = "24h" | "7d" | "30d" | "90d" | "1y";

export function coinHistory(id: number, range: Range) {
  return memo(`hist:${id}:${range}`, range === "24h" ? 5 * MINUTE : 30 * MINUTE, async () => {
    if (range === "24h") {
      const s = await cmc.ohlcv({ id, timePeriod: "hourly", count: 25 });
      return { range, source: s.source, candles: s.candles };
    }
    const count = { "7d": 8, "30d": 31, "90d": 91, "1y": 366 }[range];
    const s = await cmc.ohlcv({ id, timePeriod: "daily", count });
    return { range, source: s.source, candles: s.candles };
  });
}

export interface CompareResult {
  days: number;
  stats: Array<SeriesStats & { source: cmc.Series["source"] }>;
  /** Normalized to 100 at the first common date. */
  normalized: Array<{ date: string; values: Record<string, number | null> }>;
  correlation: Array<{ a: string; b: string; r: number | null }>;
}

export function compare(symbols: string[], days: number): Promise<CompareResult> {
  const syms = [...new Set(symbols.map((s) => s.toUpperCase()))].slice(0, 8);
  const d = Math.min(365, Math.max(7, days));
  return memo(`compare:${syms.join(",")}:${d}`, 10 * MINUTE, async () => {
    const series = await Promise.all(syms.map((s) => cmc.ohlcv({ symbol: s, count: d + 1 })));
    const stats = series.map((s) => ({ ...summarizeCandles(s.symbol, s.candles), source: s.source }));
    const dates = [...new Set(series.flatMap((s) => s.candles.map((c) => c.time_close.slice(0, 10))))].sort();
    const firstClose = new Map(series.map((s) => [s.symbol, s.candles[0]?.close ?? null]));
    const byDate = series.map((s) => new Map(s.candles.map((c) => [c.time_close.slice(0, 10), c.close])));
    const normalized = dates.map((date) => ({
      date,
      values: Object.fromEntries(
        series.map((s, i) => {
          const close = byDate[i].get(date);
          const base = firstClose.get(s.symbol);
          return [s.symbol, close !== undefined && base ? Math.round((close / base) * 10000) / 100 : null];
        }),
      ),
    }));
    const correlation: CompareResult["correlation"] = [];
    for (let i = 0; i < series.length; i++)
      for (let j = 0; j < series.length; j++)
        correlation.push({ a: series[i].symbol, b: series[j].symbol, r: i === j ? 1 : correlationByDate(series[i].candles, series[j].candles) });
    return { days: d, stats, normalized, correlation };
  });
}

export function search(q: string) {
  return memo(`search:${q.toLowerCase()}`, 30 * MINUTE, () => cmc.mapCoins({ symbol: q.toUpperCase(), limit: 10 }));
}
