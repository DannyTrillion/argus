/**
 * The right-hand rail: Argus working in real time, the evidence behind the latest
 * answer, its charts, and saved conversations.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, X, Loader2, ChevronDown, History, Trash2, Sparkles } from "lucide-react";
import clsx from "clsx";
import type { ChatMessage } from "../../lib/chat";
import { toolLabel } from "../../lib/toolLabels";
import { readConversations, deleteConversation, subscribe, type Conversation } from "../../lib/conversations";
import { timeAgo } from "../../lib/format";
import { Mascot } from "../ui/Mascot";
import { AnswerCharts } from "./AnswerCharts";

function Section({ title, right, children, className }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("glass p-4", className)}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-ink-3">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function WorkingSteps({ m, live }: { m: ChatMessage; live: boolean }) {
  if (m.steps.length === 0 && !live) return null;
  return (
    <ol className="space-y-1.5">
      <AnimatePresence initial={false}>
        {m.steps.map((s, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2.5 text-[12.5px]">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
              {s.ok === undefined ? <Loader2 size={13} className="animate-spin text-gold" /> : s.ok ? <Check size={13} className="text-up" /> : <X size={13} className="text-down" />}
            </span>
            <span className={clsx("leading-snug", s.ok === undefined ? "text-ink" : "text-ink-2")}>
              {toolLabel(s.name, s.input)}
              {s.ms !== undefined && <span className="ml-1.5 font-mono text-[10.5px] text-ink-3">{s.ms}ms</span>}
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
      {live && (
        <li className="flex items-center gap-2.5 text-[12.5px] text-ink-3">
          <Mascot size={22} thinking glow={false} />
          {m.steps.every((s) => s.ok !== undefined) ? (m.text ? "Writing the answer" : "Deciding what to read") : "Reading live data"}
        </li>
      )}
    </ol>
  );
}

export function Evidence({ m, defaultOpen = false }: { m: ChatMessage; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (m.calls.length === 0) return null;
  const credits = m.calls.reduce((a, c) => a + c.creditCount, 0);
  const endpoints = [...new Set(m.calls.map((c) => c.endpoint))];
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {endpoints.map((e) => (
          <span key={e} className="pill max-w-full truncate bg-surface-2 px-2 py-0.5 font-mono text-[10.5px] text-ink-2" title={e}>{e.replace(/^\/v\d\//, "")}</span>
        ))}
      </div>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3 hover:text-ink">
        <ChevronDown size={12} className={clsx("transition-transform", open && "rotate-180")} />
        {m.calls.length} call{m.calls.length === 1 ? "" : "s"} · {credits} credit{credits === 1 ? "" : "s"} · {m.calls.filter((c) => c.cached).length} cached
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {m.calls.map((c) => (
            <details key={c.id} className="glass-2 rounded-xl px-3 py-2 font-mono text-[11px]">
              <summary className="cursor-pointer list-none">
                <span className="text-gold">GET</span> <span className="text-ink">{c.endpoint}</span>
                <span className="text-ink-3">{Object.keys(c.query).length ? "?" + Object.entries(c.query).map(([k, v]) => `${k}=${v}`).join("&") : ""}</span>
                <span className={clsx("ml-2", c.httpStatus >= 400 ? "text-down" : "text-ink-3")}>{c.httpStatus}</span>
                <span className="ml-2 text-ink-3">{c.cached ? "cache" : `${c.creditCount} cr · ${c.elapsedMs}ms`}</span>
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-ink-2">{c.preview}</pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

export function HistoryList({ activeId, onOpen, onNew }: { activeId: string; onOpen: (id: string) => void; onNew: () => void }) {
  const [list, setList] = useState<Conversation[]>(readConversations);
  useEffect(() => subscribe(() => setList(readConversations())), []);
  return (
    <div className="space-y-1">
      <button onClick={onNew} className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12.5px] text-gold hover:bg-surface-2"><Sparkles size={13} /> New conversation</button>
      {list.length === 0 && <div className="px-2.5 py-2 text-[12px] text-ink-3">Conversations you have here are saved on this device.</div>}
      {list.map((c) => (
        <div key={c.id} className={clsx("group flex items-center gap-2 rounded-xl px-2.5 py-2", c.id === activeId ? "bg-surface-2" : "hover:bg-surface")}>
          <button onClick={() => onOpen(c.id)} className="min-w-0 flex-1 text-left">
            <div className="truncate text-[12.5px]">{c.title}</div>
            <div className="font-mono text-[10.5px] text-ink-3">{Math.floor(c.messages.length / 2)} turn{c.messages.length > 2 ? "s" : ""} · {timeAgo(c.updatedAt)}</div>
          </button>
          <button onClick={() => deleteConversation(c.id)} className="text-ink-3 opacity-0 hover:text-down group-hover:opacity-100" aria-label="Delete"><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  );
}

export function Rail({ latest, busy, activeId, onOpen, onNew }: { latest: ChatMessage | null; busy: boolean; activeId: string; onOpen: (id: string) => void; onNew: () => void }) {
  return (
    <aside className="hidden min-h-0 lg:block">
      <div className="scroll-thin h-full space-y-3 overflow-y-auto pr-1">
        <Section title={busy ? "Argus is working" : "How Argus worked"} right={busy ? <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-gold"><span className="h-1.5 w-1.5 rounded-full bg-gold" /> live</span> : null}>
          {latest ? <WorkingSteps m={latest} live={busy} /> : <div className="flex items-center gap-3 text-[12.5px] text-ink-3"><Mascot size={40} glow={false} /> Ask something and watch each step appear here.</div>}
        </Section>
        {latest && latest.calls.length > 0 && (
          <Section title="Evidence"><Evidence m={latest} /></Section>
        )}
        {latest?.done && latest.steps.some((s) => s.data) && (
          <Section title="Charts from this answer"><div className="[&>div]:mt-0 [&>div]:grid-cols-1"><AnswerCharts steps={latest.steps} /></div></Section>
        )}
        <Section title="History" right={<History size={13} className="text-ink-3" />}>
          <HistoryList activeId={activeId} onOpen={onOpen} onNew={onNew} />
        </Section>
      </div>
    </aside>
  );
}
