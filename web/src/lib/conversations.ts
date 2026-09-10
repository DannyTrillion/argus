/**
 * Conversations saved on the device. Each holds the messages the UI needs to
 * re-render (text, steps, calls, followups) plus the server session id. Large
 * chart payloads are dropped on save to keep localStorage small.
 */
import type { ChatMessage } from "./chat";

export interface Conversation {
  id: string;
  title: string;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

const KEY = "argus.conversations.v1";
const MAX = 20;
const listeners = new Set<() => void>();

export function readConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as Conversation[]) : [];
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function slim(m: ChatMessage): ChatMessage {
  return { ...m, thinking: undefined, steps: m.steps.map((s) => ({ ...s, data: undefined })), calls: m.calls.map((c) => ({ ...c, preview: c.preview.slice(0, 160) })) };
}

export function saveConversation(c: Conversation): void {
  try {
    const rest = readConversations().filter((x) => x.id !== c.id);
    const next = [{ ...c, messages: c.messages.map(slim) }, ...rest].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota or private mode */
  }
  listeners.forEach((l) => l());
}

export function deleteConversation(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(readConversations().filter((x) => x.id !== id)));
  } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function titleFrom(question: string): string {
  const t = question.replace(/\s+/g, " ").trim();
  return t.length > 48 ? t.slice(0, 47).replace(/\s+\S*$/, "") + "…" : t;
}
