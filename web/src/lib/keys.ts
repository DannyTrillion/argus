/**
 * Bring your own Anthropic key. The key lives in this browser's localStorage only and is
 * sent as a request header to this deployment's API, which uses it for that request and
 * discards it. It never reaches Argus's own logs or disk.
 */
const STORAGE = "argus.anthropicKey";
const EVENT = "argus:key";

export function getAnthropicKey(): string {
  try { return localStorage.getItem(STORAGE) ?? ""; } catch { return ""; }
}

export function setAnthropicKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(STORAGE, key.trim());
    else localStorage.removeItem(STORAGE);
  } catch { /* private mode */ }
  window.dispatchEvent(new Event(EVENT));
}

export function clearAnthropicKey(): void { setAnthropicKey(""); }

/** Headers to attach to any request that runs the model. */
export function keyHeaders(): Record<string, string> {
  const k = getAnthropicKey();
  return k ? { "x-anthropic-key": k } : {};
}

export function onKeyChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => { window.removeEventListener(EVENT, fn); window.removeEventListener("storage", fn); };
}

/** "sk-ant-api03-Hs…zvsLQ" style preview for the UI. */
export function maskKey(k: string): string {
  if (k.length < 16) return "•".repeat(k.length);
  return `${k.slice(0, 14)}…${k.slice(-5)}`;
}
