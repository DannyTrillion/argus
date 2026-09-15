import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { api } from "../lib/api";
import { usd, pct, greeting, dateLabel, timeAgo } from "../lib/format";
import { StatTile } from "../components/home/StatTile";
import { HeroChart } from "../components/home/HeroChart";
import { LiquidationsCard } from "../components/home/Liquidations";
import { Movers } from "../components/home/Movers";
import { Spotlight } from "../components/home/Spotlight";
import { BriefDeck } from "../components/home/BriefDeck";
import { Card, CardTitle } from "../components/ui/Card";
import { Gauge } from "../components/ui/Gauge";
import { Skeleton } from "../components/ui/Skeleton";
import { Term } from "../components/ui/Term";
import { AskButton } from "../components/ui/AskButton";

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
            <StatTile label={<Term k="market-cap">Total market cap</Term>} value={usd(g.total_market_cap, { compact: true })} change={g.total_market_cap_yesterday_percentage_change} spark={spark("total_market_cap")} ask="What is driving the total crypto market cap today?" />
            <StatTile label={<Term k="volume" />} value={usd(g.total_volume_24h, { compact: true })} change={g.total_volume_24h_yesterday_percentage_change} spark={spark("total_volume_24h")} ask="Why is crypto trading volume changing today?" />
            <StatTile label={<Term k="dominance" />} value={`${g.btc_dominance.toFixed(2)}%`} change={g.btc_dominance_24h_percentage_change} spark={spark("btc_dominance")} foot={`ETH ${g.eth_dominance.toFixed(1)}%`} ask="What does today's BTC dominance say about altcoins?" />
            <Card className="flex flex-col items-center justify-center gap-1 p-3 sm:p-4">
              <div className="flex w-full items-center justify-between gap-1 text-[12px] text-ink-2">
                <Term k="fear-greed" />
                <AskButton q="What is behind today's Fear & Greed reading?" className="-mr-1.5" />
              </div>
              {fg && <Gauge value={fg.value} label={fg.value_classification} color={fg.value > 60 ? "#6fd39c" : fg.value < 40 ? "#ef6f6f" : "#e7c46a"} />}
            </Card>
            <Card className="col-span-2 flex flex-col items-center justify-center gap-1 p-3 sm:p-4 lg:col-span-1">
              <div className="flex w-full items-center justify-between gap-1 text-[12px] text-ink-2">
                <Term k="altcoin-index">Altcoin Season</Term>
                <AskButton q="Is it altcoin season? What does the index say right now?" className="-mr-1.5" />
              </div>
              {alt && <Gauge value={alt.altcoin_index} label={alt.altcoin_index >= 75 ? "Altcoin season" : alt.altcoin_index <= 25 ? "Bitcoin season" : "Altcoin index"} />}
            </Card>
          </>
        ) : (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[132px]" />)
        )}
      </motion.div>

      <motion.div {...fade} transition={{ duration: 0.4, delay: 0.08 }} data-tour="spotlight">
        <Spotlight />
      </motion.div>

      <motion.div {...fade} transition={{ duration: 0.4, delay: 0.1 }} className="grid gap-4 lg:grid-cols-3">
        <div data-tour="chart" className="lg:col-span-2"><HeroChart /></div>
        <div data-tour="brief" className="min-h-[540px] lg:min-h-[420px]"><BriefDeck /></div>
      </motion.div>

      <motion.div {...fade} transition={{ duration: 0.4, delay: 0.15 }} className="grid gap-4 lg:grid-cols-3">
        <Movers />
        <LiquidationsCard data={overview.data?.liquidations} />
      </motion.div>

      <motion.div {...fade} transition={{ duration: 0.4, delay: 0.2 }} className="grid gap-4">
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
