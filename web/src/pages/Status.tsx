import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Activity } from "lucide-react";
import { api } from "../lib/api";
import { timeAgo } from "../lib/format";
import { Card, CardTitle } from "../components/ui/Card";
import { Skeleton } from "../components/ui/Skeleton";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-2 rounded-2xl p-3.5">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="mt-1 font-mono text-[15px]">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}

export default function Status() {
  const { data, isLoading } = useQuery({ queryKey: ["status"], queryFn: api.status, staleTime: 5 * 60_000 });
  const calls = useQuery({ queryKey: ["calls"], queryFn: api.calls, refetchInterval: 15_000 });
  const month = data?.usage?.current_month;
  const limit = data?.plan?.credit_limit_monthly;
  const used = month?.credits_used ?? 0;
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-1.5 text-[13px] text-ink-2"><Activity size={13} /> System</div>
        <h1 className="font-display mt-1 text-[30px] font-light leading-tight tracking-tight sm:text-[34px]">Status</h1>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-[300px]" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardTitle>CoinMarketCap plan</CardTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <Stat label="Mode" value={data.keyless ? "keyless" : "API key"} sub={data.keyless ? "public subset only" : "Pro API"} />
                <Stat label="Monthly credits" value={limit ? `${used.toLocaleString()} / ${limit.toLocaleString()}` : "—"} sub={data.plan?.credit_limit_monthly_reset} />
                <Stat label="Today" value={`${(data.usage?.current_day?.credits_used ?? 0).toLocaleString()} credits`} />
                <Stat label="Rate limit" value={data.plan?.rate_limit_minute ? `${data.plan.rate_limit_minute}/min` : "—"} sub={data.usage?.current_minute ? `${data.usage.current_minute.requests_left} left this minute` : undefined} />
              </div>
              {limit ? (
                <div className="mt-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} /></div>
                  <div className="mt-1 font-mono text-[11px] text-ink-3">{pct.toFixed(1)}% of monthly credits used</div>
                </div>
              ) : null}
            </Card>
            <Card>
              <CardTitle>Analyst</CardTitle>
              <div className="grid grid-cols-2 gap-2.5">
                <Stat label="Model" value={data.model} />
                <Stat label="Tools" value={`${data.capabilities.filter((c) => c.ok).length} / ${data.capabilities.length} active`} />
                <Stat label="Brief" value={data.brief ? timeAgo(data.brief.generatedAt) : "not yet"} sub={data.brief ? `${data.brief.calls} calls · ${data.brief.credits} credits · ${(data.brief.durationMs / 1000).toFixed(0)}s` : "generates on first request"} />
                <Stat label="Checked" value={timeAgo(data.checkedAt)} sub="probes cached 10 min" />
              </div>
            </Card>
            <Card>
              <CardTitle>Recent API traffic</CardTitle>
              {calls.data ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <Stat label="Calls logged" value={String(calls.data.length)} />
                  <Stat label="Credits" value={String(calls.data.reduce((a, c) => a + c.creditCount, 0))} />
                  <Stat label="Cache hits" value={String(calls.data.filter((c) => c.cached).length)} />
                  <Stat label="Errors" value={String(calls.data.filter((c) => c.httpStatus >= 400).length)} />
                </div>
              ) : <Skeleton className="h-24" />}
            </Card>
          </div>

          <Card>
            <CardTitle right={<span className="text-[11px] text-ink-3">live probe, one call each</span>}>Endpoint families on this plan</CardTitle>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.capabilities.map((c) => (
                <div key={c.endpoint} className="glass-2 flex items-center gap-3 rounded-2xl px-3 py-2.5">
                  {c.ok ? <CheckCircle2 size={16} className="shrink-0 text-up" /> : <XCircle size={16} className="shrink-0 text-down" />}
                  <div className="min-w-0">
                    <div className="text-[13px]">{c.name}</div>
                    <div className="truncate font-mono text-[10.5px] text-ink-3">{c.endpoint}{c.note ? ` · ${c.note}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
              When a family is unavailable, Argus degrades rather than fails: candles fall back to daily historical quotes, movers to a filtered listings screen. The analyst tells you which source it used.
            </p>
          </Card>

          <Card className="p-0">
            <div className="border-b border-line px-5 py-3 text-[13px] font-medium text-ink-2">Last calls</div>
            <div className="scroll-thin max-h-[420px] overflow-auto">
              {(calls.data ?? []).slice().reverse().slice(0, 60).map((c) => (
                <div key={c.id} className="flex items-center gap-3 border-b border-line px-5 py-2 font-mono text-[11.5px] last:border-0">
                  <span className={c.httpStatus >= 400 ? "text-down" : "text-up"}>{c.httpStatus}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{c.endpoint}<span className="text-ink-3">{Object.keys(c.query).length ? "?" + Object.entries(c.query).map(([k, v]) => `${k}=${v}`).join("&") : ""}</span></span>
                  <span className="text-ink-3">{c.cached ? "cache" : `${c.creditCount} cr · ${c.elapsedMs}ms`}</span>
                  <span className="text-ink-3">{new Date(c.at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
