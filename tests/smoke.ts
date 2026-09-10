/**
 * Hits a handful of CMC endpoints and prints trimmed results.
 * Runs keyless if CMC_API_KEY is unset (subset of endpoints only).
 *   pnpm tsx --env-file=.env tests/smoke.ts
 */
import * as cmc from "../src/cmc/endpoints.ts";
import { config } from "../src/config.ts";

console.log(`mode: ${config.keyless ? "keyless public API" : "keyed Pro API"} (${config.cmcBaseUrl})`);

async function step<T>(name: string, fn: () => Promise<T>, show: (v: T) => unknown): Promise<void> {
  try {
    const v = await fn();
    console.log(`✔ ${name}:`, JSON.stringify(show(v)));
  } catch (err) {
    console.log(`✘ ${name}:`, err instanceof Error ? err.message : err);
  }
}

await step("globalMetrics", () => cmc.globalMetrics(), (g) => ({ cap: g.total_market_cap, btc_dom: g.btc_dominance, chg: g.total_market_cap_yesterday_percentage_change }));
await step("fearGreedLatest", () => cmc.fearGreedLatest(), (f) => f);
await step("altcoinSeason", () => cmc.altcoinSeason(), (a) => ({ idx: a.altcoin_index, high: a.yearly_high, low: a.yearly_low }));
await step("quotes BTC,ETH,SOL", () => cmc.quotes({ symbols: ["BTC", "ETH", "SOL"] }), (q) => q.map((c) => [c.symbol, c.quote.price, c.quote.percent_change_24h]));
await step("listings top5 by 24h change", () => cmc.listings({ limit: 5, sort: "percent_change_24h", marketCapMin: 1e9 }), (l) => l.map((c) => [c.symbol, c.quote.percent_change_24h]));
await step("mapCoins SOL", () => cmc.mapCoins({ symbol: "SOL", limit: 3 }), (m) => m.map((x) => [x.id, x.name, x.rank]));
await step("categories", () => cmc.categories({ limit: 3 }), (c) => c.map((x) => [x.id, x.name, x.market_cap_change]));
await step("trending", () => cmc.trending({ limit: 3 }), (t) => t.map((c) => c.symbol));
await step("gainers", () => cmc.gainersLosers({ limit: 3 }), (t) => t.map((c) => [c.symbol, c.quote.percent_change_24h]));
await step("ohlcv BTC 5d", () => cmc.ohlcv({ symbol: "BTC", count: 6 }), (o) => o.candles.map((c) => [c.time_close.slice(0, 10), c.close]));
await step("pricePerformance BTC", () => cmc.pricePerformance({ symbols: ["BTC"], periods: ["all_time", "30d"] }), (p) => p.map((x) => [x.symbol, x.periods.all_time?.high, x.periods["30d"]?.percent_change]));
await step("globalHistory 3d", () => cmc.globalMetricsHistorical({ count: 3 }), (h) => h.map((p) => [p.timestamp.slice(0, 10), p.btc_dominance]));
await step("liquidations", () => cmc.liquidations(), (l) => ({ t24: l.total_liquidations_24h, long24: l.long_liquidations_24h }));
await step("news", () => cmc.news({ limit: 2 }), (n) => n.map((x) => x.title));
await step("keyInfo", () => cmc.keyInfo(), (k) => k.usage);
