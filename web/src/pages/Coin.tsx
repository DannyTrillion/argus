import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star, ExternalLink, ArrowLeft } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { usd, pct, compact } from "../lib/format";
import { useWatchlist } from "../lib/watchlist";
import { Change } from "../components/ui/Change";
import { Card, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";
import { PriceChart } from "../components/coin/PriceChart";
import { AskInline } from "../components/coin/AskInline";

function Stat({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="glass-2 rounded-2xl p-3.5">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="mt-1 font-mono text-[15px] text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}

export default function CoinPage() {
  const { id } = useParams();
  const cid = Number(id);
  const { data, isLoading, error } = useQuery({ queryKey: ["coin", cid], queryFn: () => api.coin(cid), enabled: Number.isInteger(cid), refetchInterval: 60_000 });
  const wl = useWatchlist();

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-[420px]" /></div>;
  if (error || !data) return <Card>Could not load this coin. {error instanceof Error ? error.message : ""}</Card>;

  const { coin, info, performance, risk } = data;
  const q = coin.quote;
  const ath = performance?.periods.all_time;
  const fromAth = ath && q.price ? ((q.price - ath.high) / ath.high) * 100 : null;
  const supplyPct = coin.circulating_supply && coin.max_supply ? (coin.circulating_supply / coin.max_supply) * 100 : null;
  const links = info?.urls ?? {};

  return (
    <div className="space-y-5">
      <Link to="/explore" className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink"><ArrowLeft size={13} /> Explore</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.id}.png`} alt="" className="h-12 w-12 rounded-full bg-surface-2" />
          <div>
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              <span className="font-mono">#{coin.cmc_rank ?? "—"}</span> · {coin.symbol}
              {info?.category && <span className="pill bg-surface-2 px-2 py-0.5 text-[11px]">{info.category}</span>}
              {coin.platform?.name && <span className="pill bg-surface-2 px-2 py-0.5 text-[11px]">on {coin.platform.name}</span>}
            </div>
            <h1 className="font-display mt-0.5 text-[32px] font-light leading-tight tracking-tight">{coin.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-display text-[34px] font-medium leading-none tabular">{usd(q.price)}</div>
            <div className="mt-1.5 flex justify-end gap-1.5">
              <Change value={q.percent_change_1h} chip className="text-[11px]" />
              <Change value={q.percent_change_24h} chip className="text-[11px]" />
              <Change value={q.percent_change_7d} chip className="text-[11px]" />
            </div>
            <div className="mt-1 font-mono text-[10.5px] text-ink-3">1h · 24h · 7d</div>
          </div>
          <button onClick={() => wl.toggle(coin.id)} className={clsx("glass-2 flex h-11 w-11 items-center justify-center rounded-full", wl.has(coin.id) ? "text-gold" : "text-ink-2 hover:text-ink")} aria-label="Toggle watchlist">
            <Star size={17} fill={wl.has(coin.id) ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PriceChart id={coin.id} symbol={coin.symbol} />
          <AskInline symbol={coin.symbol} name={coin.name} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardTitle>Key stats</CardTitle>
            <div className="grid grid-cols-2 gap-2.5">
              <Stat label="Market cap" value={usd(q.market_cap, { compact: true })} sub={q.market_cap_dominance ? `${q.market_cap_dominance.toFixed(2)}% dominance` : undefined} />
              <Stat label="Volume 24h" value={usd(q.volume_24h, { compact: true })} sub={q.volume_change_24h !== null && q.volume_change_24h !== undefined ? <Change value={q.volume_change_24h} /> : undefined} />
              <Stat label="Fully diluted" value={usd(q.fully_diluted_market_cap, { compact: true })} />
              <Stat label="Circulating" value={compact(coin.circulating_supply)} sub={supplyPct ? `${supplyPct.toFixed(1)}% of max ${compact(coin.max_supply)}` : coin.max_supply ? `max ${compact(coin.max_supply)}` : "no max supply"} />
              <Stat label="30d" value={pct(q.percent_change_30d)} />
              <Stat label="90d" value={pct(q.percent_change_90d)} />
              {ath && <Stat label="All-time high" value={usd(ath.high)} sub={fromAth !== null ? <span>{pct(fromAth)} from ATH · {ath.high_timestamp?.slice(0, 10)}</span> : undefined} />}
              {ath && <Stat label="All-time low" value={usd(ath.low)} sub={ath.low_timestamp?.slice(0, 10)} />}
            </div>
          </Card>

          <Card>
            <CardTitle right={<span className="text-[11px] text-ink-3">90 days · computed by Argus</span>}>Risk profile</CardTitle>
            {risk ? (
              <div className="grid grid-cols-2 gap-2.5">
                <Stat label="Return" value={pct(risk.total_return_pct)} />
                <Stat label="Annualized vol" value={`${risk.annualized_volatility_pct.toFixed(1)}%`} />
                <Stat label="Max drawdown" value={pct(risk.max_drawdown_pct)} />
                <Stat label="Corr. with BTC" value={risk.correlation_with_btc === null ? "—" : risk.correlation_with_btc.toFixed(2)} sub={risk.correlation_with_btc !== null ? (risk.correlation_with_btc > 0.8 ? "moves with BTC" : risk.correlation_with_btc > 0.5 ? "partly independent" : "largely independent") : undefined} />
                <Stat label="Best day" value={pct(risk.best_day?.return_pct)} sub={risk.best_day?.date} />
                <Stat label="Worst day" value={pct(risk.worst_day?.return_pct)} sub={risk.worst_day?.date} />
                <Stat label="Avg daily volume" value={usd(risk.avg_daily_volume, { compact: true })} sub={risk.volume_trend_ratio ? `7d vs 90d ratio ${risk.volume_trend_ratio}×` : undefined} />
              </div>
            ) : (
              <div className="text-[12px] text-ink-3">Not enough history for a risk profile.</div>
            )}
          </Card>

          {info && (
            <Card>
              <CardTitle>About</CardTitle>
              {info.description && <p className="text-[12.5px] leading-relaxed text-ink-2">{info.description}</p>}
              {info.tags && info.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {info.tags.slice(0, 8).map((t) => <span key={t} className="pill bg-surface-2 px-2 py-0.5 text-[11px] text-ink-2">{t}</span>)}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                {Object.entries(links).slice(0, 5).map(([k, v]) => (
                  <a key={k} href={v[0]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-gold hover:text-gold-2">
                    {k.replace(/_/g, " ")} <ExternalLink size={11} />
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
