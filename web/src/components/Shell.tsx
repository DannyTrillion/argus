import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Search, Sparkles, LayoutGrid, Compass, Star, MessageSquareText, CircleHelp, Bell, KeyRound, TriangleAlert } from "lucide-react";
import { getAnthropicKey, onKeyChange } from "../lib/keys";
import clsx from "clsx";
import { api } from "../lib/api";
import { Tour, useTour } from "./Tour";
import { Mascot } from "./ui/Mascot";
import { Palette, usePalette } from "./Palette";
import { AlertsPanel } from "./AlertsPanel";
import { AlertsWatcher } from "./AlertsWatcher";
import { useAlerts } from "../lib/alerts";

const NAV = [
  { to: "/", label: "Home", icon: LayoutGrid, end: true },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/analyst", label: "Analyst", icon: MessageSquareText },
];

function Logo() {
  return (
    <NavLink to="/" className="flex items-center gap-2">
      <Mascot size={36} glow={false} />
      <span className="font-display text-[17px] font-medium tracking-wide">Argus</span>
    </NavLink>
  );
}

function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data } = useQuery({ queryKey: ["search", q], queryFn: () => api.search(q), enabled: q.trim().length >= 2 });
  const results = (data ?? []).filter((r) => r.rank).slice(0, 6);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    // "/" focuses search from anywhere, like GitHub.
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); inputRef.current?.focus(); }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);

  return (
    <div ref={box} className="relative w-[280px]">
      <div className="glass-2 pill flex items-center gap-2 px-3.5 py-2">
        <Search size={15} className="text-ink-3" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { nav(`/coin/${results[0].id}`); setOpen(false); setQ(""); } }}
          placeholder="Search  /  or ⌘K"
          className="w-full min-w-0 bg-transparent text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
        />
      </div>
      {open && results.length > 0 && (
        <div className="glass absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden p-1.5">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => { nav(`/coin/${r.id}`); setOpen(false); setQ(""); }}
              className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left hover:bg-surface-2"
            >
              <span className="text-[13px]">{r.name} <span className="text-ink-3">{r.symbol}</span></span>
              <span className="font-mono text-[11px] text-ink-3">#{r.rank}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { to: "/", label: "Home", icon: LayoutGrid, end: true, center: false },
  { to: "/explore", label: "Explore", icon: Compass, end: false, center: false },
  { to: "/analyst", label: "Ask", icon: Sparkles, end: false, center: true },
  { to: "/watchlist", label: "Watchlist", icon: Star, end: false, center: false },
  { to: "__search", label: "Search", icon: Search, end: false, center: false },
];

/**
 * Floating bottom tab bar for phones: glass, rounded, safe-area aware, with a raised
 * gold "Ask" action in the centre and a sliding active indicator.
 */
function MobileTabBar({ onSearch }: { onSearch: () => void }) {
  const loc = useLocation();
  const nav = useNavigate();
  const isActive = (to: string, end: boolean) => (end ? loc.pathname === to : loc.pathname.startsWith(to));
  return (
    <motion.div layoutId="dock" data-tour="nav-mobile" className="fixed inset-x-3 z-30 lg:hidden" style={{ bottom: "max(12px, env(safe-area-inset-bottom))" }} transition={{ type: "spring", stiffness: 260, damping: 30 }}>
      <nav
        className="relative flex items-end justify-between rounded-[28px] border border-line px-2 pb-2 pt-2"
        style={{
          background: "rgba(16,16,18,0.82)",
          backdropFilter: "blur(24px) saturate(140%)",
          WebkitBackdropFilter: "blur(24px) saturate(140%)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 20px 50px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,0,0,0.4)",
        }}
      >
        {TABS.map((t) => {
          if (t.center) {
            const active = isActive(t.to, false);
            return (
              <button key={t.to} onClick={() => nav(t.to)} className="relative -mt-7 flex flex-1 flex-col items-center gap-1 pb-1.5" aria-label="Ask Argus">
                <span
                  className={clsx("flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-bg transition-transform active:scale-95", active ? "bg-gold-2" : "bg-gold")}
                  style={{ boxShadow: "0 10px 30px -8px rgba(231,196,106,0.7), 0 0 0 1px rgba(231,196,106,0.35)" }}
                >
                  <t.icon size={22} className="text-bg" />
                </span>
                <span className={clsx("text-[10.5px] font-medium", active ? "text-gold" : "text-ink-2")}>{t.label}</span>
              </button>
            );
          }
          const search = t.to === "__search";
          const active = !search && isActive(t.to, t.end);
          return (
            <button key={t.to} onClick={() => (search ? onSearch() : nav(t.to))} className="relative flex flex-1 flex-col items-center gap-1 py-1.5" aria-label={t.label}>
              {active && (
                <motion.span layoutId="tab-pill" className="absolute inset-x-2 top-0 h-full rounded-2xl bg-gold-dim" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <t.icon size={20} className={clsx("relative", active ? "text-gold" : "text-ink-2")} fill={active && t.label === "Watchlist" ? "currentColor" : "none"} />
              <span className={clsx("relative text-[10.5px] font-medium", active ? "text-gold" : "text-ink-2")}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </motion.div>
  );
}

export function Shell() {
  const tour = useTour();
  const palette = usePalette();
  const [alertsOpen, setAlertsOpen] = useState(false);
  const { alerts } = useAlerts();
  const armed = alerts.filter((a) => !a.triggeredAt).length;
  const loc = useLocation();
  // On phones the Analyst takes over the whole screen: no global header, the tab bar becomes the composer.
  const analyst = loc.pathname.startsWith("/analyst");
  return (
    <div className={clsx("mx-auto flex min-h-full w-full max-w-[1440px] flex-col overflow-x-hidden px-4 pt-4 sm:px-6 lg:px-8", analyst ? "pb-[calc(96px+env(safe-area-inset-bottom))] lg:pb-6" : "pb-[calc(112px+env(safe-area-inset-bottom))] md:pb-8")}>
      <Tour open={tour.open && !palette.open} onClose={tour.finish} />
      <Palette open={palette.open} onClose={() => palette.setOpen(false)} />
      <AlertsPanel open={alertsOpen} onClose={() => setAlertsOpen(false)} />
      <AlertsWatcher />
      <header className={clsx("mb-6 min-w-0 items-center gap-3 sm:gap-4", analyst ? "hidden lg:flex" : "flex")}>
        <Logo />
        <nav data-tour="nav" className="glass-2 pill mx-auto hidden items-center gap-1 p-1 lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx("pill px-4 py-2 text-[13px] font-medium transition-colors", isActive ? "bg-ink text-bg" : "text-ink-2 hover:text-ink")
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:block"><SearchBox /></div>
          <button onClick={() => palette.setOpen(true)} className="glass-2 flex h-10 w-10 items-center justify-center rounded-full text-ink-2 sm:hidden" aria-label="Search">
            <Search size={17} />
          </button>
          <NavLink data-tour="ask" to="/analyst" className="glass-2 pill hidden items-center gap-2 whitespace-nowrap px-3.5 py-2 text-[13px] text-gold hover:bg-gold-dim lg:flex">
            <Sparkles size={14} /> Ask Argus
          </NavLink>
          <button onClick={() => setAlertsOpen(true)} className="glass-2 relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-2 hover:text-ink sm:h-9 sm:w-9" aria-label="Alerts" title="Alerts">
            <Bell size={16} />
            {armed > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 font-mono text-[9.5px] font-semibold text-bg">{armed}</span>}
          </button>
          <NavLink data-tour="keys" to="/keys" className={({ isActive }) => clsx("glass-2 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full hover:text-ink sm:flex", isActive ? "text-gold" : "text-ink-3")} aria-label="Your Anthropic key" title="Keys">
            <KeyRound size={15} />
          </NavLink>
          <button onClick={tour.start} className="glass-2 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:text-ink sm:flex" aria-label="Replay the welcome tour" title="Welcome tour">
            <CircleHelp size={16} />
          </button>
        </div>
      </header>
      <main className="flex-1">
        <KeyHealthBanner />
        <Outlet />
      </main>
      {!analyst && <MobileTabBar onSearch={() => palette.setOpen(true)} />}
    </div>
  );
}

/**
 * Shown only when Anthropic has rejected the site's shared key. Says plainly what still
 * works and how to keep asking, instead of letting answers fail one by one.
 */
function KeyHealthBanner() {
  const { data } = useQuery({ queryKey: ["keys"], queryFn: api.keys, staleTime: 60_000, refetchInterval: 5 * 60_000 });
  const [ownKey, setOwnKey] = useState(Boolean(getAnthropicKey()));
  useEffect(() => onKeyChange(() => setOwnKey(Boolean(getAnthropicKey()))), []);
  if (!data?.serverKey || data.serverKeyHealthy !== false) return null;
  return (
    <div role="status" className="mb-4 flex flex-col gap-2.5 rounded-2xl border border-down/30 bg-down-dim px-4 py-3 text-[12.5px] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5 text-ink-2">
        <TriangleAlert size={15} className="mt-0.5 shrink-0 text-down" />
        <span>
          <span className="font-medium text-ink">The analyst is temporarily unavailable.</span> Market data, stories and the brief still work.{" "}
          {ownKey ? "Your own key keeps the analyst working for you." : "Add your own Anthropic key to keep asking."}
        </span>
      </div>
      {!ownKey && (
        <NavLink to="/keys" className="pill shrink-0 self-start bg-gold px-3.5 py-1.5 text-[12px] font-medium text-bg hover:bg-gold-2 sm:self-auto">
          Add my key
        </NavLink>
      )}
    </div>
  );
}
