import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { api } from "../lib/api";
import { usd, pct, greeting, dateLabel, timeAgo } from "../lib/format";
import { StatTile } from "../components/home/StatTile";
import { HeroChart } from "../components/home/HeroChart";
import { SectorMap } from "../components/home/SectorMap";
import { LiquidationsCard } from "../components/home/Liquidations";
import { Movers } from "../components/home/Movers";
import { BriefCard } from "../components/home/BriefCard";
import { Card, CardTitle } from "../components/ui/Card";
import { Gauge } from "../components/ui/Gauge";
import { Skeleton } from "../components/ui/Skeleton";

const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

export default function Home() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: api.overview, refetchInterval: 60_000 });
  const history = useQuery({ queryKey: ["history", 30], queryFn: () => api.history(30) });
  const g = overview.data?.global;
  const spark = (key: "total_market_cap" | "total_volume_24h" | "btc_dominance") => history.data?.global.map((p) => p[key]) ?? [];
  const fg = overview.data?.fearGreed;
  const alt = overview.data?.altcoinSeason;

  return (
    <div className="space-y-5">
      <motion.div {...fade} transition={{ duration: 0.4 }} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] text-ink-2">{greeting()} · {dateLabel()}</div>
          <h1 className="font-display mt-1 text-[30px] font-light leading-tight tracking-tight sm:text-[40px]">The market, <span className="text-glow">read live.</span></h1>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap text-[12px] text-ink-3">
          <RefreshCw size={12} className={overview.isFetching ? "animate-spin" : ""} />
          <span>Live data · updated {overview.data ? timeAgo(overview.data.updatedAt) : "…"}</span>
        </div>
      </motion.div>

      <motion.div {...fade} transition={{ duration: 0.4, delay: 0.05 }} data-tour="pulse" className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {g ? (
          <>
            <StatTile label="Total market cap" value={usd(g.total_market_cap, { compact: true })} change={g.total_market_cap_yesterday_percentage_change} spark={spark("total_market_cap")} />
            <StatTile label="24h volume" value={usd(g.total_volume_24h, { compact: true })} change={g.total_volume_24h_yesterday_percentage_change} spark={spark("total_volume_24h")} />
            <StatTile label="BTC dominance" value={`${g.btc_dominance.toFixed(2)}%`} change={g.btc_dominance_24h_percentage_change} spark={spark("btc_dominance")} foot={`ETH ${g.eth_dominance.toFixed(1)}%`} />
            <Card className="flex items-center justify-center p-3 sm:p-5">
              {fg && <Gauge value={fg.value} label={fg.value_classification} color={fg.value > 60 ? "#6fd39c" : fg.value < 40 ? "#ef6f6f" : "#e7c46a"} />}
            </Card>
            <Card className="col-span-2 flex items-center justify-center p-3 sm:p-5 lg:col-span-1">
              {alt && <Gauge value={alt.altcoin_index} label={alt.altcoin_index >= 75 ? "Altcoin season" : alt.altcoin_index <= 25 ? "Bitcoin season" : "Altcoin index"} />}
            </Card>
          </>
        ) : (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[132px]" />)
        )}
      </motion.div>

      <motion.div {...fade} transition={{ duration: 0.4, delay: 0.1 }} data-tour="brief" className="grid gap-4 lg:grid-cols-3">
        <BriefCard />
      </motion.div>

      <motion.div {...fade} transition={{ duration: 0.4, delay: 0.12 }} className="grid gap-4">
        <HeroChart />
      </motion.div>

      <motion.div {...fade} transition={{ duration: 0.4, delay: 0.15 }} className="grid gap-4 lg:grid-cols-3">
        <div data-tour="sectors" className="lg:col-span-2"><SectorMap /></div>
        <LiquidationsCard data={overview.data?.liquidations} />
      </motion.div>

      <motion.div {...fade} transition={{ duration: 0.4, delay: 0.2 }} className="grid gap-4 lg:grid-cols-3">
        <Movers />
        <Card className="flex flex-col justify-between" data-tour="ask-card">
          <div>
            <CardTitle>Ask the analyst</CardTitle>
            <p className="text-[13px] leading-relaxed text-ink-2">
              Argus reads {g ? `${usd(g.total_market_cap, { compact: true })} of market` : "the market"} through live CoinMarketCap calls and explains what is moving and why, with every number sourced.
            </p>
            {g && (
              <div className="mt-4 space-y-1.5 text-[12px] text-ink-3">
                <div>Altcoins {usd(g.altcoin_market_cap, { compact: true })} · DeFi {usd(g.defi_market_cap, { compact: true })}</div>
                <div>Stablecoins {usd(g.stablecoin_market_cap, { compact: true })} · Derivatives vol {usd(g.derivatives_volume_24h, { compact: true })}</div>
                <div>Fear & Greed {fg?.value} ({fg?.value_classification}) · Alt index {alt?.altcoin_index} · cap {pct(g.total_market_cap_yesterday_percentage_change)} 24h</div>
              </div>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {["How is the market today?", "Is it altcoin season?", "What got liquidated?"].map((q) => (
              <Link key={q} to={`/analyst?q=${encodeURIComponent(q)}`} className="glass-2 pill px-3 py-1.5 text-[12px] text-ink-2 hover:text-ink">
                {q}
              </Link>
            ))}
            <Link to="/analyst" className="pill flex items-center gap-1.5 bg-gold px-3.5 py-1.5 text-[12px] font-medium text-bg hover:bg-gold-2">
              <Sparkles size={13} /> Open analyst
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
