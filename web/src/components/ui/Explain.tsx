/**
 * Explain: an instant, stored explainer for the number it sits on. No model, no network.
 * Anchored popover on desktop; bottom sheet on phones. The analyst is kept for analysis.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Info, X, ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { timeAgo } from "../../lib/format";
import clsx from "clsx";
import { EXPLAINERS, readNow, zoneFor, type ExplainTopic, type Live, type Tone } from "../../lib/explainers";

const TONE: Record<Tone, string> = { down: "#ef6f6f", gold: "#e7c46a", up: "#6fd39c", blue: "#8fb7ff" };
const WIDTH = 368;

export function ExplainButton({ topic, live, className, iconOnly, tourId }: { topic: ExplainTopic; live?: Live; className?: string; iconOnly?: boolean; tourId?: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Explain ${EXPLAINERS[topic].title}`}
        data-tour={tourId}
        className={clsx("pill inline-flex shrink-0 items-center gap-1 px-2 py-1 text-[11px] transition-colors hover:bg-gold-dim hover:text-gold", open ? "bg-gold-dim text-gold" : "text-ink-3", className)}
      >
        <Info size={11} />
        <span className={iconOnly ? "sr-only" : "hidden sm:inline"}>Explain</span>
      </button>
      {open && <ExplainPanel topic={topic} live={live} anchor={btn} onClose={() => setOpen(false)} />}
    </>
  );
}

function Scale({ topic, value }: { topic: ExplainTopic; value: number }) {
  const scale = EXPLAINERS[topic].scale!;
  const span = scale.max - scale.min;
  const at = Math.max(0, Math.min(100, ((value - scale.min) / span) * 100));
  const current = zoneFor(scale, value);
  return (
    <div className="mt-3">
      <div className="relative flex h-2 w-full gap-[3px]">
        {scale.zones.map((z) => (
          <div key={z.label} className="h-full rounded-full" style={{ flex: (Math.min(z.to, scale.max) - Math.max(z.from, scale.min)) || 1, background: TONE[z.tone], opacity: z === current ? 0.95 : 0.28 }} />
        ))}
        <motion.div
          className="absolute -top-[5px] h-[18px] w-[3px] rounded-full bg-ink shadow-[0_0_0_2px_#141416]"
          initial={{ left: "0%" }}
          animate={{ left: `calc(${at}% - 1.5px)` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <div className="mt-1.5 flex justify-between gap-2 font-mono text-[10px] text-ink-3">
        {scale.zones.map((z) => (
          <span key={z.label} className={clsx(z === current && "text-ink")}>{z.label}</span>
        ))}
      </div>
    </div>
  );
}

function ExplainPanel({ topic, live, anchor, onClose }: { topic: ExplainTopic; live?: Live; anchor: React.RefObject<HTMLButtonElement | null>; onClose: () => void }) {
  const ex = EXPLAINERS[topic];
  const reading = readNow(topic, live);
  const panel = useRef<HTMLDivElement>(null);
  const phone = typeof window !== "undefined" && window.innerWidth < 640;
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (phone) return;
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(12, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 12));
    const below = window.innerHeight - r.bottom - 20;
    const above = r.top - 20;
    setPos(below >= 380 || below >= above ? { left, top: r.bottom + 8, maxHeight: below } : { left, bottom: window.innerHeight - r.top + 8, maxHeight: above });
  }, [anchor, phone]);

  useEffect(() => {
    const outside = (e: Event) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const scroll = (e: Event) => { if (!phone && !panel.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose, phone]);

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-gold"><Info size={11} /> Explained</div>
          <div className="font-display mt-1 text-[19px] font-medium leading-tight text-ink">{ex.title}</div>
        </div>
        <button type="button" onClick={onClose} className="glass-2 -mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 hover:text-ink" aria-label="Close"><X size={15} /></button>
      </div>

      {reading && (
        <div className="mt-3 rounded-2xl border border-gold/20 bg-gold-dim px-3.5 py-3">
          <div className="flex items-center justify-between gap-2 text-[10.5px] uppercase tracking-wider text-gold">
            <span>Right now</span>
            {live?.asOf && <span className="font-mono normal-case tracking-normal text-ink-3">updated {timeAgo(live.asOf)}</span>}
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-ink">{reading}</p>
          {ex.scale && typeof live?.value === "number" && <Scale topic={topic} value={live.value} />}
        </div>
      )}

      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{ex.what}</p>

      <div className="mt-3.5 text-[10.5px] uppercase tracking-wider text-ink-3">How to read it</div>
      <ul className="mt-1.5 space-y-1.5">
        {ex.howToRead.map((l) => (
          <li key={l} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold" />{l}</li>
        ))}
      </ul>

      <div className="mt-3.5 text-[10.5px] uppercase tracking-wider text-ink-3">What moves it</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {ex.moves.map((m) => (
          <span key={m} className="glass-2 pill px-2.5 py-1 text-[11.5px] text-ink-2">{m}</span>
        ))}
      </div>

      {/* A separate door, not the Explain action itself: only where today's "why" is a real question. */}
      {ex.analyse && (
        <div className="mt-4 border-t border-line pt-3.5">
          <p className="text-[11.5px] leading-relaxed text-ink-3">This explains what the number means. For why it moved today, the analyst works through live data.</p>
          <Link to={`/analyst?q=${encodeURIComponent(ex.analyse.q)}`} onClick={onClose} className="glass-2 pill mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-ink-2 hover:border-gold/40 hover:text-ink">
            <Sparkles size={12} className="text-gold" /> {ex.analyse.label} <ArrowRight size={12} />
          </Link>
        </div>
      )}
      <div className={clsx("flex justify-end", ex.analyse ? "mt-3" : "mt-4")}>
        <Link to={`/learn#${topic}`} onClick={onClose} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-3 hover:text-gold">
          <BookOpen size={12} /> All explainers
        </Link>
      </div>
    </>
  );

  if (phone) {
    return createPortal(
      <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={ex.title}>
        <motion.div className="absolute inset-0 bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
        <motion.div
          ref={panel}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-y-auto rounded-t-[26px] border-t border-line-2 bg-[#141416] px-5 pt-3"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-2" />
          {body}
        </motion.div>
      </div>,
      document.body,
    );
  }

  if (!pos) return null;
  return createPortal(
    <motion.div
      ref={panel}
      role="dialog"
      aria-label={ex.title}
      initial={{ opacity: 0, y: pos.top !== undefined ? -6 : 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.16 }}
      style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: WIDTH, maxHeight: pos.maxHeight }}
      className="z-[90] overflow-y-auto rounded-[22px] border border-line-2 bg-[#141416] p-4 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.95)]"
    >
      {body}
    </motion.div>,
    document.body,
  );
}
