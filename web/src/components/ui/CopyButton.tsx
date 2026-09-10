import { useState } from "react";
import { Check, Copy } from "lucide-react";
import clsx from "clsx";

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <button onClick={copy} className={clsx("inline-flex items-center gap-1 font-mono text-[11px] text-ink-3 hover:text-ink", className)} title="Copy as markdown">
      {done ? <Check size={12} className="text-up" /> : <Copy size={12} />} {done ? "Copied" : label}
    </button>
  );
}
