/**
 * Runs one turn of the Argus agent: the model reasons, calls CoinMarketCap tools
 * through the SDK's tool runner, and streams text back through `onEvent`.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages";
import { config } from "../config.js";
import { onCall, type CallRecord } from "../cmc/http.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { createTools, type ToolEvent } from "./tools.js";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "tool_result"; name: string; ok: boolean; ms: number; summary: string; data?: unknown }
  | { type: "api_call"; record: CallRecord }
  | { type: "done"; text: string; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number | null } }
  | { type: "error"; message: string };

export interface RunOptions {
  /** Prior conversation, alternating user/assistant. The new user message must be last. */
  messages: BetaMessageParam[];
  onEvent: (event: AgentEvent) => void;
  signal?: AbortSignal;
  maxIterations?: number;
}

export interface RunResult {
  /** Full conversation after this turn, ready to be sent again. */
  messages: BetaMessageParam[];
  text: string;
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

function todayBlock(): string {
  const now = new Date();
  return `Current UTC time: ${now.toISOString()}. Today's date is ${now.toISOString().slice(0, 10)}.`;
}

export async function runAgent(opts: RunOptions): Promise<RunResult> {
  const { onEvent } = opts;
  const tools = createTools((e: ToolEvent) => onEvent({ type: "tool_result", ...e }));
  const unsubscribe = onCall((record) => onEvent({ type: "api_call", record }));

  try {
    const runner = getClient().beta.messages.toolRunner(
      {
        model: config.model,
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
      for (const block of message.content) {
        if (block.type === "tool_use") onEvent({ type: "tool_call", id: block.id, name: block.name, input: block.input });
      }
      if (message.stop_reason === "pause_turn") {
        runner.pushMessages({ role: "assistant", content: message.content });
      }
    }

    const final = await runner.done();
    finalText = final.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    onEvent({
      type: "done",
      text: finalText,
      usage: {
        input_tokens: final.usage.input_tokens,
        output_tokens: final.usage.output_tokens,
        cache_read_input_tokens: final.usage.cache_read_input_tokens ?? null,
      },
    });
    return { messages: [...runner.params.messages], text: finalText };
  } catch (err) {
    const message = describeError(err);
    onEvent({ type: "error", message });
    throw err;
  } finally {
    unsubscribe();
  }
}

export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Anthropic API key is missing or invalid (set ANTHROPIC_API_KEY).";
  if (err instanceof Anthropic.RateLimitError) return "Anthropic rate limit hit. Try again in a moment.";
  if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}
