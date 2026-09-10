import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star, ArrowUpDown, Search } from "lucide-react";
import clsx from "clsx";
import { api, type CoinRow } from "../lib/api";
import { usd, timeAgo } from "../lib/format";
import { useWatchlist } from "../lib/watchlist";
import { Change } from "../components/ui/Change";
import { Sparkline } from "../components/ui/Sparkline";
import { Skeleton } from "../components/ui/Skeleton";

type SortKey = "rank" | "price" | "change24h" | "change7d" | "marketCap" | "volume";
const SORTS: Record<SortKey, (c: CoinRow) => number> = {
  rank: (c) => c.cmc_rank ?? 1e9,
  price: (c) => c.quote.price ?? 0,
  change24h: (c) => c.quote.percent_change_24h ?? 0,
  change7d: (c) => c.quote.percent_change_7d ?? 0,
  marketCap: (c) => c.quote.market_cap ?? 0,
  volume: (c) => c.quote.volume_24h ?? 0,
};

const FILTERS: Array<{ key: string; label: string; fn: (c: CoinRow) => boolean }> = [
  { key: "all", label: "All", fn: () => true },
  { key: "large", label: "Large cap", fn: (c) => (c.quote.market_cap ?? 0) >= 10e9 },
  { key: "mid", label: "Mid cap", fn: (c) => (c.quote.market_cap ?? 0) >= 1e9 && (c.quote.market_cap ?? 0) < 10e9 },
  { key: "small", label: "Small cap", fn: (c) => (c.quote.market_cap ?? 0) < 1e9 },
  { key: "defi", label: "DeFi", fn: (c) => (c.tags ?? []).some((t) => /defi/i.test(t)) },
  { key: "l1", label: "Layer 1", fn: (c) => (c.tags ?? []).some((t) => /layer-1|layer 1|smart-contracts|smart contracts/i.test(t)) },
  { key: "ai", label: "AI", fn: (c) => (c.tags ?? []).some((t) => /\bai\b|ai-big-data|artificial/i.test(t)) },
  { key: "meme", label: "Memes", fn: (c) => (c.tags ?? []).some((t) => /meme/i.test(t)) },
  { key: "stable", label: "Stablecoins", fn: (c) => (c.tags ?? []).some((t) => /stablecoin/i.test(t)) },
];

function Th({ label, k, sort, dir, onSort, className }: { label: string; k: SortKey; sort: SortKey; dir: 1 | -1; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort === k;
  return (
    <th className={clsx("px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-3", className)}>
      <button onClick={() => onSort(k)} className={clsx("inline-flex items-center gap-1 hover:text-ink", active && "text-ink")}>
        {label} <ArrowUpDown size={11} className={clsx(active ? "opacity-100" : "opacity-30", active && dir === 1 && "rotate-180")} />
      </button>
    </th>
  );
}

export default function Explore() {
  const { data, isLoading } = useQuery({ queryKey: ["coins", 200], queryFn: () => api.coins(200), refetchInterval: 60_000 });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("rank");
  const [dir, setDir] = useState<1 | -1>(1);
  const wl = useWatchlist();

  const rows = useMemo(() => {
    if (!data) return [];
    const f = FILTERS.find((x) => x.key === filter)?.fn ?? (() => true);
    const needle = q.trim().toLowerCase();
    const key = SORTS[sort];
    return data.coins
      .filter(f)
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.symbol.toLowerCase().includes(needle))
      .sort((a, b) => (key(a) - key(b)) * dir);
  }, [data, filter, q, sort, dir]);

  const onSort = (k: SortKey) => {
    if (k === sort) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(k);
      setDir(k === "rank" ? 1 : -1);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] text-ink-2">Top 200 by market cap</div>
          <h1 className="font-display mt-1 text-[34px] font-light leading-tight tracking-tight">Explore</h1>
        </div>
        <div className="text-[12px] text-ink-3">{data ? `Updated ${timeAgo(data.updatedAt)}` : ""}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="glass-2 pill flex items-center gap-2 px-3.5 py-2">
          <Search size={14} className="text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or symbol" className="w-[200px] bg-transparent text-[13px] placeholder:text-ink-3 focus:outline-none" />
        </div>
        <div className="glass-2 pill flex flex-wrap gap-0.5 p-0.5">
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={clsx("pill px-3 py-1.5 text-[12px]", filter === f.key ? "bg-ink text-bg" : "text-ink-2 hover:text-ink")}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass overflow-hidden p-0">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead className="border-b border-line">
              <tr>
                <th className="w-8" />
                <Th label="#" k="rank" sort={sort} dir={dir} onSort={onSort} className="text-left" />
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-3">Coin</th>
                <Th label="Price" k="price" sort={sort} dir={dir} onSort={onSort} className="text-right" />
                <Th label="24h" k="change24h" sort={sort} dir={dir} onSort={onSort} className="text-right" />
                <Th label="7d" k="change7d" sort={sort} dir={dir} onSort={onSort} className="text-right" />
                <Th label="Market cap" k="marketCap" sort={sort} dir={dir} onSort={onSort} className="text-right" />
                <Th label="Volume 24h" k="volume" sort={sort} dir={dir} onSort={onSort} className="text-right" />
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-ink-3">Last 7d</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 12 }).map((_, i) => (
                  <tr key={i} className="border-b border-line">
                    <td colSpan={9} className="px-3 py-2"><Skeleton className="h-8" /></td>
                  </tr>
                ))}
              {rows.map((c) => (
                <tr key={c.id} className="group border-b border-line last:border-0 hover:bg-surface-2">
                  <td className="pl-3">
                    <button onClick={() => wl.toggle(c.id)} className={clsx("rounded-md p-1", wl.has(c.id) ? "text-gold" : "text-ink-3 opacity-0 group-hover:opacity-100")} aria-label="Toggle watchlist">
                      <Star size={14} fill={wl.has(c.id) ? "currentColor" : "none"} />
                    </button>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-ink-3">{c.cmc_rank}</td>
                  <td className="px-3 py-2.5">
                    <Link to={`/coin/${c.id}`} className="flex items-center gap-3">
                      <img src={`https://s2.coinmarketcap.com/static/img/coins/32x32/${c.id}.png`} alt="" className="h-6 w-6 rounded-full bg-surface-2" loading="lazy" />
                      <span className="text-[13px] font-medium">{c.name}</span>
                      <span className="text-[12px] text-ink-3">{c.symbol}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-[13px]">{usd(c.quote.price)}</td>
                  <td className="px-3 py-2.5 text-right"><Change value={c.quote.percent_change_24h} className="text-[12.5px]" /></td>
                  <td className="px-3 py-2.5 text-right"><Change value={c.quote.percent_change_7d} className="text-[12.5px]" /></td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12.5px] text-ink-2">{usd(c.quote.market_cap, { compact: true })}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12.5px] text-ink-2">{usd(c.quote.volume_24h, { compact: true })}</td>
                  <td className="px-3 py-2.5"><div className="ml-auto w-[96px]"><Sparkline data={c.sparkline} /></div></td>
                </tr>
              ))}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-[13px] text-ink-3">Nothing matches.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
