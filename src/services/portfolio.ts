/**
 * Portfolio analysis: the user's holdings (a list of CoinMarketCap ids and amounts)
 * priced and decomposed with the same maths the rest of Argus uses.
 *
 * Everything here is derived, not fetched. CoinMarketCap has no wallet or portfolio
 * endpoint; what it gives us is prices, daily history, sector membership and sector
 * performance, and this module turns those into the numbers a holder actually wants:
 *
 *   value & weights      amount * price, normalized
 *   today's attribution  portfolio move = market beta + sector excess + coin-specific
 *   vs just holding BTC  what the same money in Bitcoin would have done
 *   concentration        Herfindahl index and its "effective number of positions"
 *   risk                 volatility, max drawdown, best and worst day of the basket
 *
 * Holdings are never stored on the server. They arrive with the request, are used to
 * compute an answer, and are discarded.
 */
import * as cmc from "../cmc/endpoints.js";
import { CmcApiError } from "../cmc/http.js";
import { logReturns, maxDrawdown, pearson, stddev } from "../agent/analytics.js";
import { memo, MINUTE } from "../api/cache.js";
import { pickSectors } from "./market.js";
import { sectorForTags } from "./explain.js";

const BTC_ID = 1;
const MAX_POSITIONS = 25;
const HISTORY_DAYS = 91;
const MIN_HISTORY_POINTS = 20;

export interface Holding {
  id: number;
  amount: number;
}

export interface Position {
  id: number;
  symbol: string;
  name: string;
  rank: number | null;
  amount: number;
  price: number;
  value_usd: number;
  weight_pct: number;
  change_24h_pct: number | null;
  change_7d_pct: number | null;
  pnl_24h_usd: number | null;
  /** Percentage points of the portfolio's 24h move that came from this position. */
  contribution_24h_pp: number | null;
  beta_to_btc: number | null;
  sector: string | null;
}

export interface PortfolioAnalysis {
  total_value_usd: number;
  positions: Position[];
  change_24h_pct: number | null;
  change_24h_usd: number | null;
  change_7d_pct: number | null;
  change_7d_usd: number | null;
  /** Same decomposition as explain_move, applied to the whole basket. */
  attribution: {
    total_pct: number;
    btc_change_pct: number;
    beta_to_btc: number | null;
    market_component_pct: number | null;
    sector_excess_pct: number | null;
    coin_specific_pct: number | null;
    read: "market beta" | "sector rotation" | "coin-specific" | "mixed";
    read_text: string;
  } | null;
  /** Your move minus the alternative: the same money in BTC, or in the whole market. */
  vs_btc_pct: number | null;
  vs_market_pct: number | null;
  concentration: {
    top1_pct: number;
    top3_pct: number;
    hhi: number;
    effective_positions: number;
    stablecoin_pct: number;
  };
  sectors: Array<{ name: string; value_usd: number; weight_pct: number; change_24h_pct: number | null }>;
  contributors: { up: Position[]; down: Position[] };
  risk: {
    days: number;
    annualized_volatility_pct: number;
    max_drawdown_pct: number;
    best_day_pct: number;
    worst_day_pct: number;
    correlation_to_btc: number | null;
    return_pct: number;
  } | null;
  history: Array<{ date: string; value: number }>;
  btc_history: Array<{ date: string; value: number }>;
  computed_at: string;
  caveats: string[];
}

function round(n: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

async function optional<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CmcApiError) return null;
    throw err;
  }
}

/** Merge duplicates, drop non-positive amounts, cap the list. */
export function normalizeHoldings(input: Holding[]): Holding[] {
  const merged = new Map<number, number>();
  for (const h of input) {
    const id = Number(h?.id);
    const amount = Number(h?.amount);
    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(amount) || amount <= 0) continue;
    merged.set(id, (merged.get(id) ?? 0) + amount);
  }
  return [...merged.entries()].map(([id, amount]) => ({ id, amount })).slice(0, MAX_POSITIONS);
}

function fingerprint(holdings: Holding[]): string {
  return holdings
    .map((h) => `${h.id}:${h.amount}`)
    .sort()
    .join(",");
}

export function analyzePortfolio(input: Holding[]): Promise<PortfolioAnalysis> {
  const holdings = normalizeHoldings(input);
  return memo(`portfolio:${fingerprint(holdings)}`, MINUTE, () => compute(holdings));
}

/**
 * Risk of a value series: volatility, drawdown, extremes and correlation with Bitcoin.
 * Pure, so the numbers behind the Portfolio screen are unit tested. All figures are
 * percentages, not fractions.
 */
export function basketRisk(closes: number[], btcCloses?: number[]): PortfolioAnalysis["risk"] {
  if (closes.length < 3) return null;
  const rets = logReturns(closes);
  const daily = closes.slice(1).map((c, i) => (c / closes[i] - 1) * 100);
  let correlation: number | null = null;
  if (btcCloses && btcCloses.length === closes.length) {
    const r = pearson(rets, logReturns(btcCloses));
    correlation = r === null ? null : round(r);
  }
  return {
    days: closes.length,
    annualized_volatility_pct: round(stddev(rets) * Math.sqrt(365) * 100, 1),
    max_drawdown_pct: round(maxDrawdown(closes) * 100, 1),
    best_day_pct: round(Math.max(...daily), 2),
    worst_day_pct: round(Math.min(...daily), 2),
    correlation_to_btc: correlation,
    return_pct: round((closes[closes.length - 1] / closes[0] - 1) * 100, 1),
  };
}

async function compute(holdings: Holding[]): Promise<PortfolioAnalysis> {
  const caveats: string[] = [];
  const empty: PortfolioAnalysis = {
    total_value_usd: 0,
    positions: [],
    change_24h_pct: null,
    change_24h_usd: null,
    change_7d_pct: null,
    change_7d_usd: null,
    attribution: null,
    vs_btc_pct: null,
    vs_market_pct: null,
    concentration: { top1_pct: 0, top3_pct: 0, hhi: 0, effective_positions: 0, stablecoin_pct: 0 },
    sectors: [],
    contributors: { up: [], down: [] },
    risk: null,
    history: [],
    btc_history: [],
    computed_at: new Date().toISOString(),
    caveats: ["No holdings yet. Add an amount next to a coin to build a portfolio."],
  };
  if (holdings.length === 0) return empty;

  const ids = holdings.map((h) => h.id);
  const withBtc = ids.includes(BTC_ID) ? ids : [...ids, BTC_ID];

  const [coins, global, sectorRows, series] = await Promise.all([
    cmc.quotes({ ids: withBtc }),
    optional(() => cmc.globalMetrics()),
    optional(() => cmc.categories({ limit: 500 }).then(pickSectors)),
    optional(() => cmc.closeSeries(withBtc, HISTORY_DAYS)),
  ]);

  const byId = new Map(coins.map((c) => [c.id, c]));
  const btc = byId.get(BTC_ID);
  const btcChange24h = btc?.quote.percent_change_24h ?? null;

  // ---------- positions ----------
  const priced = holdings
    .map((h) => ({ h, coin: byId.get(h.id) }))
    .filter((x): x is { h: Holding; coin: cmc.Coin } => Boolean(x.coin && typeof x.coin.quote.price === "number"));

  const missing = holdings.length - priced.length;
  if (missing > 0) caveats.push(`${missing} holding${missing === 1 ? "" : "s"} had no price on CoinMarketCap and ${missing === 1 ? "was" : "were"} skipped.`);
  if (priced.length === 0) return { ...empty, caveats: [...empty.caveats.slice(1), "None of these holdings could be priced."] };

  const values = priced.map(({ h, coin }) => ({ h, coin, value: h.amount * (coin.quote.price as number) }));
  const total = values.reduce((s, v) => s + v.value, 0);

  // 30-day beta per position, from the same batched history call.
  const btcSeries = series?.get(BTC_ID) ?? [];
  const btcByDate = new Map(btcSeries.map((p) => [p.date, p.close]));
  const betaFor = (id: number): number | null => {
    if (id === BTC_ID) return 1;
    const s = series?.get(id);
    if (!s || s.length < MIN_HISTORY_POINTS || btcSeries.length < MIN_HISTORY_POINTS) return null;
    const pairs = s
      .slice(-31)
      .map((p) => [p.close, btcByDate.get(p.date)] as const)
      .filter((p): p is readonly [number, number] => typeof p[1] === "number");
    if (pairs.length < MIN_HISTORY_POINTS) return null;
    const rc = logReturns(pairs.map((p) => p[0]));
    const rb = logReturns(pairs.map((p) => p[1]));
    const corr = pearson(rc, rb);
    const sb = stddev(rb);
    if (corr === null || sb === 0) return null;
    return round(corr * (stddev(rc) / sb));
  };

  const positions: Position[] = values
    .map(({ h, coin, value }) => {
      const weight = total > 0 ? (value / total) * 100 : 0;
      const c24 = coin.quote.percent_change_24h ?? null;
      return {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        rank: coin.cmc_rank ?? null,
        amount: h.amount,
        price: round(coin.quote.price as number, (coin.quote.price as number) >= 1 ? 2 : 6),
        value_usd: round(value, 2),
        weight_pct: round(weight),
        change_24h_pct: c24 === null ? null : round(c24),
        change_7d_pct: coin.quote.percent_change_7d === undefined || coin.quote.percent_change_7d === null ? null : round(coin.quote.percent_change_7d),
        pnl_24h_usd: c24 === null ? null : round(value - value / (1 + c24 / 100), 2),
        contribution_24h_pp: c24 === null ? null : round((weight * c24) / 100),
        beta_to_btc: betaFor(coin.id),
        sector: sectorForTags(coin.tags),
      };
    })
    .sort((a, b) => b.value_usd - a.value_usd);

  // ---------- portfolio move ----------
  const weighted = (pick: (p: Position) => number | null): number | null => {
    let sum = 0;
    let covered = 0;
    for (const p of positions) {
      const v = pick(p);
      if (v === null) continue;
      sum += (p.weight_pct / 100) * v;
      covered += p.weight_pct;
    }
    return covered >= 50 ? round(sum) : null;
  };

  const change24 = weighted((p) => p.change_24h_pct);
  const change7 = weighted((p) => p.change_7d_pct);
  const pnl24 = positions.reduce((s, p) => s + (p.pnl_24h_usd ?? 0), 0);

  // ---------- attribution, the explain_move decomposition at basket level ----------
  const portfolioBeta = weighted((p) => p.beta_to_btc);
  let attribution: PortfolioAnalysis["attribution"] = null;
  let sectorExcess: number | null = null;

  const sectorMap = new Map<string, { value: number; change: number | null }>();
  for (const p of positions) {
    if (!p.sector) continue;
    const cur = sectorMap.get(p.sector) ?? { value: 0, change: null };
    cur.value += p.value_usd;
    sectorMap.set(p.sector, cur);
  }
  const sectors = [...sectorMap.entries()]
    .map(([name, v]) => {
      const row = sectorRows?.find((s) => s.label === name || s.name === name);
      const change = row && typeof row.avg_price_change === "number" ? round(row.avg_price_change) : null;
      return { name, value_usd: round(v.value, 2), weight_pct: round(total > 0 ? (v.value / total) * 100 : 0), change_24h_pct: change };
    })
    .sort((a, b) => b.value_usd - a.value_usd);

  if (btcChange24h !== null) {
    let excess = 0;
    let covered = 0;
    for (const s of sectors) {
      if (s.change_24h_pct === null) continue;
      excess += (s.weight_pct / 100) * (s.change_24h_pct - btcChange24h);
      covered += s.weight_pct;
    }
    sectorExcess = covered >= 30 ? round(excess) : null;
    if (covered < 30) caveats.push("Sector effect not separated: too little of the portfolio maps to a known sector.");
  }

  if (change24 !== null && btcChange24h !== null) {
    const market = portfolioBeta === null ? null : round(portfolioBeta * btcChange24h);
    const specific = market === null ? null : round(change24 - market - (sectorExcess ?? 0));
    const parts: Array<[NonNullable<PortfolioAnalysis["attribution"]>["read"], number]> = [];
    if (market !== null) parts.push(["market beta", Math.abs(market)]);
    if (sectorExcess !== null) parts.push(["sector rotation", Math.abs(sectorExcess)]);
    if (specific !== null) parts.push(["coin-specific", Math.abs(specific)]);
    parts.sort((a, b) => b[1] - a[1]);
    const top = parts[0];
    const read = !top || (parts[1] && top[1] - parts[1][1] < 0.15 * Math.abs(change24 || 1)) ? "mixed" : top[0];
    const dir = change24 >= 0 ? "up" : "down";
    const readText =
      market === null
        ? `Portfolio is ${dir} ${Math.abs(change24).toFixed(2)}% over 24h.`
        : `Portfolio is ${dir} ${Math.abs(change24).toFixed(2)}% over 24h. Bitcoin moved ${btcChange24h.toFixed(2)}% and this basket's beta is ${portfolioBeta}, so ${market.toFixed(2)} points are market beta${sectorExcess !== null ? `, ${sectorExcess.toFixed(2)} points are sector` : ""}, leaving ${specific?.toFixed(2)} points specific to what you hold.`;
    attribution = {
      total_pct: change24,
      btc_change_pct: round(btcChange24h),
      beta_to_btc: portfolioBeta,
      market_component_pct: market,
      sector_excess_pct: sectorExcess,
      coin_specific_pct: specific,
      read,
      read_text: readText,
    };
  }

  // ---------- concentration ----------
  const weights = positions.map((p) => p.weight_pct / 100);
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const stableShare = positions.filter((p) => p.sector === "Stablecoins").reduce((s, p) => s + p.weight_pct, 0);
  const concentration = {
    top1_pct: round(positions[0]?.weight_pct ?? 0),
    top3_pct: round(positions.slice(0, 3).reduce((s, p) => s + p.weight_pct, 0)),
    hhi: round(hhi, 3),
    effective_positions: hhi > 0 ? round(1 / hhi, 1) : 0,
    stablecoin_pct: round(stableShare),
  };

  // ---------- history of this basket, using today's amounts ----------
  const history: Array<{ date: string; value: number }> = [];
  const btcHistory: Array<{ date: string; value: number }> = [];
  let risk: PortfolioAnalysis["risk"] = null;

  if (series) {
    const perId = new Map(values.map(({ h, coin }) => [coin.id, { amount: h.amount, points: series.get(coin.id) ?? [] }]));
    const shortest = [...perId.entries()].reduce<{ id: number; len: number } | null>(
      (acc, [id, v]) => (acc === null || v.points.length < acc.len ? { id, len: v.points.length } : acc),
      null,
    );
    // Dates where every position has a close, so the basket value is comparable day to day.
    const dateSets = [...perId.values()].map((v) => new Set(v.points.map((p) => p.date)));
    const dates = (btcSeries.length ? btcSeries.map((p) => p.date) : [...(dateSets[0] ?? [])]).filter((d) => dateSets.every((s) => s.has(d)));

    if (dates.length >= MIN_HISTORY_POINTS) {
      const lookup = new Map<number, Map<string, number>>();
      for (const [id, v] of perId) lookup.set(id, new Map(v.points.map((p) => [p.date, p.close])));
      for (const d of dates) {
        let sum = 0;
        for (const [id, v] of perId) sum += v.amount * (lookup.get(id)?.get(d) ?? 0);
        history.push({ date: d, value: round(sum, 2) });
        const b = btcByDate.get(d);
        if (b !== undefined) btcHistory.push({ date: d, value: round(b, 2) });
      }
      risk = basketRisk(
        history.map((p) => p.value),
        btcHistory.length === history.length ? btcHistory.map((p) => p.value) : undefined,
      );
      if (shortest && shortest.len < HISTORY_DAYS - 1) {
        const sym = byId.get(shortest.id)?.symbol ?? "one holding";
        caveats.push(`History is ${history.length} days long because ${sym} has the shortest price record here.`);
      }
    } else {
      caveats.push("Not enough overlapping daily history to chart this basket or measure its risk.");
    }
  }

  const totalMarketChange = global?.total_market_cap_yesterday_percentage_change ?? null;

  caveats.push("Amounts come from this browser and are never stored on the server. There is no cost basis, so returns are price moves, not your profit.");
  if (history.length) caveats.push("The history line values today's amounts at past prices; it is not a record of trades.");

  return {
    total_value_usd: round(total, 2),
    positions,
    change_24h_pct: change24,
    change_24h_usd: change24 === null ? null : round(pnl24, 2),
    change_7d_pct: change7,
    change_7d_usd: change7 === null ? null : round(total - total / (1 + change7 / 100), 2),
    attribution,
    vs_btc_pct: change24 !== null && btcChange24h !== null ? round(change24 - btcChange24h) : null,
    vs_market_pct: change24 !== null && typeof totalMarketChange === "number" ? round(change24 - totalMarketChange) : null,
    concentration,
    sectors,
    contributors: {
      up: positions.filter((p) => (p.contribution_24h_pp ?? 0) > 0).sort((a, b) => (b.contribution_24h_pp ?? 0) - (a.contribution_24h_pp ?? 0)).slice(0, 3),
      down: positions.filter((p) => (p.contribution_24h_pp ?? 0) < 0).sort((a, b) => (a.contribution_24h_pp ?? 0) - (b.contribution_24h_pp ?? 0)).slice(0, 3),
    },
    risk,
    history,
    btc_history: btcHistory,
    computed_at: new Date().toISOString(),
    caveats,
  };
}
