/**
 * Typed, compact wrappers around the CoinMarketCap Pro API endpoints Argus uses.
 *
 * Every function returns a trimmed shape (not the raw envelope) so tool results
 * stay small when they are handed to the model. Raw responses are still logged
 * by the HTTP layer for the evidence panel.
 *
 * Endpoints used (all verified against the docs at pro.coinmarketcap.com/llms.txt):
 *   GET /v1/cryptocurrency/map
 *   GET /v3/cryptocurrency/listings/latest
 *   GET /v3/cryptocurrency/quotes/latest
 *   GET /v2/cryptocurrency/info
 *   GET /v1/cryptocurrency/categories
 *   GET /v1/cryptocurrency/category
 *   GET /v1/cryptocurrency/trending/latest
 *   GET /v1/cryptocurrency/trending/gainers-losers
 *   GET /v2/cryptocurrency/ohlcv/historical
 *   GET /v2/cryptocurrency/price-performance-stats/latest
 *   GET /v1/global-metrics/quotes/latest
 *   GET /v1/global-metrics/quotes/historical
 *   GET /v3/fear-and-greed/latest
 *   GET /v3/fear-and-greed/historical
 *   GET /v1/altcoin-season-index/latest
 *   GET /v5/derivatives/liquidations/quotes/latest
 *   GET /v5/derivatives/liquidations/cryptocurrency/list/latest
 *   GET /v1/content/latest
 *   GET /v1/key/info
 */
import { cmcGet, CmcApiError } from "./http.js";

// ---------- shared shapes ----------

export interface Quote {
  price: number | null;
  volume_24h: number | null;
  volume_change_24h?: number | null;
  percent_change_1h: number | null;
  percent_change_24h: number | null;
  percent_change_7d: number | null;
  percent_change_30d?: number | null;
  percent_change_60d?: number | null;
  percent_change_90d?: number | null;
  market_cap: number | null;
  market_cap_dominance?: number | null;
  fully_diluted_market_cap?: number | null;
  last_updated?: string;
}

export interface Coin {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  cmc_rank?: number | null;
  num_market_pairs?: number | null;
  circulating_supply?: number | null;
  total_supply?: number | null;
  max_supply?: number | null;
  date_added?: string;
  tags?: string[];
  platform?: { name?: string; symbol?: string; token_address?: string } | null;
  quote: Quote;
}


type RawQuoteMap = Record<string, Quote & { symbol?: string }> | Array<Quote & { symbol?: string }>;
export interface RawCoin extends Omit<Coin, "quote" | "tags"> {
  quote: RawQuoteMap;
  tags?: Array<string | { name?: string; slug?: string }>;
}

const CONVERT = "USD";

/** Round to a sensible precision so tool results stay small: 2dp for percentages, ~6 significant figures otherwise. */
function num(v: number | null | undefined, kind: "pct" | "usd" | "raw" = "raw"): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (kind === "pct") return Math.round(v * 100) / 100;
  if (Math.abs(v) >= 1e6) return Math.round(v); // caps, volumes, supplies
  if (Math.abs(v) >= 1) return Math.round(v * 10000) / 10000; // prices keep cents and a bit
  return Number(v.toPrecision(5)); // sub-dollar prices keep significant digits
}

/** CMC v2 returns quote as a map keyed by currency; v3 may return an array. Handle both. */
function pickQuote(raw: RawQuoteMap | undefined): Quote {
  const empty: Quote = {
    price: null,
    volume_24h: null,
    percent_change_1h: null,
    percent_change_24h: null,
    percent_change_7d: null,
    market_cap: null,
  };
  if (!raw) return empty;
  const q = Array.isArray(raw)
    ? (raw.find((x) => x.symbol === CONVERT) ?? raw[0])
    : (raw[CONVERT] ?? Object.values(raw)[0]);
  if (!q) return empty;
  return {
    price: num(q.price),
    volume_24h: num(q.volume_24h),
    volume_change_24h: num(q.volume_change_24h, "pct"),
    percent_change_1h: num(q.percent_change_1h, "pct"),
    percent_change_24h: num(q.percent_change_24h, "pct"),
    percent_change_7d: num(q.percent_change_7d, "pct"),
    percent_change_30d: num(q.percent_change_30d, "pct"),
    percent_change_60d: num(q.percent_change_60d, "pct"),
    percent_change_90d: num(q.percent_change_90d, "pct"),
    market_cap: num(q.market_cap),
    market_cap_dominance: num(q.market_cap_dominance, "pct"),
    fully_diluted_market_cap: num(q.fully_diluted_market_cap),
    last_updated: q.last_updated,
  };
}

/** Tags that describe what a project is, as opposed to which VC portfolio lists it. */
const NOISY_TAG = /portfolio|ecosystem|launchpad|-chain$|^bnb|^binance|alameda|paradigm|pantera|coinbase|multicoin|a16z|dragonfly|polychain|sequoia|placeholder|dcg|galaxy|estate|reserve|taxonomy|sec-cftc|made-in|winklevoss|alt-season|commodit|labs$|ventures|capital/i;

export function normalizeCoin(raw: RawCoin): Coin {
  // v3 endpoints return tag objects, v1/v2 return slug strings. Normalize to slugs so
  // tags compare equal across endpoints (used for related-coin matching).
  const tags = raw.tags
    ?.map((t) => (typeof t === "string" ? t : (t.slug ?? t.name ?? "")))
    .map((t) => t.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter((t) => t && !NOISY_TAG.test(t))
    .slice(0, 6);
  return {
    id: raw.id,
    name: raw.name,
    symbol: raw.symbol,
    slug: raw.slug,
    cmc_rank: raw.cmc_rank ?? null,
    circulating_supply: num(raw.circulating_supply),
    max_supply: num(raw.max_supply),
    date_added: raw.date_added?.slice(0, 10),
    tags: tags && tags.length ? tags : undefined,
    platform: raw.platform?.name ? { name: raw.platform.name } : undefined,
    quote: pickQuote(raw.quote),
  };
}

/** Flatten whatever container CMC used (array, id-keyed map, or symbol-keyed map of arrays). */
export function coinsFrom(data: unknown): Coin[] {
  if (Array.isArray(data)) return (data as RawCoin[]).map(normalizeCoin);
  if (data && typeof data === "object") {
    const out: Coin[] = [];
    for (const v of Object.values(data as Record<string, RawCoin | RawCoin[]>)) {
      if (Array.isArray(v)) out.push(...v.map(normalizeCoin));
      else if (v && typeof v === "object" && "id" in v) out.push(normalizeCoin(v));
    }
    return out;
  }
  return [];
}

// ---------- cryptocurrency ----------

export interface MapEntry {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  rank?: number;
  is_active?: number;
  first_historical_data?: string;
  platform?: { name?: string; symbol?: string; token_address?: string } | null;
}

/** Resolve symbols or slugs to CMC IDs. Symbols can collide, so results include rank to disambiguate. */
export async function mapCoins(opts: { symbol?: string; slug?: string; limit?: number }): Promise<MapEntry[]> {
  const res = await cmcGet<MapEntry[]>("/v1/cryptocurrency/map", {
    symbol: opts.symbol,
    slug: opts.slug,
    limit: opts.limit ?? 20,
    sort: "cmc_rank",
    listing_status: "active",
  });
  return res.data.map((m) => ({
    id: m.id,
    name: m.name,
    symbol: m.symbol,
    slug: m.slug,
    rank: m.rank,
    is_active: m.is_active,
    first_historical_data: m.first_historical_data,
    platform: m.platform ? { name: m.platform.name, symbol: m.platform.symbol } : null,
  }));
}

export type ListingSort =
  | "market_cap"
  | "volume_24h"
  | "percent_change_1h"
  | "percent_change_24h"
  | "percent_change_7d"
  | "date_added"
  | "price";

const SORT_FIELD: Record<ListingSort, (c: Coin) => number> = {
  market_cap: (c) => c.quote.market_cap ?? 0,
  volume_24h: (c) => c.quote.volume_24h ?? 0,
  percent_change_1h: (c) => c.quote.percent_change_1h ?? 0,
  percent_change_24h: (c) => c.quote.percent_change_24h ?? 0,
  percent_change_7d: (c) => c.quote.percent_change_7d ?? 0,
  price: (c) => c.quote.price ?? 0,
  date_added: (c) => (c.date_added ? Date.parse(c.date_added) : 0),
};

export async function listings(opts: {
  start?: number;
  limit?: number;
  sort?: ListingSort;
  sortDir?: "asc" | "desc";
  marketCapMin?: number;
  volume24hMin?: number;
  tag?: string;
}): Promise<Coin[]> {
  const sort = opts.sort ?? "market_cap";
  const limit = opts.limit ?? 50;
  const hasFilter = opts.marketCapMin !== undefined || opts.volume24hMin !== undefined;

  // API quirk (observed 2026-09): a non-market_cap sort combined with market_cap_min /
  // volume_24h_min returns an empty list. Fetch the filtered universe sorted by market cap
  // and sort locally instead. Costs one extra credit per 250 rows, which is acceptable.
  if (hasFilter && sort !== "market_cap") {
    const res = await cmcGet<unknown>("/v3/cryptocurrency/listings/latest", {
      start: 1,
      limit: Math.min(500, Math.max(limit * 4, 250)),
      sort: "market_cap",
      market_cap_min: opts.marketCapMin,
      volume_24h_min: opts.volume24hMin,
      tag: opts.tag,
      convert: CONVERT,
    });
    const key = SORT_FIELD[sort];
    const dir = opts.sortDir === "asc" ? 1 : -1;
    const sorted = coinsFrom(res.data).sort((a, b) => (key(a) - key(b)) * dir);
    const start = (opts.start ?? 1) - 1;
    return sorted.slice(start, start + limit);
  }

  const res = await cmcGet<unknown>("/v3/cryptocurrency/listings/latest", {
    start: opts.start ?? 1,
    limit,
    sort,
    sort_dir: opts.sortDir,
    market_cap_min: opts.marketCapMin,
    volume_24h_min: opts.volume24hMin,
    tag: opts.tag,
    convert: CONVERT,
  });
  return coinsFrom(res.data);
}

/**
 * Symbol lookups return every asset that shares the ticker (dozens for BTC).
 * Keep the best-ranked active asset per symbol, which is what a user means
 * when they type "SOL". Ids and slugs are already unique, so they pass through.
 */
export function bestPerSymbol(coins: Coin[], raw: unknown): Coin[] {
  const active = new Set<number>();
  if (Array.isArray(raw)) for (const r of raw as Array<{ id: number; is_active?: number }>) if (r.is_active !== 0) active.add(r.id);
  const best = new Map<string, Coin>();
  for (const c of coins) {
    if (active.size && !active.has(c.id)) continue;
    const key = c.symbol.toUpperCase();
    const cur = best.get(key);
    const rank = c.cmc_rank ?? Number.MAX_SAFE_INTEGER;
    const curRank = cur?.cmc_rank ?? Number.MAX_SAFE_INTEGER;
    if (!cur || rank < curRank) best.set(key, c);
  }
  return [...best.values()];
}

export async function quotes(opts: { ids?: number[]; symbols?: string[]; slugs?: string[] }): Promise<Coin[]> {
  const res = await cmcGet<unknown>("/v3/cryptocurrency/quotes/latest", {
    id: opts.ids,
    symbol: opts.symbols,
    slug: opts.slugs,
    convert: CONVERT,
    skip_invalid: true,
  });
  const coins = coinsFrom(res.data);
  return opts.symbols?.length && !opts.ids?.length && !opts.slugs?.length ? bestPerSymbol(coins, res.data) : coins;
}

export interface CoinInfo {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  category?: string;
  description?: string;
  date_launched?: string | null;
  tags?: string[];
  urls?: Record<string, string[]>;
  platform?: { name?: string; symbol?: string; token_address?: string } | null;
}

export async function info(ids: number[]): Promise<CoinInfo[]> {
  const res = await cmcGet<Record<string, RawInfo>>("/v2/cryptocurrency/info", { id: ids, aux: "urls,logo,description,tags,platform,date_added" });
  return Object.values(res.data).map((c) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol,
    slug: c.slug,
    category: c.category,
    description: c.description ? c.description.slice(0, 600) : undefined,
    date_launched: c.date_launched ?? null,
    tags: c.tags?.filter((t) => !NOISY_TAG.test(t)).slice(0, 10),
    urls: c.urls
      ? Object.fromEntries(Object.entries(c.urls).filter(([, v]) => Array.isArray(v) && v.length > 0).map(([k, v]) => [k, v.slice(0, 2)]))
      : undefined,
    platform: c.platform ? { name: c.platform.name, symbol: c.platform.symbol, token_address: c.platform.token_address } : null,
  }));
}
interface RawInfo extends Omit<CoinInfo, "urls"> {
  urls?: Record<string, string[]>;
}

export interface Category {
  id: string;
  name: string;
  title?: string;
  description?: string;
  num_tokens?: number;
  avg_price_change?: number;
  market_cap?: number;
  market_cap_change?: number;
  volume?: number;
  volume_change?: number;
  last_updated?: string;
}

export async function categories(opts: { start?: number; limit?: number }): Promise<Category[]> {
  const res = await cmcGet<Category[]>("/v1/cryptocurrency/categories", {
    start: opts.start ?? 1,
    limit: opts.limit ?? 100,
  });
  return res.data.map((c) => ({
    id: c.id,
    name: c.name,
    num_tokens: c.num_tokens,
    avg_price_change: num(c.avg_price_change, "pct") ?? undefined,
    market_cap: num(c.market_cap) ?? undefined,
    market_cap_change: num(c.market_cap_change, "pct") ?? undefined,
    volume: num(c.volume) ?? undefined,
    volume_change: num(c.volume_change, "pct") ?? undefined,
  }));
}

export async function category(opts: { id: string; limit?: number; start?: number }): Promise<Category & { coins: Coin[] }> {
  const res = await cmcGet<Category & { coins: RawCoin[] }>("/v1/cryptocurrency/category", {
    id: opts.id,
    start: opts.start ?? 1,
    limit: opts.limit ?? 25,
    convert: CONVERT,
  });
  const c = res.data;
  return {
    id: c.id,
    name: c.name,
    title: c.title,
    description: c.description?.slice(0, 400),
    num_tokens: c.num_tokens,
    avg_price_change: c.avg_price_change,
    market_cap: c.market_cap,
    market_cap_change: c.market_cap_change,
    volume: c.volume,
    volume_change: c.volume_change,
    last_updated: c.last_updated,
    coins: coinsFrom(c.coins),
  };
}

export async function trending(opts: { timePeriod?: "24h" | "7d" | "30d"; limit?: number }): Promise<Coin[]> {
  const res = await cmcGet<unknown>("/v1/cryptocurrency/trending/latest", {
    time_period: opts.timePeriod ?? "24h",
    limit: opts.limit ?? 20,
    convert: CONVERT,
  });
  return coinsFrom(res.data);
}

export async function gainersLosers(opts: {
  timePeriod?: "1h" | "24h" | "7d" | "30d";
  direction?: "gainers" | "losers";
  limit?: number;
}): Promise<Coin[]> {
  const timePeriod = opts.timePeriod ?? "24h";
  try {
    const res = await cmcGet<unknown>("/v1/cryptocurrency/trending/gainers-losers", {
      time_period: timePeriod,
      sort: "percent_change_24h",
      sort_dir: opts.direction === "losers" ? "asc" : "desc",
      limit: opts.limit ?? 20,
      convert: CONVERT,
    });
    return coinsFrom(res.data);
  } catch (err) {
    // Basic plan fallback: screen the liquid universe from listings and sort locally.
    if (err instanceof CmcApiError && err.errorCode === PLAN_LIMIT_ERROR) {
      const sort: ListingSort = timePeriod === "1h" ? "percent_change_1h" : timePeriod === "7d" ? "percent_change_7d" : "percent_change_24h";
      return listings({ limit: opts.limit ?? 20, sort, sortDir: opts.direction === "losers" ? "asc" : "desc", volume24hMin: 5_000_000, marketCapMin: 50_000_000 });
    }
    throw err;
  }
}

export interface Candle {
  time_open: string;
  time_close: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  market_cap: number;
}

export interface Series {
  id: number;
  name: string;
  symbol: string;
  candles: Candle[];
  /** "ohlcv" for true candles, "quotes_historical" when built from daily closes (Basic plan fallback). */
  source: "ohlcv" | "quotes_historical";
}

/**
 * Daily historical quotes (price, volume, market cap at each UTC midnight).
 * Available on every plan including Basic, so it is the fallback when OHLCV is not.
 */
export async function quotesHistorical(opts: { id?: number; symbol?: string; count?: number; interval?: string; timeStart?: string; timeEnd?: string }): Promise<Series> {
  interface RawPoint {
    timestamp: string;
    quote: Record<string, { price: number; volume_24h: number; market_cap: number; timestamp: string }>;
  }
  interface RawAsset {
    id: number;
    name: string;
    symbol: string;
    is_active?: number;
    quotes: RawPoint[];
  }
  const res = await cmcGet<Record<string, RawAsset | RawAsset[]> | RawAsset>("/v3/cryptocurrency/quotes/historical", {
    id: opts.id,
    symbol: opts.symbol,
    count: opts.count ?? 30,
    interval: opts.interval ?? "daily",
    time_start: opts.timeStart,
    time_end: opts.timeEnd,
    convert: CONVERT,
    skip_invalid: true,
  });
  let asset: RawAsset | undefined;
  if (res.data && "quotes" in res.data) asset = res.data as RawAsset;
  else {
    const candidates: RawAsset[] = [];
    for (const v of Object.values(res.data as Record<string, RawAsset | RawAsset[]>)) {
      if (Array.isArray(v)) candidates.push(...v);
      else candidates.push(v);
    }
    // Symbol lookups can return several assets; keep the active one with the most data.
    asset = candidates.filter((c) => c.is_active !== 0).sort((a, b) => b.quotes.length - a.quotes.length)[0] ?? candidates[0];
  }
  if (!asset) throw new Error("No historical quotes returned");
  return {
    id: asset.id,
    name: asset.name,
    symbol: asset.symbol,
    source: "quotes_historical",
    candles: asset.quotes.map((p) => {
      const q = p.quote[CONVERT] ?? Object.values(p.quote)[0];
      return {
        time_open: p.timestamp,
        time_close: p.timestamp,
        open: q.price,
        high: q.price,
        low: q.price,
        close: q.price,
        volume: q.volume_24h,
        market_cap: q.market_cap,
      };
    }),
  };
}

const PLAN_LIMIT_ERROR = 1006;

/**
 * Daily closing prices for many coins in as few calls as possible (batches of 100 ids).
 * Used for the sparkline column on the Explore screen. 1 credit per 100 points.
 */
export async function sparklines(ids: number[], count = 8): Promise<Map<number, number[]>> {
  interface RawAsset {
    id: number;
    quotes: Array<{ quote: Record<string, { price: number }> }>;
  }
  const out = new Map<number, number[]>();
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const res = await cmcGet<Record<string, RawAsset | RawAsset[]>>("/v3/cryptocurrency/quotes/historical", {
      id: batch,
      count,
      interval: "daily",
      convert: CONVERT,
      skip_invalid: true,
    });
    for (const v of Object.values(res.data)) {
      const assets = Array.isArray(v) ? v : [v];
      for (const a of assets) {
        if (!a || !Array.isArray(a.quotes)) continue;
        out.set(
          a.id,
          a.quotes.map((q) => num((q.quote[CONVERT] ?? Object.values(q.quote)[0])?.price) ?? 0),
        );
      }
    }
  }
  return out;
}

export async function ohlcv(opts: {
  id?: number;
  symbol?: string;
  timePeriod?: "daily" | "hourly";
  count?: number;
  interval?: string;
  timeStart?: string;
  timeEnd?: string;
}): Promise<Series> {
  try {
    return await ohlcvStrict(opts);
  } catch (err) {
    // Basic plan cannot call OHLCV. Daily closes from quotes/historical are close enough for
    // returns, drawdown, volatility and correlation, so degrade gracefully instead of failing.
    if (err instanceof CmcApiError && err.errorCode === PLAN_LIMIT_ERROR) {
      const hourly = (opts.timePeriod ?? "daily") === "hourly";
      return quotesHistorical({
        id: opts.id,
        symbol: opts.symbol,
        count: opts.count,
        interval: hourly ? "1h" : "daily",
        timeStart: opts.timeStart,
        timeEnd: opts.timeEnd,
      });
    }
    throw err;
  }
}

async function ohlcvStrict(opts: {
  id?: number;
  symbol?: string;
  timePeriod?: "daily" | "hourly";
  count?: number;
  interval?: string;
  timeStart?: string;
  timeEnd?: string;
}): Promise<Series> {
  interface RawOhlcv {
    id: number;
    name: string;
    symbol: string;
    quotes: Array<{ time_open: string; time_close: string; quote: Record<string, Omit<Candle, "time_open" | "time_close">> }>;
  }
  const res = await cmcGet<RawOhlcv | Record<string, RawOhlcv | RawOhlcv[]>>("/v2/cryptocurrency/ohlcv/historical", {
    id: opts.id,
    symbol: opts.symbol,
    time_period: opts.timePeriod ?? "daily",
    count: opts.count ?? 30,
    interval: opts.interval,
    time_start: opts.timeStart,
    time_end: opts.timeEnd,
    convert: CONVERT,
    skip_invalid: true,
  });
  // Single-asset responses return the object directly; multi-asset are wrapped in a map.
  let raw: RawOhlcv | undefined;
  if (res.data && "quotes" in res.data) raw = res.data as RawOhlcv;
  else {
    const first = Object.values(res.data as Record<string, RawOhlcv | RawOhlcv[]>)[0];
    raw = Array.isArray(first) ? first[0] : first;
  }
  if (!raw) throw new Error("No OHLCV data returned");
  return {
    id: raw.id,
    name: raw.name,
    symbol: raw.symbol,
    source: "ohlcv",
    candles: raw.quotes.map((q) => {
      const c = q.quote[CONVERT] ?? Object.values(q.quote)[0];
      return {
        time_open: q.time_open,
        time_close: q.time_close,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        market_cap: c.market_cap,
      };
    }),
  };
}

export type PerfPeriod = "all_time" | "yesterday" | "24h" | "7d" | "30d" | "90d" | "365d";

export interface PerformanceStats {
  id: number;
  name: string;
  symbol: string;
  periods: Record<
    string,
    {
      open: number;
      high: number;
      high_timestamp?: string | null;
      low: number;
      low_timestamp?: string | null;
      close: number;
      percent_change: number;
      price_change: number;
    }
  >;
}

export async function pricePerformance(opts: { ids?: number[]; symbols?: string[]; periods?: PerfPeriod[] }): Promise<PerformanceStats[]> {
  interface RawPerf {
    id: number;
    name: string;
    symbol: string;
    periods: Record<string, { quote: Record<string, PerformanceStats["periods"][string]> }>;
  }
  const res = await cmcGet<Record<string, RawPerf | RawPerf[]>>("/v2/cryptocurrency/price-performance-stats/latest", {
    id: opts.ids,
    symbol: opts.symbols,
    time_period: opts.periods ?? ["all_time", "24h", "7d", "30d", "90d", "365d"],
    convert: CONVERT,
    skip_invalid: true,
  });
  const items: RawPerf[] = [];
  for (const v of Object.values(res.data)) {
    if (Array.isArray(v)) items.push(...v);
    else items.push(v);
  }
  return items.map((p) => ({
    id: p.id,
    name: p.name,
    symbol: p.symbol,
    periods: Object.fromEntries(
      Object.entries(p.periods).map(([period, v]) => {
        const q = v.quote[CONVERT] ?? Object.values(v.quote)[0];
        return [
          period,
          {
            open: q.open,
            high: q.high,
            high_timestamp: q.high_timestamp ?? null,
            low: q.low,
            low_timestamp: q.low_timestamp ?? null,
            close: q.close,
            percent_change: q.percent_change,
            price_change: q.price_change,
          },
        ];
      }),
    ),
  }));
}

// ---------- global metrics ----------

export interface GlobalMetrics {
  btc_dominance: number;
  eth_dominance: number;
  btc_dominance_24h_percentage_change?: number;
  eth_dominance_24h_percentage_change?: number;
  active_cryptocurrencies?: number;
  active_exchanges?: number;
  active_market_pairs?: number;
  defi_market_cap?: number;
  defi_volume_24h?: number;
  stablecoin_market_cap?: number;
  stablecoin_volume_24h?: number;
  derivatives_volume_24h?: number;
  total_market_cap: number;
  total_volume_24h: number;
  altcoin_market_cap?: number;
  altcoin_volume_24h?: number;
  total_market_cap_yesterday_percentage_change?: number;
  total_volume_24h_yesterday_percentage_change?: number;
  last_updated?: string;
}

export async function globalMetrics(): Promise<GlobalMetrics> {
  interface Raw extends Omit<GlobalMetrics, "total_market_cap" | "total_volume_24h" | "altcoin_market_cap" | "altcoin_volume_24h" | "total_market_cap_yesterday_percentage_change" | "total_volume_24h_yesterday_percentage_change"> {
    quote: Record<string, {
      total_market_cap: number;
      total_volume_24h: number;
      altcoin_market_cap?: number;
      altcoin_volume_24h?: number;
      total_market_cap_yesterday_percentage_change?: number;
      total_volume_24h_yesterday_percentage_change?: number;
      last_updated?: string;
    }>;
  }
  const res = await cmcGet<Raw>("/v1/global-metrics/quotes/latest", { convert: CONVERT });
  const d = res.data;
  const q = d.quote[CONVERT] ?? Object.values(d.quote)[0];
  return {
    btc_dominance: d.btc_dominance,
    eth_dominance: d.eth_dominance,
    btc_dominance_24h_percentage_change: d.btc_dominance_24h_percentage_change,
    eth_dominance_24h_percentage_change: d.eth_dominance_24h_percentage_change,
    active_cryptocurrencies: d.active_cryptocurrencies,
    active_exchanges: d.active_exchanges,
    active_market_pairs: d.active_market_pairs,
    defi_market_cap: d.defi_market_cap,
    defi_volume_24h: d.defi_volume_24h,
    stablecoin_market_cap: d.stablecoin_market_cap,
    stablecoin_volume_24h: d.stablecoin_volume_24h,
    derivatives_volume_24h: d.derivatives_volume_24h,
    total_market_cap: q.total_market_cap,
    total_volume_24h: q.total_volume_24h,
    altcoin_market_cap: q.altcoin_market_cap,
    altcoin_volume_24h: q.altcoin_volume_24h,
    total_market_cap_yesterday_percentage_change: q.total_market_cap_yesterday_percentage_change,
    total_volume_24h_yesterday_percentage_change: q.total_volume_24h_yesterday_percentage_change,
    last_updated: q.last_updated ?? d.last_updated,
  };
}

export interface GlobalPoint {
  timestamp: string;
  btc_dominance: number;
  eth_dominance: number;
  total_market_cap: number;
  total_volume_24h: number;
  altcoin_market_cap?: number;
}

export async function globalMetricsHistorical(opts: { count?: number; interval?: string; timeStart?: string; timeEnd?: string }): Promise<GlobalPoint[]> {
  interface Raw {
    quotes: Array<{ timestamp: string; btc_dominance: number; eth_dominance: number; quote: Record<string, { total_market_cap: number; total_volume_24h: number; altcoin_market_cap?: number }> }>;
  }
  const res = await cmcGet<Raw>("/v1/global-metrics/quotes/historical", {
    count: opts.count ?? 30,
    interval: opts.interval ?? "daily",
    time_start: opts.timeStart,
    time_end: opts.timeEnd,
    convert: CONVERT,
  });
  return res.data.quotes.map((p) => {
    const q = p.quote[CONVERT] ?? Object.values(p.quote)[0];
    return {
      timestamp: p.timestamp,
      btc_dominance: p.btc_dominance,
      eth_dominance: p.eth_dominance,
      total_market_cap: q.total_market_cap,
      total_volume_24h: q.total_volume_24h,
      altcoin_market_cap: q.altcoin_market_cap,
    };
  });
}

export interface FearGreed {
  value: number;
  value_classification: string;
  timestamp?: string;
}

export async function fearGreedLatest(): Promise<FearGreed> {
  const res = await cmcGet<{ value: number; value_classification: string; update_time?: string; timestamp?: string }>("/v3/fear-and-greed/latest");
  return { value: res.data.value, value_classification: res.data.value_classification, timestamp: res.data.update_time ?? res.data.timestamp };
}

function toIso(ts: string | number | undefined): string | undefined {
  if (ts === undefined || ts === null) return undefined;
  const s = String(ts);
  if (/^\d{9,13}$/.test(s)) return new Date(Number(s) * (s.length <= 10 ? 1000 : 1)).toISOString();
  return s;
}

export async function fearGreedHistorical(limit = 30): Promise<FearGreed[]> {
  const res = await cmcGet<Array<{ value: number; value_classification: string; timestamp: string | number }>>("/v3/fear-and-greed/historical", { limit });
  // CMC returns epoch seconds as strings here; normalize to ISO like every other endpoint.
  return res.data.map((d) => ({ value: d.value, value_classification: d.value_classification, timestamp: toIso(d.timestamp) }));
}

export interface AltcoinSeason {
  altcoin_index: number;
  altcoin_marketcap: number;
  snapshot_time: string;
  yearly_high?: number;
  yearly_high_date?: string;
  yearly_low?: number;
  yearly_low_date?: string;
}

export async function altcoinSeason(): Promise<AltcoinSeason> {
  const res = await cmcGet<AltcoinSeason>("/v1/altcoin-season-index/latest");
  return res.data;
}

// ---------- derivatives ----------

export interface Liquidations {
  symbol: string;
  total_liquidations_1h: number;
  long_liquidations_1h: number;
  short_liquidations_1h: number;
  total_liquidations_4h: number;
  long_liquidations_4h: number;
  short_liquidations_4h: number;
  total_liquidations_24h: number;
  long_liquidations_24h: number;
  short_liquidations_24h: number;
  last_updated?: string;
}

export async function liquidations(): Promise<Liquidations> {
  const res = await cmcGet<{ quotes: Liquidations[] }>("/v5/derivatives/liquidations/quotes/latest", { convert: CONVERT });
  const q = res.data.quotes.find((x) => x.symbol === CONVERT) ?? res.data.quotes[0];
  if (!q) throw new Error("No liquidation data returned");
  return q;
}

export interface CoinLiquidations {
  id: number;
  symbol: string;
  name: string;
  total_1h: number;
  long_1h: number;
  short_1h: number;
  total_4h: number;
  long_4h: number;
  short_4h: number;
  total_24h: number;
  long_24h: number;
  short_24h: number;
}

export async function liquidationsByCrypto(limit = 15): Promise<CoinLiquidations[]> {
  interface RawRow {
    crypto_id: number;
    symbol: string;
    name: string;
    quotes: Array<Record<string, number | string>>;
  }
  const res = await cmcGet<{ cryptocurrencies?: RawRow[] } | RawRow[]>("/v5/derivatives/liquidations/cryptocurrency/list/latest", { limit, convert: CONVERT });
  const rows: RawRow[] = Array.isArray(res.data) ? res.data : (res.data.cryptocurrencies ?? []);
  const n = (q: Record<string, number | string>, k: string) => (typeof q[k] === "number" ? (q[k] as number) : 0);
  return rows.slice(0, limit).map((r) => {
    const q = r.quotes?.find((x) => x.symbol === CONVERT) ?? r.quotes?.[0] ?? {};
    return {
      id: r.crypto_id,
      symbol: r.symbol,
      name: r.name,
      total_1h: Math.round(n(q, "total_liquidations_1h")),
      long_1h: Math.round(n(q, "long_liquidations_1h")),
      short_1h: Math.round(n(q, "short_liquidations_1h")),
      total_4h: Math.round(n(q, "total_liquidations_4h")),
      long_4h: Math.round(n(q, "long_liquidations_4h")),
      short_4h: Math.round(n(q, "short_liquidations_4h")),
      total_24h: Math.round(n(q, "total_liquidations_24h")),
      long_24h: Math.round(n(q, "long_liquidations_24h")),
      short_24h: Math.round(n(q, "short_liquidations_24h")),
    };
  });
}

// ---------- content ----------

export interface NewsItem {
  title: string;
  subtitle?: string;
  source_name?: string;
  source_url?: string;
  released_at?: string;
  assets?: string[];
}

export async function news(opts: { symbols?: string[]; limit?: number; newsType?: "news" | "community" | "alexandria" | "all" }): Promise<NewsItem[]> {
  interface Raw extends Omit<NewsItem, "assets"> {
    assets?: Array<{ symbol: string }>;
  }
  const res = await cmcGet<Raw[]>("/v1/content/latest", {
    symbol: opts.symbols,
    limit: opts.limit ?? 15,
    news_type: opts.newsType ?? "news",
    language: "en",
  });
  return res.data.map((n) => ({
    title: n.title,
    subtitle: n.subtitle?.slice(0, 240),
    source_name: n.source_name,
    source_url: n.source_url,
    released_at: n.released_at,
    assets: n.assets?.map((a) => a.symbol).slice(0, 6),
  }));
}

// ---------- tools ----------

export interface KeyInfo {
  plan: { credit_limit_monthly?: number; credit_limit_monthly_reset?: string; rate_limit_minute?: number };
  usage: {
    current_minute?: { requests_made?: number; requests_left?: number };
    current_day?: { credits_used?: number; credits_left?: number };
    current_month?: { credits_used?: number; credits_left?: number };
  };
}

export async function keyInfo(): Promise<KeyInfo> {
  const res = await cmcGet<KeyInfo>("/v1/key/info");
  return res.data;
}
