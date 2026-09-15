import { test } from "node:test";
import assert from "node:assert/strict";
import { readNow, compactUsd, EXPLAINERS, zoneFor } from "../web/src/lib/explainers.js";

test("no live value means no reading, never a made-up number", () => {
  assert.equal(readNow("market-cap", {}), null);
  assert.equal(readNow("fear-greed", undefined), null);
  assert.equal(readNow("chart", { extra: { days: 90 } }), null);
});

test("compact dollars", () => {
  assert.equal(compactUsd(2.64e12), "$2.64T");
  assert.equal(compactUsd(82.5e9), "$82.5B");
  assert.equal(compactUsd(412e6), "$412M");
});

test("fear and greed zones", () => {
  assert.match(readNow("fear-greed", { value: 12 })!, /Extreme fear/);
  assert.match(readNow("fear-greed", { value: 50 })!, /Neutral/);
  assert.match(readNow("fear-greed", { value: 68 })!, /is Greed/);
  assert.match(readNow("fear-greed", { value: 90 })!, /Extreme greed/);
});

test("altcoin season zones", () => {
  assert.match(readNow("altcoin-index", { value: 80 })!, /altcoin season/);
  assert.match(readNow("altcoin-index", { value: 10 })!, /bitcoin season/);
  assert.equal(zoneFor(EXPLAINERS["altcoin-index"].scale!, 36).label, "Mixed");
});

test("dominance and market cap readings use the live numbers", () => {
  assert.match(readNow("dominance", { value: 58.84, change: -0.01 })!, /58\.8%.*Bitcoin-led/);
  assert.match(readNow("market-cap", { value: 2.64e12, change: -0.45 })!, /\$2\.64T, down 0\.45% on the day\. A quiet day\./);
});

test("chart combines cap and dominance direction", () => {
  assert.match(readNow("chart", { extra: { days: 90, capChangePct: 12, domChangePts: -1.8 } })!, /rotating into altcoins/);
  assert.match(readNow("chart", { extra: { days: 30, capChangePct: -8, domChangePts: 1.2 } })!, /hiding in Bitcoin/);
});

test("liquidations: which side and how heavy", () => {
  assert.match(readNow("liquidations", { value: 620e6, extra: { longSharePct: 72 } })!, /72% of them longs\. Longs took the pain.*heavy day/);
  assert.match(readNow("liquidations", { value: 80e6, extra: { longSharePct: 30 } })!, /Shorts were squeezed.*calm day/);
});
