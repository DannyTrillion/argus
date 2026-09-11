/**
 * Message composer with "@" coin mentions from the cached top 200.
 * Enter sends, Shift+Enter adds a line.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SendHorizontal, Square, AtSign } from "lucide-react";
import clsx from "clsx";
import { api } from "../../lib/api";
import { expandMentions } from "../../lib/mentions";

export function Composer({ busy, onSend, onStop, autoFocus }: { busy: boolean; onSend: (q: string) => void; onStop: () => void; autoFocus?: boolean }) {
  const [value, setValue] = useState("");
  const [sel, setSel] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const { data } = useQuery({ queryKey: ["coins", 200], queryFn: () => api.coins(200), staleTime: 60_000 });

  // Detect an "@query" token at the caret.
  const mention = useMemo(() => {
    const el = ta.current;
    const pos = el ? el.selectionStart : value.length;
    const before = value.slice(0, pos);
    const m = before.match(/(^|\s)@([A-Za-z0-9.]{0,12})$/);
    return m ? { q: m[2], start: pos - m[2].length - 1, end: pos } : null;
  }, [value]);

  const matches = useMemo(() => {
    if (!mention || !data) return [];
    const q = mention.q.toLowerCase();
    return data.coins.filter((c) => c.symbol.toLowerCase().startsWith(q) || c.name.toLowerCase().startsWith(q)).slice(0, 6);
  }, [mention, data]);

  useEffect(() => setSel(0), [mention?.q]);
  useEffect(() => { if (autoFocus) ta.current?.focus(); }, [autoFocus]);

  const pick = (symbol: string) => {
    if (!mention) return;
    const next = value.slice(0, mention.start) + `@${symbol} ` + value.slice(mention.end);
    setValue(next);
    requestAnimationFrame(() => { const el = ta.current; if (el) { el.focus(); const p = mention.start + symbol.length + 2; el.setSelectionRange(p, p); } });
  };

  const submit = () => {
    const q = value.trim();
    if (!q || busy) return;
    setValue("");
    onSend(expandMentions(q, data?.coins));
  };

  return (
    <div className="relative">
      {mention && matches.length > 0 && (
        <div className="glass absolute bottom-[calc(100%+8px)] left-3 z-30 w-[300px] overflow-hidden p-1.5">
          {matches.map((c, i) => (
            <button key={c.id} onMouseDown={(e) => { e.preventDefault(); pick(c.symbol); }} onMouseEnter={() => setSel(i)} className={clsx("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left", i === sel ? "bg-surface-2" : "")}>
              <img src={`https://s2.coinmarketcap.com/static/img/coins/32x32/${c.id}.png`} alt="" className="h-5 w-5 rounded-full" />
              <span className="text-[13px]">{c.name}</span>
              <span className="font-mono text-[11px] text-ink-3">{c.symbol}</span>
              <span className="ml-auto font-mono text-[11px] text-ink-3">#{c.cmc_rank}</span>
            </button>
          ))}
        </div>
      )}
      <div className="glass flex items-end gap-2 p-2 pl-4" style={{ boxShadow: "0 0 0 1px rgba(231,196,106,0.10), 0 20px 50px -30px rgba(0,0,0,0.9)" }}>
        <textarea
          ref={ta}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (mention && matches.length) {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(matches.length - 1, s + 1)); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); return; }
              if (e.key === "Tab" || e.key === "Enter") { e.preventDefault(); pick(matches[sel].symbol); return; }
            }
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          placeholder={typeof window !== "undefined" && window.innerWidth < 640 ? "Ask Argus anything · @ mentions a coin" : "Ask about any coin, sector, or the whole market. Type @ to mention a coin."}
          rows={1}
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[14px] placeholder:text-ink-3 focus:outline-none"
        />
        <button type="button" onClick={() => { setValue((v) => (v.endsWith(" ") || v === "" ? v + "@" : v + " @")); ta.current?.focus(); }} className="hidden h-10 w-10 items-center justify-center rounded-full text-ink-3 hover:text-ink sm:flex" aria-label="Mention a coin" title="Mention a coin">
          <AtSign size={16} />
        </button>
        {busy ? (
          <button onClick={onStop} className="glass-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:text-ink" aria-label="Stop"><Square size={14} /></button>
        ) : (
          <button onClick={submit} disabled={!value.trim()} className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-bg hover:bg-gold-2 disabled:opacity-40" aria-label="Send"><SendHorizontal size={16} /></button>
        )}
      </div>
    </div>
  );
}
