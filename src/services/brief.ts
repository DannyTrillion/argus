/**
 * Automated market brief. The agent writes a structured brief on a schedule
 * (default every 4 hours) and on first request, so the Home screen always has
 * a fresh read of the market without anyone typing a prompt.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages";
import { runAgent } from "../agent/agent.js";

export interface Brief {
  text: string;
  generatedAt: string;
  model: string;
  calls: number;
  credits: number;
  durationMs: number;
}

const PROMPT =
  "Write today's crypto market brief as five sections with these exact markdown headings: ## Market backdrop, ## Movers that matter, ## Sector rotation, ## Leverage and risk, ## Watch list. Directly under each heading put one bold line: a punchy headline of at most 8 words in financial-news style, wrapped in ** **. Then at most 45 words: two or three tight sentences, or for Watch list three bullets of one line each. Lead with the single most important number. No preamble, no closing line, no other headings. Every number must come from the tools.";

const REFRESH_MS = Number(process.env.BRIEF_REFRESH_MINUTES ?? 240) * 60_000;
const CACHE_FILE = process.env.BRIEF_CACHE_FILE ?? ".cache/brief.json";

function load(): Brief | null {
  try {
    const b = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Brief;
    if (b && typeof b.text === "string" && Date.now() - Date.parse(b.generatedAt) < REFRESH_MS) return b;
  } catch {
    /* no cache yet */
  }
  return null;
}

function save(b: Brief): void {
  try {
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(b));
  } catch (err) {
    console.warn("[brief] could not persist brief:", err instanceof Error ? err.message : err);
  }
}

let current: Brief | null = load();
let inflight: Promise<Brief> | null = null;
let timer: NodeJS.Timeout | null = null;

async function generate(): Promise<Brief> {
  const started = Date.now();
  let calls = 0;
  let credits = 0;
  let model = "";
  const messages: BetaMessageParam[] = [{ role: "user", content: PROMPT }];
  const result = await runAgent({
    messages,
    maxIterations: 10,
    onEvent: (e) => {
      if (e.type === "api_call") {
        calls += 1;
        credits += e.record.creditCount;
      }
    },
  });
  model = process.env.ARGUS_MODEL ?? "claude-opus-5";
  const brief: Brief = { text: result.text, generatedAt: new Date().toISOString(), model, calls, credits, durationMs: Date.now() - started };
  current = brief;
  save(brief);
  return brief;
}

/** Returns the latest brief, generating one if none exists yet. */
export function getBrief(): Promise<Brief> | Brief {
  if (current) return current;
  return refreshBrief();
}

export function refreshBrief(): Promise<Brief> {
  if (!inflight) {
    inflight = generate().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export function currentBrief(): Brief | null {
  return current;
}

/** Start the background schedule. Safe to call once at server boot. */
export function startBriefSchedule(): void {
  if (timer) return;
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("[brief] ANTHROPIC_API_KEY not set; automated brief disabled");
    return;
  }
  // Warm on boot unless a fresh cached brief was loaded, then refresh on an interval.
  if (!current) refreshBrief().catch((err) => console.error("[brief] initial generation failed:", err instanceof Error ? err.message : err));
  timer = setInterval(() => {
    refreshBrief().catch((err) => console.error("[brief] refresh failed:", err instanceof Error ? err.message : err));
  }, REFRESH_MS);
  timer.unref();
}
