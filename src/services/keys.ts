/**
 * Bring-your-own-key support for the Anthropic side of Argus.
 *
 * A request may carry `x-anthropic-key`. When it does, that key is used for that request
 * only: it is never logged, never written to disk, and never used for scheduled work. When
 * it does not, the server's ANTHROPIC_API_KEY (if any) is used. The scheduled brief and
 * watch loop always use the server key, since a key that lives in one browser cannot run a
 * job on behalf of every visitor.
 */
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

export const KEY_HEADER = "x-anthropic-key";

export function serverHasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function looksLikeKey(v: string | undefined | null): v is string {
  return typeof v === "string" && /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(v.trim());
}

/** The key to use for this request: the caller's if they sent one, else the server's, else null. */
export function resolveAnthropicKey(header: string | undefined): string | null {
  if (looksLikeKey(header)) return header.trim();
  // null means "use the SDK default", which reads ANTHROPIC_API_KEY from the environment.
  return null;
}

/** True when a request with this header can run the analyst at all. */
export function canRunModel(header: string | undefined): boolean {
  return looksLikeKey(header) || serverHasAnthropicKey();
}

export function keyStatus() {
  return {
    serverKey: serverHasAnthropicKey(),
    cmcKey: !config.keyless,
    analystModel: config.model,
    automationModel: config.automationModel,
  };
}

/** Cheapest possible round trip that proves a key works and can reach the analyst model. */
export async function testAnthropicKey(key: string): Promise<{ ok: true; model: string } | { ok: false; error: string }> {
  if (!looksLikeKey(key)) return { ok: false, error: "That does not look like an Anthropic key. They start with sk-ant-." };
  try {
    const client = new Anthropic({ apiKey: key.trim(), maxRetries: 0 });
    await client.messages.create({ model: config.model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] });
    return { ok: true, model: config.model };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) return { ok: false, error: "Anthropic rejected this key. Check it was copied in full and has not been revoked." };
    if (err instanceof Anthropic.PermissionDeniedError) return { ok: false, error: `This key cannot use ${config.model}. Check the key's workspace has access to it.` };
    if (err instanceof Anthropic.RateLimitError) return { ok: true, model: config.model };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
