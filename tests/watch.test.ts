import { test } from "node:test";
import assert from "node:assert/strict";
import { detect } from "../src/services/watch.ts";

const coin = (id: number, symbol: string, p24: number, p1 = 0, cap = 1e9, vol = 1e8, vc = 0) => ({
  id, name: symbol, symbol, slug: symbol.toLowerCase(), sparkline: [],
  quote: { price: 1, volume_24h: vol, volume_change_24h: vc, percent_change_1h: p1, percent_change_24h: p24, percent_change_7d: 0, market_cap: cap },
});
const overview = (extra: Partial<{ dom: number; liq1h: number; fg: number }> = {}) => ({
  global: { btc_dominance: 59, eth_dominance: 11, btc_dominance_24h_percentage_change: extra.dom ?? 0, total_market_cap: 2.6e12, total_volume_24h: 9e10, total_market_cap_yesterday_percentage_change: -1 },
  fearGreed: { value: extra.fg ?? 60, value_classification: "Greed" },
  altcoinSeason: { altcoin_index: 40, altcoin_marketcap: 1e12, snapshot_time: "" },
  liquidations: { total_liquidations_1h: extra.liq1h ?? 1e6, long_liquidations_1h: (extra.liq1h ?? 1e6) * 0.8, short_liquidations_1h: (extra.liq1h ?? 1e6) * 0.2, total_liquidations_4h: 5e6, long_liquidations_4h: 4e6, short_liquidations_4h: 1e6, total_liquidations_24h: 1e8, long_liquidations_24h: 8e7, short_liquidations_24h: 2e7 },
  updatedAt: "",
});

test("detect flags liquid big movers and ignores illiquid ones", () => {
  const s = detect({ coins: [coin(1, "BIG", -9), coin(2, "TINY", 40, 0, 1e7, 1e5), coin(3, "CALM", 1)], overview: overview(), sectors: [], lastFearGreed: null });
  assert.deepEqual(s.map((x) => x.fingerprint), ["coin:1:24h:down"]);
  assert.equal(s[0].severity, 2);
});

test("detect flags 1h moves on large caps, volume spikes, liquidation bursts, dominance and sentiment", () => {
  const s = detect({
    coins: [coin(1, "FAST", 2, 5, 2e9), coin(2, "VOL", 3, 0, 1e9, 2e8, 200)],
    overview: overview({ dom: 0.8, liq1h: 6e7, fg: 80 }),
    sectors: [{ id: "x", name: "Memes", num_tokens: 50, market_cap: 6e9, market_cap_change: 8 }],
    lastFearGreed: 70,
  });
  const kinds = s.map((x) => x.kind).sort();
  assert.deepEqual(kinds, ["coin_move", "dominance_break", "liquidation_burst", "sector_divergence", "sentiment_shift", "volume_spike"]);
  assert.ok(s[0].severity >= s[s.length - 1].severity, "sorted by severity");
});

test("detect is quiet on a calm market", () => {
  const s = detect({ coins: [coin(1, "A", 1), coin(2, "B", -2)], overview: overview(), sectors: [{ id: "x", name: "DeFi", num_tokens: 50, market_cap: 6e9, market_cap_change: -1 }], lastFearGreed: 60 });
  assert.equal(s.length, 0);
});
