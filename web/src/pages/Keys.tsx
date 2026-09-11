import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Eye, EyeOff, Check, X, Sparkles, ShieldCheck, ExternalLink, Trash2, Loader2, Radar } from "lucide-react";
import clsx from "clsx";
import { api } from "../lib/api";
import { getAnthropicKey, setAnthropicKey, clearAnthropicKey, maskKey, onKeyChange } from "../lib/keys";
import { Card, CardTitle } from "../components/ui/Card";
import { Mascot } from "../components/ui/Mascot";

function Pill({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={clsx("pill inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[11px]", on ? "bg-up-dim text-up" : "glass-2 text-ink-3")}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", on ? "bg-up" : "bg-ink-3")} />
      {label}
    </span>
  );
}

export default function Keys() {
  const status = useQuery({ queryKey: ["keys"], queryFn: api.keys, staleTime: 60_000 });
  const [saved, setSaved] = useState(getAnthropicKey());
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [state, setState] = useState<{ kind: "idle" } | { kind: "testing" } | { kind: "ok"; model: string } | { kind: "error"; error: string }>({ kind: "idle" });

  useEffect(() => onKeyChange(() => setSaved(getAnthropicKey())), []);

  const connect = async () => {
    const key = draft.trim();
    if (!key) return;
    setState({ kind: "testing" });
    const r = await api.testKey(key).catch((e: Error) => ({ ok: false as const, error: e.message }));
    if (r.ok) {
      setAnthropicKey(key);
      setDraft("");
      setState({ kind: "ok", model: r.model });
    } else {
      setState({ kind: "error", error: r.error });
    }
  };

  const shared = status.data?.serverKey ?? false;
  const active = Boolean(saved) || shared;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] text-gold"><KeyRound size={13} /> Bring your own key</div>
          <h1 className="font-display mt-1 text-[30px] font-light leading-tight tracking-tight sm:text-[36px]">Your key, <span className="text-glow">your analyst.</span></h1>
          <p className="mt-2 max-w-[640px] text-[13.5px] leading-relaxed text-ink-2">
            The market data on every screen is free to read. The analyst, Ask Argus and Scan now run on Claude, and Claude bills an Anthropic key. Paste yours here and Argus uses it for your questions only.
          </p>
        </div>
        <Mascot size={88} className="hidden shrink-0 rounded-full sm:block" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Pill on={shared} label={shared ? "shared key on this deployment" : "no shared key on this deployment"} />
        <Pill on={Boolean(saved)} label={saved ? "your key saved in this browser" : "no key in this browser"} />
        <Pill on={active} label={active ? "analyst ready" : "analyst locked"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start">
        <Card className="hud">
          <CardTitle right={saved ? <span className="font-mono text-[11px] text-ink-3">{maskKey(saved)}</span> : undefined}>Anthropic API key</CardTitle>

          {saved ? (
            <div className="glass-2 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-up-dim text-up"><Check size={16} /></span>
                <div>
                  <div className="text-[14px] font-medium">Connected</div>
                  <div className="text-[12px] text-ink-3">Questions run on {status.data?.analystModel ?? "the analyst model"} with your key.</div>
                </div>
              </div>
              <button onClick={() => { clearAnthropicKey(); setState({ kind: "idle" }); }} className="glass-2 pill inline-flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] text-ink-2 hover:text-down"><Trash2 size={13} /> Forget this key</button>
            </div>
          ) : (
            <>
              <div className="glass-2 flex items-center gap-2 rounded-2xl px-3.5 py-2.5">
                <KeyRound size={15} className="shrink-0 text-ink-3" />
                <input
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); if (state.kind !== "idle") setState({ kind: "idle" }); }}
                  onKeyDown={(e) => { if (e.key === "Enter") void connect(); }}
                  type={show ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sk-ant-api03-…"
                  className="w-full min-w-0 bg-transparent font-mono text-[13px] text-ink placeholder:text-ink-3 focus:outline-none"
                />
                <button onClick={() => setShow((s) => !s)} className="shrink-0 text-ink-3 hover:text-ink" aria-label={show ? "Hide key" : "Show key"}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void connect()}
                  disabled={!draft.trim() || state.kind === "testing"}
                  className="pill inline-flex items-center gap-2 bg-gold px-4 py-2 text-[13px] font-medium text-bg hover:bg-gold-2 disabled:opacity-50"
                >
                  {state.kind === "testing" ? <><Loader2 size={14} className="animate-spin" /> Checking with Anthropic</> : <><Sparkles size={14} /> Test and connect</>}
                </button>
                <span className="text-[12px] text-ink-3">One tiny request proves the key works. Nothing is stored until it does.</span>
              </div>
            </>
          )}

          {state.kind === "ok" && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-up-dim px-3.5 py-2.5 text-[12.5px] text-up"><Check size={14} className="mt-0.5 shrink-0" /> Key works. <Link to="/analyst" className="underline underline-offset-2">Ask Argus something.</Link></div>
          )}
          {state.kind === "error" && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-down-dim px-3.5 py-2.5 text-[12.5px] text-down"><X size={14} className="mt-0.5 shrink-0" /> {state.error}</div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { icon: <ShieldCheck size={15} />, t: "Stays in this browser", d: "Saved in local storage on this device. Forget it here or clear site data to remove it." },
              { icon: <Sparkles size={15} />, t: "Sent per request", d: "Travels as a header over HTTPS with each question. The server uses it once and keeps nothing." },
              { icon: <Radar size={15} />, t: "Never in the schedule", d: "The 4h brief and the watch loop only ever use the deployment's own key, never yours." },
            ].map((x) => (
              <div key={x.t} className="glass-2 rounded-2xl p-3.5">
                <div className="flex items-center gap-2 text-gold">{x.icon}<span className="text-[12.5px] font-medium text-ink">{x.t}</span></div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">{x.d}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardTitle>What your key unlocks</CardTitle>
            <ul className="space-y-2.5 text-[13px] text-ink-2">
              {[
                ["Analyst", "Streaming answers with tool steps, inline charts, evidence of every CoinMarketCap call, and follow-up questions."],
                ["Ask Argus", "Open any finding or coin straight into a conversation with that context loaded."],
                ["Scan now", "Run the anomaly detector on the top 100 and investigate what it flags, on demand."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-2.5"><Check size={14} className="mt-0.5 shrink-0 text-up" /><span><span className="font-medium text-ink">{t}.</span> {d}</span></li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
              Everything else, the dashboard, Explore, coin pages, watchlist, the brief and past findings, needs no key at all. A typical question costs a few cents.
            </p>
          </Card>

          <Card>
            <CardTitle>Get a key in two minutes</CardTitle>
            <ol className="space-y-2 text-[13px] text-ink-2">
              {[
                <>Open the <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold underline-offset-2 hover:underline">Anthropic Console <ExternalLink size={11} /></a> and sign in or create an account.</>,
                <>Add a small amount of credit under Billing.</>,
                <>Create a key, copy it (it starts with <span className="font-mono text-ink">sk-ant-</span>) and paste it here.</>,
              ].map((s, i) => (
                <li key={i} className="flex gap-3"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-dim font-mono text-[11px] text-gold">{i + 1}</span><span>{s}</span></li>
              ))}
            </ol>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-3">
              Running Argus yourself? Set <span className="font-mono text-ink">ANTHROPIC_API_KEY</span> on the server instead and every visitor shares it. The pause switch on <Link to="/status" className="text-gold underline-offset-2 hover:underline">Status</Link> bounds what the schedule can spend.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
