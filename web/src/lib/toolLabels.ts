/** Plain-English labels for tool calls, so the working rail reads like a person narrating. */
type Input = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map(String).join(", ") : "");
const num = (v: unknown) => (typeof v === "number" ? String(v) : "");

export function toolLabel(name: string, input: unknown): string {
  const i = (input ?? {}) as Input;
  switch (name) {
    case "get_global_metrics": return "Reading the whole-market snapshot";
    case "get_fear_greed": return i.history_days ? `Checking Fear & Greed, last ${num(i.history_days)} days` : "Checking Fear & Greed";
    case "get_altcoin_season": return "Checking the Altcoin Season Index";
    case "get_quotes": return i.symbols ? `Quoting ${list(i.symbols)}` : "Quoting coins by id";
    case "search_coins": return `Resolving ${str(i.symbol) || str(i.slug)}`;
    case "get_listings": return `Screening the top ${num(i.limit) || "50"} by ${str(i.sort) || "market cap"}`;
    case "get_categories": return "Scanning sector categories";
    case "get_category": return "Opening a sector's constituents";
    case "get_trending": return `Checking what's trending (${str(i.time_period) || "24h"})`;
    case "get_gainers_losers": return `Finding ${str(i.direction) || "gainers"} over ${str(i.time_period) || "24h"}`;
    case "get_price_performance": return `Checking ATH distance and period returns${i.symbols ? ` for ${list(i.symbols)}` : ""}`;
    case "get_ohlcv": return `Pulling ${num(i.count) || ""} ${str(i.time_period) || "daily"} candles${i.symbol ? ` for ${str(i.symbol)}` : ""}`;
    case "analyze_series": return `Computing risk for ${list(i.symbols)} over ${num(i.days) || "90"} days`;
    case "get_global_metrics_history": return `Loading ${num(i.count) || "30"} ${str(i.interval) || "daily"} points of dominance history`;
    case "get_liquidations": return "Reading liquidations";
    case "get_news": return i.symbols ? `Scanning headlines for ${list(i.symbols)}` : "Scanning headlines";
    case "get_coin_info": return "Reading project info";
    default: return name.replace(/_/g, " ");
  }
}
