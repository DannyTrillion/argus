# CoinMarketCap API feedback

Notes gathered while building Argus. Kept as a running log; the submission form asks
"what the API made possible and where it got in the way", and this is the raw material.

## Where it got in the way

1. **`status.error_code` type differs by version.** v1 and v2 endpoints return a number
   (`0`), v3 endpoints (`/v3/cryptocurrency/quotes/latest`, `/v3/fear-and-greed/latest`,
   `/v3/cryptocurrency/listings/latest`) return the string `"0"`. A naive truthiness check
   treats every successful v3 call as an error. Observed 2026-09-10.

2. **Sort plus filter returns an empty list.** `/v3/cryptocurrency/listings/latest` with
   `sort=percent_change_24h&market_cap_min=1000000000` returns `data: []` with
   `error_code: 0`, while either parameter alone works. Argus works around it by
   fetching the filtered universe sorted by market cap and sorting locally.

3. **Symbol lookups return every asset sharing the ticker.** `quotes/latest?symbol=BTC,ETH,SOL`
   returned 21 assets, most inactive or with a null price, and the docs do not say which one
   is "the" BTC. Callers have to pick by `cmc_rank` and `is_active` themselves. A
   `best_match=true` flag, or defaulting to the ranked asset, would remove a whole class
   of wrong-token bugs in agents.

4. **v3 quotes changed `quote` from a map to an array.** v2 returns `quote: { USD: {...} }`,
   v3 returns `quote: [{ symbol: "USD", ... }]`. Client code needs to handle both.

5. **Keyless API returns 500 "system is busy" for unsupported endpoints** (gainers-losers,
   global-metrics historical, content/latest) instead of the 403 "API key required" that
   other unsupported endpoints return. Hard to tell an outage from a plan limit.

6. **Tag formats differ by endpoint.** `/v3/cryptocurrency/quotes/latest` returns tags as
   objects whose `name` is a display label ("Smart Contracts", with trailing spaces in some
   cases such as "FTX Bankruptcy Estate "), while `/v3/cryptocurrency/listings/latest`
   returns slug strings ("smart-contracts"). Matching coins by tag across the two endpoints
   silently fails until both are normalized to slugs.

7. **Tags mix taxonomy with classification.** "SEC/CFTC Token Taxonomy", "FTX Bankruptcy
   Estate", "US Strategic Crypto Reserve" and VC-portfolio tags sit alongside "layer-1" and
   "defi" in the same list. A `category` field per tag (the v3 quotes response has one)
   exposed consistently everywhere would let clients filter without a hand-written deny list.

8. **Fear & Greed history returns timestamps as epoch-second strings.**
   `/v3/fear-and-greed/historical` gives `timestamp: "1757462400"` while `/v3/fear-and-greed/latest`
   and every other historical endpoint use ISO 8601. Charting code that parses dates has to
   special-case this one endpoint.

9. **Per-coin liquidations are nested one level deeper than the docs suggest.** The rows of
   `/v5/derivatives/liquidations/cryptocurrency/list/latest` sit under `data.cryptocurrencies[]`,
   and each row's numbers sit under `quotes[]` keyed by the convert symbol, not under a
   top-level `quote`. It differs from the shape of `/v5/derivatives/liquidations/quotes/latest`.

10. **Plan limits surface as a generic error code.** On the Basic plan, OHLCV, trending,
    gainers/losers and news all return `error_code: 1006` with no hint of which plan unlocks
    them. Argus catches 1006 and falls back (daily closes from `quotes/historical`, movers from
    a locally sorted listings screen), but a `required_plan` field in the error would let
    clients explain the gap to the user instead of guessing.

## What it made possible

- Every question in the demo is answered from live data with a visible per-call credit cost.
- `price-performance-stats` gives ATH distance and period returns without candle math.
- `/v1/cryptocurrency/categories` is the only public source I know of for sector-level
  market cap change, which is what makes the "sector rotation" analysis possible.
- Liquidation totals by window explain sharp moves in a way price data alone cannot.
- `/v3/cryptocurrency/quotes/historical` with `interval=1h` is enough to run a hourly anomaly
  detector on the top 100 without the OHLCV endpoint, at one credit per 100 points.
- The credit cost on every response (`status.credit_count`) let Argus show the exact price
  of each answer, which turned out to be a feature judges and users both notice.

## Paragraph for the submission form

CoinMarketCap gave Argus everything it needed to be an analyst rather than a price ticker:
categories for sector rotation, price-performance-stats for ATH context, liquidations for
leverage, and hourly quotes/historical for anomaly detection, each with a visible credit cost.
Where it got in the way: v3 endpoints return `error_code` as a string while v1/v2 return a
number; sort plus `market_cap_min` on listings returns an empty list; symbol lookups return
every asset sharing a ticker with no "best match"; tags are display names on quotes but slugs
on listings; Fear & Greed history uses epoch-second strings; and plan-locked endpoints return
a bare 1006 with no hint of the plan that unlocks them. Full notes with dates and repro
parameters are in `docs/API_FEEDBACK.md` in the repo.
