/**
 * Command palette (Cmd/Ctrl+K): jump to a coin, a screen, or ask the analyst a saved question.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Search, Sparkles, LayoutGrid, Compass, Star, MessageSquareText, CornerDownLeft } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { usd } from "../lib/format";
import { Change } from "./ui/Change";

interface Item { id: string; kind: "coin" | "page" | "ask"; label: string; hint?: string; to: string; icon?: React.ReactNode; change?: number | null; coinId?: number }

const PAGES: Item[] = [
  { id: "p-home", kind: "page", label: "Home", to: "/", icon: <LayoutGrid size={14} /> },
  { id: "p-explore", kind: "page", label: "Explore", to: "/explore", icon: <Compass size={14} /> },
  { id: "p-watch", kind: "page", label: "Watchlist", to: "/watchlist", icon: <Star size={14} /> },
  { id: "p-portfolio", kind: "page", label: "Portfolio", hint: "your holdings, priced and explained", to: "/watchlist?view=portfolio", icon: <Star size={14} /> },
  { id: "p-analyst", kind: "page", label: "Analyst", to: "/analyst", icon: <MessageSquareText size={14} /> },
  { id: "p-status", kind: "page", label: "Status", to: "/status", icon: <LayoutGrid size={14} /> },
  { id: "p-keys", kind: "page", label: "Keys", hint: "bring your own Anthropic key", to: "/keys", icon: <LayoutGrid size={14} /> },
  { id: "p-learn", kind: "page", label: "Learn", hint: "what every number means", to: "/learn", icon: <LayoutGrid size={14} /> },
];
const ASKS = [
  "How is the market today?",
  "Is it altcoin season?",
  "Which sectors are rotating this week?",
  "What got liquidated in the last 24h?",
  "Compare BTC, ETH and SOL risk over 90 days",
  "Write today's market brief",
];

export function usePalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const { data } = useQuery({ queryKey: ["coins", 200], queryFn: () => api.coins(200), staleTime: 60_000, enabled: open });

  useEffect(() => { if (open) { setQ(""); setSel(0); setTimeout(() => input.current?.focus(), 30); } }, [open]);

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();
    const coins = (data?.coins ?? [])
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.symbol.toLowerCase().includes(needle))
      .slice(0, needle ? 8 : 5)
      .map<Item>((c) => ({ id: `c-${c.id}`, kind: "coin", label: c.name, hint: c.symbol, to: `/coin/${c.id}`, change: c.quote.percent_change_24h, coinId: c.id, icon: <img src={`https://s2.coinmarketcap.com/static/img/coins/32x32/${c.id}.png`} alt="" className="h-5 w-5 rounded-full" /> }));
    const pages = PAGES.filter((p) => !needle || p.label.toLowerCase().includes(needle));
    const asks = ASKS.filter((a) => !needle || a.toLowerCase().includes(needle)).map<Item>((a) => ({ id: `a-${a}`, kind: "ask", label: a, to: `/analyst?q=${encodeURIComponent(a)}`, icon: <Sparkles size={14} className="text-gold" /> }));
    const free = needle.length > 2 && !asks.some((a) => a.label.toLowerCase() === needle) ? [{ id: "a-free", kind: "ask" as const, label: `Ask Argus: "${q.trim()}"`, to: `/analyst?q=${encodeURIComponent(q.trim())}`, icon: <Sparkles size={14} className="text-gold" /> }] : [];
    return [...coins, ...pages, ...asks.slice(0, 4), ...free];
  }, [data, q]);

  useEffect(() => { setSel(0); }, [q]);

  const go = (it: Item) => { onClose(); nav(it.to); };

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(6,6,8,0.6)] p-4 pt-[12vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div initial={{ y: 8, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ duration: 0.18 }} className="glass w-full max-w-[600px] overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Search size={16} className="text-ink-3" />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
                if (e.key === "Enter" && items[sel]) go(items[sel]);
                if (e.key === "Escape") onClose();
              }}
              placeholder="Jump to a coin, a screen, or ask a question"
              className="flex-1 bg-transparent text-[14px] placeholder:text-ink-3 focus:outline-none"
            />
            <kbd className="pill hidden bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-ink-3 sm:inline">esc</kbd>
          </div>
          <div className="scroll-thin max-h-[60vh] overflow-y-auto p-1.5">
            {items.length === 0 && <div className="px-3 py-6 text-center text-[13px] text-ink-3">Nothing matches.</div>}
            {items.map((it, i) => (
              <button
                key={it.id}
                onMouseEnter={() => setSel(i)}
                onClick={() => go(it)}
                className={clsx("flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left", i === sel ? "bg-surface-2" : "hover:bg-surface")}
              >
                <span className="flex h-6 w-6 items-center justify-center text-ink-2">{it.icon}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{it.label} {it.hint && <span className="text-ink-3">{it.hint}</span>}</span>
                {it.kind === "coin" && data && (
                  <span className="flex items-center gap-2 font-mono text-[12px]">
                    <span className="text-ink-2">{usd(data.coins.find((c) => c.id === it.coinId)?.quote.price)}</span>
                    <Change value={it.change} className="text-[11.5px]" />
                  </span>
                )}
                <span className="pill hidden bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-3 sm:inline">{it.kind}</span>
                {i === sel && <CornerDownLeft size={12} className="text-ink-3" />}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
