import { useState } from "react";
import { Sparkles, Square } from "lucide-react";
import clsx from "clsx";
import { useChat } from "../../lib/chat";
import { Markdown } from "../ui/Markdown";
import { Card, CardTitle } from "../ui/Card";
import { Mascot } from "../ui/Mascot";

export function AskInline({ symbol, name }: { symbol: string; name: string }) {
  const peer = symbol === "BTC" ? "ETH" : "BTC";
  const prompts = [
    `Why is ${symbol} moving today?`,
    `How risky is ${symbol} compared with ${peer}?`,
    `Where is ${symbol} relative to its all-time high, and what would confirm a trend change?`,
    `What is ${name} and what would make it worth watching?`,
  ];
  const chat = useChat();
  const [asked, setAsked] = useState<string | null>(null);
  const last = chat.messages[chat.messages.length - 1];

  return (
    <Card>
      <CardTitle right={<span className="flex items-center gap-1 text-[11px] text-gold"><Sparkles size={12} /> live analyst</span>}>Ask Argus about {symbol}</CardTitle>
      <div className="flex flex-wrap gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            disabled={chat.busy}
            onClick={() => { setAsked(p); chat.send(p); }}
            className={clsx("glass-2 pill px-3 py-1.5 text-left text-[12.5px] text-ink-2 hover:text-ink disabled:opacity-50", asked === p && "border-gold/40 text-ink")}
          >
            {p}
          </button>
        ))}
      </div>
      {last?.role === "assistant" && (
        <div className="mt-4 border-t border-line pt-4">
          {last.steps.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {last.steps.map((s, i) => (
                <span key={i} className={clsx("pill px-2 py-0.5 font-mono text-[10.5px]", s.ok === false ? "bg-down-dim text-down" : s.ok ? "bg-up-dim text-up" : "bg-gold-dim text-gold")}>{s.name}</span>
              ))}
            </div>
          )}
          {last.text ? <Markdown text={last.text} /> : <div className="flex items-center gap-3 text-[12px] text-ink-3"><Mascot size={36} thinking /> Reading the market…</div>}
          {chat.busy && (
            <button onClick={chat.stop} className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-3 hover:text-ink"><Square size={11} /> stop</button>
          )}
          {last.error && <div className="mt-2 text-[12px] text-down">{last.error}</div>}
        </div>
      )}
    </Card>
  );
}
