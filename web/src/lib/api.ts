/** Typed fetch helpers for the Argus JSON API. Shapes mirror src/services/market.ts on the server. */

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
  circulating_supply?: number | null;
  max_supply?: number | null;
  date_added?: string;
  tags?: string[];
  platform?: { name?: string } | null;
  quote: Quote;
}
export interface CoinRow extends Coin {
  sparkline: number[];
}
export interface GlobalMetrics {
  btc_dominance: number;
  eth_dominance: number;
  btc_dominance_24h_percentage_change?: number;
  eth_dominance_24h_percentage_change?: number;
  active_cryptocurrencies?: number;
  active_exchanges?: number;
  defi_market_cap?: number;
  stablecoin_market_cap?: number;
  derivatives_volume_24h?: number;
  total_market_cap: number;
  total_volume_24h: number;
  altcoin_market_cap?: number;
  total_market_cap_yesterday_percentage_change?: number;
  total_volume_24h_yesterday_percentage_change?: number;
  last_updated?: string;
}
export interface FearGreed { value: number; value_classification: string; timestamp?: string }
export interface AltcoinSeason { altcoin_index: number; altcoin_marketcap: number; snapshot_time: string; yearly_high?: number; yearly_low?: number }
export interface Liquidations {
  total_liquidations_1h: number; long_liquidations_1h: number; short_liquidations_1h: number;
  total_liquidations_4h: number; long_liquidations_4h: number; short_liquidations_4h: number;
  total_liquidations_24h: number; long_liquidations_24h: number; short_liquidations_24h: number;
}
export interface Overview { global: GlobalMetrics; fearGreed: FearGreed; altcoinSeason: AltcoinSeason; liquidations: Liquidations | null; updatedAt: string }
export interface GlobalPoint { timestamp: string; btc_dominance: number; eth_dominance: number; total_market_cap: number; total_volume_24h: number; altcoin_market_cap?: number }
export interface History { global: GlobalPoint[]; fearGreed: FearGreed[] }
export interface Movers { gainers: Coin[]; losers: Coin[] }
export interface Sector { id: string; name: string; num_tokens?: number; avg_price_change?: number; market_cap?: number; market_cap_change?: number; volume?: number; volume_change?: number }
export interface Candle { time_open: string; time_close: string; open: number; high: number; low: number; close: number; volume: number; market_cap: number }
export type Range = "24h" | "7d" | "30d" | "90d" | "1y";
export interface CoinHistory { range: Range; source: "ohlcv" | "quotes_historical"; candles: Candle[] }
export interface SeriesStats {
  symbol: string; days: number; first_close: number; last_close: number; total_return_pct: number; max_drawdown_pct: number;
  annualized_volatility_pct: number; best_day: { date: string; return_pct: number } | null; worst_day: { date: string; return_pct: number } | null;
  avg_daily_volume: number; volume_trend_ratio: number | null;
}
export interface CoinInfo { id: number; name: string; symbol: string; category?: string; description?: string; date_launched?: string | null; tags?: string[]; urls?: Record<string, string[]>; platform?: { name?: string; symbol?: string; token_address?: string } | null }
export interface PerformancePeriod { open: number; high: number; high_timestamp?: string | null; low: number; low_timestamp?: string | null; close: number; percent_change: number; price_change: number }
export interface PerformanceStats { id: number; symbol: string; periods: Record<string, PerformancePeriod> }
export interface CoinDetail { coin: Coin; info: CoinInfo | null; performance: PerformanceStats | null; risk: (SeriesStats & { correlation_with_btc: number | null; source: "ohlcv" | "quotes_historical" }) | null }
export interface CompareResult { days: number; stats: Array<SeriesStats & { source: string }>; normalized: Array<{ date: string; values: Record<string, number | null> }>; correlation: Array<{ a: string; b: string; r: number | null }> }
export interface MapEntry { id: number; name: string; symbol: string; slug: string; rank?: number }
export interface Capability { name: string; endpoint: string; ok: boolean; note?: string }
export interface Automation { automationPaused: boolean; analystModel: string; automationModel: string }
export interface Status {
  model: string; automationModel?: string; automationPaused?: boolean; keyless: boolean;
  plan: { credit_limit_monthly?: number; credit_limit_monthly_reset?: string; rate_limit_minute?: number } | null;
  usage: { current_minute?: { requests_made?: number; requests_left?: number }; current_day?: { credits_used?: number; credits_left?: number }; current_month?: { credits_used?: number; credits_left?: number } } | null;
  capabilities: Capability[];
  brief: { generatedAt: string; calls: number; credits: number; durationMs: number } | null;
  checkedAt: string;
}
export interface Explanation {
  symbol: string; name: string; id: number; window: "1h" | "24h" | "7d";
  coin_change_pct: number; btc_change_pct: number; total_market_change_pct: number | null;
  beta_to_btc: number | null; correlation_to_btc: number | null; market_component_pct: number | null;
  sector: { name: string; change_pct: number; excess_pct: number } | null; coin_specific_pct: number | null;
  leverage: { coin_liquidations_usd: number | null; long_share_pct: number | null; market_liquidations_24h_usd: number | null; market_long_share_pct: number | null } | null;
  read: "market beta" | "sector rotation" | "coin-specific" | "mixed"; read_text: string;
  price: number | null; market_cap: number | null; volume_24h: number | null; volume_change_24h_pct: number | null; computed_at: string; caveats: string[];
}
export interface Finding {
  id: string; fingerprint: string; kind: string; title: string; detail: string;
  subject: { type: "coin"; id: number; symbol: string; name: string } | { type: "sector"; name: string } | { type: "market" };
  severity: 1 | 2 | 3; metric: number; observedAt: string; summary: string; question: string; attribution: Explanation | null; calls: number; credits: number; investigatedAt: string;
}
export interface Findings { findings: Finding[]; lastScanAt: string | null; nextScanAt: string | null; intervalMinutes: number; investigationsToday: number; dailyCap: number; scanning: boolean; paused?: boolean; model?: string }
export interface Story {
  id: string; type: "finding" | "brief"; kicker: string; headline: string; deck: string; body: string;
  accent: "gold" | "up" | "down" | "blue";
  subject: { type: "coin"; id: number; symbol: string } | { type: "topic"; key: string } | { type: "market" };
  question: string; at: string; severity?: number; attribution?: Explanation | null; meta?: { calls: number; credits: number };
}
export interface Stream { stories: Story[]; lastScanAt: string | null; intervalMinutes: number; scanning: boolean }
export interface Brief { text: string; generatedAt: string; model: string; calls: number; credits: number; durationMs: number }
export interface CallRecord { id: number; endpoint: string; query: Record<string, string>; httpStatus: number; creditCount: number; elapsedMs: number; cached: boolean; at: string; preview: string }

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = ((await res.json()) as { error?: string }).error ?? msg; } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

export const api = {
  overview: () => get<Overview>("/market/overview"),
  history: (days = 90) => get<History>(`/market/history?days=${days}`),
  movers: () => get<Movers>("/market/movers"),
  sectors: () => get<Sector[]>("/market/sectors"),
  coins: (limit = 200) => get<{ coins: CoinRow[]; updatedAt: string }>(`/coins?limit=${limit}`),
  coin: (id: number) => get<CoinDetail>(`/coins/${id}`),
  coinHistory: (id: number, range: Range) => get<CoinHistory>(`/coins/${id}/history?range=${range}`),
  compare: (symbols: string[], days = 90) => get<CompareResult>(`/compare?symbols=${encodeURIComponent(symbols.join(","))}&days=${days}`),
  search: (q: string) => get<MapEntry[]>(`/coins/search?q=${encodeURIComponent(q)}`),
  calls: () => get<CallRecord[]>("/calls"),
  brief: () => get<Brief>("/brief"),
  status: () => get<Status>("/status"),
  explain: (symbol: string, window: "1h" | "24h" | "7d" = "24h") => get<Explanation>(`/explain?symbol=${encodeURIComponent(symbol)}&window=${window}`),
  findings: () => get<Findings>("/findings"),
  stream: () => get<Stream>("/stream"),
  automation: () => get<Automation>("/automation"),
  share: async (title: string, messages: unknown[]) => {
    const res = await fetch("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, messages }) });
    if (!res.ok) throw new ApiError(res.status, ((await res.json().catch(() => ({}))) as { error?: string }).error ?? res.statusText);
    return (await res.json()) as { id: string; url: string };
  },
  readShare: (id: string) => get<{ id: string; title: string; createdAt: string; messages: import("./chat").ChatMessage[] }>(`/share/${encodeURIComponent(id)}`),
  setAutomation: async (paused: boolean) => {
    const res = await fetch("/api/automation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paused }) });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return (await res.json()) as Automation;
  },
  scanNow: async () => {
    const res = await fetch("/api/watch/scan", { method: "POST" });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return (await res.json()) as Findings;
  },
};
