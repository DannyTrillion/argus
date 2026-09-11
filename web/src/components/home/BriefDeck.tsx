/**
 * The daily brief as a vertical picture deck. Five collage cards built from live
 * data; one is in focus, the neighbours peek above and below, dimmed. Steps up
 * every six seconds, pauses silently on hover, tapping asks the analyst.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Globe, TrendingUp, Layers, Flame, Eye, Sparkles } from "lucide-react";
import clsx from "clsx";
import { api, type Coin } from "../../lib/api";
import { parseBrief } from "../../lib/brief";
import { usd, pct, timeAgo } from "../../lib/format";
import { Sparkline } from "../ui/Sparkline";
import { Gauge } from "../ui/Gauge";
import { Skeleton } from "../ui/Skeleton";
import { Markdown } from "../ui/Markdown";

type Accent = "gold" | "up" | "down" | "blue";
const ACCENT: Record<Accent, { text: string; hex: string }> = {
  gold: { text: "text-gold", hex: "231,196,106" },
  up: { text: "text-up", hex: "111,211,156" },
  down: { text: "text-down", hex: "239,111,111" },
  blue: { text: "text-[#8fb7ff]", hex: "143,183,255" },
};

interface Topic { key: string; match: RegExp; label: string; accent: Accent; icon: typeof Globe; question: string }
const TOPICS: Topic[] = [
  { key: "backdrop", match: /backdrop|overview|market$/i, label: "Market backdrop", accent: "gold", icon: Globe, question: "How is the market today?" },
  { key: "movers", match: /mover/i, label: "Movers that matter", accent: "up", icon: TrendingUp, question: "What moved today and why?" },
  { key: "sectors", match: /sector|rotation/i, label: "Sector rotation", accent: "blue", icon: Layers, question: "Which sectors are rotating this week?" },
  { key: "leverage", match: /leverage|risk|liquidation/i, label: "Leverage and risk", accent: "down", icon: Flame, question: "What got liquidated in the last 24h?" },
  { key: "watch", match: /watch/i, label: "Watch list", accent: "gold", icon: Eye, question: "What should I watch this week?" },
];

const STEP_MS = 7000;

function Drift({ children, x = 10, y = 6, duration = 14, delay = 0, className }: { children: ReactNode; x?: number; y?: number; duration?: number; delay?: number; className?: string }) {
  return (
    <motion.div className={clsx("absolute", className)} animate={{ x: [0, x, 0, -x, 0], y: [0, -y, 0, y, 0] }} transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}>
      {children}
    </motion.div>
  );
}

function CoinBadge({ coin, size }: { coin: Coin; size: number }) {
  const up = (coin.quote.percent_change_24h ?? 0) >= 0;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="rounded-full p-[3px]" style={{ background: `radial-gradient(circle, rgba(${up ? "111,211,156" : "239,111,111"},0.35), transparent 70%)` }}>
        <img src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`} alt="" width={size} height={size} className="rounded-full shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)]" />
      </div>
      <span className={clsx("font-mono text-[10.5px]", up ? "text-up" : "text-down")}>{coin.symbol} {pct(coin.quote.percent_change_24h, 1)}</span>
    </div>
  );
}

export function BriefDeck({ className }: { className?: string }) {
  const brief = useQuery({ queryKey: ["brief"], queryFn: api.brief, staleTime: 10 * 60_000, refetchInterval: 10 * 60_000, retry: 2 });
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.overview });
  const history = useQuery({ queryKey: ["history", 30], queryFn: () => api.history(30) });
  const movers = useQuery({ queryKey: ["movers"], queryFn: api.movers });
  const sectors = useQuery({ queryKey: ["sectors"], queryFn: api.sectors });
  const nav = useNavigate();

  const sections = useMemo(() => (brief.data ? parseBrief(brief.data.text) : []), [brief.data]);
  const slides = useMemo(() => TOPICS.map((t) => ({ topic: t, section: sections.find((s) => t.match.test(s.title)) ?? null })).filter((s) => s.section), [sections]);
  const n = slides.length;

  const [i, setI] = useState(0);
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    if (hover || n < 2) return;
    const t = setInterval(() => setI((x) => { setPrevIdx(x); return (x + 1) % n; }), STEP_MS);
    return () => clearInterval(t);
  }, [hover, n]);

  const g = overview.data?.global;
  const liq = overview.data?.liquidations;
  const fg = overview.data?.fearGreed;
  const capSpark = history.data?.global.map((p) => p.total_market_cap) ?? [];
  const gainers = movers.data?.gainers.slice(0, 3) ?? [];
  const losers = movers.data?.losers.slice(0, 2) ?? [];
  const sorted = sectors.data ? [...sectors.data].sort((a, b) => (b.market_cap_change ?? 0) - (a.market_cap_change ?? 0)) : [];
  const topSector = sectors.data ? [...sectors.data].sort((a, b) => Math.abs(b.market_cap_change ?? 0) - Math.abs(a.market_cap_change ?? 0))[0] : undefined;
  const chips = [...sorted.slice(0, 3), ...sorted.slice(-3)];

  function headline(key: string): string {
    switch (key) {
      case "backdrop": return g ? `${usd(g.total_market_cap, { compact: true })} · ${pct(g.total_market_cap_yesterday_percentage_change, 1)}` : "—";
      case "movers": return gainers[0] ? `${gainers[0].symbol} ${pct(gainers[0].quote.percent_change_24h, 1)}` : "—";
      case "sectors": return topSector ? `${topSector.name} ${pct(topSector.market_cap_change, 1)}` : "—";
      case "leverage": return liq ? `${usd(liq.total_liquidations_24h, { compact: true })} · ${Math.round((liq.long_liquidations_24h / (liq.total_liquidations_24h || 1)) * 100)}% longs` : "—";
      case "watch": return fg ? `${fg.value} · ${fg.value_classification}` : "—";
      default: return "";
    }
  }

  function collage(key: string): ReactNode {
    switch (key) {
      case "backdrop":
        return capSpark.length > 2 ? (
          <Drift x={6} y={3} duration={20} className="inset-x-0 top-6 opacity-70">
            <Sparkline data={capSpark} width={600} height={210} color="#e7c46a" strokeWidth={1.6} fluid />
          </Drift>
        ) : null;
      case "movers": {
        const spots = [
          { c: "left-[6%] top-[10%]", s: 58, d: 12 },
          { c: "left-[32%] top-[4%]", s: 48, d: 15 },
          { c: "left-[56%] top-[14%]", s: 64, d: 13 },
          { c: "left-[80%] top-[6%]", s: 50, d: 14 },
        ];
        return [...gainers.slice(0, 2), ...losers.slice(0, 2)].map((coin, k) => (
          <Drift key={coin.id} x={8 + k * 2} y={6 + k} duration={spots[k].d} delay={k * 0.8} className={spots[k].c}><CoinBadge coin={coin} size={spots[k].s} /></Drift>
        ));
      }
      case "sectors": {
        const spots = ["left-[6%] top-[10%]", "left-[46%] top-[6%]", "left-[66%] top-[28%]", "left-[16%] top-[34%]"];
        return [...chips.slice(0, 2), ...chips.slice(-2)].map((s, k) => (
          <Drift key={s.id} x={7 + k} y={5 + (k % 3)} duration={12 + k * 2} delay={k * 0.6} className={spots[k]}>
            <span className={clsx("glass-2 pill px-3 py-1.5 font-mono text-[12px] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.9)]", (s.market_cap_change ?? 0) >= 0 ? "text-up" : "text-down")}>{s.name} {pct(s.market_cap_change, 1)}</span>
          </Drift>
        ));
      }
      case "leverage":
        return liq ? (
          <div className="absolute inset-x-6 top-6 space-y-3.5">
            {(["24h", "4h", "1h"] as const).map((w, k) => {
              const long = liq[`long_liquidations_${w}`];
              const short = liq[`short_liquidations_${w}`];
              const lp = (long / (long + short || 1)) * 100;
              return (
                <div key={w}>
                  <div className="mb-1 flex justify-between font-mono text-[10.5px] text-ink-3"><span>{w}</span><span>{usd(long + short, { compact: true })}</span></div>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-black/40">
                    <motion.div className="h-full bg-down" initial={{ width: 0 }} animate={{ width: `${lp}%` }} transition={{ duration: 1.2, delay: k * 0.2, ease: "easeOut" }} />
                    <div className="h-full flex-1 bg-up" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null;
      case "watch":
        return fg ? (
          <Drift x={4} y={3} duration={18} className="left-1/2 top-4 -translate-x-1/2">
            <Gauge value={fg.value} label={fg.value_classification} size={200} color={fg.value > 60 ? "#6fd39c" : fg.value < 40 ? "#ef6f6f" : "#e7c46a"} />
          </Drift>
        ) : null;
      default:
        return null;
    }
  }

  if (brief.isLoading) return <Skeleton className={clsx("h-full min-h-[540px] lg:min-h-[420px]", className)} />;
  if (brief.isError || !brief.data || n === 0) return null;

  return (
    <div
      className={clsx("relative h-full min-h-[540px] overflow-hidden rounded-[22px] lg:min-h-[420px]", className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-roledescription="carousel"
    >
      {slides.map((s, k) => {
        const active = k === i;
        const leaving = k === prevIdx && !active;
        const a = ACCENT[s.topic.accent];
        // Stack transition: the incoming card slides up from below and covers the current one,
        // which sinks back and dims underneath. Idle cards wait just below the frame.
        return (
          <motion.button
            key={s.topic.key}
            type="button"
            onClick={() => nav(`/analyst?q=${encodeURIComponent(s.topic.question)}`)}
            initial={false}
            animate={active ? { y: 0, scale: 1, opacity: 1 } : leaving ? { y: -18, scale: 0.94, opacity: 0.45 } : { y: "104%", scale: 1, opacity: 1 }}
            transition={active ? { type: "spring", stiffness: 150, damping: 24, mass: 0.9 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className={clsx("glass absolute inset-0 block cursor-pointer overflow-hidden p-0 text-left", !active && "pointer-events-none")}
            style={{
              boxShadow: active
                ? "0 0 0 1px rgba(231,196,106,0.14), 0 1px 0 rgba(255,255,255,0.05) inset, 0 -18px 50px -20px rgba(0,0,0,0.85), 0 24px 60px -36px rgba(0,0,0,0.9)"
                : "0 0 0 1px rgba(231,196,106,0.10)",
              zIndex: active ? 3 : leaving ? 2 : 1,
              transformOrigin: "50% 100%",
            }}
            tabIndex={active ? 0 : -1}
            aria-hidden={!active}
          >
            <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(520px 260px at 70% 0%, rgba(${a.hex},0.10), transparent 70%)` }} />
            <div className="pointer-events-none absolute inset-x-0 top-11 h-[56%] overflow-hidden">{collage(s.topic.key)}</div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#0e0e10] via-[rgba(14,14,16,0.86)] to-transparent" />

            <div className="absolute left-5 top-4 flex items-center gap-1.5 text-[11px] text-ink-3">
              <Sparkles size={11} className="text-gold" /> Today's brief · {timeAgo(brief.data.generatedAt)}
            </div>

            <div className="absolute inset-x-6 bottom-6">
              <div className={clsx("flex items-center gap-1.5 text-[11px] uppercase tracking-wider", a.text)}>
                <s.topic.icon size={12} /> {s.topic.label}
              </div>
              <div className="font-display mt-2 text-[30px] font-medium leading-none tracking-tight tabular">{headline(s.topic.key)}</div>
              <Markdown text={s.section!.body} className="mt-3 text-[13px] leading-relaxed [&_p]:mb-1.5 [&_ul]:mb-0 [&_li]:my-0.5" />
              <div className="mt-4 flex items-center justify-between">
                <span className={clsx("inline-flex items-center gap-1.5 text-[12px]", a.text)}><Sparkles size={12} /> {s.topic.question}</span>
                <div className="flex gap-1.5">
                  {slides.map((d, j) => <span key={d.topic.key} className={clsx("h-1 rounded-full transition-all duration-500", j === i ? "w-4 bg-gold" : "w-1 bg-line-2")} />)}
                </div>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
