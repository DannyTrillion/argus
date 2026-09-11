# Submission pack

Everything that goes into the DoraHacks BUIDL, the demo video and the X post, in one place.
Deadline: **30 Sep 2026, 23:59 UTC**. Track: **AI Agents and Automation**.

## Checklist

- [ ] Register on DoraHacks with the same email as the CoinMarketCap API account
- [ ] Rotate the CoinMarketCap and Anthropic keys, then confirm `git log -p | grep -c sk-ant` is 0
- [ ] Push the public repo `DannyTrillion/argus` (MIT, README, `.env.example`, no `.env`)
- [x] Deployed on Railway: https://argus-production-d392.up.railway.app (project `argus`, service `argus`, volume at `/app/.cache`)
- [ ] On the deployed app open `/status`, resume automation, run "Scan now" so the coverflow has fresh findings
- [ ] Record the 2-minute video in your own voice (script below), upload unlisted to YouTube
- [ ] Post on X with `#BuildwithCMC`, linking the BUIDL page (draft below), paste the post URL into the BUIDL
- [ ] Submit the BUIDL: title, tagline, description, repo, video, live URL, X post, API feedback

## BUIDL: title and tagline

**Argus**
*A crypto market terminal with an AI analyst that watches CoinMarketCap for you.*

## BUIDL: description

Argus is a full web app on live CoinMarketCap data: a market dashboard, coin explorer, coin
pages with computed risk profiles, a watchlist with correlation analysis, and an analyst you
ask in plain language. Three things make it more than a wrapper around API calls.

**1. It watches the market on its own.** A watch loop scans the top 100 every 30 minutes
using hourly `quotes/historical`, and a pure anomaly detector flags moves that are unusual
against each coin's own recent volatility, not just "biggest gainer". For each flag the agent
runs an investigation with the full tool set and writes a poster headline, a deck and a short
article. These show up on the home screen as "Argus noticed", a coverflow of cards with
Read more and an Ask Argus button that opens the analyst with the finding as context.

**2. It explains moves with numbers, not vibes.** `explain_move` decomposes any coin's move
into market beta (the coin's beta to BTC times BTC's move), sector excess (its category's
move beyond BTC) and a coin-specific residual, then adds the leverage picture from the
liquidations endpoints. The result is a deterministic attribution bar plus a plain-English
read, on the home screen and inside every analyst answer.

**3. The analyst shows its work.** Every answer streams with the tool steps, inline charts
(risk bars, global cap line, Fear & Greed, liquidations, price history) and an evidence panel
listing each CoinMarketCap call with endpoint, parameters, credit cost and a response
preview. The model proposes follow-up questions after each answer. Conversations can be
shared as read-only links.

Also: a scheduled market brief every four hours (backdrop, movers, rotation, leverage, watch
list) shown as a card deck, a welcome tour with the Argus owl, Cmd+K palette, local price and
Fear & Greed alerts, a `/status` page with plan usage, endpoint probes and a pause switch for
the automation, plan-aware fallbacks for the Basic tier, and a keyless mode for the public API.

**Stack:** TypeScript, Hono, Anthropic SDK tool runner (claude-opus-5 for questions,
claude-sonnet-5 for unattended work), React 19, Vite, Tailwind v4, ECharts, motion. 15 unit
tests over the analytics, the anomaly detector and the parsers.

## BUIDL: CoinMarketCap endpoints used

Paste this list into the "endpoints" field. All under `pro-api.coinmarketcap.com`, header
`X-CMC_PRO_API_KEY`.

```
GET /v1/cryptocurrency/map                                   symbol and search resolution
GET /v3/cryptocurrency/quotes/latest                         live price, cap, volume, % changes
GET /v3/cryptocurrency/listings/latest                       ranked screens, top-100 watch universe
GET /v3/cryptocurrency/quotes/historical                     daily + hourly history, sparklines, risk maths, anomaly detection
GET /v2/cryptocurrency/ohlcv/historical                      candles (Startup plan and above)
GET /v2/cryptocurrency/info                                  project metadata, links
GET /v2/cryptocurrency/price-performance-stats/latest        ATH/ATL distance, period returns
GET /v1/cryptocurrency/categories                            sector cap and volume change
GET /v1/cryptocurrency/category                              sector constituents
GET /v1/cryptocurrency/trending/latest                       attention trending
GET /v1/cryptocurrency/trending/gainers-losers               biggest movers
GET /v1/global-metrics/quotes/latest                         total cap, volume, dominance
GET /v1/global-metrics/quotes/historical                     90-day cap and dominance chart
GET /v3/fear-and-greed/latest                                sentiment gauge
GET /v3/fear-and-greed/historical                            sentiment line
GET /v1/altcoin-season-index/latest                          altseason read
GET /v5/derivatives/liquidations/quotes/latest               long vs short liquidations by window
GET /v5/derivatives/liquidations/cryptocurrency/list/latest  liquidations by coin
GET /v1/content/latest                                       headlines
GET /v1/key/info                                             plan tier and credit usage
```

Twenty endpoints across eight API families. Every call is logged with endpoint, query,
status, credit cost and a response preview; the Analyst screen shows that log per answer
and `GET /api/calls` returns the last 100.

## BUIDL: evidence of real API calls

Judges want to see the calls happen. Three places in the app do that on screen:

- **Analyst evidence panel:** each answer lists the CoinMarketCap calls it made, with the
  credit count taken from `status.credit_count` in the response.
- **Status page:** `GET /v1/key/info` shows the plan and credits used today, and a live probe
  hits one endpoint per family and reports which the key can reach.
- **Recent calls log:** the bottom of `/status` and `GET /api/calls`.

Take one screenshot of each for the BUIDL gallery, plus the home screen and the coverflow
article.

## Video script (2 minutes, your voice)

Record at 1440x900 or a phone plus desktop split. Keep the cursor slow. Say the endpoint
names out loud where marked; judges listen for them.

**0:00–0:15 Hook.** Home screen, coverflow moving.
"This is Argus. It's a crypto market terminal, but the part that matters is that it watches
CoinMarketCap on its own. Every half hour it scans the top hundred with hourly
quotes-historical, flags moves that are unusual for that coin, and investigates them."

**0:15–0:40 Argus noticed.** Click Read more on a card, scroll the article, tap Ask Argus.
"Each finding gets a headline, a deck and a short article written by the agent from real
calls: quotes, categories, liquidations, news. Ask Argus opens the analyst with the finding
as context."

**0:40–1:10 Analyst.** Ask "why is SOL moving today". Show tool steps, attribution bar,
evidence panel expanded.
"The analyst is a Claude agent with eighteen tools over the API. Here it calls explain-move,
which splits the move into market beta, sector excess and what's left that's coin-specific,
using quotes-latest, quotes-historical, categories and the liquidations endpoints. Every call
is listed here with its credit cost. These are the follow-ups it suggests."

**1:10–1:30 Brief and explainer.** Back home. Show the brief deck sliding, then the Move
explainer tab with a chip or two.
"Every four hours it writes a brief without anyone typing a prompt. And the move explainer
does the attribution for any coin in one tap."

**1:30–1:50 Depth.** Coin page risk profile, watchlist correlation heatmap, quick pass over
Explore.
"Underneath is a full terminal: risk profiles computed from ninety days of history, a
correlation heatmap for your watchlist, and a screener over two hundred coins."

**1:50–2:00 Close.** Status page.
"Plan usage, endpoint probes, and a pause switch for the automation. Built for Build with CMC.
Repo and live link are in the submission."

## X post draft

Post from your account, tag @CoinMarketCap, attach a 20–30s screen clip of the coverflow
and the analyst evidence panel. Replace `<buidl-url>`.

> Built Argus for #BuildwithCMC: a market terminal with an AI analyst that watches
> @CoinMarketCap for you.
>
> Every 30 min it scans the top 100, flags unusual moves, investigates them and writes the
> headline. Ask "why is SOL moving" and it splits the move into market beta, sector and
> coin-specific, showing every API call and its credit cost.
>
> 20 CMC endpoints, 18 agent tools, one owl.
>
> Live: https://argus-production-d392.up.railway.app
> BUIDL: <buidl-url>

Alternate shorter version if the clip carries it:

> Argus watches @CoinMarketCap so you don't have to. Scans, flags, investigates, explains,
> and shows every call it made. #BuildwithCMC
> <buidl-url>

## Before pushing

```bash
git ls-files | grep -E '^\.env$|\.cache/' ; echo "(should print nothing)"
git log -p --all | grep -cE 'sk-ant-|3a0b1027' ; echo "(should print 0)"
pnpm test && pnpm typecheck && (cd web && npx tsc -b)
```
