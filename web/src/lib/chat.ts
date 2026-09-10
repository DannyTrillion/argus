/**
 * Client for the streaming /api/chat endpoint. Parses Server-Sent Events into a
 * message list the UI can render live: text deltas, tool steps, API calls, usage.
 */
import { useCallback, useRef, useState } from "react";
import type { CallRecord } from "./api";

export interface Step {
  name: string;
  input?: unknown;
  ok?: boolean;
  ms?: number;
  summary?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  thinking?: string;
  steps: Step[];
  calls: CallRecord[];
  usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number | null };
  error?: string;
  done?: boolean;
}

const SESSION_KEY = "argus.session";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const session = useRef<string | null>(sessionStorage.getItem(SESSION_KEY));

  const patchLast = useCallback((fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.slice();
      next[next.length - 1] = fn(next[next.length - 1]);
      return next;
    });
  }, []);

  const send = useCallback(
    async (question: string) => {
      if (busy || !question.trim()) return;
      setBusy(true);
      setMessages((prev) => [...prev, { role: "user", text: question, steps: [], calls: [] }, { role: "assistant", text: "", steps: [], calls: [] }]);
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: session.current, message: question }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let pendingSteps = 0;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            let event = "message";
            let data = "";
            for (const line of chunk.split("\n")) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) data += line.slice(5).trim();
            }
            if (!data) continue;
            const e = JSON.parse(data);
            switch (event) {
              case "session":
                session.current = e.sessionId;
                sessionStorage.setItem(SESSION_KEY, e.sessionId);
                break;
              case "text":
                patchLast((m) => ({ ...m, text: m.text + e.delta }));
                break;
              case "thinking":
                patchLast((m) => ({ ...m, thinking: ((m.thinking ?? "") + e.delta).slice(-800) }));
                break;
              case "tool_call":
                pendingSteps += 1;
                patchLast((m) => ({ ...m, steps: [...m.steps, { name: e.name, input: e.input }] }));
                break;
              case "tool_result":
                patchLast((m) => {
                  const steps = m.steps.slice();
                  const i = steps.findIndex((s) => s.name === e.name && s.ok === undefined);
                  if (i >= 0) steps[i] = { ...steps[i], ok: e.ok, ms: e.ms, summary: e.summary };
                  return { ...m, steps };
                });
                pendingSteps = Math.max(0, pendingSteps - 1);
                break;
              case "api_call":
                patchLast((m) => ({ ...m, calls: [...m.calls, e.record] }));
                break;
              case "done":
                patchLast((m) => ({ ...m, usage: e.usage, done: true }));
                break;
              case "error":
                patchLast((m) => ({ ...m, error: e.message, done: true }));
                break;
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") patchLast((m) => ({ ...m, error: (err as Error).message, done: true }));
        else patchLast((m) => ({ ...m, done: true }));
      } finally {
        setBusy(false);
        abort.current = null;
      }
    },
    [busy, patchLast],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const reset = useCallback(() => {
    const id = session.current;
    session.current = null;
    sessionStorage.removeItem(SESSION_KEY);
    setMessages([]);
    if (id) fetch(`/api/session/${id}`, { method: "DELETE" }).catch(() => undefined);
  }, []);

  return { messages, busy, send, stop, reset };
}
