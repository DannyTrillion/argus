import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles, Square, RotateCcw, SendHorizontal, ChevronDown } from "lucide-react";
import clsx from "clsx";
import { useChat, type ChatMessage } from "../lib/chat";
import { Markdown } from "../components/ui/Markdown";
import type { CallRecord } from "../lib/api";
import { Mascot } from "../components/ui/Mascot";
import { AnswerCharts } from "../components/analyst/AnswerCharts";

const SUGGESTIONS = [
  "How is the market today?",
  "Why is SOL moving today?",
  "Is it altcoin season?",
  "Which sectors are rotating this week?",
  "Compare BTC, ETH and SOL risk over 90 days",
  "What got liquidated in the last 24h?",
  "Write today's market brief",
];

function Steps({ steps }: { steps: ChatMessage["steps"] }) {
  if (steps.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {steps.map((s, i) => (
        <span key={i} title={s.summary} className={clsx("pill inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[11px]", s.ok === false ? "bg-down-dim text-down" : s.ok ? "bg-up-dim text-up" : "bg-gold-dim text-gold")}>
          <span className={clsx("h-1.5 w-1.5 rounded-full", s.ok === undefined ? "animate-pulse bg-gold" : s.ok ? "bg-up" : "bg-down")} />
          {s.name}
          {s.ms !== undefined && <span className="opacity-60">{s.ms}ms</span>}
        </span>
      ))}
    </div>
  );
}

function Calls({ calls }: { calls: CallRecord[] }) {
  const [open, setOpen] = useState(false);
  if (calls.length === 0) return null;
  const credits = calls.reduce((a, c) => a + c.creditCount, 0);
  return (
    <div className="mt-3 border-t border-line pt-2">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3 hover:text-ink">
        <ChevronDown size={12} className={clsx("transition-transform", open && "rotate-180")} />
        {calls.length} CoinMarketCap call{calls.length === 1 ? "" : "s"} · {credits} credit{credits === 1 ? "" : "s"}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {calls.map((c) => (
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

function Bubble({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    return <div className="glass-2 ml-auto max-w-[80%] rounded-3xl rounded-br-lg px-4 py-2.5 text-[13.5px]">{m.text}</div>;
  }
  return (
    <div className="glass max-w-[920px] p-5">
      <Steps steps={m.steps} />
      {!m.text && !m.done && (
        <div className="flex items-center gap-3 text-[12.5px] text-ink-3">
          <Mascot size={40} thinking />
          {m.thinking ? <span className="italic">{m.thinking.slice(-220)}</span> : "Reading the market…"}
        </div>
      )}
      {m.text && <Markdown text={m.text} />}
      {m.done && <AnswerCharts steps={m.steps} />}
      {m.error && <div className="mt-2 text-[12.5px] text-down">{m.error}</div>}
      <Calls calls={m.calls} />
      {m.usage && (
        <div className="mt-2 font-mono text-[10.5px] text-ink-3">
          tokens in {m.usage.input_tokens.toLocaleString()} · out {m.usage.output_tokens.toLocaleString()}{m.usage.cache_read_input_tokens ? ` · cache ${m.usage.cache_read_input_tokens.toLocaleString()}` : ""}
        </div>
      )}
    </div>
  );
}

export default function Analyst() {
  const chat = useChat();
  const [input, setInput] = useState("");
  const [params, setParams] = useSearchParams();
  const bottom = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const q = params.get("q");
    if (q && !started.current) {
      started.current = true;
      chat.send(q);
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.messages]);

  const submit = () => {
    const q = input.trim();
    if (!q) return;
    setInput("");
    chat.send(q);
  };

  return (
    <div className="flex min-h-[calc(100vh-140px)] flex-col">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] text-gold"><Sparkles size={13} /> Live analyst</div>
          <h1 className="font-display mt-1 text-[34px] font-light leading-tight tracking-tight">Ask Argus</h1>
        </div>
        {chat.messages.length > 0 && (
          <button onClick={chat.reset} className="glass-2 pill flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-ink-2 hover:text-ink"><RotateCcw size={12} /> New conversation</button>
        )}
      </div>

      <div className="flex-1 space-y-4">
        {chat.messages.length === 0 && (
          <div className="glass hud p-8">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              <Mascot size={128} className="scan rounded-full" />
              <div>
                <div className="font-display text-[24px] font-light">Every number, <span className="text-glow">sourced live.</span></div>
                <p className="mt-2 max-w-[640px] text-[13.5px] leading-relaxed text-ink-2">
                  Ask me about a coin, a sector, or the whole market. I decide which CoinMarketCap endpoints answer it, call them, compute what the API does not provide (volatility, drawdown, correlation, rotation), and show you every call I made.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => chat.send(s)} className="glass-2 pill px-3.5 py-2 text-[12.5px] text-ink-2 hover:border-gold/40 hover:text-ink">{s}</button>
              ))}
            </div>
          </div>
        )}
        {chat.messages.map((m, i) => <div key={i} className="flex"><Bubble m={m} /></div>)}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-20 mt-5 md:bottom-4">
        <div className="glass flex items-end gap-2 p-2 pl-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Ask about any coin, sector, or the whole market"
            rows={1}
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[14px] placeholder:text-ink-3 focus:outline-none"
          />
          {chat.busy ? (
            <button onClick={chat.stop} className="glass-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:text-ink" aria-label="Stop"><Square size={14} /></button>
          ) : (
            <button onClick={submit} disabled={!input.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-bg hover:bg-gold-2 disabled:opacity-40" aria-label="Send"><SendHorizontal size={16} /></button>
          )}
        </div>
      </div>
    </div>
  );
}
