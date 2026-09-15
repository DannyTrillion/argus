import type { Liquidations as L } from "../../lib/api";
import { usd } from "../../lib/format";
import { Card, CardTitle } from "../ui/Card";
import { ExplainButton } from "../ui/Explain";

function Row({ label, long, short }: { label: string; long: number; short: number }) {
  const total = long + short || 1;
  const lp = (long / total) * 100;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12px]">
        <span className="text-ink-2">{label}</span>
        <span className="font-mono text-ink">{usd(long + short, { compact: true })}</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-down" style={{ width: `${lp}%` }} />
        <div className="h-full bg-up" style={{ width: `${100 - lp}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px]">
        <span className="text-down">longs {usd(long, { compact: true })} · {lp.toFixed(0)}%</span>
        <span className="text-up">shorts {usd(short, { compact: true })}</span>
      </div>
    </div>
  );
}

export function LiquidationsCard({ data, asOf }: { data: L | null | undefined; asOf?: string | null }) {
  return (
    <Card>
      <CardTitle right={<div className="flex items-center gap-2"><span className="hidden text-[11px] text-ink-3 sm:inline">perps + futures, all exchanges</span><ExplainButton topic="liquidations" live={data ? { value: data.total_liquidations_24h, asOf, extra: { longSharePct: data.total_liquidations_24h ? (data.long_liquidations_24h / data.total_liquidations_24h) * 100 : null } } : undefined} /></div>}>Liquidations</CardTitle>
      {data ? (
        <div className="space-y-5">
          <Row label="Last 24h" long={data.long_liquidations_24h} short={data.short_liquidations_24h} />
          <Row label="Last 4h" long={data.long_liquidations_4h} short={data.short_liquidations_4h} />
          <Row label="Last 1h" long={data.long_liquidations_1h} short={data.short_liquidations_1h} />
          <p className="text-[11.5px] leading-relaxed text-ink-3">
            Long-heavy liquidations mean leveraged buyers were force-sold into a drop. Short-heavy means a squeeze on the way up.
          </p>
        </div>
      ) : (
        <div className="text-[12px] text-ink-3">Liquidation data needs a higher CoinMarketCap plan.</div>
      )}
    </Card>
  );
}
