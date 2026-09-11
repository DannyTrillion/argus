/**
 * Move explainer: decompose a coin's move over a window into market beta, sector
 * effect and a coin-specific residual, plus leverage pressure. Deterministic, no LLM.
 *
 *   coin_change      = observed % change over the window
 *   market_component = beta_to_BTC * BTC % change over the window
 *   sector_excess    = sector average % change - BTC % change  (what the sector did beyond the market)
 *   coin_specific    = coin_change - market_component - sector_excess
 *
 * Beta comes from 30 daily closes (corr * vol_coin / vol_btc). It is a rough, honest
 * number, and the response says so.
 */
import * as cmc from "../cmc/endpoints.js";
import { CmcApiError } from "../cmc/http.js";
import { logReturns, pearson, stddev } from "../agent/analytics.js";
import { memo, MINUTE } from "../api/cache.js";
import { pickSectors } from "./market.js";

export type Window = "1h" | "24h" | "7d";

/** Map CMC tag slugs to the curated sector labels in market.ts. */
const TAG_TO_SECTOR: Array<[RegExp, string]> = [
  [/^layer-1$/, "Layer 1"],
  [/^layer-2$/, "Layer 2"],
  [/^defi$/, "DeFi"],
  [/stablecoin/, "Stablecoins"],
  [/^memes?$/, "Memes"],
  [/^ai-big-data$|^ai-agents$|^generative-ai$/, "AI & Big Data"],
  [/^gaming$/, "Gaming"],
  [/real-world-assets|^rwa$/, "RWA"],
  [/^privacy$/, "Privacy"],
  [/centralized-exchange|^exchange-based-tokens?$/, "Exchange tokens"],
  [/decentralized-exchange|^dex$|^amm$/, "DEX"],
  [/^lending|borrowing/, "Lending"],
  [/liquid-staking/, "Liquid staking"],
  [/perpetual/, "Perpetuals"],
  [/^oracles?$/, "Oracles"],
  [/^interoperability$/, "Interoperability"],
  [/^storage$|^filesharing$/, "Storage"],
  [/^depin$/, "DePIN"],
  [/collectibles-nfts|^nft$/, "NFT"],
  [/^payments$/, "Payments"],
  [/^modular/, "Modular"],
  [/restaking/, "Restaking"],
  [/^launchpad/, "Launchpads"],
  [/prediction-market/, "Prediction markets"],
];

/** First curated sector label matching a coin's CMC tag slugs, or null. */
export function sectorForTags(tags: string[] | undefined): string | null {
  for (const tag of tags ?? []) {
    const hit = TAG_TO_SECTOR.find(([re]) => re.test(tag));
    if (hit) return hit[1];
  }
  return null;
}

export interface Explanation {
  symbol: string;
  name: string;
  id: number;
  window: Window;
  coin_change_pct: number;
  btc_change_pct: number;
  total_market_change_pct: number | null;
  beta_to_btc: number | null;
  correlation_to_btc: number | null;
  market_component_pct: number | null;
  sector: { name: string; change_pct: number; excess_pct: number } | null;
  coin_specific_pct: number | null;
  leverage: { coin_liquidations_usd: number | null; long_share_pct: number | null; market_liquidations_24h_usd: number | null; market_long_share_pct: number | null } | null;
  /** Which component dominates, in plain words. */
  read: "market beta" | "sector rotation" | "coin-specific" | "mixed";
  read_text: string;
  price: number | null;
  market_cap: number | null;
  volume_24h: number | null;
  volume_change_24h_pct: number | null;
  computed_at: string;
  caveats: string[];
}

function pctForWindow(q: cmc.Quote, w: Window): number | null {
  return w === "1h" ? (q.percent_change_1h ?? null) : w === "7d" ? (q.percent_change_7d ?? null) : (q.percent_change_24h ?? null);
}

async function optional<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CmcApiError) return null;
    throw err;
  }
}

export function explainMove(symbolOrId: string | number, window: Window = "24h"): Promise<Explanation> {
  const key = `explain:${String(symbolOrId).toUpperCase()}:${window}`;
  return memo(key, 2 * MINUTE, async () => {
    const caveats: string[] = [];
    const isId = typeof symbolOrId === "number" || /^\d+$/.test(String(symbolOrId));
    const [coins, btcArr, global, sectors, liq, liqByCoin] = await Promise.all([
      isId ? cmc.quotes({ ids: [Number(symbolOrId)] }) : cmc.quotes({ symbols: [String(symbolOrId).toUpperCase()] }),
      cmc.quotes({ ids: [1] }),
      cmc.globalMetrics(),
      cmc.categories({ limit: 500 }).then(pickSectors),
      optional(() => cmc.liquidations()),
      optional(() => cmc.liquidationsByCrypto(40)),
    ]);
    const coin = coins[0];
    const btc = btcArr[0];
    if (!coin || !btc) throw new Error(`Unknown asset ${symbolOrId}`);

    const coinChange = pctForWindow(coin.quote, window);
    const btcChange = pctForWindow(btc.quote, window);
    if (coinChange === null || btcChange === null) throw new Error("No percent change available for that window");

    // Beta from 30 daily closes.
    let beta: number | null = null;
    let corr: number | null = null;
    if (coin.id !== 1) {
      const [cs, bs] = await Promise.all([
        optional(() => cmc.quotesHistorical({ id: coin.id, count: 31 })),
        optional(() => cmc.quotesHistorical({ id: 1, count: 31 })),
      ]);
      if (cs && bs && cs.candles.length > 10 && bs.candles.length > 10) {
        const byDate = new Map(bs.candles.map((c) => [c.time_close.slice(0, 10), c.close]));
        const pairs = cs.candles.map((c) => [c.close, byDate.get(c.time_close.slice(0, 10))] as const).filter((p): p is readonly [number, number] => p[1] !== undefined);
        const rc = logReturns(pairs.map((p) => p[0]));
        const rb = logReturns(pairs.map((p) => p[1]));
        corr = pearson(rc, rb);
        const sc = stddev(rc);
        const sb = stddev(rb);
        if (corr !== null && sb > 0) beta = Math.round((corr * (sc / sb)) * 100) / 100;
        if (corr !== null) corr = Math.round(corr * 100) / 100;
      } else caveats.push("Beta unavailable: not enough daily history.");
    } else {
      beta = 1;
      corr = 1;
    }

    // Sector: first tag that maps to a curated sector. Sector change is CMC's 24h avg price change,
    // so for 1h and 7d windows it is only a hint.
    let sector: Explanation["sector"] = null;
    for (const tag of coin.tags ?? []) {
      const hit = TAG_TO_SECTOR.find(([re]) => re.test(tag));
      if (!hit) continue;
      const s = sectors.find((x) => x.name === hit[1]);
      if (s && typeof s.avg_price_change === "number") {
        sector = { name: s.name, change_pct: Math.round(s.avg_price_change * 100) / 100, excess_pct: Math.round((s.avg_price_change - btcChange) * 100) / 100 };
        if (window !== "24h") caveats.push("Sector change is a 24h figure; treat it as a hint for this window.");
        break;
      }
    }
    if (!sector) caveats.push("No sector match for this coin's tags; sector effect not separated.");

    const marketComponent = beta === null ? null : Math.round(beta * btcChange * 100) / 100;
    const coinSpecific = marketComponent === null ? null : Math.round((coinChange - marketComponent - (sector?.excess_pct ?? 0)) * 100) / 100;

    // Leverage: this coin's liquidations if the plan allows, plus the market total.
    let leverage: Explanation["leverage"] = null;
    if (liq) {
      let coinLiq: number | null = null;
      let longShare: number | null = null;
      if (liqByCoin) {
        const row = liqByCoin.find((r) => r.id === coin.id || r.symbol === coin.symbol);
        if (row && row.total_24h > 0) {
          coinLiq = row.total_24h;
          longShare = Math.round((row.long_24h / row.total_24h) * 100);
        }
      }
      leverage = {
        coin_liquidations_usd: coinLiq,
        long_share_pct: longShare,
        market_liquidations_24h_usd: liq.total_liquidations_24h,
        market_long_share_pct: Math.round((liq.long_liquidations_24h / (liq.total_liquidations_24h || 1)) * 100),
      };
    }

    // Classification by dominant absolute share.
    const parts: Array<[Explanation["read"], number]> = [];
    if (marketComponent !== null) parts.push(["market beta", Math.abs(marketComponent)]);
    if (sector) parts.push(["sector rotation", Math.abs(sector.excess_pct)]);
    if (coinSpecific !== null) parts.push(["coin-specific", Math.abs(coinSpecific)]);
    parts.sort((a, b) => b[1] - a[1]);
    const total = parts.reduce((a, p) => a + p[1], 0) || 1;
    let read: Explanation["read"] = "mixed";
    if (parts.length && parts[0][1] / total >= 0.5) read = parts[0][0];

    const fmt = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
    const pieces: string[] = [];
    if (marketComponent !== null && beta !== null) pieces.push(`market beta explains ${fmt(marketComponent)} (BTC ${fmt(btcChange)} × beta ${beta})`);
    if (sector) pieces.push(`${sector.name} sector adds ${fmt(sector.excess_pct)} beyond the market`);
    if (coinSpecific !== null) pieces.push(`${fmt(coinSpecific)} is coin-specific`);
    const readText = `${coin.symbol} ${fmt(coinChange)} over ${window}: ${pieces.join("; ")}. Read: ${read}.`;

    return {
      symbol: coin.symbol,
      name: coin.name,
      id: coin.id,
      window,
      coin_change_pct: coinChange,
      btc_change_pct: btcChange,
      total_market_change_pct: window === "24h" ? (global.total_market_cap_yesterday_percentage_change ?? null) : null,
      beta_to_btc: beta,
      correlation_to_btc: corr,
      market_component_pct: marketComponent,
      sector,
      coin_specific_pct: coinSpecific,
      leverage,
      read,
      read_text: readText,
      price: coin.quote.price,
      market_cap: coin.quote.market_cap,
      volume_24h: coin.quote.volume_24h,
      volume_change_24h_pct: coin.quote.volume_change_24h ?? null,
      computed_at: new Date().toISOString(),
      caveats,
    } satisfies Explanation;
  });
}
