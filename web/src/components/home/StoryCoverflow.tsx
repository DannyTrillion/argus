/**
 * Perspective coverflow of Argus stories: findings the agent caught on its own and
 * the daily brief's sections. The centre card is flat and in focus, neighbours recede
 * with rotation and dim. Steps every five seconds, pauses on hover. "Read more" grows
 * the centre card into the full article in place and stops the deck.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, ArrowRight, X, ChevronLeft, ChevronRight, Radar, Flame, Layers, Globe, TrendingUp, Eye, Activity } from "lucide-react";
import clsx from "clsx";
import { api, type Story } from "../../lib/api";
import { pct, timeAgo } from "../../lib/format";
import { Markdown } from "../ui/Markdown";
import { Mascot } from "../ui/Mascot";
import { Skeleton } from "../ui/Skeleton";

const ACCENT: Record<Story["accent"], { text: string; hex: string }> = {
  gold: { text: "text-gold", hex: "231,196,106" },
  up: { text: "text-up", hex: "111,211,156" },
  down: { text: "text-down", hex: "239,111,111" },
  blue: { text: "text-[#8fb7ff]", hex: "143,183,255" },
};

const TOPIC_ICON: Record<string, typeof Globe> = { backdrop: Globe, movers: TrendingUp, sectors: Layers, leverage: Flame, watch: Eye };

const STEP_MS = 5000;

function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(1200);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function Motif({ s, size = "lg" }: { s: Story; size?: "lg" | "sm" }) {
  const a = ACCENT[s.accent];
  const px = size === "lg" ? 84 : 56;
  if (s.subject.type === "coin") {
    return (
      <div className="relative flex items-center justify-center" style={{ width: px + 28, height: px + 28 }}>
        <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, rgba(${a.hex},0.45), transparent 68%)`, filter: "blur(8px)" }} />
        <img src={`https://s2.coinmarketcap.com/static/img/coins/128x128/${s.subject.id}.png`} alt="" width={px} height={px} className="relative rounded-full shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]" />
      </div>
    );
  }
  const Icon = s.subject.type === "topic" ? TOPIC_ICON[s.subject.key] ?? Activity : Radar;
  return (
    <div className="relative flex items-center justify-center" style={{ width: px + 28, height: px + 28 }}>
      <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, rgba(${a.hex},0.35), transparent 68%)`, filter: "blur(8px)" }} />
      <div className="glass-2 relative flex items-center justify-center rounded-full" style={{ width: px, height: px }}>
        <Icon size={px * 0.42} className={a.text} />
      </div>
    </div>
  );
}

function Card({ s, onRead, dim }: { s: Story; onRead: () => void; dim: boolean }) {
  const a = ACCENT[s.accent];
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[22px] border border-line p-5" style={{ background: "linear-gradient(180deg, #17171a 0%, #101012 100%)", boxShadow: dim ? "0 20px 50px -30px rgba(0,0,0,0.9)" : `0 0 0 1px rgba(${a.hex},0.28), 0 30px 70px -30px rgba(0,0,0,0.9)` }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(360px 220px at 50% 0%, rgba(${a.hex},0.14), transparent 70%)` }} />
      <div className="relative flex items-center justify-between text-[10.5px] uppercase tracking-wider">
        <span className={a.text}>{s.kicker}</span>
        <span className="font-mono normal-case text-ink-3">{timeAgo(s.at)}</span>
      </div>
      <div className="relative mt-4 flex justify-center"><Motif s={s} /></div>
      <div className="relative mt-4 flex-1">
        <div className="font-display text-[21px] font-medium leading-[1.15] tracking-tight">{s.headline}</div>
        <div className="mt-2 line-clamp-2 text-[12.5px] leading-snug text-ink-2">{s.deck}</div>
      </div>
      <div className="relative mt-4 flex items-center justify-between">
        {s.attribution ? <span className="pill bg-gold-dim px-2 py-0.5 font-mono text-[10.5px] text-gold">{s.attribution.read}</span> : <span />}
        <button onClick={(e) => { e.stopPropagation(); onRead(); }} className="pill flex items-center gap-1.5 bg-ink px-3.5 py-1.5 text-[12px] font-medium text-bg hover:bg-white">
          Read more <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

function Article({ s, onClose }: { s: Story; onClose: () => void }) {
  const a = ACCENT[s.accent];
  return (
    <div className="relative overflow-hidden rounded-[22px] border border-line p-6 sm:p-8" style={{ background: "linear-gradient(180deg, #17171a 0%, #101012 100%)", boxShadow: `0 0 0 1px rgba(${a.hex},0.28), 0 40px 90px -40px rgba(0,0,0,0.95)` }}>
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(700px 300px at 20% 0%, rgba(${a.hex},0.12), transparent 70%)` }} />
      <button type="button" onClick={onClose} className="glass-2 absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:text-ink sm:right-4 sm:top-4 sm:h-10 sm:w-10" aria-label="Close"><X size={17} /></button>
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <div className={clsx("pr-12 text-[11px] uppercase tracking-wider", a.text)}>{s.kicker} · <span className="font-mono normal-case text-ink-3">{timeAgo(s.at)}</span></div>
          <h3 className="font-display mt-2 pr-12 text-[26px] font-medium leading-[1.1] tracking-tight sm:text-[34px] lg:pr-0">{s.headline}</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{s.deck}</p>
          <Markdown text={s.body} className="mt-5 text-[14px] leading-relaxed" />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to={`/analyst?q=${encodeURIComponent(s.question)}`} className="pill inline-flex items-center gap-2 bg-gold px-4 py-2 text-[13px] font-medium text-bg hover:bg-gold-2">
              <Sparkles size={14} /> Ask Argus about this <ArrowRight size={13} />
            </Link>
            {s.meta && <span className="font-mono text-[11px] text-ink-3">{s.meta.calls} API calls · {s.meta.credits} credits</span>}
          </div>
          <button type="button" onClick={onClose} className="glass-2 pill mt-5 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] text-ink-2 hover:text-ink lg:hidden"><X size={13} /> Back to stories</button>
        </div>
        <div className="space-y-4">
          <div className="flex justify-center"><Motif s={s} /></div>
          {s.attribution && (
            <div className="glass-2 rounded-2xl p-4">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-3">Attribution · {s.attribution.window}</div>
              {[
                ["Market beta", s.attribution.market_component_pct, "#8fb7ff"],
                [s.attribution.sector ? `${s.attribution.sector.name} sector` : "Sector", s.attribution.sector?.excess_pct ?? null, "#c99cff"],
                ["Coin-specific", s.attribution.coin_specific_pct, "#e7c46a"],
              ].map(([label, v, color]) => (
                <div key={String(label)} className="mb-2 flex items-center justify-between text-[12px]">
                  <span className="text-ink-2">{label}</span>
                  <span className="font-mono" style={{ color: String(color) }}>{typeof v === "number" ? pct(v, 2) : "—"}</span>
                </div>
              ))}
              <div className="mt-2 font-mono text-[10.5px] text-ink-3">BTC {pct(s.attribution.btc_change_pct, 2)} · beta {s.attribution.beta_to_btc ?? "—"} · read {s.attribution.read}</div>
            </div>
          )}
          {s.subject.type === "coin" && (
            <Link to={`/coin/${s.subject.id}`} className="glass-2 flex items-center justify-between rounded-2xl px-4 py-3 text-[13px] hover:border-gold/40">
              Open {s.subject.symbol} <ArrowRight size={13} className="text-ink-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}

export function StoryCoverflow() {
  const { data, isLoading } = useQuery({ queryKey: ["stream"], queryFn: api.stream, refetchInterval: 60_000 });
  const stories = useMemo(() => data?.stories ?? [], [data]);
  const n = stories.length;
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const width = useSize(wrap);
  const compact = width < 720;
  const cardW = compact ? Math.min(260, width * 0.72) : 300;
  const cardH = compact ? 360 : 380;
  const touch = useRef<number | null>(null);

  useEffect(() => { if (i >= n && n > 0) setI(0); }, [n, i]);
  useEscape(open !== null, () => setOpen(null));
  useEffect(() => {
    if (hover || open || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), STEP_MS);
    return () => clearInterval(t);
  }, [hover, open, n]);

  if (isLoading) return <Skeleton className="h-[440px]" />;
  if (n === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Mascot size={88} />
        <div className="text-[14px]">Nothing to show yet.</div>
        <div className="max-w-[460px] text-[12.5px] text-ink-3">Argus scans the market every ten minutes and writes a brief every four hours. Stories appear here as they land.</div>
      </div>
    );
  }
  const opened = open ? stories.find((s) => s.id === open) : null;
  const wrapDelta = (k: number) => { let d = k - i; if (d > n / 2) d -= n; if (d < -n / 2) d += n; return d; };
  const slots = compact ? 1 : 2;
  const stepX = compact ? cardW * 0.62 : cardW * 0.78;

  return (
    <div ref={wrap} className="relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <AnimatePresence mode="wait" initial={false}>
        {opened ? (
          <motion.div key={`article-${opened.id}`} layoutId={`story-${opened.id}`} initial={{ opacity: 0.6, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", stiffness: 180, damping: 26 }}>
            <Article s={opened} onClose={() => setOpen(null)} />
          </motion.div>
        ) : (
          <motion.div key="deck" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div
              className="relative mx-auto overflow-hidden"
              style={{ height: cardH + 24, perspective: 1400 }}
              onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 40) setI((x) => (dx < 0 ? (x + 1) % n : (x - 1 + n) % n)); }}
            >
              {stories.map((s, k) => {
                const d = wrapDelta(k);
                const visible = Math.abs(d) <= slots;
                const center = d === 0;
                return (
                  <motion.div
                    key={s.id}
                    layoutId={`story-${s.id}`}
                    onClick={() => { if (!center) setI(k); }}
                    initial={false}
                    animate={{
                      x: d * stepX,
                      rotateY: -d * (compact ? 26 : 22),
                      scale: center ? 1 : Math.abs(d) === 1 ? 0.9 : 0.8,
                      opacity: !visible ? 0 : center ? 1 : Math.abs(d) === 1 ? 0.72 : 0.42,
                      zIndex: 10 - Math.abs(d),
                      filter: center ? "blur(0px)" : `blur(${Math.abs(d) * 0.4}px)`,
                    }}
                    transition={{ type: "spring", stiffness: 140, damping: 24, mass: 0.9 }}
                    className={clsx("absolute left-1/2 top-3 -translate-x-1/2", !visible && "pointer-events-none", !center && "cursor-pointer")}
                    style={{ width: cardW, height: cardH, transformStyle: "preserve-3d" }}
                  >
                    <div className="relative h-full w-full">
                      <Card s={s} onRead={() => { setI(k); setOpen(s.id); }} dim={!center} />
                    </div>
                  </motion.div>
                );
              })}
              <button onClick={() => setI((x) => (x - 1 + n) % n)} className="glass-2 absolute left-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-2 opacity-0 transition-opacity hover:text-ink group-hover:opacity-100 md:flex" style={{ opacity: hover ? 1 : 0 }} aria-label="Previous"><ChevronLeft size={16} /></button>
              <button onClick={() => setI((x) => (x + 1) % n)} className="glass-2 absolute right-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-2 transition-opacity hover:text-ink md:flex" style={{ opacity: hover ? 1 : 0 }} aria-label="Next"><ChevronRight size={16} /></button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5">
              {stories.map((s, k) => (
                <button key={s.id} onClick={() => setI(k)} className={clsx("h-1 rounded-full transition-all duration-300", k === i ? "w-5 bg-gold" : "w-1.5 bg-line-2 hover:bg-ink-3")} aria-label={s.headline} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
