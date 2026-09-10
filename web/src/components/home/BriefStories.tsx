/**
 * The daily brief as a story deck: one card per topic, each with a live-data
 * headline number and a slow-moving collage of the data behind it. Auto-advances,
 * pauses on hover, swipes on phones, arrows and keys on desktop.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Sparkles, ChevronLeft, ChevronRight, Globe, TrendingUp, Layers, Flame, Eye, Pause, Play } from "lucide-react";
import clsx from "clsx";
import { api, type Coin } from "../../lib/api";
import { parseBrief } from "../../lib/brief";
import { usd, pct, timeAgo } from "../../lib/format";
import { Markdown } from "../ui/Markdown";
import { Sparkline } from "../ui/Sparkline";
import { Gauge } from "../ui/Gauge";
import { Skeleton } from "../ui/Skeleton";
import { CopyButton } from "../ui/CopyButton";

type Accent = "gold" | "up" | "down" | "blue";
const ACCENT: Record<Accent, { text: string; ring: string; glow: string }> = {
  gold: { text: "text-gold", ring: "rgba(231,196,106,0.35)", glow: "rgba(231,196,106,0.18)" },
  up: { text: "text-up", ring: "rgba(111,211,156,0.35)", glow: "rgba(111,211,156,0.16)" },
  down: { text: "text-down", ring: "rgba(239,111,111,0.35)", glow: "rgba(239,111,111,0.16)" },
  blue: { text: "text-[#8fb7ff]", ring: "rgba(143,183,255,0.35)", glow: "rgba(143,183,255,0.16)" },
};

interface Topic { key: string; match: RegExp; label: string; accent: Accent; icon: typeof Globe; question: string }
const TOPICS: Topic[] = [
  { key: "backdrop", match: /backdrop|overview|market$/i, label: "Market backdrop", accent: "gold", icon: Globe, question: "How is the market today?" },
  { key: "movers", match: /mover/i, label: "Movers that matter", accent: "up", icon: TrendingUp, question: "What moved today and why?" },
  { key: "sectors", match: /sector|rotation/i, label: "Sector rotation", accent: "blue", icon: Layers, question: "Which sectors are rotating this week?" },
  { key: "leverage", match: /leverage|risk|liquidation/i, label: "Leverage and risk", accent: "down", icon: Flame, question: "What got liquidated in the last 24h?" },
  { key: "watch", match: /watch/i, label: "Watch list", accent: "gold", icon: Eye, question: "What should I watch this week?" },
];

const AUTO_MS = 8000;

function Drift({ children, x = 14, y = 8, duration = 14, delay = 0, className }: { children: ReactNode; x?: number; y?: number; duration?: number; delay?: number; className?: string }) {
  return (
    <motion.div
      className={clsx("absolute", className)}
      animate={{ x: [0, x, 0, -x, 0], y: [0, -y, 0, y, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

function Logo({ coin, size = 44 }: { coin: Coin; size?: number }) {
  return (
    <div className="glass-2 flex items-center gap-2 rounded-full py-1 pl-1 pr-3">
      <img src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`} alt="" width={size * 0.7} height={size * 0.7} className="rounded-full" />
      <span className="font-mono text-[11px]">{coin.symbol}</span>
      <span className={clsx("font-mono text-[11px]", (coin.quote.percent_change_24h ?? 0) >= 0 ? "text-up" : "text-down")}>{pct(coin.quote.percent_change_24h, 1)}</span>
    </div>
  );
}

export function BriefStories() {
  const brief = useQuery({ queryKey: ["brief"], queryFn: api.brief, staleTime: 10 * 60_000, refetchInterval: 10 * 60_000, retry: 2 });
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.overview });
  const history = useQuery({ queryKey: ["history", 30], queryFn: () => api.history(30) });
  const movers = useQuery({ queryKey: ["movers"], queryFn: api.movers });
  const sectors = useQuery({ queryKey: ["sectors"], queryFn: api.sectors });

  const sections = useMemo(() => (brief.data ? parseBrief(brief.data.text) : []), [brief.data]);
  const slides = useMemo(() => {
    return TOPICS.map((t) => ({ topic: t, section: sections.find((s) => t.match.test(s.title)) ?? null })).filter((s) => s.section);
  }, [sections]);

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const n = slides.length;

  // Auto-advance
  useEffect(() => {
    if (paused || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), AUTO_MS);
    return () => clearInterval(t);
  }, [paused, n, i]);

  // Scroll the track to the active card
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const card = el.children[i] as HTMLElement | undefined;
    if (card) el.scrollTo({ left: card.offsetLeft - 8, behavior: "smooth" });
  }, [i]);

  // Sync index when the user swipes
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    cards.forEach((c, k) => { const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center); if (d < dist) { dist = d; best = k; } });
    if (best !== i) setI(best);
  };

  const g = overview.data?.global;
  const liq = overview.data?.liquidations;
  const fg = overview.data?.fearGreed;
  const capSpark = history.data?.global.map((p) => p.total_market_cap) ?? [];
  const gainers = movers.data?.gainers.slice(0, 3) ?? [];
  const losers = movers.data?.losers.slice(0, 3) ?? [];
  const topSector = sectors.data ? [...sectors.data].sort((a, b) => Math.abs(b.market_cap_change ?? 0) - Math.abs(a.market_cap_change ?? 0))[0] : undefined;
  const sectorChips = sectors.data ? [...sectors.data].sort((a, b) => (b.market_cap_change ?? 0) - (a.market_cap_change ?? 0)).filter((_, k, arr) => k < 3 || k >= arr.length - 3) : [];

  function headline(key: string): { value: string; sub: string } {
    switch (key) {
      case "backdrop": return { value: g ? usd(g.total_market_cap, { compact: true }) : "—", sub: g ? `total market cap · ${pct(g.total_market_cap_yesterday_percentage_change)} 24h` : "" };
      case "movers": return gainers[0] ? { value: `${gainers[0].symbol} ${pct(gainers[0].quote.percent_change_24h, 1)}`, sub: `top liquid gainer · ${losers[0] ? `${losers[0].symbol} ${pct(losers[0].quote.percent_change_24h, 1)} worst` : ""}` } : { value: "—", sub: "" };
      case "sectors": return topSector ? { value: `${topSector.name} ${pct(topSector.market_cap_change, 1)}`, sub: "biggest sector move · 24h market cap" } : { value: "—", sub: "" };
      case "leverage": return liq ? { value: usd(liq.total_liquidations_24h, { compact: true }), sub: `liquidated 24h · ${Math.round((liq.long_liquidations_24h / (liq.total_liquidations_24h || 1)) * 100)}% longs` } : { value: "—", sub: "" };
      case "watch": return fg ? { value: `${fg.value} · ${fg.value_classification}`, sub: "Fear & Greed · what would change the read" } : { value: "—", sub: "" };
      default: return { value: "", sub: "" };
    }
  }

  function motif(key: string): ReactNode {
    switch (key) {
      case "backdrop":
        return capSpark.length > 2 ? (
          <Drift x={8} y={3} duration={18} className="bottom-0 left-0 right-0 opacity-60">
            <Sparkline data={capSpark} width={600} height={110} color="#e7c46a" strokeWidth={1.5} fluid />
          </Drift>
        ) : null;
      case "movers":
        return (
          <>
            {[...gainers.slice(0, 2), ...losers.slice(0, 2)].map((c, k) => (
              <Drift key={c.id} x={8 + k * 2} y={5} duration={12 + k * 2} delay={k * 0.6} className={clsx("right-3", ["top-2", "top-[46px]", "top-[90px]", "top-[134px]"][k])}><Logo coin={c} /></Drift>
            ))}
          </>
        );
      case "sectors":
        return (
          <>
            {[...sectorChips.slice(0, 2), ...sectorChips.slice(-2)].map((s, k) => (
              <Drift key={s.id} x={8 + k * 2} y={4 + k} duration={11 + k * 2} delay={k * 0.7} className={clsx("right-3", ["top-2", "top-[46px]", "top-[90px]", "top-[134px]"][k])}>
                <span className={clsx("glass-2 pill px-2.5 py-1 font-mono text-[11px]", (s.market_cap_change ?? 0) >= 0 ? "text-up" : "text-down")}>{s.name} {pct(s.market_cap_change, 1)}</span>
              </Drift>
            ))}
          </>
        );
      case "leverage":
        return liq ? (
          <div className="absolute right-4 top-4 w-[40%] space-y-2.5 opacity-90">
            {(["24h", "4h", "1h"] as const).map((w, k) => {
              const long = liq[`long_liquidations_${w}`];
              const short = liq[`short_liquidations_${w}`];
              const lp = (long / (long + short || 1)) * 100;
              return (
                <div key={w}>
                  <div className="mb-1 flex justify-between font-mono text-[10.5px] text-ink-3"><span>{w}</span><span>{usd(long + short, { compact: true })}</span></div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
                    <motion.div className="h-full bg-down" initial={{ width: 0 }} animate={{ width: `${lp}%` }} transition={{ duration: 1.2, delay: k * 0.2, ease: "easeOut" }} />
                    <div className="h-full flex-1 bg-up" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null;
      case "watch":
        return fg ? <div className="absolute right-4 top-3 opacity-90"><Gauge value={fg.value} label={fg.value_classification} size={132} color={fg.value > 60 ? "#6fd39c" : fg.value < 40 ? "#ef6f6f" : "#e7c46a"} /></div> : null;
      default: return null;
    }
  }

  if (brief.isLoading) {
    return (
      <div className="glass p-5">
        <div className="flex items-center gap-3 text-[12px] text-ink-3"><Skeleton className="h-4 w-40" /> Argus is reading the market for today's brief. About a minute.</div>
        <div className="mt-4 flex gap-3">{[0, 1, 2].map((k) => <Skeleton key={k} className="h-[260px] w-[360px] shrink-0" />)}</div>
      </div>
    );
  }
  if (brief.isError || !brief.data || n === 0) return null;

  return (
    <section className="space-y-3" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-ink-2">
          <Sparkles size={13} className="text-gold" /> Today's brief, written by Argus
          <span className="font-mono text-[11px] text-ink-3">· {timeAgo(brief.data.generatedAt)}<span className="hidden sm:inline"> · {brief.data.calls} calls · {brief.data.credits} credits</span></span>
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={brief.data.text} label="Copy" />
          <button onClick={() => setPaused((p) => !p)} className="glass-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:text-ink" aria-label={paused ? "Play" : "Pause"}>{paused ? <Play size={13} /> : <Pause size={13} />}</button>
          <button onClick={() => setI((x) => (x - 1 + n) % n)} className="glass-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:text-ink" aria-label="Previous"><ChevronLeft size={15} /></button>
          <button onClick={() => setI((x) => (x + 1) % n)} className="glass-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:text-ink" aria-label="Next"><ChevronRight size={15} /></button>
        </div>
      </div>

      {/* Segmented progress, story style */}
      <div className="flex gap-1.5">
        {slides.map((s, k) => (
          <button key={s.topic.key} onClick={() => setI(k)} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2" aria-label={s.topic.label}>
            <div
              className={clsx("h-full rounded-full", k < i ? "bg-ink-3" : "bg-gold")}
              style={{
                width: k < i ? "100%" : k === i ? "100%" : "0%",
                transition: k === i && !paused ? `width ${AUTO_MS}ms linear` : "none",
                ...(k === i ? { animation: paused ? "none" : undefined } : {}),
              }}
              key={`${k}-${i}-${paused}`}
            />
          </button>
        ))}
      </div>

      <div ref={track} onScroll={onScroll} className="scroll-thin -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2" style={{ scrollbarWidth: "none" }}>
        {slides.map((s, k) => {
          const a = ACCENT[s.topic.accent];
          const h = headline(s.topic.key);
          const active = k === i;
          return (
            <motion.article
              key={s.topic.key}
              animate={{ opacity: active ? 1 : 0.55, scale: active ? 1 : 0.985 }}
              transition={{ duration: 0.35 }}
              className="glass relative flex min-h-[340px] w-[min(88vw,420px)] shrink-0 snap-start flex-col overflow-hidden p-5 lg:w-[calc((100%-2rem)/3)]"
              style={{ boxShadow: active ? `0 0 0 1px ${a.ring}, 0 30px 60px -30px ${a.glow}` : undefined }}
            >
              <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(420px 220px at 85% 20%, ${a.glow}, transparent 70%)` }} />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[176px] overflow-hidden">{motif(s.topic.key)}</div>

              <div className="relative min-h-[136px]">
                <div className={clsx("flex items-center gap-1.5 text-[11px] uppercase tracking-wider", a.text)}>
                  <s.topic.icon size={13} /> {s.topic.label}
                </div>
                <div className="font-display mt-3 max-w-[60%] text-[28px] font-medium leading-none tracking-tight tabular">{h.value}</div>
                <div className="mt-1 max-w-[60%] text-[11.5px] text-ink-3">{h.sub}</div>
              </div>

              <div className="relative mt-auto pt-3">
                <Markdown text={s.section!.body} className="text-[13px] leading-relaxed [&_p]:mb-2 [&_ul]:mb-0" />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Link to={`/analyst?q=${encodeURIComponent(s.topic.question)}`} className={clsx("inline-flex items-center gap-1.5 text-[12px] hover:underline", a.text)}>
                    <Sparkles size={12} /> {s.topic.question}
                  </Link>
                  <span className="font-mono text-[10.5px] text-ink-3">{k + 1}/{n}</span>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
