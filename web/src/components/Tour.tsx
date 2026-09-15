/**
 * First-run welcome tour. Spotlights real elements on the page (marked with
 * data-tour attributes), explains them in a few words, and ends on the analyst.
 * State lives in localStorage so it shows once; the header "?" replays it.
 */
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles, ArrowRight, X } from "lucide-react";
import clsx from "clsx";
import { Mascot } from "./ui/Mascot";

// Bumped when the tour changes, so returning visitors see the new stops once.
const KEY = "argus.tour.v3";

interface Step {
  /** data-tour anchors to try in order; the first one visible wins (desktop vs mobile variants). */
  target?: string[];
  title: string;
  body: string;
  route?: string;
  cta?: { label: string; to: string };
}

const STEPS: Step[] = [
  {
    title: "Hi, I'm Argus.",
    body: "The hundred-eyed watcher, now watching crypto. Every number here comes from a live CoinMarketCap call, and I can explain any of them. A few quick stops.",
    route: "/",
  },
  {
    target: ["pulse"],
    title: "The market pulse",
    body: "Total cap, volume and BTC dominance with 30-day sparklines, plus Fear & Greed and the Altcoin Season Index. Refreshes every minute.",
    route: "/",
  },
  {
    target: ["explain"],
    title: "Tap Explain on any number",
    body: "Every tile and chart has an Explain button. It opens straight away: what the number means today, how it compares with last week, how to read it and what moves it. The Learn page keeps them all in one place.",
    route: "/",
  },
  {
    target: ["spotlight"],
    title: "What I caught on my own",
    body: "Every four hours I scan 200 coins for unusual moves, volume spikes, liquidation bursts and sector breaks, then investigate and write the story. Tap Read more for the full article. The Move explainer tab splits any move into market, sector and coin-specific.",
    route: "/",
  },
  {
    target: ["scan"],
    title: "Can't wait four hours?",
    body: "Scan now runs a fresh scan on demand with your own Anthropic key. Your key stays in your browser and is never stored in a database.",
    route: "/",
  },
  {
    target: ["brief"],
    title: "A brief nobody had to ask for",
    body: "Twice a day I write five cards: backdrop, movers, sector rotation, leverage and a watch list. Tap a card to ask about it.",
    route: "/",
  },
  {
    target: ["chart"],
    title: "The big picture",
    body: "Total market cap against BTC dominance over 30, 90 or 365 days. When dominance falls while cap rises, money is flowing into alts.",
    route: "/",
  },
  {
    target: ["nav", "nav-mobile"],
    title: "Explore, Watchlist, Portfolio",
    body: "Explore the top 200 and star coins to build a watchlist. Switch the Watchlist to Portfolio and add amounts: I price your holdings, explain today's move and flag concentration. Amounts are saved on this device.",
    route: "/",
  },
  {
    target: ["keys"],
    title: "Bring your own key",
    body: "The key icon opens Keys. Add your Anthropic key to unlock Scan now. It is tested once, kept in this browser, and sent only with your own requests.",
    route: "/",
  },
  {
    target: ["ask", "nav-mobile", "ask-card"],
    title: "Ask anything, see the evidence",
    body: "Try \"Why is SOL moving today?\" I choose the endpoints, compute what the API does not provide, chart it, and list every call I made.",
    route: "/",
    cta: { label: "Ask the analyst", to: "/analyst?q=" + encodeURIComponent("Why is SOL moving today?") },
  },
];

export function useTour() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      /* ignore */
    }
  }, []);
  const start = useCallback(() => setOpen(true), []);
  const finish = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ }
  }, []);
  return { open, start, finish };
}

interface Rect { top: number; left: number; width: number; height: number }

function find(targets?: string[]): HTMLElement | null {
  for (const t of targets ?? []) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${t}"]`);
    if (el && el.getBoundingClientRect().width > 0) return el;
  }
  return null;
}

function measure(targets?: string[]): Rect | null {
  const el = find(targets);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const nav = useNavigate();
  const loc = useLocation();
  const step = STEPS[i];
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Keep the tour on the route the step needs.
  useEffect(() => {
    if (!open) return;
    if (step.route && loc.pathname !== step.route) nav(step.route);
  }, [open, step.route, loc.pathname, nav]);

  // Scroll the target into view, then measure it. Re-measure on resize/scroll.
  useLayoutEffect(() => {
    if (!open) return;
    let raf = 0;
    const update = () => setRect(measure(step.target));
    const el = find(step.target);
    if (el && getComputedStyle(el).position !== "fixed") el.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(update, el ? 450 : 0);
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); window.removeEventListener("resize", onMove); window.removeEventListener("scroll", onMove, true); };
  }, [open, i, step.target, loc.pathname]);

  useEffect(() => {
    if (!open) setI(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "Enter") setI((x) => Math.min(STEPS.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const last = i === STEPS.length - 1;
  const pad = 8;
  const spot = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;

  // Card placement: below the target when there is room, else above; centered when no target.
  let cardStyle: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (spot && !isMobile) {
    const below = spot.top + spot.height + 16;
    const roomBelow = window.innerHeight - below > 220;
    cardStyle = roomBelow
      ? { top: below, left: Math.min(Math.max(16, spot.left), window.innerWidth - 400) }
      : { top: Math.max(16, spot.top - 16 - 200), left: Math.min(Math.max(16, spot.left), window.innerWidth - 400) };
  } else if (isMobile) {
    cardStyle = { left: 12, right: 12, bottom: 96 };
  }

  return (
    <AnimatePresence>
      <motion.div key="tour" className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        {/* Spotlight: a transparent box whose huge shadow dims everything else. */}
        <motion.div
          className="pointer-events-none absolute rounded-[26px]"
          animate={spot ? { top: spot.top, left: spot.left, width: spot.width, height: spot.height, opacity: 1 } : { top: window.innerHeight / 2, left: window.innerWidth / 2, width: 0, height: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          style={{ boxShadow: "0 0 0 9999px rgba(6,6,8,0.72), 0 0 0 1px rgba(231,196,106,0.5), 0 0 40px rgba(231,196,106,0.25)" }}
        />
        <div className="absolute inset-0" onClick={onClose} />
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="glass absolute w-[min(384px,calc(100vw-24px))] p-5"
          style={cardStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gold"><Sparkles size={12} /> {i === 0 ? "Welcome" : `Stop ${i} of ${STEPS.length - 1}`}</div>
            <button onClick={onClose} className="text-ink-3 hover:text-ink" aria-label="Close tour"><X size={15} /></button>
          </div>
          <div className="flex items-start gap-4">
            {(i === 0 || last) && <Mascot size={i === 0 ? 96 : 64} className="-ml-1 -mt-1" />}
            <div className="min-w-0">
              <div className="font-display text-[20px] font-medium leading-tight">{step.title}</div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{step.body}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {STEPS.map((_, k) => (
                <button key={k} onClick={() => setI(k)} className={clsx("h-1.5 rounded-full transition-all", k === i ? "w-5 bg-gold" : "w-1.5 bg-line-2 hover:bg-ink-3")} aria-label={`Go to step ${k + 1}`} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {i > 0 && <button onClick={() => setI(i - 1)} className="pill px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink">Back</button>}
              {!last ? (
                <button onClick={() => setI(i + 1)} className="pill flex items-center gap-1.5 bg-ink px-3.5 py-1.5 text-[12.5px] font-medium text-bg hover:bg-white">
                  {i === 0 ? "Start" : "Next"} <ArrowRight size={13} />
                </button>
              ) : (
                <>
                  <button onClick={onClose} className="pill px-3 py-1.5 text-[12.5px] text-ink-2 hover:text-ink">Done</button>
                  {step.cta && (
                    <button onClick={() => { onClose(); nav(step.cta!.to); }} className="pill flex items-center gap-1.5 bg-gold px-3.5 py-1.5 text-[12.5px] font-medium text-bg hover:bg-gold-2">
                      <Sparkles size={13} /> {step.cta.label}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
