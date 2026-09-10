import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type Coin } from "../../lib/api";
import { usd } from "../../lib/format";
import { Change } from "../ui/Change";
import { Sparkline } from "../ui/Sparkline";
import { Card, CardTitle } from "../ui/Card";

const GENERIC = new Set(["mineable", "pow", "pos", "platform", "coin", "token"]);

/** Coins from the top 200 that share the most descriptive tags with this one. Zero extra API calls. */
export function Peers({ coin }: { coin: Coin }) {
  const { data } = useQuery({ queryKey: ["coins", 200], queryFn: () => api.coins(200), staleTime: 60_000 });
  const peers = useMemo(() => {
    if (!data) return [];
    const mine = new Set((coin.tags ?? []).filter((t) => !GENERIC.has(t.toLowerCase())));
    if (mine.size === 0) return [];
    return data.coins
      .filter((c) => c.id !== coin.id)
      .map((c) => {
        const theirs = (c.tags ?? []).filter((t) => !GENERIC.has(t.toLowerCase()));
        const shared = theirs.filter((t) => mine.has(t)).length;
        const union = new Set([...mine, ...theirs]).size;
        return { c, score: union ? shared / union : 0, shared };
      })
      .filter((x) => x.shared > 0)
      .sort((a, b) => b.score - a.score || (b.c.quote.market_cap ?? 0) - (a.c.quote.market_cap ?? 0))
      .slice(0, 6)
      .map((x) => x.c);
  }, [data, coin]);

  if (peers.length === 0) return null;
  return (
    <Card>
      <CardTitle right={<span className="text-[11px] text-ink-3">by shared tags · top 200</span>}>Related coins</CardTitle>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {peers.map((p) => (
          <Link key={p.id} to={`/coin/${p.id}`} className="glass-2 glass-hover flex items-center gap-3 rounded-2xl p-3">
            <img src={`https://s2.coinmarketcap.com/static/img/coins/32x32/${p.id}.png`} alt="" className="h-7 w-7 rounded-full bg-surface-2" loading="lazy" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px]">{p.name} <span className="text-ink-3">{p.symbol}</span></div>
              <div className="font-mono text-[11px] text-ink-3">{usd(p.quote.price)} · {usd(p.quote.market_cap, { compact: true })}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Change value={p.quote.percent_change_24h} className="text-[12px]" />
              <Sparkline data={p.sparkline} width={64} height={18} />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
