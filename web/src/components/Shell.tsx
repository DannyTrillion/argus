import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, LayoutGrid, Compass, Star, MessageSquareText, CircleHelp } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { Tour, useTour } from "./Tour";
import { Mascot } from "./ui/Mascot";

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
    <div ref={box} className="relative min-w-0 flex-1 sm:w-[280px] sm:flex-none">
      <div className="glass-2 pill flex items-center gap-2 px-3.5 py-2">
        <Search size={15} className="text-ink-3" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { nav(`/coin/${results[0].id}`); setOpen(false); setQ(""); } }}
          placeholder="Search a coin  /"
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

export function Shell() {
  const tour = useTour();
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col overflow-x-hidden px-4 pb-28 pt-4 sm:px-6 md:pb-8 lg:px-8">
      <Tour open={tour.open} onClose={tour.finish} />
      <header className="mb-6 flex min-w-0 items-center gap-3 sm:gap-4">
        <Logo />
        <nav data-tour="nav" className="glass-2 pill mx-auto hidden items-center gap-1 p-1 md:flex">
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
        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3 md:flex-none">
          <SearchBox />
          <NavLink data-tour="ask" to="/analyst" className="glass-2 pill hidden items-center gap-2 whitespace-nowrap px-3.5 py-2 text-[13px] text-gold hover:bg-gold-dim lg:flex">
            <Sparkles size={14} /> Ask Argus
          </NavLink>
          <button onClick={tour.start} className="glass-2 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 hover:text-ink sm:flex" aria-label="Replay the welcome tour" title="Welcome tour">
            <CircleHelp size={16} />
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <nav data-tour="nav-mobile" className="glass fixed bottom-4 left-1/2 z-20 flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-0.5 p-1 md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => clsx("pill flex flex-col items-center gap-0.5 px-3.5 py-1.5 text-[10.5px]", isActive ? "bg-ink text-bg" : "text-ink-2")}
          >
            <n.icon size={16} /> {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
