import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowRight } from "lucide-react";
import { api } from "../lib/api";
import { displayText } from "../lib/chat";
import { stripMentions } from "../lib/mentions";
import { timeAgo } from "../lib/format";
import { Markdown } from "../components/ui/Markdown";
import { Mascot } from "../components/ui/Mascot";
import { Skeleton } from "../components/ui/Skeleton";
import { AnswerCharts } from "../components/analyst/AnswerCharts";
import { WorkingSteps, Evidence } from "../components/analyst/Rail";

export default function Shared() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ["share", id], queryFn: () => api.readShare(id ?? ""), enabled: Boolean(id) });

  if (isLoading) return <Skeleton className="h-[400px]" />;
  if (error || !data) {
    return (
      <div className="glass flex flex-col items-center gap-3 p-10 text-center">
        <Mascot size={88} />
        <div className="text-[15px]">That conversation is not here.</div>
        <div className="text-[12.5px] text-ink-3">Shares live on the server that created them and are pruned after the newest 500.</div>
        <Link to="/analyst" className="pill mt-2 bg-gold px-4 py-2 text-[13px] font-medium text-bg">Ask Argus yourself</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[960px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] text-gold"><Sparkles size={13} /> Shared conversation · {timeAgo(data.createdAt)}</div>
          <h1 className="font-display mt-1 truncate text-[28px] font-light leading-tight tracking-tight sm:text-[34px]">{stripMentions(data.title)}</h1>
        </div>
        <Link to="/analyst" className="pill inline-flex items-center gap-2 bg-gold px-4 py-2 text-[13px] font-medium text-bg hover:bg-gold-2"><Sparkles size={14} /> Ask Argus yourself <ArrowRight size={13} /></Link>
      </div>
      {data.messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="glass-2 ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-lg px-4 py-2.5 text-[13.5px]">{stripMentions(m.text)}</div>
        ) : (
          <div key={i} className="glass p-5 sm:p-6">
            {m.steps.length > 0 && <div className="mb-4"><WorkingSteps m={m} live={false} /></div>}
            <Markdown text={displayText(m.text)} className="text-[14px]" />
            <AnswerCharts steps={m.steps} />
            {m.calls.length > 0 && <div className="mt-4 border-t border-line pt-3"><Evidence m={m} /></div>}
          </div>
        ),
      )}
      <div className="glass flex flex-col items-center gap-3 p-8 text-center">
        <Mascot size={72} />
        <div className="text-[14px]">Every number above came from live CoinMarketCap calls when this was asked.</div>
        <Link to="/analyst" className="pill inline-flex items-center gap-2 bg-gold px-4 py-2 text-[13px] font-medium text-bg hover:bg-gold-2"><Sparkles size={14} /> Start your own conversation</Link>
      </div>
    </div>
  );
}
