import { test } from "node:test";
import assert from "node:assert/strict";
import { readNow, compactUsd, EXPLAINERS, LEARN_GROUPS, recoveryPct, zoneFor, type ExplainTopic } from "../web/src/lib/explainers.js";

test("no live value means no reading, never a made-up number", () => {
  assert.equal(readNow("market-cap", {}), null);
  assert.equal(readNow("fear-greed", undefined), null);
  assert.equal(readNow("chart", { extra: { days: 90 } }), null);
  assert.equal(readNow("portfolio-attribution", { extra: {} }), null);
});

test("compact dollars and recovery maths", () => {
  assert.equal(compactUsd(2.64e12), "$2.64T");
  assert.equal(compactUsd(82.5e9), "$82.5B");
  assert.equal(compactUsd(412e6), "$412M");
  assert.equal(Math.round(recoveryPct(50)!), 100);
  assert.equal(Math.round(recoveryPct(75)!), 300);
  assert.equal(recoveryPct(100), null);
});

test("fear and greed zones, with a week-ago comparison", () => {
  assert.match(readNow("fear-greed", { value: 12 })!, /Extreme fear/);
  assert.match(readNow("fear-greed", { value: 50 })!, /Neutral/);
  assert.match(readNow("fear-greed", { value: 67, previous: 76 })!, /is Greed.*A week ago it read 76, extreme greed\./);
});

test("altcoin season zones", () => {
  assert.match(readNow("altcoin-index", { value: 80 })!, /altcoin season/);
  assert.match(readNow("altcoin-index", { value: 10 })!, /bitcoin season/);
  assert.equal(zoneFor(EXPLAINERS["altcoin-index"].scale!, 36).label, "Mixed");
});

test("dominance and market cap readings use the live numbers and the week before", () => {
  assert.match(readNow("dominance", { value: 58.84, change: -0.01, previous: 57.6 })!, /58\.8%.*Bitcoin-led.*A week ago it was 57\.6%, so it has risen 1\.2 points\./);
  assert.match(readNow("market-cap", { value: 2.64e12, change: -0.45 })!, /\$2\.64T, down 0\.45% on the day\. A quiet day\.$/);
  assert.match(readNow("market-cap", { value: 2.64e12, previous: 2.5e12 })!, /On the week it is up 5\.6%, from \$2\.50T\./);
});

test("chart combines cap and dominance direction", () => {
  assert.match(readNow("chart", { extra: { days: 90, capChangePct: 12, domChangePts: -1.8 } })!, /rotating into altcoins/);
  assert.match(readNow("chart", { extra: { days: 30, capChangePct: -8, domChangePts: 1.2 } })!, /hiding in Bitcoin/);
});

test("liquidations: which side and how heavy", () => {
  assert.match(readNow("liquidations", { value: 620e6, extra: { longSharePct: 72 } })!, /72% of them longs\. Longs took the pain.*heavy day/);
  assert.match(readNow("liquidations", { value: 80e6, extra: { longSharePct: 30 } })!, /Shorts were squeezed.*calm day/);
});

test("coin risk readings", () => {
  assert.match(readNow("volatility", { value: 95 })!, /95% a year\. Wild/);
  assert.match(readNow("drawdown", { value: -50 })!, /50\.0%\. A typical crypto shakeout\. Climbing back to that peak takes a 100% rise\./);
  assert.match(readNow("correlation", { value: 0.86 })!, /0\.86 means it moves almost in step with Bitcoin/);
  assert.match(readNow("ath", { value: -75 })!, /75\.0% below its all-time high\. Getting back there takes a 300% rise\./);
  assert.equal(readNow("ath", { value: -0.4 }), "It is trading at or near its all-time high.");
});

test("portfolio readings", () => {
  assert.match(readNow("vs-btc", { value: -1.25 })!, /1\.25% worse than holding/);
  assert.match(readNow("concentration", { value: 62, extra: { effective: 1.8 } })!, /62% of the basket, and it behaves like 1\.8 equally sized positions\. One coin decides/);
  assert.match(readNow("portfolio-attribution", { extra: { market: 1.2, sector: -0.3, own: 0.45, beta: 1.1 } })!, /\+1\.20% came from the market, -0\.30% from your sectors and \+0\.45%.*beta is 1\.10/);
});

test("only dominance and liquidations offer the separate analyst link", () => {
  const withLink = (Object.keys(EXPLAINERS) as ExplainTopic[]).filter((t) => EXPLAINERS[t].analyse);
  assert.deepEqual(withLink.sort(), ["dominance", "liquidations"]);
});

test("the Learn page lists every topic exactly once", () => {
  const listed = LEARN_GROUPS.flatMap((g) => g.topics).sort();
  assert.deepEqual(listed, (Object.keys(EXPLAINERS) as ExplainTopic[]).sort());
});
