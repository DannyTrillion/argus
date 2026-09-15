import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, XCircle, Activity, Pause, Play, KeyRound, Lock, Waves } from "lucide-react";
import { useCalm, setCalm, getCalmSetting } from "../lib/calm";
import { Link } from "react-router-dom";
import { getAnthropicKey } from "../lib/keys";
import clsx from "clsx";
import { api, ApiError, setAdminToken } from "../lib/api";
import { timeAgo, compact } from "../lib/format";
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

function AutomationCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["automation"], queryFn: api.automation });
  const keys = useQuery({ queryKey: ["keys"], queryFn: api.keys, staleTime: 60_000 });
  const ownKey = Boolean(getAnthropicKey());
  const toggle = useMutation({ mutationFn: api.setAutomation, onSuccess: (d) => { qc.setQueryData(["automation"], d); void qc.invalidateQueries({ queryKey: ["findings"] }); } });
  const [token, setToken] = useState("");
  const needsToken = toggle.error instanceof ApiError && toggle.error.status === 401;
  const paused = data?.automationPaused ?? false;
  return (
    <Card>
      <CardTitle right={<span className={clsx("pill px-2 py-0.5 font-mono text-[10.5px]", paused ? "bg-down-dim text-down" : "bg-up-dim text-up")}>{paused ? "paused" : "running"}</span>}>Automation and spend</CardTitle>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Analyst model" value={data?.analystModel ?? "—"} sub="questions you ask" />
        <Stat label="Automation model" value={data?.automationModel ?? "—"} sub="brief, investigations, headlines" />
      </div>
      <div className="glass-2 mt-3 flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5 text-[12px]">
        <span className="flex items-center gap-2 text-ink-2"><KeyRound size={13} className="text-gold" /> Shared key {keys.data?.serverKey ? "on" : "off"} · your key {ownKey ? "saved" : "not set"}</span>
        <Link to="/keys" className="text-gold hover:underline">Keys</Link>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
        Scheduled work bills this site's Anthropic key; the AI spend card shows what it costs. Scan now only runs on a visitor's own key. Pause the schedule here when you are not using Argus; the Analyst keeps working on demand.
      </p>
      <button
        onClick={() => toggle.mutate(!paused)}
        disabled={toggle.isPending || !data}
        className={clsx("pill mt-3 inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium disabled:opacity-60", paused ? "bg-gold text-bg hover:bg-gold-2" : "glass-2 text-ink hover:border-gold/40")}
      >
        {paused ? <><Play size={14} /> Resume automation</> : <><Pause size={14} /> Pause automation</>}
      </button>
      {data?.adminLocked && !needsToken && <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-3"><Lock size={11} /> Owner only on this deployment</div>}
      {needsToken && (
        <div className="glass-2 mt-3 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 text-[12.5px] text-ink"><Lock size={12} className="text-gold" /> Only the owner can change this</div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">Enter the admin token for this deployment. It is saved in this browser so you only type it once.</p>
          <div className="mt-2 flex gap-2">
            <input value={token} onChange={(e) => setToken(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && token.trim()) { setAdminToken(token); toggle.mutate(!paused); } }} type="password" autoComplete="off" placeholder="Admin token" aria-label="Admin token" className="min-w-0 flex-1 rounded-xl border border-line bg-transparent px-3 py-1.5 font-mono text-[12.5px] text-ink placeholder:text-ink-3 focus:border-gold/40 focus:outline-none" />
            <button onClick={() => { setAdminToken(token); toggle.mutate(!paused); }} disabled={!token.trim() || toggle.isPending} className="pill shrink-0 bg-gold px-3.5 py-1.5 text-[12px] font-medium text-bg hover:bg-gold-2 disabled:opacity-50">Unlock</button>
          </div>
        </div>
      )}
    </Card>
  );
}

const KIND_LABEL: Record<string, string> = { analyst: "Analyst questions", brief: "Briefs", investigation: "Investigations", headline: "Headlines" };
const money = (n: number) => `$${n > 0 && n < 0.01 ? n.toFixed(3) : n.toFixed(2)}`;
const every = (min: number) => (min % 60 === 0 ? `${min / 60}h` : `${min} min`);

function SpendCard() {
  const { data } = useQuery({ queryKey: ["usage"], queryFn: api.usage, refetchInterval: 60_000 });
  return (
    <Card className="lg:col-span-2">
      <CardTitle right={data ? <span className="pill bg-gold-dim px-2 py-0.5 font-mono text-[10.5px] text-gold">today {money(data.today.usd)}</span> : undefined}>AI spend on this site</CardTitle>
      {!data ? (
        <Skeleton className="h-[120px]" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[12.5px]">
              <thead>
                <tr className="text-left text-[11px] text-ink-3">
                  <th className="pb-2 font-normal">Today</th>
                  <th className="pb-2 text-right font-normal">Runs</th>
                  <th className="pb-2 text-right font-normal">Tokens in</th>
                  <th className="pb-2 text-right font-normal">Tokens out</th>
                  <th className="pb-2 text-right font-normal">Estimate</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {(["analyst", "brief", "investigation", "headline"] as const).map((k) => {
                  const b = data.today.kinds[k];
                  return (
                    <tr key={k} className="border-t border-line">
                      <td className="py-1.5 font-sans text-ink-2">{KIND_LABEL[k]}</td>
                      <td className="py-1.5 text-right">{b.runs}</td>
                      <td className="py-1.5 text-right">{compact(b.input + b.cacheRead + b.cacheWrite)}</td>
                      <td className="py-1.5 text-right">{compact(b.output)}</td>
                      <td className="py-1.5 text-right text-ink">{money(b.usd)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Stat label="Last 7 days" value={money(data.last7.usd)} sub={`${data.last7.runs} runs on this site's key`} />
            <Stat label="Shared analyst today" value={`${data.sharedAnalyst.usedToday} / ${data.sharedAnalyst.perDay}`} sub={`${data.sharedAnalyst.perHour} per visitor per hour`} />
            <Stat label="Schedule" value={`brief ${every(data.schedule.briefMinutes)} · scan ${every(data.schedule.scanMinutes)}`} sub={`${data.schedule.investigationsToday} of ${data.schedule.investigationsPerDay} investigations today`} />
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-3">
            Estimated from token counts at Anthropic's published rates. Questions on visitors' own keys are not included ({data.today.visitorRuns} today). The Anthropic Console has the exact bill.
          </p>
        </>
      )}
    </Card>
  );
}

function BudgetCard() {
  const { data } = useQuery({ queryKey: ["usage"], queryFn: api.usage, refetchInterval: 60_000 });
  const b = data?.cmcBudget;
  const pct = b?.budgetToday ? Math.min(100, (b.usedToday / b.budgetToday) * 100) : 0;
  return (
    <Card>
      <CardTitle right={b ? <span className={clsx("pill px-2 py-0.5 font-mono text-[10.5px]", b.frozen ? "bg-down-dim text-down" : b.lean ? "bg-gold-dim text-gold" : "glass-2 text-ink-3")}>{b.frozen ? "budget spent" : b.lean ? "judging mode" : "normal"}</span> : undefined}>CoinMarketCap budget</CardTitle>
      {!b ? (
        <Skeleton className="h-[110px]" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Used today" value={b.budgetToday ? `${b.usedToday.toLocaleString()} / ${b.budgetToday.toLocaleString()}` : b.usedToday.toLocaleString()} sub="credits against today's budget" />
            <Stat label="Plan" value={b.limitMonthly ? `${compact(b.limitMonthly)} / month` : "—"} sub={b.rateLimitMinute ? `${b.rateLimitMinute} calls a minute` : undefined} />
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"><div className={clsx("h-full rounded-full", b.frozen ? "bg-down" : "bg-gold")} style={{ width: `${pct}%` }} /></div>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
            {b.lean
              ? `Basic-sized plan${b.simulateBasic ? " (simulated)" : ""}: caches last ten times longer, scheduled scans pause at 60% of today's budget, and once it is spent the site keeps showing the last data it fetched.`
              : "Startup plan: normal caching. Judging mode switches on by itself if the key drops to a Basic-sized plan, as it will when submissions close."}
            {b.until ? ` Budget spread until ${b.until.slice(0, 10)}.` : ""}
          </p>
        </>
      )}
    </Card>
  );
}

function PreferencesCard() {
  const calm = useCalm();
  const chosen = getCalmSetting();
  return (
    <Card>
      <CardTitle right={<span className={clsx("pill px-2 py-0.5 font-mono text-[10.5px]", calm ? "bg-gold-dim text-gold" : "glass-2 text-ink-3")}>{calm ? "on" : "off"}</span>}>Calm mode</CardTitle>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-dim text-gold"><Waves size={16} /></span>
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Stops the story and brief carousels from sliding on their own. Use the arrows to move through them instead.{" "}
          {chosen === null ? "Right now Argus follows your device's reduce-motion setting." : ""}
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => setCalm(!calm)} className={clsx("pill px-4 py-2 text-[13px] font-medium", calm ? "glass-2 text-ink hover:border-gold/40" : "bg-gold text-bg hover:bg-gold-2")}>{calm ? "Turn calm mode off" : "Turn calm mode on"}</button>
        {chosen !== null && <button onClick={() => setCalm(null)} className="pill px-3 py-2 text-[12.5px] text-ink-3 hover:text-ink">Follow my device</button>}
      </div>
    </Card>
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
          <div className="grid gap-4 lg:grid-flow-row-dense lg:grid-cols-3">
            <AutomationCard />
            <PreferencesCard />
            <SpendCard />
            <BudgetCard />
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
