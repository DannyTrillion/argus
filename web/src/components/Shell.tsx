import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, LayoutGrid, Compass, Star, MessageSquareText } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";

const NAV = [
  { to: "/", label: "Home", icon: LayoutGrid, end: true },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/watchlist", label: "Watchlist", icon: Star },
  { to: "/analyst", label: "Analyst", icon: MessageSquareText },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-8 w-8 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #f3d68b, #8b6a1f 70%)" }}>
        <div className="absolute inset-[11px] rounded-full bg-bg" />
      </div>
      <span className="font-display text-[17px] font-medium tracking-wide">Argus</span>
    </div>
  );
}

function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const { data } = useQuery({ queryKey: ["search", q], queryFn: () => api.search(q), enabled: q.trim().length >= 2 });
  const results = (data ?? []).filter((r) => r.rank).slice(0, 6);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={box} className="relative min-w-0 flex-1 sm:w-[280px] sm:flex-none">
      <div className="glass-2 pill flex items-center gap-2 px-3.5 py-2">
        <Search size={15} className="text-ink-3" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { nav(`/coin/${results[0].id}`); setOpen(false); setQ(""); } }}
          placeholder="Search a coin"
          className="w-full bg-transparent text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
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
  return (
    <div className="mx-auto flex min-h-full max-w-[1440px] flex-col px-4 pb-24 pt-4 sm:px-6 md:pb-8 lg:px-8">
      <header className="mb-6 flex items-center gap-4">
        <Logo />
        <nav className="glass-2 pill mx-auto hidden items-center gap-1 p-1 md:flex">
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
          <NavLink to="/analyst" className="glass-2 pill hidden items-center gap-2 whitespace-nowrap px-3.5 py-2 text-[13px] text-gold hover:bg-gold-dim lg:flex">
            <Sparkles size={14} /> Ask Argus
          </NavLink>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <nav className="glass fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 p-1 md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => clsx("pill flex items-center gap-1.5 px-3.5 py-2 text-[12px]", isActive ? "bg-ink text-bg" : "text-ink-2")}
          >
            <n.icon size={15} /> {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
