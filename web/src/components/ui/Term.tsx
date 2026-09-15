/**
 * A jargon word with a dotted underline. Tap or click it for a one-line plain explanation.
 * The popover is portalled to <body> so tiles, carousels and overflow never clip it.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import clsx from "clsx";
import { GLOSSARY, type GlossaryKey } from "../../lib/glossary";

const WIDTH = 264;

export function Term({ k, children, className }: { k: GlossaryKey; children?: ReactNode; className?: string }) {
  const g = GLOSSARY[k];
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);

  const toggle = () => {
    if (pos) return setPos(null);
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(WIDTH, window.innerWidth - 24);
    const left = Math.max(12, Math.min(r.left, window.innerWidth - width - 12));
    const below = window.innerHeight - r.bottom > 150;
    setPos(below ? { left, top: r.bottom + 8, width } : { left, bottom: window.innerHeight - r.top + 8, width });
  };

  useEffect(() => {
    if (!pos) return;
    const outside = (e: Event) => {
      const t = e.target as Node;
      if (btn.current?.contains(t) || pop.current?.contains(t)) return;
      setPos(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const close = () => setPos(null);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(); }}
        aria-expanded={Boolean(pos)}
        aria-label={`${g.term}: what does this mean?`}
        className={clsx("cursor-help text-left underline decoration-dotted decoration-1 underline-offset-[3px] [text-decoration-color:rgba(183,179,169,0.45)] hover:[text-decoration-color:#e7c46a]", className)}
      >
        {children ?? g.term}
      </button>
      {pos &&
        createPortal(
          <motion.span
            ref={pop}
            role="tooltip"
            initial={{ opacity: 0, y: pos.top !== undefined ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.14 }}
            style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width }}
            className="z-[70] block rounded-2xl border border-line-2 bg-[#141416] p-3.5 text-left text-[12.5px] font-normal normal-case leading-relaxed tracking-normal text-ink-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.95)]"
          >
            <span className="mb-1 block text-[13px] font-medium text-ink">{g.term}</span>
            {g.text}
          </motion.span>,
          document.body,
        )}
    </>
  );
}
