# Submission pack

Everything that goes into the DoraHacks BUIDL, the demo video and the X post, in one place.
Deadline: **30 Sep 2026, 23:59 UTC**. Track: **AI Agents and Automation**.

## Checklist

- [x] Register on DoraHacks with the same email as the CoinMarketCap API account
- [ ] Rotate the CoinMarketCap and Anthropic keys, then run the pre-push check at the bottom of this file
- [x] Public repo: https://github.com/DannyTrillion/argus (MIT, README, `.env.example`, no `.env`)
- [x] Deployed on Railway: https://argus-production-d392.up.railway.app (project `argus`, service `argus`, volume at `/app/.cache`)
- [ ] In the browser you record with, open `/keys` and add your own Anthropic key: "Scan now" only runs on a visitor's own key
- [ ] If automation is paused, open `/status` and unlock the switch with `ARGUS_ADMIN_TOKEN` from your local `.env`
- [ ] An hour before recording, press "Scan now" so the coverflow has fresh findings
- [x] Recorded 17 September, while the Startup plan is active
- [x] Video: https://youtu.be/eG0nNZ3ARUE (set it to Unlisted, not Private, so judges can open it)
- [ ] Nothing to switch for judging: the live site detects the Basic plan from 1 October and turns on judging mode by itself (see README, "CoinMarketCap budget and judging mode")
- [x] Posted on X: https://x.com/sadboy_042/status/2100711426629214664 (paste this URL into the BUIDL, and reply to the post with the BUIDL link once it exists)
- [ ] Submit the BUIDL: title, tagline, description, repo, video, live URL, X post, API feedback

## BUIDL: title and tagline

**Argus**
*A crypto market terminal with an AI analyst that watches CoinMarketCap for you.*

## BUIDL: description

Argus is a full web app on live CoinMarketCap data: a market dashboard, coin explorer, coin
pages with computed risk profiles, a watchlist with correlation analysis, and an analyst you
ask in plain language. Three things make it more than a wrapper around API calls.

**1. It watches the market on its own.** A watch loop scans the top 200 every four hours
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

**3. It answers questions about what you actually hold.** Put amounts next to coins on the
Portfolio tab and the same engine runs on your basket: total value, the positions that drove
today's move, the split between market beta, sector and what is specific to your positions,
how you did against simply holding Bitcoin, concentration (Herfindahl and effective number of
positions), sector exposure and 90-day risk. CoinMarketCap has no holdings endpoint, so the
amounts come from the browser, stay there, and the analysis is entirely derived. There is no
wallet connection and no signature, so a judge can try it in ten seconds.

**4. The analyst shows its work.** Every answer streams with the tool steps, inline charts
(risk bars, global cap line, Fear & Greed, liquidations, price history) and an evidence panel
listing each CoinMarketCap call with endpoint, parameters, credit cost and a response
preview. The model proposes follow-up questions after each answer. Conversations can be
shared as read-only links.

Also: a scheduled market brief twice a day (backdrop, movers, rotation, leverage, watch
list) shown as a card deck, a welcome tour with the Argus owl, Cmd+K palette, local price and
Fear & Greed alerts, a `/status` page with plan usage, endpoint probes and a pause switch for
the automation, plan-aware fallbacks for the Basic tier, and a keyless mode for the public API.

The analyst has a tool for the portfolio too, so "why is my portfolio down today" is answered
with the same numbers shown on the screen.

**Stack:** TypeScript, Hono, Anthropic SDK tool runner (claude-opus-5 for questions,
claude-sonnet-5 for unattended work), React 19, Vite, Tailwind v4, ECharts, motion. 15 unit
tests over the analytics, the anomaly detector and the parsers.

## BUIDL form: what to paste where

DoraHacks asks for these fields. Everything below is ready to paste.

**BUIDL name**

```
Argus
```

**One-line intro / tagline**

```
An AI analyst that watches CoinMarketCap for you: it finds the unusual moves, investigates them, and shows every API call behind the answer.
```

**Track**

```
AI Agents and Automation
```

**Demo video**

```
https://youtu.be/eG0nNZ3ARUE
```

**Repository**

```
https://github.com/DannyTrillion/argus
```

**Live demo / website**

```
https://argus-production-d392.up.railway.app
```

**X post**

```
https://x.com/sadboy_042/status/2100711426629214664
```

**BUIDL logo** (480 x 480, PNG, 110 KB)

```
docs/marketing/logo-480.png
```

**Vision** (the form caps this at 250 characters; this is 228)

```
Crypto dashboards tell you what moved, never why. Argus watches the top 200 coins, flags what is unusual for each one, investigates it with live CoinMarketCap data, and shows every API call behind the answer so you can check it.
```

Alternative, 210 characters, leads with the concrete example:

```
Dashboards say SOL fell 3%. Nobody says why. Argus watches 200 coins, investigates the odd moves itself, and splits each one into market, sector and the coin, showing every CoinMarketCap call behind the answer.
```

**Category**

```
Crypto / Web3 (add AI / Robotics too if the form allows more than one)
```

**Profile tab, optional fields**

- Key innovation domains: `AI Agents`, `Data & Analytics`, `Developer Tools`, `Trading` (type them if they are not in the list; two to four is plenty)
- Layer-1s, Layer-2s, Appchains: leave empty. Argus deploys no contracts and reads CoinMarketCap across every chain, and the tracks are chain-neutral on purpose.
- Other open source ecosystems: `API markets` if the field accepts it, otherwise leave empty.

**Cover image**

Upload `docs/marketing/x-banner.png`.

**Gallery screenshots**, in this order (in `docs/marketing/gallery/`):

1. `01-home.jpg` - the home screen with the findings carousel
2. `03-analyst.jpg` - an analyst answer with the evidence panel listing CoinMarketCap calls
3. `04-explain-fear-greed.jpg` - a stored explainer with its live reading
4. `07-portfolio.jpg` - a portfolio priced and attributed
5. `10-status.jpg` - plan usage, endpoint probes, AI spend and the CoinMarketCap budget

**Tech stack / tags**

```
TypeScript, Node, Hono, React, Vite, Tailwind, ECharts, Anthropic Claude (tool runner), CoinMarketCap Pro API, Railway
```

**Team**

```
Solo: Daniel Makinde (DannyTrillion)
```

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

Record the live site at 1440x900, or a phone and desktop split. Keep the cursor slow. Say the
endpoint names where marked; judges listen for them.

**Before you record:** add your own Anthropic key on `/keys` in the recording browser, press
Scan now about an hour earlier so the cards are fresh, and close the welcome tour.

**0:00-0:15 Hook.** Home, the "Argus noticed" cards sliding.
"This is Argus. It is a crypto market terminal, but the part that matters is that it watches
CoinMarketCap on its own. Every four hours it scans the top two hundred with hourly
quotes-historical, flags moves that are unusual for that coin, and investigates them."

**0:15-0:35 A finding.** Click Read more on a card, scroll the article, tap Ask Argus.
"Each finding is a headline and a short article the agent wrote from real calls: quotes,
categories and liquidations. Ask Argus takes it straight into the analyst."

**0:35-1:00 The analyst.** Ask "why is SOL moving today". Show the tool steps, the attribution
bar and the evidence panel.
"The analyst is a Claude agent with eighteen tools over the API. Here it runs explain-move,
splitting the move into market beta, sector and what is specific to SOL, using quotes-latest,
quotes-historical, categories and the liquidations endpoints. Every call is listed with its
credit cost."

**1:00-1:20 Explain.** Back home. Tap Explain on Fear & Greed, then on BTC dominance.
"Not every question needs an AI. Tap Explain on any number and you get a plain reading
instantly: what it means today, how it compares with last week, and how to read it. Dominance
and liquidations add a separate link when the real question is why it moved."

**1:20-1:40 Portfolio.** Watchlist, Portfolio, Paste a list: "0.5 BTC, 10 SOL", Add.
"Paste what you hold and the same engine runs on your basket: what moved your value, how much
was just Bitcoin, and how concentrated you are. Amounts stay in the browser."

**1:40-1:52 On demand.** Press Scan now.
"The schedule runs on its own. Scan now runs one immediately on your own key, which stays in
your browser and is never stored."

**1:52-2:00 Close.** Status page.
"Plan usage, endpoint probes and owner-only controls. Built for Build with CMC. Repo and live
link are in the submission."

## YouTube listing

**Title**

```
Argus: an AI analyst that watches CoinMarketCap for you
```

**Description** (chapters assume the script's timings; check them against the recording)

```
Argus is a crypto market terminal with an AI analyst built on live CoinMarketCap data. Built solo for the Build with CMC: API Hackathon, track: AI Agents and Automation.

Every four hours it scans the top 200 coins with hourly quotes-historical, flags moves that are unusual for that coin rather than just the biggest movers, investigates them with the full tool set, and writes the headline itself. Ask it "why is SOL moving today" and it splits the move into market beta, sector and coin-specific, then shows every CoinMarketCap call it made with the credit cost.

Live: https://argus-production-d392.up.railway.app
Code: https://github.com/DannyTrillion/argus

Chapters
0:00 What Argus is
0:15 A finding the agent wrote itself
0:35 The analyst, with its evidence panel
1:00 Explain: instant readings, no AI call
1:20 Portfolio: paste what you hold
1:40 Scan on demand with your own key
1:52 Plan usage and endpoint probes

CoinMarketCap endpoints used: cryptocurrency map, quotes/latest, listings/latest, quotes/historical, ohlcv/historical, info, price-performance-stats, categories, category, trending/latest, trending/gainers-losers, global-metrics latest and historical, fear-and-greed latest and historical, altcoin-season-index, derivatives liquidations by window and by coin, content/latest, key/info.

Built with TypeScript, Hono, the Anthropic SDK tool runner, React and ECharts.

#BuildwithCMC
```

Tags: `CoinMarketCap, crypto API, hackathon, AI agent, Claude, crypto dashboard, BuildwithCMC`

## X post draft

Post the hook with the banner attached, then put the links in the first reply: links eat into
the 280 characters and the hook lands harder alone. Tag @CoinMarketCap once, in the main post.

**Post 1** (264 characters, attach `docs/marketing/x-banner.png`)

```
I got tired of dashboards that just say "SOL -3%".

So I built an analyst that answers why: 3.34 points of it was market beta, 0.06 sector, 0.01 the coin itself. Every @CoinMarketCap call is shown, with credits.

It hunts moves on its own, every 4h.

#BuildwithCMC
```

**Reply**

```
Demo (2 min): https://youtu.be/eG0nNZ3ARUE
Live: https://argus-production-d392.up.railway.app
Code: https://github.com/DannyTrillion/argus
BUIDL: <paste after submitting>
```

**Image alt text** (X asks for it; judges and screen readers both benefit)

```
Argus banner: "Every dashboard tells you what moved. This one tells you why." beside a screenshot of the Argus analyst answering "Why is SOL moving today?", showing the move split into market beta, sector and coin-specific, with the list of CoinMarketCap calls it made.
```

**Alternative hook** if you want the build angle instead of the product angle:

```
Three weeks, one owl, 20 CoinMarketCap endpoints.

Argus scans 200 coins every 4h, flags what is strange for that coin, investigates it and writes the headline itself. Then it shows every @CoinMarketCap call and what it cost.

#BuildwithCMC
```

## Before pushing

```bash
git ls-files | grep -E '^\.env$|\.cache/' ; echo "(should print nothing)"
git log -p --all | grep -cE 'sk-ant-api03-[A-Za-z0-9_-]{20,}|CMC_API_KEY=[0-9a-f]{32}|X-CMC_PRO_API_KEY: [0-9a-f]{32}' ; echo "(should print 0)"
pnpm test && pnpm typecheck && (cd web && npx tsc -b)
```
