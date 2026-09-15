/**
 * What this site's Anthropic key spends, by kind of work, estimated from token counts.
 * Runs on a visitor's own key are counted but not costed: they are not billed to the site.
 * The Anthropic Console has the exact bill; this is the at-a-glance version.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type UsageKind = "analyst" | "brief" | "investigation" | "headline";
export interface TokenUsage { input: number; output: number; cacheRead: number; cacheWrite: number }

/** USD per million tokens, Anthropic first-party rates. Cache reads bill at 0.1x input, 5-minute cache writes at 1.25x. */
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export function estimateUsd(model: string, u: TokenUsage): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return (u.input * p.input + u.output * p.output + u.cacheRead * p.input * 0.1 + u.cacheWrite * p.input * 1.25) / 1_000_000;
}

interface Bucket extends TokenUsage { runs: number; usd: number }
interface Day { site: Partial<Record<UsageKind, Bucket>>; visitorRuns: number }
interface State { days: Record<string, Day> }

// Declared before load() runs at module init.
const FILE = process.env.USAGE_FILE ?? ".cache/usage.json";
const KEEP_DAYS = 14;
const KINDS: UsageKind[] = ["analyst", "brief", "investigation", "headline"];

function load(): State {
  try {
    const s = JSON.parse(readFileSync(FILE, "utf8")) as State;
    if (s && typeof s.days === "object") return s;
  } catch { /* first run */ }
  return { days: {} };
}

let state: State = load();

function save(): void {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    const tmp = FILE + ".tmp";
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, FILE);
  } catch (err) {
    console.warn("[usage] could not save:", err instanceof Error ? err.message : err);
  }
}

const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

export function recordUsage(kind: UsageKind, model: string, u: TokenUsage, siteKey: boolean, now = Date.now()): void {
  const key = dayKey(now);
  const day = (state.days[key] ??= { site: {}, visitorRuns: 0 });
  if (!siteKey) {
    day.visitorRuns += 1;
  } else {
    const b = (day.site[kind] ??= { runs: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 });
    b.runs += 1;
    b.input += u.input;
    b.output += u.output;
    b.cacheRead += u.cacheRead;
    b.cacheWrite += u.cacheWrite;
    b.usd += estimateUsd(model, u) ?? 0;
  }
  const keys = Object.keys(state.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete state.days[k];
  save();
}

const empty = (): Bucket => ({ runs: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0 });

export function usageSummary(now = Date.now()) {
  const today = dayKey(now);
  const d = state.days[today];
  const kinds = Object.fromEntries(KINDS.map((k) => [k, d?.site[k] ?? empty()])) as Record<UsageKind, Bucket>;
  const sum = (day: Day | undefined) => KINDS.reduce((acc, k) => ({ usd: acc.usd + (day?.site[k]?.usd ?? 0), runs: acc.runs + (day?.site[k]?.runs ?? 0) }), { usd: 0, runs: 0 });
  const days = Array.from({ length: 7 }, (_, i) => dayKey(now - i * 86_400_000)).map((date) => ({ date, ...sum(state.days[date]) }));
  return {
    today: { date: today, ...sum(d), visitorRuns: d?.visitorRuns ?? 0, kinds },
    last7: days.reduce((acc, x) => ({ usd: acc.usd + x.usd, runs: acc.runs + x.runs }), { usd: 0, runs: 0 }),
    days,
  };
}
