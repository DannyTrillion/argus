/**
 * Central place for environment configuration. Fails loudly on missing secrets
 * so a misconfigured deploy never silently runs without data access.
 */
const cmcKey = process.env.CMC_API_KEY?.trim() ?? "";

export const config = {
  /**
   * CoinMarketCap API key. When empty, Argus falls back to CMC's keyless public
   * API, which serves a subset of endpoints with tighter rate limits. That is
   * enough for a smoke test but not for the full agent (OHLCV, liquidations,
   * news and trending need a key).
   */
  cmcApiKey: cmcKey,
  keyless: cmcKey === "",
  /** Base URL for the CoinMarketCap Pro API. Override for sandbox testing. */
  cmcBaseUrl:
    process.env.CMC_BASE_URL?.trim() ||
    (cmcKey === "" ? "https://pro-api.coinmarketcap.com/public-api" : "https://pro-api.coinmarketcap.com"),
  /** Claude model used by the agent. */
  model: process.env.ARGUS_MODEL?.trim() || "claude-opus-5",
  port: Number(process.env.PORT) || 3000,
  /** Cache TTL for CMC responses, in seconds. Saves API credits during development and demos. */
  cacheTtlSeconds: Number(process.env.CMC_CACHE_TTL) || 60,
};
