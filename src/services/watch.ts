/**
 * "Argus noticed": an unattended watch loop. Every few minutes it scans the data
 * the dashboard already fetches for anomalies, and when one trips it asks the agent
 * to investigate and writes a short finding. Bounded by per-signal cooldowns and a
 * daily investigation cap so it cannot run away with credits.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages";
import * as market from "./market.js";
import { explainMove, type Explanation } from "./explain.js";
import { runAgent } from "../agent/agent.js";
import { config } from "../config.js";

export type SignalKind = "coin_move" | "volume_spike" | "liquidation_burst" | "dominance_break" | "sector_divergence" | "sentiment_shift";

export interface Signal {
  fingerprint: string;
  kind: SignalKind;
  title: string;
  detail: string;
  subject: { type: "coin"; id: number; symbol: string; name: string } | { type: "sector"; name: string } | { type: "market" };
  severity: 1 | 2 | 3;
  metric: number;
  observedAt: string;
}

export interface Finding extends Signal {
  id: string;
  summary: string;
  question: string;
  attribution: Explanation | null;
  calls: number;
  credits: number;
  investigatedAt: string;
}

interface State {
  findings: Finding[];
  cooldowns: Record<string, string>;
  lastScanAt: string | null;
  nextScanAt: string | null;
  investigationsToday: { day: string; count: number };
  lastFearGreed: number | null;
}

const FILE = process.env.WATCH_STATE_FILE ?? ".cache/watch.json";
const INTERVAL_MS = Number(process.env.WATCH_INTERVAL_MINUTES ?? 10) * 60_000;
const COOLDOWN_MS = Number(process.env.WATCH_COOLDOWN_HOURS ?? 6) * 3_600_000;
const MAX_PER_SCAN = Number(process.env.WATCH_MAX_PER_SCAN ?? 2);
const MAX_PER_DAY = Number(process.env.WATCH_MAX_PER_DAY ?? 12);
const MAX_FINDINGS = 40;

let state: State = load();
let timer: NodeJS.Timeout | null = null;
let scanning: Promise<Finding[]> | null = null;

function load(): State {
  try {
    const s = JSON.parse(readFileSync(FILE, "utf8")) as State;
    if (Array.isArray(s.findings)) return { ...s, findings: s.findings.slice(0, MAX_FINDINGS) };
  } catch { /* fresh */ }
  return { findings: [], cooldowns: {}, lastScanAt: null, nextScanAt: null, investigationsToday: { day: "", count: 0 }, lastFearGreed: null };
}

function save(): void {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(state));
  } catch (err) {
    console.warn("[watch] could not persist state:", err instanceof Error ? err.message : err);
  }
}

const fmtUsd = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${Math.round(n).toLocaleString()}`);
const fmtPct = (n: number, d = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;

/** Pure: derive signals from a snapshot. Exported for tests. */
export function detect(input: {
  coins: market.CoinRow[];
  overview: Awaited<ReturnType<typeof market.overview>>;
  sectors: Awaited<ReturnType<typeof market.sectors>>;
  lastFearGreed: number | null;
}): Signal[] {
  const now = new Date().toISOString();
  const out: Signal[] = [];
  const { coins, overview, sectors } = input;
  const g = overview.global;

  for (const c of coins) {
    const cap = c.quote.market_cap ?? 0;
    const vol = c.quote.volume_24h ?? 0;
    const liquid = cap >= 500e6 && vol >= 50e6;
    if (!liquid) continue;
    // Stablecoins do not reprice; their volume swings are flow, not signal.
    if ((c.tags ?? []).some((t) => /stablecoin/i.test(t)) || /^(USDT|USDC|DAI|USDE|USD1|PYUSD|FDUSD|TUSD|USDS|USDG)$/i.test(c.symbol)) continue;
    const p24 = c.quote.percent_change_24h ?? 0;
    const p1 = c.quote.percent_change_1h ?? 0;
    const subject = { type: "coin" as const, id: c.id, symbol: c.symbol, name: c.name };
    if (Math.abs(p24) >= 8) {
      out.push({ fingerprint: `coin:${c.id}:24h:${p24 > 0 ? "up" : "down"}`, kind: "coin_move", title: `${c.symbol} ${fmtPct(p24)} in 24h`, detail: `${c.name} moved ${fmtPct(p24)} over 24h on ${fmtUsd(vol)} volume, ${fmtUsd(cap)} market cap.`, subject, severity: Math.abs(p24) >= 15 ? 3 : 2, metric: p24, observedAt: now });
    } else if (Math.abs(p1) >= 4 && cap >= 1e9) {
      out.push({ fingerprint: `coin:${c.id}:1h:${p1 > 0 ? "up" : "down"}`, kind: "coin_move", title: `${c.symbol} ${fmtPct(p1)} in the last hour`, detail: `${c.name} moved ${fmtPct(p1)} in one hour, ${fmtUsd(cap)} market cap.`, subject, severity: 2, metric: p1, observedAt: now });
    }
    const vc = c.quote.volume_change_24h ?? 0;
    if (vc >= 150 && cap >= 500e6 && Math.abs(p24) < 8) {
      out.push({ fingerprint: `coin:${c.id}:volume`, kind: "volume_spike", title: `${c.symbol} volume ${fmtPct(vc, 0)} vs yesterday`, detail: `${c.name} is trading ${fmtUsd(vol)} in 24h, ${fmtPct(vc, 0)} versus the day before, with price only ${fmtPct(p24)}.`, subject, severity: 1, metric: vc, observedAt: now });
    }
  }

  const liq = overview.liquidations;
  if (liq) {
    if (liq.total_liquidations_1h >= 50e6) {
      const longShare = Math.round((liq.long_liquidations_1h / (liq.total_liquidations_1h || 1)) * 100);
      out.push({ fingerprint: `liq:1h`, kind: "liquidation_burst", title: `${fmtUsd(liq.total_liquidations_1h)} liquidated in one hour`, detail: `${longShare}% longs. A ${longShare >= 65 ? "long flush" : longShare <= 35 ? "short squeeze" : "two-sided wipeout"} is under way.`, subject: { type: "market" }, severity: liq.total_liquidations_1h >= 150e6 ? 3 : 2, metric: liq.total_liquidations_1h, observedAt: now });
    } else if (liq.total_liquidations_4h >= 150e6) {
      const longShare = Math.round((liq.long_liquidations_4h / (liq.total_liquidations_4h || 1)) * 100);
      out.push({ fingerprint: `liq:4h`, kind: "liquidation_burst", title: `${fmtUsd(liq.total_liquidations_4h)} liquidated in four hours`, detail: `${longShare}% longs over the last four hours.`, subject: { type: "market" }, severity: 2, metric: liq.total_liquidations_4h, observedAt: now });
    }
  }

  const domChg = g.btc_dominance_24h_percentage_change ?? 0;
  if (Math.abs(domChg) >= 0.6) {
    out.push({ fingerprint: `dom:${domChg > 0 ? "up" : "down"}`, kind: "dominance_break", title: `BTC dominance ${fmtPct(domChg, 2)} pts in 24h`, detail: `Dominance is ${g.btc_dominance.toFixed(2)}%. ${domChg > 0 ? "Capital is concentrating in Bitcoin." : "Capital is moving out of Bitcoin into alts."}`, subject: { type: "market" }, severity: Math.abs(domChg) >= 1.2 ? 3 : 2, metric: domChg, observedAt: now });
  }

  const mkt = g.total_market_cap_yesterday_percentage_change ?? 0;
  for (const s of sectors) {
    if ((s.market_cap ?? 0) < 5e9 || typeof s.market_cap_change !== "number") continue;
    const diff = s.market_cap_change - mkt;
    if (Math.abs(diff) >= 5) {
      out.push({ fingerprint: `sector:${s.name}:${diff > 0 ? "up" : "down"}`, kind: "sector_divergence", title: `${s.name} ${fmtPct(s.market_cap_change)} vs market ${fmtPct(mkt)}`, detail: `${s.name} (${fmtUsd(s.market_cap ?? 0)} cap) is diverging from the market by ${fmtPct(diff)} on the day.`, subject: { type: "sector", name: s.name }, severity: Math.abs(diff) >= 10 ? 3 : 2, metric: diff, observedAt: now });
    }
  }

  const fg = overview.fearGreed.value;
  const last = input.lastFearGreed;
  if (last !== null) {
    const crossed = (last < 75 && fg >= 75) || (last >= 75 && fg < 75) || (last > 25 && fg <= 25) || (last <= 25 && fg > 25);
    if (crossed || Math.abs(fg - last) >= 10) {
      out.push({ fingerprint: `fg:${fg >= 75 ? "greed" : fg <= 25 ? "fear" : "mid"}`, kind: "sentiment_shift", title: `Fear & Greed ${last} → ${fg} (${overview.fearGreed.value_classification})`, detail: crossed ? "The index crossed a regime line." : "A ten-point move in sentiment since the last check.", subject: { type: "market" }, severity: crossed ? 2 : 1, metric: fg - last, observedAt: now });
    }
  }

  return out.sort((a, b) => b.severity - a.severity || Math.abs(b.metric) - Math.abs(a.metric));
}

function questionFor(s: Signal): string {
  if (s.subject.type === "coin") return `Why is ${s.subject.symbol} moving today? It is ${s.title.replace(`${s.subject.symbol} `, "")}.`;
  if (s.subject.type === "sector") return `Why is the ${s.subject.name} sector diverging from the market today?`;
  if (s.kind === "liquidation_burst") return "What just got liquidated and what does it mean for the next few hours?";
  if (s.kind === "dominance_break") return "Why is BTC dominance breaking today and what does it mean for alts?";
  return "What changed in market sentiment today?";
}

async function investigate(s: Signal): Promise<Finding> {
  const started = Date.now();
  let calls = 0;
  let credits = 0;
  const attribution = s.subject.type === "coin" ? await explainMove(s.subject.id, s.kind === "coin_move" && s.title.includes("hour") ? "1h" : "24h").catch(() => null) : null;
  const prompt =
    `You are investigating an anomaly Argus detected automatically. Signal: ${s.title}. ${s.detail}` +
    (attribution ? ` Attribution already computed: ${attribution.read_text}` : "") +
    ` Write the finding in under 110 words: what happened, the most likely read (market beta, sector rotation, coin-specific, leverage), and one thing to watch. Numbers from tools only. No headings, no follow-up block needed.`;
  const messages: BetaMessageParam[] = [{ role: "user", content: prompt }];
  let summary = "";
  try {
    const r = await runAgent({ messages, maxIterations: 8, onEvent: (e) => { if (e.type === "api_call") { calls += 1; credits += e.record.creditCount; } } });
    summary = r.text.replace(/<followups>[\s\S]*$/i, "").trim();
  } catch (err) {
    summary = `Investigation failed: ${err instanceof Error ? err.message : String(err)}`;
  }
  void started;
  return { ...s, id: crypto.randomUUID(), summary, question: questionFor(s), attribution, calls, credits, investigatedAt: new Date().toISOString() };
}

export function scan(): Promise<Finding[]> {
  if (scanning) return scanning;
  scanning = (async () => {
    const fresh: Finding[] = [];
    try {
      const [coinsRes, overview, sectors] = await Promise.all([market.coins(200), market.overview(), market.sectors()]);
      const signals = detect({ coins: coinsRes.coins, overview, sectors, lastFearGreed: state.lastFearGreed });
      state.lastFearGreed = overview.fearGreed.value;
      const now = Date.now();
      const today = new Date().toISOString().slice(0, 10);
      if (state.investigationsToday.day !== today) state.investigationsToday = { day: today, count: 0 };
      const eligible = signals.filter((s) => {
        const last = state.cooldowns[s.fingerprint];
        return !last || now - Date.parse(last) > COOLDOWN_MS;
      });
      const budget = Math.max(0, Math.min(MAX_PER_SCAN, MAX_PER_DAY - state.investigationsToday.count));
      for (const s of eligible.slice(0, budget)) {
        state.cooldowns[s.fingerprint] = new Date().toISOString();
        state.investigationsToday.count += 1;
        const f = await investigate(s);
        fresh.push(f);
        state.findings = [f, ...state.findings].slice(0, MAX_FINDINGS);
        save();
      }
      // Prune old cooldowns.
      for (const [k, v] of Object.entries(state.cooldowns)) if (now - Date.parse(v) > 2 * COOLDOWN_MS) delete state.cooldowns[k];
    } catch (err) {
      console.error("[watch] scan failed:", err instanceof Error ? err.message : err);
    } finally {
      state.lastScanAt = new Date().toISOString();
      state.nextScanAt = new Date(Date.now() + INTERVAL_MS).toISOString();
      save();
      scanning = null;
    }
    return fresh;
  })();
  return scanning;
}

export function findings() {
  return {
    findings: state.findings,
    lastScanAt: state.lastScanAt,
    nextScanAt: state.nextScanAt,
    intervalMinutes: INTERVAL_MS / 60_000,
    investigationsToday: state.investigationsToday.count,
    dailyCap: MAX_PER_DAY,
    scanning: scanning !== null,
    watching: { coins: 200, sectors: true, liquidations: true, dominance: true, sentiment: true },
  };
}

export function startWatch(): void {
  if (timer) return;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[watch] ANTHROPIC_API_KEY not set; automated investigations disabled");
    return;
  }
  if (config.keyless) return;
  // First scan shortly after boot so the feed is not empty for long, then on the interval.
  setTimeout(() => void scan(), 20_000).unref();
  timer = setInterval(() => void scan(), INTERVAL_MS);
  timer.unref();
}
