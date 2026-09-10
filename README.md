# Argus

**An AI market analyst that answers real questions with live CoinMarketCap data.**

Ask "why is SOL moving today" or "is it altcoin season" and Argus decides which
CoinMarketCap endpoints answer the question, calls them, computes derived statistics the
API does not provide (volatility, drawdown, correlation, sector rotation), and writes a
sourced answer. Every number in the answer traces to an API call you can see in the UI.

Built for the [Build with CMC: API Hackathon](https://dorahacks.io/hackathon/coinmarketcap-api-202609/detail),
track **AI Agents and Automation**.

## What it does that a plain API call cannot

| Question | What Argus does |
|---|---|
| "Why is X moving?" | Pulls the coin's quote and candles, its sector peers, market backdrop, liquidations and headlines, then separates coin-specific moves from market beta. |
| "Compare BTC, ETH and SOL risk" | Fetches 90 days of candles for each and computes return, max drawdown, annualized volatility, best/worst day and correlation with BTC. |
| "Which sectors are rotating?" | Reads all categories, ranks by market cap change and volume change, then drills into the constituents of the movers. |
| "Is it altseason?" | Combines the Altcoin Season Index, BTC dominance and its 24h change, and Fear & Greed into one read. |
| "Market brief" | A structured daily brief: backdrop, movers that matter, sector rotation, leverage and risk, watch list. |

## Quick start

```bash
pnpm install
cp .env.example .env      # add CMC_API_KEY and ANTHROPIC_API_KEY
pnpm dev                  # web UI on http://localhost:3000
pnpm ask "how is the market today"
pnpm brief                # markdown market brief to stdout
pnpm ask --keyinfo        # show your CMC plan and remaining credits
```

Without `CMC_API_KEY`, Argus falls back to CMC's keyless public API. That is enough
for global metrics, quotes, listings, categories, Fear & Greed and Altcoin Season, but
OHLCV, liquidations, trending and news need a key.

## CoinMarketCap endpoints used

All under `https://pro-api.coinmarketcap.com`, authenticated with `X-CMC_PRO_API_KEY`.

| Endpoint | Used for |
|---|---|
| `GET /v1/cryptocurrency/map` | Resolve symbols to ids |
| `GET /v3/cryptocurrency/quotes/latest` | Live price, volume, cap, dominance, % changes |
| `GET /v3/cryptocurrency/listings/latest` | Ranked market lists and screens |
| `GET /v2/cryptocurrency/info` | Project metadata |
| `GET /v1/cryptocurrency/categories` | Sector market cap and volume changes |
| `GET /v1/cryptocurrency/category` | Constituents of a sector |
| `GET /v1/cryptocurrency/trending/latest` | Attention-based trending |
| `GET /v1/cryptocurrency/trending/gainers-losers` | Biggest movers |
| `GET /v2/cryptocurrency/ohlcv/historical` | Candles for analysis |
| `GET /v2/cryptocurrency/price-performance-stats/latest` | ATH, ATL, period returns |
| `GET /v1/global-metrics/quotes/latest` | Total cap, volume, dominance |
| `GET /v1/global-metrics/quotes/historical` | Dominance and cap trends |
| `GET /v3/fear-and-greed/latest` and `/historical` | Sentiment |
| `GET /v1/altcoin-season-index/latest` | Altcoin Season Index |
| `GET /v5/derivatives/liquidations/quotes/latest` | Liquidations by window |
| `GET /v5/derivatives/liquidations/cryptocurrency/list/latest` | Liquidations by coin |
| `GET /v1/content/latest` | Headlines |
| `GET /v1/key/info` | Plan and credit usage |

The HTTP layer lives in [src/cmc/http.ts](src/cmc/http.ts) and the typed wrappers in
[src/cmc/endpoints.ts](src/cmc/endpoints.ts). Every call is logged with endpoint, query,
status, credit cost and a response preview, and the web UI shows that log live.

## Architecture

```
public/index.html      chat UI + live "CoinMarketCap calls" evidence panel (SSE)
src/server.ts          Hono server: /api/chat streams agent events, /api/calls lists API calls
src/cli.ts             ask / brief / --keyinfo commands
src/agent/agent.ts     Claude tool-runner loop, streams text and tool events
src/agent/tools.ts     17 tools wrapping CMC endpoints + derived analytics
src/agent/analytics.ts pure math: returns, drawdown, volatility, correlation
src/agent/prompt.ts    frozen system prompt (prompt-cached)
src/cmc/http.ts        fetch, cache, credit accounting, call log
src/cmc/endpoints.ts   typed endpoint wrappers with compact output shapes
```

The agent is Claude (`claude-opus-5` by default, override with `ARGUS_MODEL`) driven by
the Anthropic SDK's tool runner with adaptive thinking. Tool results are trimmed to the
fields that matter so a full market brief fits comfortably in context.

## API feedback

See [docs/API_FEEDBACK.md](docs/API_FEEDBACK.md) for the quirks found while building
(v3 error codes as strings, sort plus filter returning empty, symbol collisions) and what
the API made possible.

## Tests

```bash
pnpm test                          # unit tests for the analytics math
pnpm tsx --env-file=.env tests/smoke.ts   # hits every endpoint and prints trimmed results
```

## Built with

Written by Daniel Makinde with Claude Code (Claude Fable 5.1) as a pair programmer.
The design, endpoint choices, prompt, and all decisions about what the agent should do
are mine; a large share of the boilerplate was generated and then reviewed and edited.

## License

MIT
