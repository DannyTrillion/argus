import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type Coin } from "../../lib/api";
import { usd } from "../../lib/format";
import { Change } from "../ui/Change";
import { Card, CardTitle } from "../ui/Card";
import { AskButton } from "../ui/AskButton";
import { Skeleton } from "../ui/Skeleton";

function List({ title, coins }: { title: string; coins: Coin[] }) {
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-3">{title}</div>
      <div className="divide-y divide-line">
        {coins.map((c) => (
          <Link key={c.id} to={`/coin/${c.id}`} className="-mx-2 flex items-center justify-between rounded-xl px-2 py-2 hover:bg-surface-2">
            <div className="min-w-0">
              <div className="truncate text-[13px]">{c.name} <span className="text-ink-3">{c.symbol}</span></div>
              <div className="font-mono text-[11px] text-ink-3">cap {usd(c.quote.market_cap, { compact: true })} · vol {usd(c.quote.volume_24h, { compact: true })}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[13px]">{usd(c.quote.price)}</div>
              <Change value={c.quote.percent_change_24h} className="text-[12px]" />
            </div>
          </Link>
        ))}
        {coins.length === 0 && <div className="py-3 text-[12px] text-ink-3">No liquid movers right now.</div>}
      </div>
    </div>
  );
}

export function Movers() {
  const { data, isLoading } = useQuery({ queryKey: ["movers"], queryFn: api.movers });
  return (
    <Card className="lg:col-span-2">
      <CardTitle right={<div className="flex items-center gap-2"><span className="hidden text-[11px] text-ink-3 sm:inline">24h · cap ≥ $50M · vol ≥ $5M</span><AskButton q="What moved today and why?" /></div>}>Movers that matter</CardTitle>
      {isLoading || !data ? (
        <Skeleton className="h-[280px]" />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <List title="Gainers" coins={data.gainers.slice(0, 6)} />
          <List title="Losers" coins={data.losers.slice(0, 6)} />
        </div>
      )}
    </Card>
  );
}
