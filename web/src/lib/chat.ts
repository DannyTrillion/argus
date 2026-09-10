/**
 * Client for the streaming /api/chat endpoint. Parses Server-Sent Events into a
 * message list the UI can render live, and persists the conversation on device.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CallRecord } from "./api";
import { readConversations, saveConversation, titleFrom, type Conversation } from "./conversations";

export interface Step {
  name: string;
  input?: unknown;
  ok?: boolean;
  ms?: number;
  summary?: string;
  /** Structured result for chartable tools (analyze_series, histories, liquidations). */
  data?: unknown;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  thinking?: string;
  steps: Step[];
  calls: CallRecord[];
  followups?: string[];
  usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number | null };
  error?: string;
  done?: boolean;
}

/** Strip a trailing (possibly partial) followups block from streamed text before display. */
export function displayText(text: string): string {
  return text.replace(/<followups>[\s\S]*$/i, "").replace(/<followup?s?$/i, "").trimEnd();
}

function newConversation(): Conversation {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: "New conversation", sessionId: null, createdAt: now, updatedAt: now, messages: [] };
}

export function useChat(initialId?: string | null) {
  const [conv, setConv] = useState<Conversation>(() => {
    if (initialId) {
      const found = readConversations().find((c) => c.id === initialId);
      if (found) return found;
    }
    return newConversation();
  });
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const convRef = useRef(conv);
  convRef.current = conv;

  const patchLast = useCallback((fn: (m: ChatMessage) => ChatMessage) => {
    setConv((prev) => {
      if (prev.messages.length === 0) return prev;
      const messages = prev.messages.slice();
      messages[messages.length - 1] = fn(messages[messages.length - 1]);
      return { ...prev, messages };
    });
  }, []);

  // Persist whenever a turn completes.
  useEffect(() => {
    const last = conv.messages[conv.messages.length - 1];
    if (conv.messages.length > 0 && last?.done) saveConversation({ ...conv, updatedAt: new Date().toISOString() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.messages.length, conv.messages[conv.messages.length - 1]?.done]);

  const send = useCallback(
    async (question: string) => {
      if (busy || !question.trim()) return;
      setBusy(true);
      const cur = convRef.current;
      const transcript = cur.messages.filter((m) => m.done !== false && m.text).map((m) => ({ role: m.role, text: m.role === "assistant" ? displayText(m.text) : m.text }));
      setConv((prev) => ({
        ...prev,
        title: prev.messages.length === 0 ? titleFrom(question) : prev.title,
        messages: [...prev.messages, { role: "user", text: question, steps: [], calls: [], done: true }, { role: "assistant", text: "", steps: [], calls: [] }],
      }));
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: cur.sessionId, message: question, history: transcript }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
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
                setConv((prev) => ({ ...prev, sessionId: e.sessionId }));
                break;
              case "text":
                patchLast((m) => ({ ...m, text: m.text + e.delta }));
                break;
              case "thinking":
                patchLast((m) => ({ ...m, thinking: ((m.thinking ?? "") + e.delta).slice(-800) }));
                break;
              case "tool_call":
                patchLast((m) => ({ ...m, steps: [...m.steps, { name: e.name, input: e.input }] }));
                break;
              case "tool_result":
                patchLast((m) => {
                  const steps = m.steps.slice();
                  const i = steps.findIndex((s) => s.name === e.name && s.ok === undefined);
                  if (i >= 0) steps[i] = { ...steps[i], ok: e.ok, ms: e.ms, summary: e.summary, data: e.data };
                  return { ...m, steps };
                });
                break;
              case "api_call":
                patchLast((m) => ({ ...m, calls: [...m.calls, e.record] }));
                break;
              case "done":
                patchLast((m) => ({ ...m, text: e.text || m.text, followups: e.followups ?? [], usage: e.usage, done: true }));
                break;
              case "error":
                patchLast((m) => ({ ...m, error: e.message, done: true }));
                break;
            }
          }
        }
        patchLast((m) => (m.done ? m : { ...m, done: true }));
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
    const id = convRef.current.sessionId;
    setConv(newConversation());
    if (id) fetch(`/api/session/${id}`, { method: "DELETE" }).catch(() => undefined);
  }, []);

  /** Re-send the last question after a failed answer. */
  const retry = useCallback(() => {
    const msgs = convRef.current.messages;
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setConv((prev) => ({ ...prev, messages: prev.messages.slice(0, prev.messages.length - 2) }));
    setTimeout(() => void send(lastUser.text), 0);
  }, [send]);

  const open = useCallback((id: string) => {
    const found = readConversations().find((c) => c.id === id);
    if (found) setConv(found);
  }, []);

  return { conversation: conv, messages: conv.messages, busy, send, stop, reset, open, retry };
}
