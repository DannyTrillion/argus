/** Small "Explain" link that opens the analyst with a question about the thing it sits on. */
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import clsx from "clsx";

export function AskButton({ q, label = "Explain", className }: { q: string; label?: string; className?: string }) {
  return (
    <Link
      to={`/analyst?q=${encodeURIComponent(q)}`}
      onClick={(e) => e.stopPropagation()}
      title={q}
      aria-label={`Ask Argus: ${q}`}
      className={clsx("pill inline-flex shrink-0 items-center gap-1 px-2 py-1 text-[11px] text-ink-3 transition-colors hover:bg-gold-dim hover:text-gold", className)}
    >
      <Sparkles size={11} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
