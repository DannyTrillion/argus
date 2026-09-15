/**
 * Learn: every explainer in Argus on one page. Stored content only, nothing to wait for.
 * Each Explain popup links here with #topic, so this page also works as a glossary.
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { BookOpen } from "lucide-react";
import clsx from "clsx";
import { EXPLAINERS, LEARN_GROUPS, type Tone } from "../lib/explainers";
import { Card } from "../components/ui/Card";
import { Mascot } from "../components/ui/Mascot";

const TONE: Record<Tone, string> = { down: "#ef6f6f", gold: "#e7c46a", up: "#6fd39c", blue: "#8fb7ff" };

export default function Learn() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!el) return;
    const t = setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    el.classList.add("learn-flash");
    const off = setTimeout(() => el.classList.remove("learn-flash"), 1600);
    return () => { clearTimeout(t); clearTimeout(off); };
  }, [hash]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] text-gold"><BookOpen size={13} /> Learn</div>
          <h1 className="font-display mt-1 text-[30px] font-light leading-tight tracking-tight sm:text-[36px]">What every number <span className="text-glow">actually means.</span></h1>
          <p className="mt-2 max-w-[640px] text-[13.5px] leading-relaxed text-ink-2">
            The same explainers you get from any Explain button, in one place. Plain language, simple thresholds, and what tends to move each one.
          </p>
        </div>
        <Mascot size={84} className="hidden shrink-0 rounded-full sm:block" />
      </div>

      <nav className="-mx-1 flex flex-wrap gap-2 px-1" aria-label="Topics">
        {LEARN_GROUPS.map((g) => (
          <a key={g.title} href={`#group-${g.topics[0]}`} className="glass-2 pill px-3 py-1.5 text-[12px] text-ink-2 hover:border-gold/40 hover:text-ink">{g.title}</a>
        ))}
      </nav>

      {LEARN_GROUPS.map((g) => (
        <section key={g.title} id={`group-${g.topics[0]}`} className="scroll-mt-24">
          <h2 className="mb-3 text-[11.5px] uppercase tracking-wider text-ink-3">{g.title}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {g.topics.map((t) => {
              const ex = EXPLAINERS[t];
              return (
                <Card key={t} id={t} className="scroll-mt-24 transition-shadow">
                  <div className="font-display text-[19px] font-medium leading-tight">{ex.title}</div>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{ex.what}</p>
                  {ex.scale && (
                    <div className="mt-3">
                      <div className="flex h-1.5 gap-[3px]">
                        {ex.scale.zones.map((z) => (
                          <div key={z.label} className="h-full rounded-full" style={{ flex: (Math.min(z.to, ex.scale!.max) - Math.max(z.from, ex.scale!.min)) || 1, background: TONE[z.tone], opacity: 0.7 }} />
                        ))}
                      </div>
                      <div className="mt-1.5 flex justify-between gap-2 font-mono text-[10px] text-ink-3">
                        {ex.scale.zones.map((z) => <span key={z.label}>{z.label}</span>)}
                      </div>
                    </div>
                  )}
                  <div className="mt-3.5 text-[10.5px] uppercase tracking-wider text-ink-3">How to read it</div>
                  <ul className="mt-1.5 space-y-1.5">
                    {ex.howToRead.map((l) => (
                      <li key={l} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-2"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold" />{l}</li>
                    ))}
                  </ul>
                  <div className="mt-3.5 text-[10.5px] uppercase tracking-wider text-ink-3">What moves it</div>
                  <div className={clsx("mt-1.5 flex flex-wrap gap-1.5")}>
                    {ex.moves.map((m) => <span key={m} className="glass-2 pill px-2.5 py-1 text-[11.5px] text-ink-2">{m}</span>)}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
