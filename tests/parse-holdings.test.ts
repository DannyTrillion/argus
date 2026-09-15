import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHoldings, resolveHoldings } from "../web/src/lib/parseHoldings.js";

test("parses amount-first and symbol-first lists, commas and new lines", () => {
  const r = parseHoldings("0.5 BTC, 10 SOL\nxrp 2,500\nETH: .25");
  assert.deepEqual(r.items, [
    { symbol: "BTC", amount: 0.5 },
    { symbol: "SOL", amount: 10 },
    { symbol: "XRP", amount: 2500 },
    { symbol: "ETH", amount: 0.25 },
  ]);
  assert.deepEqual(r.unreadable, []);
});

test("keeps thousands separators, adds repeats, reports junk", () => {
  const r = parseHoldings("1,000,000 SHIB; btc 1, BTC 0.5, hello, 0 DOGE");
  assert.deepEqual(r.items, [{ symbol: "SHIB", amount: 1_000_000 }, { symbol: "BTC", amount: 1.5 }]);
  assert.deepEqual(r.unreadable, ["hello", "0 DOGE"]);
});

test("resolves shared tickers to the highest-ranked coin and lists unknown ones", () => {
  const coins = [
    { id: 999, symbol: "BTC", cmc_rank: 4000 },
    { id: 1, symbol: "BTC", cmc_rank: 1 },
    { id: 5426, symbol: "SOL", cmc_rank: 6 },
  ];
  const r = resolveHoldings([{ symbol: "BTC", amount: 1 }, { symbol: "SOL", amount: 2 }, { symbol: "NOPE", amount: 3 }], coins);
  assert.deepEqual(r.matched, [{ id: 1, symbol: "BTC", amount: 1 }, { id: 5426, symbol: "SOL", amount: 2 }]);
  assert.deepEqual(r.unknown, ["NOPE"]);
});
