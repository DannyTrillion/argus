/**
 * Automated market brief. The agent writes a structured brief on a schedule
 * (default every 4 hours) and on first request, so the Home screen always has
 * a fresh read of the market without anyone typing a prompt.
 */
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
  "Write today's crypto market brief for a reader who checks the market once a day. Use these headings exactly: Market backdrop, Movers that matter, Sector rotation, Leverage and risk, Watch list. Keep it under 350 words. Every number must come from the tools. No preamble, start with the first heading.";

const REFRESH_MS = Number(process.env.BRIEF_REFRESH_MINUTES ?? 240) * 60_000;

let current: Brief | null = null;
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
  // Warm on boot, then refresh on an interval. Errors are logged, never fatal.
  refreshBrief().catch((err) => console.error("[brief] initial generation failed:", err instanceof Error ? err.message : err));
  timer = setInterval(() => {
    refreshBrief().catch((err) => console.error("[brief] refresh failed:", err instanceof Error ? err.message : err));
  }, REFRESH_MS);
  timer.unref();
}
