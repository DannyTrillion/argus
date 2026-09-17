![Argus: every dashboard tells you what moved, this one tells you why](https://raw.githubusercontent.com/DannyTrillion/argus/main/docs/marketing/x-banner.png)

**Argus is a crypto market terminal with an AI analyst that watches CoinMarketCap for you.** It finds the moves worth explaining, investigates them on its own, and shows every API call behind the answer.

🔗 **Live:** https://argus-production-d392.up.railway.app · 💻 **Code:** https://github.com/DannyTrillion/argus · 🎬 **Demo:**

https://youtu.be/eG0nNZ3ARUE

---

## The problem

Every dashboard tells you *what* moved. None tell you *why*.

Answering "why is SOL down 3% today" properly means pulling live quotes, ninety days of history, the sector's performance, the liquidation picture, and then doing the maths: how much of this move is just Bitcoin, how much is the sector, how much is the coin itself. Almost nobody does that. So people trade on headlines, and a price ticker with an AI chat box bolted on top does not help, because it cannot show you where its numbers came from.

## What Argus does

- **It watches by itself.** Every four hours it scans the top 200 coins with hourly `quotes/historical` and scores each move against that coin's own recent volatility. Not "biggest gainer": *unusual for this coin*.
- **It investigates what it flags.** Each flagged signal gets a full agent run with 18 tools over the CoinMarketCap API, and the agent writes the headline, the deck and a short article itself.
- **It shows its work.** Every answer lists the calls it made, with credit costs and response previews. Nothing is a black box.

---

## Three things a plain API call cannot do

### 1. Notice something without being asked

![The Argus home screen with the findings carousel](https://raw.githubusercontent.com/DannyTrillion/argus/main/docs/marketing/gallery/01-home.jpg)

A pure anomaly detector (no LLM, unit tested) scores the top 200 on hourly data, sector moves, liquidation bursts, dominance breaks and sentiment shifts. Cooldowns and a daily cap keep it from crying wolf. What survives becomes a story card with a headline the agent wrote.

### 2. Decompose a move into causes, deterministically

![The analyst answering why SOL is moving, with the evidence panel listing CoinMarketCap calls](https://raw.githubusercontent.com/DannyTrillion/argus/main/docs/marketing/gallery/03-analyst.jpg)

`explain_move` computes the coin's beta to Bitcoin over 30 daily closes, then splits the window's move three ways:

| Component | How it is computed | Example: SOL −3.27% in 24h |
|---|---|---|
| Market beta | beta × BTC's move | **−3.34 points** (BTC −2.96% × beta 1.13) |
| Sector excess | the coin's category beyond the market | +0.06 |
| Coin-specific | what is left over | +0.01 |

The read: SOL did nothing. Bitcoin dragged it. The same question asked twice gives the same numbers, because the arithmetic is code, not a guess. The right-hand rail lists every endpoint the answer touched: 12 calls, 8 credits, 3 served from cache.

### 3. Explain the numbers without spending a token

![The Fear and Greed explainer with its live reading and zone scale](https://raw.githubusercontent.com/DannyTrillion/argus/main/docs/marketing/gallery/04-explain-fear-greed.jpg)

Every number on screen has an **Explain** button that opens instantly with no model call: what it is, what today's value means with a zone scale, how it compares with a week ago, how to read it and what moves it. The analyst is kept for real analysis. A `/learn` page collects all fifteen explainers in one place.

### Bonus: your own basket, same engine

![The portfolio view showing what moved your value, split into market, sector and the coins themselves](https://raw.githubusercontent.com/DannyTrillion/argus/main/docs/marketing/gallery/07-portfolio.jpg)

Paste "0.5 BTC, 10 SOL" and Argus prices the basket, splits *your* day into market beta, sector and coin-specific, measures concentration in effective positions, and charts you against simply holding Bitcoin. Amounts live in your browser. No wallet connection, no signature, nothing stored on the server.

---

## Evidence of a real API call

The client that makes every call ([`src/cmc/http.ts`](https://github.com/DannyTrillion/argus/blob/main/src/cmc/http.ts)):

```ts
const headers = { Accept: "application/json", "Accept-Encoding": "deflate, gzip" };
if (!config.keyless) headers["X-CMC_PRO_API_KEY"] = config.cmcApiKey;
const res = await fetch(url, { headers });
const body = await res.json();

// v1/v2 return error_code as a number, v3 as the string "0". Normalise before checking.
const errorCode = Number(body?.status?.error_code ?? (res.ok ? 0 : res.status));
if (!res.ok || errorCode !== 0) throw new CmcApiError(res.status, errorCode, body?.status?.error_message, path);

record({ endpoint: path, query: params, httpStatus: res.status, creditCount: body.status.credit_count, cached: false, preview: preview(body.data) });
```

A real response from `GET /v3/cryptocurrency/quotes/latest?id=1&convert=USD`, trimmed to the fields Argus reads:

```json
{
  "status": { "timestamp": "2026-09-15T17:54:32.765Z", "error_code": "0", "elapsed": 4, "credit_count": 1 },
  "data": [{
    "id": 1, "name": "Bitcoin", "symbol": "BTC", "cmc_rank": 1,
    "quote": [{ "symbol": "USD", "price": 76993.18239851118, "volume_24h": 32996313380.69,
                "percent_change_24h": -2.47644884, "market_cap": 1546395749564.91,
                "market_cap_dominance": 59.016, "last_updated": "2026-09-15T17:53:04.000Z" }]
  }]
}
```

Every call is logged with endpoint, query, status, credits, timing and a response preview. `GET /api/calls` on the live site returns the last 100, the Status page shows them, and each analyst answer shows the ones it made.

---

## CoinMarketCap endpoints used

| Endpoint | Used for |
|---|---|
| `/v1/cryptocurrency/map` | symbol and search resolution |
| `/v3/cryptocurrency/quotes/latest` | live price, cap, volume, % changes |
| `/v3/cryptocurrency/listings/latest` | ranked screens, the top-200 watch universe |
| `/v3/cryptocurrency/quotes/historical` | daily and hourly history, sparklines, risk maths, anomaly detection |
| `/v2/cryptocurrency/ohlcv/historical` | candles |
| `/v2/cryptocurrency/info` | project metadata and links |
| `/v2/cryptocurrency/price-performance-stats/latest` | ATH and ATL distance, period returns |
| `/v1/cryptocurrency/categories` · `/category` | sector cap and volume change, constituents |
| `/v1/cryptocurrency/trending/latest` · `/trending/gainers-losers` | attention and movers |
| `/v1/global-metrics/quotes/latest` · `/historical` | total cap, dominance, 90-day trend |
| `/v3/fear-and-greed/latest` · `/historical` | sentiment gauge and line |
| `/v1/altcoin-season-index/latest` | altseason read |
| `/v5/derivatives/liquidations/quotes/latest` · `/cryptocurrency/list/latest` | leverage by window and by coin |
| `/v1/content/latest` | headlines |
| `/v1/key/info` | plan tier, credit usage, budget control |

Twenty endpoints across eight families.

---

## How it works

```
React 19 + Vite + Tailwind + ECharts          the terminal: Home, Explore, Coin, Watchlist,
                                               Portfolio, Analyst, Learn, Status, Keys
        │  /api  (JSON + Server-Sent Events)
Hono on Node 22
        ├── agent/      Claude tool runner, 18 tools, streaming, prompt caching
        ├── services/   watch loop · explain (beta maths) · brief · portfolio · budget · usage
        └── cmc/        typed endpoint wrappers, cache, credit accounting, call log
                │
        CoinMarketCap Pro API
```

The detector, the attribution maths and the analytics are plain TypeScript with unit tests (46 of them). The model is used where judgement helps: investigating a signal, writing a headline, answering a question.

## Built to keep running

![The Status page with plan usage, endpoint probes, AI spend and the CoinMarketCap budget](https://raw.githubusercontent.com/DannyTrillion/argus/main/docs/marketing/gallery/10-status.jpg)

Hackathon access reverts to the free Basic plan when submissions close, and judging happens after that. Argus reads its own plan from `/v1/key/info` (zero credits) and, on a Basic-sized plan, **switches itself into judging mode**: it spreads the month's credits into a daily budget, makes every cache last ten times longer, keeps calls under 80% of the rate limit, pauses scheduled work as the budget runs down, and serves the last data it fetched once it is spent. Liquidation features degrade gracefully instead of erroring. Rehearsed with `CMC_SIMULATE_BASIC=1`.

The Status page also estimates what the AI costs, by run type, and visitors can bring their own Anthropic key, which stays in their browser and is never stored.

---

## What the API made possible, and where it got in the way

**Made possible:** categories give sector-level rotation that nothing else exposes publicly; `price-performance-stats` gives ATH context without candle maths; the derivatives endpoints explain sharp moves that price data alone cannot; hourly `quotes/historical` is enough to run anomaly detection on 200 coins for one credit per 100 points; and `credit_count` on every response let Argus show the price of each answer.

**Got in the way:** `error_code` is a number on v1/v2 but the string `"0"` on v3; `sort` plus `market_cap_min` on listings returns an empty list; symbol lookups return every asset sharing a ticker with no best-match flag; tags are display names on quotes but slugs on listings; Fear & Greed history returns epoch-second strings while everything else is ISO; per-coin liquidations nest one level deeper than the docs suggest; and plan-locked endpoints return a bare `1006` with no hint of which plan unlocks them.

Ten quirks with dates and repro parameters: [`docs/API_FEEDBACK.md`](https://github.com/DannyTrillion/argus/blob/main/docs/API_FEEDBACK.md).

---

## Try it in thirty seconds

1. Open **https://argus-production-d392.up.railway.app**
2. Tap **Read more** on a card the agent wrote, then **Ask Argus**
3. Ask *"why is SOL moving today"* and open the evidence panel
4. Tap **Explain** on any number
5. Switch the Watchlist to **Portfolio** and paste `0.5 BTC, 10 SOL`

**Stack:** TypeScript · Hono · Anthropic Claude (tool runner) · React 19 · Vite · Tailwind v4 · ECharts · Railway
**Track:** AI Agents and Automation · **Built by:** [@DannyTrillion](https://github.com/DannyTrillion), solo
