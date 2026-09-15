/**
 * Runs one turn of the Argus agent: the model reasons, calls CoinMarketCap tools
 * through the SDK's tool runner, and streams text back through `onEvent`.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages";
import { config } from "../config.js";
import { onCall, callContext, type CallRecord } from "../cmc/http.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { createTools, type ToolEvent } from "./tools.js";
import { recheckServerKey } from "../services/keys.js";
import { recordUsage, type UsageKind } from "../services/usage.js";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; name: string; ok: boolean; ms: number; summary: string; data?: unknown }
  | { type: "api_call"; record: CallRecord }
  | { type: "done"; text: string; followups: string[]; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number | null } }
  | { type: "error"; message: string };

export interface RunOptions {
  /** Prior conversation, alternating user/assistant. The new user message must be last. */
  messages: BetaMessageParam[];
  onEvent: (event: AgentEvent) => void;
  signal?: AbortSignal;
  maxIterations?: number;
  /** Override the model, e.g. a cheaper one for scheduled work. */
  model?: string;
  /** What this run is for, so the spend report can break it down. Defaults to "analyst". */
  usageKind?: UsageKind;
  /** Caller-supplied Anthropic key for this run only. Omit to use the server's ANTHROPIC_API_KEY. */
  apiKey?: string | null;
  /** The asker's holdings, sent by their browser with the question. Never stored. */
  portfolio?: Array<{ id: number; amount: number }>;
}

export interface RunResult {
  /** Full conversation after this turn, ready to be sent again. */
  messages: BetaMessageParam[];
  text: string;
}

let client: Anthropic | undefined;
function getClient(apiKey?: string | null): Anthropic {
  if (apiKey) return new Anthropic({ apiKey });
  if (!client) client = new Anthropic();
  return client;
}

function todayBlock(): string {
  const now = new Date();
  return `Current UTC time: ${now.toISOString()}. Today's date is ${now.toISOString().slice(0, 10)}.`;
}

export async function runAgent(opts: RunOptions): Promise<RunResult> {
  const runId = crypto.randomUUID();
  return callContext.run({ runId }, () => runAgentInner(opts, runId));
}

async function runAgentInner(opts: RunOptions, runId: string): Promise<RunResult> {
  const { onEvent } = opts;
  const tools = createTools((e: ToolEvent) => onEvent({ type: "tool_result", ...e }), { portfolio: opts.portfolio });
  // Only surface calls made by this run; other requests to the server keep their own tags.
  const unsubscribe = onCall((record) => {
    if (record.runId === runId) onEvent({ type: "api_call", record });
  });

  // Tokens across every turn of the tool loop, not just the last message.
  const total = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const model = opts.model ?? config.model;
  try {
    const runner = getClient(opts.apiKey).beta.messages.toolRunner(
      {
        model,
        max_tokens: 16000,
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: "high" },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          { type: "text", text: todayBlock() },
        ],
        tools,
        messages: opts.messages,
        max_iterations: opts.maxIterations ?? 12,
        stream: true,
      },
      { signal: opts.signal },
    );

    let finalText = "";
    for await (const stream of runner) {
      stream.on("text", (delta: string) => onEvent({ type: "text", delta }));
      stream.on("thinking", (delta: string) => onEvent({ type: "thinking", delta }));
      const message = await stream.finalMessage();
      total.input += message.usage.input_tokens;
      total.output += message.usage.output_tokens;
      total.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      total.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
      for (const block of message.content) {
        if (block.type === "tool_use") onEvent({ type: "tool_call", id: block.id, name: block.name, input: block.input });
      }
      if (message.stop_reason === "pause_turn") {
        runner.pushMessages({ role: "assistant", content: message.content });
      }
    }

    const final = await runner.done();
    const rawText = final.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    const { text, followups } = splitFollowups(rawText);
    finalText = text;
    onEvent({
      type: "done",
      text: finalText,
      followups,
      usage: {
        input_tokens: total.input,
        output_tokens: total.output,
        cache_read_input_tokens: total.cacheRead,
      },
    });
    recordUsage(opts.usageKind ?? "analyst", model, total, !opts.apiKey);
    return { messages: [...runner.params.messages], text: finalText };
  } catch (err) {
    // A rejected server key: re-probe now so the UI banner appears within seconds, not 30 minutes.
    if (!opts.apiKey && err instanceof Anthropic.AuthenticationError) void recheckServerKey();
    // Tokens spent before a failure are still billed.
    if (total.input || total.output) recordUsage(opts.usageKind ?? "analyst", model, total, !opts.apiKey);
    const message = describeError(err);
    onEvent({ type: "error", message });
    throw err;
  } finally {
    unsubscribe();
  }
}

/** Pull the trailing <followups> block out of an answer. Tolerates a missing or malformed block. */
export function splitFollowups(raw: string): { text: string; followups: string[] } {
  const m = raw.match(/<followups>([\s\S]*?)<\/followups>\s*$/i);
  if (!m) return { text: raw.trim(), followups: [] };
  const followups = m[1]
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, "").trim())
    .filter((l) => l.length > 3)
    .slice(0, 3);
  return { text: raw.slice(0, m.index).trim(), followups };
}

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Anthropic API key is missing or invalid. Add yours on the Keys page, or set ANTHROPIC_API_KEY on the server.";
  if (err instanceof Anthropic.APIConnectionError) return "Could not reach the Anthropic API. Check the connection and try again.";
  if (err instanceof Anthropic.RateLimitError) return "Anthropic rate limit hit. Try again in a moment.";
  if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
