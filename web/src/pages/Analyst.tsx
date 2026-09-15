import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Sparkles, History as HistoryIcon, ChevronDown, ChevronLeft, ArrowDown, Plus, Share2, Check, KeyRound } from "lucide-react";
import { getAnthropicKey, onKeyChange } from "../lib/keys";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import clsx from "clsx";
import { useChat, displayText, type ChatMessage } from "../lib/chat";
import { Markdown } from "../components/ui/Markdown";
import { Mascot } from "../components/ui/Mascot";
import { CopyButton } from "../components/ui/CopyButton";
import { AnswerCharts } from "../components/analyst/AnswerCharts";
import { Composer } from "../components/analyst/Composer";
import { Rail, WorkingSteps, Evidence, HistoryList } from "../components/analyst/Rail";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { expandMentions, stripMentions } from "../lib/mentions";

const SUGGESTIONS: Array<{ group: string; items: string[] }> = [
  { group: "Market", items: ["How is the market today?", "Is it altcoin season?", "Write today's market brief"] },
  { group: "Coins", items: ["Why is @SOL moving today?", "Where is @BTC relative to its all-time high?", "What is @HYPE and why is it moving?"] },
  { group: "Risk", items: ["Compare BTC, ETH and SOL risk over 90 days", "What got liquidated in the last 24h?", "How correlated are @ETH and @SOL with BTC?"] },
  { group: "Sectors", items: ["Which sectors are rotating this week?", "Are memes leading or lagging?", "Is money moving into privacy coins?"] },
];

function Bubble({ m, live, onFollowup, onRetry, compact, isLatest }: { m: ChatMessage; live: boolean; onFollowup: (q: string) => void; onRetry: () => void; compact: boolean; isLatest: boolean }) {
  const [showWork, setShowWork] = useState(false);
  if (m.role === "user") {
    return <div className="glass-2 ml-auto max-w-[85%] rounded-3xl rounded-br-lg px-4 py-2.5 text-[13.5px] sm:max-w-[75%]">{stripMentions(m.text)}</div>;
  }
  const text = displayText(m.text);
  return (
    <div className="glass w-full p-5 sm:p-6">
      {/* On phones the rail is hidden, so the working state lives inside the answer. */}
      {compact && (live || m.steps.length > 0) && (
        <div className="mb-4">
          {live ? (
            <WorkingSteps m={m} live />
          ) : (
            <>
              <button onClick={() => setShowWork((o) => !o)} className="flex items-center gap-1.5 font-mono text-[11px] text-ink-3 hover:text-ink">
                <ChevronDown size={12} className={clsx("transition-transform", showWork && "rotate-180")} /> {m.steps.length} step{m.steps.length === 1 ? "" : "s"} · {m.calls.length} API call{m.calls.length === 1 ? "" : "s"}
              </button>
              {showWork && <div className="mt-2 space-y-3"><WorkingSteps m={m} live={false} /><Evidence m={m} /></div>}
            </>
          )}
        </div>
      )}
      {!text && !m.done && !(compact && live) && (
        <div className="flex items-center gap-3 text-[12.5px] text-ink-3">
          <Mascot size={40} thinking />
          {m.thinking ? <span className="italic">{m.thinking.slice(-220)}</span> : "Reading the market…"}
        </div>
      )}
      {text && <Markdown text={text} className="text-[14px] [&_h2]:text-[16px] [&_h3]:text-[15px]" />}
      {live && text && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-gold align-middle" />}
      {m.done && compact && <AnswerCharts steps={m.steps} />}
      {m.error && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[12.5px]">
          <span className="text-down">{m.error}</span>
          <button onClick={onRetry} className="pill bg-surface-2 px-3 py-1 text-[12px] text-ink hover:bg-gold hover:text-bg">Try again</button>
        </div>
      )}
      {/* On phones the latest answer's follow-ups live in the row above the composer instead. */}
      {m.done && m.followups && m.followups.length > 0 && !(compact && isLatest) && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex flex-wrap gap-2">
          {m.followups.map((q) => (
            <button key={q} onClick={() => onFollowup(q)} className="glass-2 pill px-3 py-1.5 text-left text-[12.5px] text-ink-2 hover:border-gold/40 hover:text-ink">{q}</button>
          ))}
        </motion.div>
      )}
      {m.usage && (
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 font-mono text-[10.5px] text-ink-3">
          <span>{m.calls.length} API call{m.calls.length === 1 ? "" : "s"} · {m.calls.reduce((a, c) => a + c.creditCount, 0)} credits · tokens {m.usage.input_tokens.toLocaleString()}/{m.usage.output_tokens.toLocaleString()}</span>
          <CopyButton text={text} />
        </div>
      )}
    </div>
  );
}

export default function Analyst() {
  const [params, setParams] = useSearchParams();
  const chat = useChat(params.get("c"));
  const coins = useQuery({ queryKey: ["coins", 200], queryFn: () => api.coins(200), staleTime: 60_000 });
  const keys = useQuery({ queryKey: ["keys"], queryFn: api.keys, staleTime: 60_000 });
  const [ownKey, setOwnKey] = useState(Boolean(getAnthropicKey()));
  useEffect(() => onKeyChange(() => setOwnKey(Boolean(getAnthropicKey()))), []);
  // Locked when there is no shared key, or Anthropic rejected it, and this browser has none.
  const sharedDown = keys.data ? !keys.data.serverKey || keys.data.serverKeyHealthy === false : false;
  const locked = sharedDown && !ownKey;
  const ask = (q: string) => chat.send(expandMentions(q, coins.data?.coins));
  const [histOpen, setHistOpen] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [pinned, setPinned] = useState(true);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ?q= from the deck, coin pages and the palette.
  useEffect(() => {
    const q = params.get("q");
    if (q && !started.current) {
      started.current = true;
      ask(q);
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pinned-to-bottom logic. Desktop scrolls the thread container; phones scroll the window.
  useEffect(() => {
    const check = () => {
      if (isDesktop && thread.current) {
        const el = thread.current;
        setPinned(el.scrollHeight - el.clientHeight - el.scrollTop < 120);
      } else {
        setPinned(document.documentElement.scrollHeight - window.innerHeight - window.scrollY < 140);
      }
    };
    const el = thread.current;
    el?.addEventListener("scroll", check, { passive: true });
    window.addEventListener("scroll", check, { passive: true });
    return () => { el?.removeEventListener("scroll", check); window.removeEventListener("scroll", check); };
  }, [isDesktop]);
  const lastText = chat.messages[chat.messages.length - 1]?.text;
  const scrollToLatest = (smooth = false) => {
    if (isDesktop && thread.current) thread.current.scrollTo({ top: thread.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    else bottom.current?.scrollIntoView({ block: "end", behavior: smooth ? "smooth" : "auto" });
  };
  useEffect(() => {
    if (chat.messages.length > 0 && pinned) scrollToLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.messages.length, lastText, pinned]);

  const latest = [...chat.messages].reverse().find((m) => m.role === "assistant") ?? null;
  const title = chat.messages.length ? stripMentions(chat.conversation.title) : "Ask Argus";
  const nav = useNavigate();

  // Share: post a slim transcript, copy the link.
  const [shared, setShared] = useState<"idle" | "busy" | "done" | "error">("idle");
  const share = async () => {
    if (chat.messages.length === 0 || shared === "busy") return;
    setShared("busy");
    try {
      const slim = chat.messages.filter((m) => m.done !== false).map((m) => ({ role: m.role, text: m.text, steps: m.steps.map((s) => ({ name: s.name, input: s.input, ok: s.ok, ms: s.ms, data: s.data })), calls: m.calls.map((c) => ({ ...c, preview: c.preview.slice(0, 200) })), followups: [], done: true }));
      const r = await api.share(chat.conversation.title, slim);
      const url = `${window.location.origin}${r.url}`;
      try { await navigator.clipboard.writeText(url); } catch { /* clipboard blocked */ }
      setShared("done");
      setTimeout(() => setShared("idle"), 2000);
    } catch {
      setShared("error");
      setTimeout(() => setShared("idle"), 2000);
    }
  };

  // Swipe from the left edge to go Home on phones.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; swipe.current = t.clientX < 28 ? { x: t.clientX, y: t.clientY } : null; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!swipe.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipe.current.x;
    const dy = Math.abs(t.clientY - swipe.current.y);
    swipe.current = null;
    if (dx > 80 && dy < 60) nav("/");
  };

  const QUICK = ["How is the market today?", "Why is @SOL moving today?", "Compare BTC, ETH and SOL risk over 90 days", "Which sectors are rotating this week?", "What got liquidated in the last 24h?"];

  return (
    <div className="grid min-w-0 gap-4 lg:h-[calc(100dvh-112px)] lg:grid-cols-[minmax(0,1fr)_340px]" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Phone top bar: back home, title, history, new. */}
      <div className="fixed inset-x-0 top-0 z-20 flex items-center gap-2 border-b border-line bg-[rgba(10,10,11,0.85)] px-3 py-2.5 backdrop-blur-xl lg:hidden" style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}>
        <Link to="/" className="glass-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2" aria-label="Back to Home"><ChevronLeft size={18} /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-gold"><Sparkles size={10} /> Argus</div>
          <div className="truncate text-[14px] font-medium">{title}</div>
        </div>
        {chat.messages.length > 0 && (
          <button onClick={share} className="glass-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-2" aria-label="Share" title="Copy share link">{shared === "done" ? <Check size={16} className="text-up" /> : <Share2 size={15} />}</button>
        )}
        <button onClick={() => setHistOpen((o) => !o)} className="glass-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-2" aria-label="History"><HistoryIcon size={16} /></button>
        <button onClick={chat.reset} className="glass-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-2" aria-label="New conversation"><Plus size={17} /></button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-col pt-14 lg:pt-0">
        {/* Desktop header. */}
        <div className="mb-4 hidden items-end justify-between gap-3 lg:flex">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[13px] text-gold"><Sparkles size={13} /> Live analyst</div>
            <h1 className="font-display mt-1 truncate text-[30px] font-light leading-tight tracking-tight">{title}</h1>
          </div>
          {chat.messages.length > 0 && (
            <div className="flex items-center gap-2">
              <button onClick={share} className="glass-2 pill flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-ink-2 hover:text-ink">
                {shared === "done" ? <><Check size={12} className="text-up" /> Link copied</> : shared === "error" ? "Could not share" : <><Share2 size={12} /> Share</>}
              </button>
              <button onClick={chat.reset} className="glass-2 pill flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-ink-2 hover:text-ink"><Sparkles size={12} /> New</button>
            </div>
          )}
        </div>

        {histOpen && (
          <div className="glass mb-3 p-3 lg:hidden"><HistoryList activeId={chat.conversation.id} onOpen={(id) => { chat.open(id); setHistOpen(false); }} onNew={() => { chat.reset(); setHistOpen(false); }} /></div>
        )}

        {/* Thread: its own scroll region on desktop, window scroll on phones. */}
        <div ref={thread} className="scroll-thin relative min-h-0 flex-1 space-y-4 lg:overflow-y-auto lg:pr-2">
          {locked && (
            <div className="glass flex flex-col gap-3 border-gold/30 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-dim text-gold"><KeyRound size={16} /></span>
                <div>
                  <div className="text-[14px] font-medium">Connect a key to ask</div>
                  <div className="text-[12.5px] leading-relaxed text-ink-3">{keys.data?.serverKey ? "The shared key on this site is unavailable right now." : "This site has no shared Anthropic key."} Add your own: it stays in this browser and is never stored in a database. Everything else on Argus works without one.</div>
                </div>
              </div>
              <Link to="/keys" className="pill inline-flex shrink-0 items-center gap-1.5 bg-gold px-3.5 py-2 text-[12.5px] font-medium text-bg hover:bg-gold-2">Add my key</Link>
            </div>
          )}
          {chat.messages.length === 0 && (
            <div className="glass hud p-6 sm:p-8">
              <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
                <Mascot size={112} className="scan rounded-full" />
                <div>
                  <div className="font-display text-[24px] font-light">Every number, <span className="text-glow">sourced live.</span></div>
                  <p className="mt-2 max-w-[600px] text-[13.5px] leading-relaxed text-ink-2">
                    Ask about a coin, a sector, or the whole market. I choose the CoinMarketCap endpoints, compute what the API does not provide, and show every call I made. Type @ to mention a coin.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {SUGGESTIONS.map((g) => (
                  <div key={g.group}>
                    <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-3">{g.group}</div>
                    <div className="flex flex-wrap gap-2">
                      {g.items.map((s) => (
                        <button key={s} onClick={() => ask(s)} className="glass-2 pill px-3 py-1.5 text-left text-[12.5px] text-ink-2 hover:border-gold/40 hover:text-ink">{s}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {chat.messages.map((m, i) => (
            <div key={i} className="flex">
              <Bubble m={m} live={chat.busy && i === chat.messages.length - 1} onFollowup={ask} onRetry={chat.retry} compact={!isDesktop} isLatest={i === chat.messages.length - 1} />
            </div>
          ))}
          <div ref={bottom} className="h-px" />
        </div>

        {!pinned && chat.messages.length > 0 && (
          <button onClick={() => scrollToLatest(true)} className="glass-2 pill fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 px-3 py-1.5 text-[12px] text-ink-2 hover:text-ink lg:absolute lg:bottom-24 lg:left-auto lg:right-[380px] lg:translate-x-0">
            <ArrowDown size={12} /> Jump to latest
          </button>
        )}

        {/* Composer: docked in the column on desktop; morphs from the tab bar and stays fixed on phones. */}
        <div className="hidden pt-3 lg:block">
          <Composer busy={chat.busy} onSend={chat.send} onStop={chat.stop} autoFocus={chat.messages.length === 0 && isDesktop} />
        </div>
        <motion.div layoutId="dock" className="fixed inset-x-3 z-30 lg:hidden" style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
          {chat.messages.length > 0 && !chat.busy && (
            <div className="scroll-thin -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5" style={{ scrollbarWidth: "none" }}>
              {(latest?.followups?.length ? latest.followups : QUICK).map((q) => (
                <button key={q} onClick={() => ask(q)} className="glass-2 pill shrink-0 px-3 py-1.5 text-[12px] text-ink-2">{q}</button>
              ))}
            </div>
          )}
          <Composer busy={chat.busy} onSend={chat.send} onStop={chat.stop} />
        </motion.div>
      </div>

      <Rail latest={latest} busy={chat.busy} activeId={chat.conversation.id} onOpen={chat.open} onNew={chat.reset} />
    </div>
  );
}
