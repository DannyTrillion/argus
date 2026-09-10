import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCoin, coinsFrom, bestPerSymbol, type RawCoin } from "../src/cmc/endpoints.ts";
import { pickSectors } from "../src/services/market.ts";

const quoteMap = { USD: { price: 1234.5678, volume_24h: 1e9, percent_change_1h: 0.123456, percent_change_24h: -1.98765, percent_change_7d: 3.14159, market_cap: 2.5e11 } };

test("normalizeCoin rounds numbers and drops noisy tags", () => {
  const c = normalizeCoin({ id: 1, name: "X", symbol: "X", slug: "x", tags: ["layer-1", "coinbase-ventures-portfolio", { name: "Smart Contracts", slug: "smart-contracts" }, "FTX Bankruptcy Estate "], quote: quoteMap } as RawCoin);
  assert.deepEqual(c.tags, ["layer-1", "smart-contracts"]);
  assert.equal(c.quote.percent_change_24h, -1.99);
  assert.equal(c.quote.price, 1234.5678);
  assert.equal(c.quote.market_cap, 2.5e11);
});

test("normalizeCoin accepts v3 quote arrays and picks USD", () => {
  const c = normalizeCoin({ id: 1, name: "X", symbol: "X", slug: "x", quote: [{ symbol: "EUR", price: 1 }, { symbol: "USD", price: 2, volume_24h: 3, percent_change_1h: 0, percent_change_24h: 0, percent_change_7d: 0, market_cap: 4 }] } as unknown as RawCoin);
  assert.equal(c.quote.price, 2);
});

test("coinsFrom flattens arrays, id maps and symbol maps of arrays", () => {
  const raw = { id: 1, name: "X", symbol: "X", slug: "x", quote: quoteMap } as RawCoin;
  assert.equal(coinsFrom([raw]).length, 1);
  assert.equal(coinsFrom({ "1": raw }).length, 1);
  assert.equal(coinsFrom({ X: [raw, { ...raw, id: 2 }] }).length, 2);
  assert.equal(coinsFrom(null).length, 0);
});

test("bestPerSymbol keeps the best-ranked active asset per ticker", () => {
  const mk = (id: number, rank: number | null) => normalizeCoin({ id, name: `N${id}`, symbol: "SOL", slug: `s${id}`, cmc_rank: rank, quote: quoteMap } as RawCoin);
  const coins = [mk(1, 500), mk(2, 7), mk(3, null)];
  const raw = [{ id: 1, is_active: 1 }, { id: 2, is_active: 1 }, { id: 3, is_active: 0 }];
  const out = bestPerSymbol(coins, raw);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 2);
});

test("pickSectors keeps real sectors, drops taxonomies, one per label, largest wins", () => {
  const cats = [
    { id: "a", name: "Layer 1", num_tokens: 50, market_cap: 100 },
    { id: "b", name: "SEC/CFTC Digital Commodities", num_tokens: 30, market_cap: 90 },
    { id: "c", name: "Memes", num_tokens: 200, market_cap: 40 },
    { id: "d", name: "Meme", num_tokens: 20, market_cap: 60 },
    { id: "e", name: "DeFi", num_tokens: 2, market_cap: 80 },
    { id: "f", name: "Winklevoss Capital Portfolio", num_tokens: 10, market_cap: 70 },
  ];
  const out = pickSectors(cats);
  assert.deepEqual(out.map((s) => [s.name, s.id]), [["Layer 1", "a"], ["Memes", "d"]]);
});
