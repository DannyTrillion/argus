# Argus

**A crypto market terminal with an AI analyst built in, running on live CoinMarketCap data.**

Argus is a full web app: a market dashboard, a coin explorer, coin pages with computed risk
profiles, a watchlist with correlation analysis, and an analyst you can ask questions in
plain language. The analyst is a Claude agent with 18 tools over the CoinMarketCap API. It
decides which endpoints answer a question, calls them, computes what the API does not
provide, and shows every call it made. On its own, Argus scans the top 100 every half hour,
flags moves that are unusual for that coin, investigates them and writes the headline; and
every four hours it writes a market brief without anyone typing a prompt.

Built for the [Build with CMC: API Hackathon](https://dorahacks.io/hackathon/coinmarketcap-api-202609/detail),
track **AI Agents and Automation**. Live: **https://argus-production-d392.up.railway.app**

## Screens

| Screen | What it shows |
|---|---|
| **Home** | Total cap, volume, BTC dominance with sparklines; Fear & Greed and Altcoin Season gauges; "Argus noticed", a coverflow of agent-investigated findings with Read more and Ask Argus; a Move explainer that attributes any coin's move to market beta, sector and coin-specific factors; the 90-day cap and dominance chart beside the brief deck; long vs short liquidations; liquid movers. |
| **Explore** | Top 200 coins with price, 24h and 7d change, market cap, volume, 7-day sparklines, sortable columns, and filters for cap size, DeFi, Layer 1, AI, memes and stablecoins. |
| **Coin** | Price and volume chart with 24h to 1y ranges (candles where the plan allows), key stats, ATH distance, a 90-day risk profile (return, volatility, drawdown, correlation with BTC), project info, and an inline analyst with prefilled questions. |
| **Watchlist** | Saved coins, a rebased relative-performance chart and a correlation heatmap for any selection. |
| **Analyst** | The full agent: streaming answers, inline charts for risk, history, attribution and liquidations, model-proposed follow-up questions, a fixed rail with tool steps and every CoinMarketCap call with its credit cost and response, conversation history saved on device, and read-only share links (`/s/:id`). |
| **Status** | Plan tier and credit usage, a live probe of which endpoint families the key can reach, brief and watch-loop state, a pause switch for the automation, and the recent call log. |

Also: a first-run welcome tour with the Argus owl, a Cmd+K command palette (coins, screens, saved questions), local price and Fear & Greed alerts with browser notifications, a floating tab bar on phones, and copy-as-markdown on answers and the brief.

## What the agent does that a plain API call cannot

| Question | What Argus does |
|---|---|
| "Why is X moving?" | Pulls the coin's quote and candles, its sector peers, market backdrop, liquidations and headlines, then separates coin-specific moves from market beta. |
| "Compare BTC, ETH and SOL risk" | Fetches daily history for each and computes return, max drawdown, annualized volatility, best and worst day, volume trend, and correlation with BTC. |
| "Which sectors are rotating?" | Reads all categories, ranks by market cap and volume change, then drills into the constituents of the movers. |
| "Is it altseason?" | Combines the Altcoin Season Index, BTC dominance and its 24h change, and Fear & Greed into one read. |
| Automated brief | Every four hours the agent writes a structured brief: backdrop, movers, sector rotation, leverage and risk, watch list. Shown on the home screen as a sliding card deck. |
| Watch loop | Every 30 minutes a pure detector scores the top 100 against each coin's own hourly volatility ([src/services/watch.ts](src/services/watch.ts)). Flags get an agent investigation with a headline, deck and article, subject to cooldowns and a daily cap. |
| Move attribution | `explain_move` computes the coin's beta to BTC over 30 days, splits the move into market, sector-excess and coin-specific parts, and adds the liquidation picture ([src/services/explain.ts](src/services/explain.ts)). Deterministic, so the same question gives the same numbers. |

## Quick start

```bash
pnpm install                 # installs server and web dependencies
cp .env.example .env         # add CMC_API_KEY and ANTHROPIC_API_KEY
pnpm dev                     # API + agent on http://localhost:3100
pnpm dev:web                 # web app on http://localhost:5173 (proxies /api)
```

Command line:

```bash
pnpm ask "why is SOL moving today"
pnpm brief                   # market brief to stdout
pnpm ask --keyinfo           # your CMC plan and remaining credits
```

Production:

```bash
pnpm build && pnpm start     # serves the built app and API on one port
docker build -t argus . && docker run -p 3100:3100 --env-file .env argus
railway up                   # deploys with railway.json; mount a volume at /app/.cache
```

Without `CMC_API_KEY`, Argus falls back to CMC's keyless public API for the endpoints it
supports. On the free Basic plan, OHLCV, trending, gainers/losers and news return error
1006; Argus detects that and degrades: candles come from `/v3/cryptocurrency/quotes/historical`
(daily closes), movers from a filtered listings screen sorted locally. The UI and the
agent both say which source was used.

## Keys: shared or bring your own

The market screens need no Anthropic key. The analyst, Ask Argus and Scan now run on
Claude, which bills one. Two ways to provide it:

- **Shared:** set `ANTHROPIC_API_KEY` on the server and every visitor uses it. The pause
  switch on `/status`, `WATCH_MAX_PER_DAY` and a spend limit on the Anthropic workspace
  bound the cost.
- **Bring your own:** visitors paste a key on `/keys`. It is tested with a one-token request,
  saved in that browser's local storage only, and sent as the `x-anthropic-key` header with
  each question. The server uses it for that request and never logs or stores it
  ([src/services/keys.ts](src/services/keys.ts)). The scheduled brief and watch loop only
  ever use the server key. With no server key, the Analyst shows a connect card instead of
  an error, and `POST /api/chat` and `POST /api/watch/scan` return 401 `no_key`.

## CoinMarketCap endpoints used

All under `https://pro-api.coinmarketcap.com`, authenticated with `X-CMC_PRO_API_KEY`.

| Endpoint | Used for |
|---|---|
| `GET /v1/cryptocurrency/map` | Resolve symbols to ids, search |
| `GET /v3/cryptocurrency/quotes/latest` | Live price, volume, cap, dominance, % changes |
| `GET /v3/cryptocurrency/listings/latest` | Ranked market lists and screens |
| `GET /v3/cryptocurrency/quotes/historical` | Daily and hourly history, sparklines, risk maths |
| `GET /v2/cryptocurrency/info` | Project metadata and links |
| `GET /v1/cryptocurrency/categories` | Sector market cap and volume changes |
| `GET /v1/cryptocurrency/category` | Constituents of a sector |
| `GET /v1/cryptocurrency/trending/latest` | Attention-based trending |
| `GET /v1/cryptocurrency/trending/gainers-losers` | Biggest movers |
| `GET /v2/cryptocurrency/ohlcv/historical` | Candles (Startup plan and above) |
| `GET /v2/cryptocurrency/price-performance-stats/latest` | ATH, ATL, period returns |
| `GET /v1/global-metrics/quotes/latest` | Total cap, volume, dominance |
| `GET /v1/global-metrics/quotes/historical` | Dominance and cap trends |
| `GET /v3/fear-and-greed/latest` and `/historical` | Sentiment |
| `GET /v1/altcoin-season-index/latest` | Altcoin Season Index |
| `GET /v5/derivatives/liquidations/quotes/latest` | Liquidations by window |
| `GET /v5/derivatives/liquidations/cryptocurrency/list/latest` | Liquidations by coin |
| `GET /v1/content/latest` | Headlines |
| `GET /v1/key/info` | Plan and credit usage |

Every call is logged with endpoint, query, status, credit cost and a response preview
([src/cmc/http.ts](src/cmc/http.ts)). The Analyst screen shows that log per answer, and
`GET /api/calls` returns the last 100.

## Architecture

```
web/                    React 19 + Vite + Tailwind v4 + ECharts + motion
  src/pages/            Home, Explore, Coin, Watchlist, Analyst, Status, Shared, Keys
  src/components/       chart cards, tiles, gauges, sparklines, shell
  src/lib/              typed API client, streaming chat client, chart hook, formatting

src/server.ts           Hono server: /api routes, /api/chat (SSE), static web/dist
src/api/routes.ts       JSON API for the screens
src/api/cache.ts        stale-while-revalidate cache in front of CoinMarketCap
src/services/market.ts  read models: overview, history, movers, sectors, coins, coin, compare
src/services/brief.ts   scheduled brief (generate on boot, refresh every 4h, persisted)
src/services/watch.ts   watch loop: anomaly detector, investigations, cooldowns, atomic state
src/services/explain.ts move attribution: beta to BTC, sector excess, coin-specific, leverage
src/services/stream.ts  "Argus noticed" feed: findings first, padded with brief stories
src/services/settings.ts pause switch for the automation
src/services/share.ts   read-only shared conversations
src/services/status.ts  plan usage, endpoint probes, automation state
src/services/keys.ts    bring-your-own Anthropic key: resolve per request, one-token test
src/agent/agent.ts      Claude tool-runner loop, streams text and tool events
src/agent/tools.ts      18 tools wrapping CMC endpoints + derived analytics
src/agent/analytics.ts  returns, drawdown, volatility, correlation (pure, unit tested)
src/agent/prompt.ts     frozen system prompt (prompt-cached)
src/cmc/http.ts         fetch, cache, credit accounting, call log
src/cmc/endpoints.ts    typed endpoint wrappers with plan-aware fallbacks
src/cli.ts              ask / brief / --keyinfo
```

Questions you ask run on `claude-opus-5` (override with `ARGUS_MODEL`); unattended work,
the brief and the watch investigations, runs on `claude-sonnet-5` (`ARGUS_AUTOMATION_MODEL`)
via the Anthropic SDK tool runner with adaptive thinking. `WATCH_INTERVAL_MINUTES`,
`WATCH_MAX_PER_DAY` and the pause switch on `/status` bound the spend. Tool results are trimmed and rounded so
a full brief fits comfortably in context, and the system prompt is cached across requests.

## API feedback

See [docs/API_FEEDBACK.md](docs/API_FEEDBACK.md): v3 endpoints return `error_code` as a
string, sort plus filter returns an empty list, symbol lookups return every asset sharing a
ticker, tag formats differ by endpoint, Fear & Greed history uses epoch strings, and plan
limits surface as a bare 1006. Also what the API made possible, and a ready paragraph for
the submission form. The submission pack (BUIDL text, video script, X post) is in
[docs/SUBMISSION.md](docs/SUBMISSION.md).

## Tests

```bash
pnpm test                                   # analytics, anomaly detector and parser tests (15)
pnpm tsx --env-file=.env tests/smoke.ts     # every endpoint, trimmed output
pnpm typecheck && (cd web && npx tsc -b)    # both TypeScript projects
```

## Built with

Written by Daniel Makinde with Claude Code (Claude Fable 5.1) as a pair programmer.
Product decisions, the endpoint choices, the visual direction and the prompt are mine;
much of the code was generated from those decisions and then reviewed and edited.

## License

MIT
