/**
 * Tool definitions the agent can call. Each wraps one or more CoinMarketCap
 * endpoints and returns compact JSON. Descriptions are written for the model:
 * they say when to use the tool and what the numbers mean.
 */
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import * as cmc from "../cmc/endpoints.js";
import { CmcApiError } from "../cmc/http.js";
import { correlationByDate, summarizeCandles } from "./analytics.js";

export interface ToolEvent {
  name: string;
  input: unknown;
  ok: boolean;
  ms: number;
  summary: string;
  /** Structured result for tools the UI can chart. Omitted for large or non-visual results. */
  data?: unknown;
}

/** Tools whose results are small and chartable; the UI renders them under the answer. */
const CHARTABLE = new Set(["analyze_series", "get_global_metrics_history", "get_fear_greed", "get_liquidations", "get_ohlcv"]);

type Emit = (event: ToolEvent) => void;

function json(value: unknown): string {
  return JSON.stringify(value);
}

/** Wrap a tool body with timing, error capture, and event emission. */
function instrument<I>(name: string, emit: Emit, fn: (input: I) => Promise<unknown>) {
  return async (input: I): Promise<string> => {
    const started = performance.now();
    try {
      const result = await fn(input);
      const text = json(result);
      emit({ name, input, ok: true, ms: Math.round(performance.now() - started), summary: `${text.length} chars`, data: CHARTABLE.has(name) ? result : undefined });
      return text;
    } catch (err) {
      const message =
        err instanceof CmcApiError
          ? `CoinMarketCap error ${err.errorCode} on ${err.endpoint}: ${err.message}`
          : err instanceof Error
            ? err.message
            : String(err);
      emit({ name, input, ok: false, ms: Math.round(performance.now() - started), summary: message });
      // Return the error as text so the model can recover (try another endpoint, tell the user).
      return json({ error: message });
    }
  };
}

const symbolList = z
  .array(z.string().min(1).max(12))
  .min(1)
  .max(30)
  .describe("Ticker symbols, e.g. [\"BTC\", \"ETH\"]. Case-insensitive.");

export function createTools(emit: Emit) {
  const searchCoins = betaZodTool({
    name: "search_coins",
    description:
      "Resolve a ticker symbol or slug to CoinMarketCap IDs. Use when a symbol is ambiguous (many tokens share tickers) or when you need a numeric id for other tools. Returns candidates sorted by rank; prefer the lowest rank number unless the user clearly means another project.",
    inputSchema: z.object({
      symbol: z.string().optional().describe("Ticker symbol such as SOL"),
      slug: z.string().optional().describe("URL slug such as solana"),
    }),
    run: instrument("search_coins", emit, (input: { symbol?: string; slug?: string }) =>
      cmc.mapCoins({ symbol: input.symbol?.toUpperCase(), slug: input.slug?.toLowerCase(), limit: 15 }),
    ),
  });

  const getQuotes = betaZodTool({
    name: "get_quotes",
    description:
      "Live price, volume, market cap, dominance and 1h/24h/7d/30d/60d/90d percent changes for specific coins in USD. Use for any question about a named coin's current state. Pass symbols or CMC ids (ids are unambiguous).",
    inputSchema: z.object({
      symbols: symbolList.optional(),
      ids: z.array(z.number().int()).max(30).optional().describe("CoinMarketCap ids, e.g. [1, 1027]"),
    }),
    run: instrument("get_quotes", emit, (input: { symbols?: string[]; ids?: number[] }) =>
      cmc.quotes({ symbols: input.symbols?.map((s) => s.toUpperCase()), ids: input.ids }),
    ),
  });

  const getListings = betaZodTool({
    name: "get_listings",
    description:
      "Ranked list of coins with live market data. Use to answer 'top N by X', to screen the market (filters on market cap and volume), or to get a broad snapshot. Default sort is market cap rank. Each result costs credits per 250 coins, so keep limit modest (<= 200).",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(500).default(30),
      start: z.number().int().min(1).default(1).describe("1-based offset for pagination"),
      sort: z
        .enum(["market_cap", "volume_24h", "percent_change_1h", "percent_change_24h", "percent_change_7d", "date_added", "price"])
        .default("market_cap"),
      sort_dir: z.enum(["asc", "desc"]).optional(),
      market_cap_min: z.number().optional().describe("Only coins with market cap above this USD value"),
      volume_24h_min: z.number().optional().describe("Only coins with 24h volume above this USD value"),
      tag: z.string().optional().describe("Filter by CMC tag such as defi, memes, ai-big-data, layer-1"),
    }),
    run: instrument("get_listings", emit, (input: { limit: number; start: number; sort: cmc.ListingSort; sort_dir?: "asc" | "desc"; market_cap_min?: number; volume_24h_min?: number; tag?: string }) =>
      cmc.listings({
        limit: input.limit,
        start: input.start,
        sort: input.sort,
        sortDir: input.sort_dir,
        marketCapMin: input.market_cap_min,
        volume24hMin: input.volume_24h_min,
        tag: input.tag,
      }),
    ),
  });

  const getCoinInfo = betaZodTool({
    name: "get_coin_info",
    description:
      "Static metadata for coins: description, category, launch date, tags, official links, contract platform. Use when the user asks what a project is or does. Requires CMC ids (use search_coins or get_quotes first).",
    inputSchema: z.object({ ids: z.array(z.number().int()).min(1).max(10) }),
    run: instrument("get_coin_info", emit, (input: { ids: number[] }) => cmc.info(input.ids)),
  });

  const getCategories = betaZodTool({
    name: "get_categories",
    description:
      "All CoinMarketCap sector categories (DeFi, AI, Memes, Layer 1, RWA, Gaming, ...) with aggregate market cap, market cap change, volume, volume change and average price change. Use to answer 'which sectors are moving', 'is capital rotating', or to find a category id for get_category. Returns up to 100 per page.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(500).default(100),
      start: z.number().int().min(1).default(1),
    }),
    run: instrument("get_categories", emit, (input: { limit: number; start: number }) => cmc.categories(input)),
  });

  const getCategory = betaZodTool({
    name: "get_category",
    description:
      "Detail for one category including its constituent coins with live quotes. Use after get_categories to see which coins drive a sector's move.",
    inputSchema: z.object({
      id: z.string().describe("Category id from get_categories"),
      limit: z.number().int().min(1).max(200).default(25),
    }),
    run: instrument("get_category", emit, (input: { id: string; limit: number }) => cmc.category(input)),
  });

  const getTrending = betaZodTool({
    name: "get_trending",
    description:
      "Coins trending on CoinMarketCap by user attention (searches and page views) over 24h, 7d or 30d, with live quotes. Attention is not the same as price; use it to explain narratives and retail interest.",
    inputSchema: z.object({
      time_period: z.enum(["24h", "7d", "30d"]).default("24h"),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    run: instrument("get_trending", emit, (input: { time_period: "24h" | "7d" | "30d"; limit: number }) =>
      cmc.trending({ timePeriod: input.time_period, limit: input.limit }),
    ),
  });

  const getGainersLosers = betaZodTool({
    name: "get_gainers_losers",
    description:
      "Biggest price gainers or losers over 1h, 24h, 7d or 30d among coins with meaningful volume. Use for 'what pumped/dumped today'. Small caps dominate this list; check market cap and volume before treating a move as significant.",
    inputSchema: z.object({
      time_period: z.enum(["1h", "24h", "7d", "30d"]).default("24h"),
      direction: z.enum(["gainers", "losers"]).default("gainers"),
      limit: z.number().int().min(1).max(50).default(20),
    }),
    run: instrument("get_gainers_losers", emit, (input: { time_period: "1h" | "24h" | "7d" | "30d"; direction: "gainers" | "losers"; limit: number }) =>
      cmc.gainersLosers({ timePeriod: input.time_period, direction: input.direction, limit: input.limit }),
    ),
  });

  const getOhlcv = betaZodTool({
    name: "get_ohlcv",
    description:
      "Historical daily or hourly OHLCV candles with market cap for one coin. Use for price history, ranges, and 'what happened over the last N days'. count is the number of periods back from now (add 1 to skip the incomplete current period). Prefer analyze_series when you need statistics rather than raw candles.",
    inputSchema: z.object({
      symbol: z.string().optional(),
      id: z.number().int().optional(),
      time_period: z.enum(["daily", "hourly"]).default("daily"),
      count: z.number().int().min(2).max(365).default(31),
      time_start: z.string().optional().describe("ISO date, exclusive, e.g. 2026-08-01"),
      time_end: z.string().optional().describe("ISO date, inclusive"),
    }),
    run: instrument("get_ohlcv", emit, (input: { symbol?: string; id?: number; time_period: "daily" | "hourly"; count: number; time_start?: string; time_end?: string }) =>
      cmc.ohlcv({
        symbol: input.symbol?.toUpperCase(),
        id: input.id,
        timePeriod: input.time_period,
        count: input.count,
        timeStart: input.time_start,
        timeEnd: input.time_end,
      }),
    ),
  });

  const analyzeSeries = betaZodTool({
    name: "analyze_series",
    description:
      "Fetch daily candles for one or more coins and compute return, max drawdown, annualized volatility, best and worst day, volume trend, and the correlation of each coin's daily returns with the first coin listed. Use for risk comparisons, 'how volatile is X', 'does X move with BTC', and portfolio questions. This is derived analysis the raw API does not provide.",
    inputSchema: z.object({
      symbols: symbolList,
      days: z.number().int().min(7).max(365).default(90),
    }),
    run: instrument("analyze_series", emit, async (input: { symbols: string[]; days: number }) => {
      const series = await Promise.all(
        input.symbols.map(async (s) => {
          const r = await cmc.ohlcv({ symbol: s.toUpperCase(), timePeriod: "daily", count: input.days + 1 });
          return { symbol: r.symbol, candles: r.candles, source: r.source };
        }),
      );
      const base = series[0];
      return series.map((s) => ({
        ...summarizeCandles(s.symbol, s.candles),
        data_source: s.source === "ohlcv" ? "daily OHLCV candles" : "daily closing quotes (intraday high/low not available on this plan)",
        correlation_with_first: s === base ? 1 : correlationByDate(base.candles, s.candles),
      }));
    }),
  });

  const getPricePerformance = betaZodTool({
    name: "get_price_performance",
    description:
      "All-time high and low with dates, plus open/high/low/close and percent change for rolling 24h, 7d, 30d, 90d, 365d and all_time windows. Use for 'how far from ATH', 'ROI since launch', and period returns without fetching candles.",
    inputSchema: z.object({
      symbols: symbolList.optional(),
      ids: z.array(z.number().int()).max(10).optional(),
      periods: z.array(z.enum(["all_time", "yesterday", "24h", "7d", "30d", "90d", "365d"])).optional(),
    }),
    run: instrument("get_price_performance", emit, (input: { symbols?: string[]; ids?: number[]; periods?: cmc.PerfPeriod[] }) =>
      cmc.pricePerformance({ symbols: input.symbols?.map((s) => s.toUpperCase()), ids: input.ids, periods: input.periods }),
    ),
  });

  const getGlobalMetrics = betaZodTool({
    name: "get_global_metrics",
    description:
      "Whole-market snapshot: total market cap and 24h volume with day-over-day change, BTC and ETH dominance with 24h change, altcoin market cap, DeFi and stablecoin caps, derivatives volume. Start here for any 'how is the market' question.",
    inputSchema: z.object({}),
    run: instrument("get_global_metrics", emit, () => cmc.globalMetrics()),
  });

  const getGlobalHistory = betaZodTool({
    name: "get_global_metrics_history",
    description:
      "Historical total market cap, volume, BTC and ETH dominance at daily (or other) intervals. Use to describe trends in dominance or total cap over weeks and months.",
    inputSchema: z.object({
      count: z.number().int().min(2).max(365).default(30),
      interval: z.enum(["daily", "weekly", "monthly", "1h", "6h", "12h"]).default("daily"),
    }),
    run: instrument("get_global_metrics_history", emit, (input: { count: number; interval: string }) =>
      cmc.globalMetricsHistorical({ count: input.count, interval: input.interval }),
    ),
  });

  const getFearGreed = betaZodTool({
    name: "get_fear_greed",
    description:
      "CoinMarketCap Crypto Fear & Greed index (0 = extreme fear, 100 = extreme greed) with classification. Optionally include recent history to describe the trend in sentiment.",
    inputSchema: z.object({
      history_days: z.number().int().min(0).max(90).default(0).describe("0 for latest only, otherwise number of daily points"),
    }),
    run: instrument("get_fear_greed", emit, async (input: { history_days: number }) => {
      const latest = await cmc.fearGreedLatest();
      if (input.history_days > 0) {
        const history = await cmc.fearGreedHistorical(input.history_days);
        return { latest, history };
      }
      return { latest };
    }),
  });

  const getAltcoinSeason = betaZodTool({
    name: "get_altcoin_season",
    description:
      "CoinMarketCap Altcoin Season Index (0-100): above 75 means altcoin season, below 25 means Bitcoin season. Includes yearly high and low. Use with BTC dominance to answer 'is it altseason'.",
    inputSchema: z.object({}),
    run: instrument("get_altcoin_season", emit, () => cmc.altcoinSeason()),
  });

  const getLiquidations = betaZodTool({
    name: "get_liquidations",
    description:
      "Perpetual and futures liquidations across all exchanges: long, short and total notional over rolling 1h, 4h and 24h windows, plus a per-coin breakdown. Use to explain sharp moves (a long squeeze shows as large long liquidations) and to gauge leverage stress.",
    inputSchema: z.object({
      include_by_coin: z.boolean().default(true),
      limit: z.number().int().min(1).max(30).default(10),
    }),
    run: instrument("get_liquidations", emit, async (input: { include_by_coin: boolean; limit: number }) => {
      const total = await cmc.liquidations();
      if (!input.include_by_coin) return { total };
      try {
        const by_coin = await cmc.liquidationsByCrypto(input.limit);
        return { total, by_coin };
      } catch (err) {
        return { total, by_coin_error: err instanceof Error ? err.message : String(err) };
      }
    }),
  });

  const getNews = betaZodTool({
    name: "get_news",
    description:
      "Latest crypto headlines from CoinMarketCap's news feed, optionally filtered to specific coins. Use to attach a plausible catalyst to a price move. Headlines are evidence of narrative, not proof of cause; say so.",
    inputSchema: z.object({
      symbols: z.array(z.string()).max(5).optional(),
      limit: z.number().int().min(1).max(30).default(12),
    }),
    run: instrument("get_news", emit, (input: { symbols?: string[]; limit: number }) =>
      cmc.news({ symbols: input.symbols?.map((s) => s.toUpperCase()), limit: input.limit }),
    ),
  });

  return [
    getGlobalMetrics,
    getFearGreed,
    getAltcoinSeason,
    getQuotes,
    searchCoins,
    getListings,
    getCategories,
    getCategory,
    getTrending,
    getGainersLosers,
    getPricePerformance,
    getOhlcv,
    analyzeSeries,
    getGlobalHistory,
    getLiquidations,
    getNews,
    getCoinInfo,
  ];
}
