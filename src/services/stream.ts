/**
 * One stream of "stories" for the Home carousel: agent findings first, then the
 * five sections of the latest brief, each with a headline, a deck and the article.
 */
import { findings } from "./watch.js";
import { currentBrief } from "./brief.js";
import type { Explanation } from "./explain.js";

export interface Story {
  id: string;
  type: "finding" | "brief";
  kicker: string;
  headline: string;
  deck: string;
  body: string;
  accent: "gold" | "up" | "down" | "blue";
  subject: { type: "coin"; id: number; symbol: string } | { type: "topic"; key: string } | { type: "market" };
  question: string;
  at: string;
  severity?: number;
  attribution?: Explanation | null;
  meta?: { calls: number; credits: number };
}

const TOPICS: Array<{ key: string; match: RegExp; label: string; accent: Story["accent"]; question: string }> = [
  { key: "backdrop", match: /backdrop|overview/i, label: "Market backdrop", accent: "gold", question: "How is the market today?" },
  { key: "movers", match: /mover/i, label: "Movers that matter", accent: "up", question: "What moved today and why?" },
  { key: "sectors", match: /sector|rotation/i, label: "Sector rotation", accent: "blue", question: "Which sectors are rotating this week?" },
  { key: "leverage", match: /leverage|risk/i, label: "Leverage and risk", accent: "down", question: "What got liquidated in the last 24h?" },
  { key: "watch", match: /watch/i, label: "Watch list", accent: "gold", question: "What should I watch this week?" },
];

function firstSentence(md: string, max = 140): string {
  const t = md.replace(/^[-*]\s+/gm, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\s+/g, " ").trim();
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  const s = (m ? m[1] : t).trim();
  return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : s;
}

function briefStories(): Story[] {
  const b = currentBrief();
  if (!b) return [];
  const out: Story[] = [];
  const parts = b.text.split(/^##\s+/m).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const nl = part.indexOf("\n");
    const title = (nl >= 0 ? part.slice(0, nl) : part).trim();
    let body = nl >= 0 ? part.slice(nl + 1).trim() : "";
    const topic = TOPICS.find((t) => t.match.test(title));
    if (!topic || !body) continue;
    let headline = title;
    const bold = body.match(/^\*\*(.+?)\*\*\s*$/m);
    if (bold && body.indexOf(bold[0]) < 5) {
      headline = bold[1].trim();
      body = body.replace(bold[0], "").trim();
    }
    out.push({
      id: `brief:${topic.key}:${b.generatedAt}`,
      type: "brief",
      kicker: topic.label,
      headline,
      deck: firstSentence(body),
      body,
      accent: topic.accent,
      subject: { type: "topic", key: topic.key },
      question: topic.question,
      at: b.generatedAt,
      meta: { calls: b.calls, credits: b.credits },
    });
  }
  return out;
}

const KIND_LABEL: Record<string, string> = {
  coin_move: "Price move",
  volume_spike: "Volume spike",
  liquidation_burst: "Liquidations",
  dominance_break: "Dominance",
  sector_divergence: "Sector",
  sentiment_shift: "Sentiment",
};

/** Most cards the Home coverflow carries; older findings stay in /api/findings. */
export const MAX_CARDS = 8;
/** Findings older than this leave the carousel; brief cards fill the space instead. */
export const MAX_AGE_HOURS = Number(process.env.STORY_MAX_AGE_HOURS ?? 48);

export function stream(): { stories: Story[]; lastScanAt: string | null; intervalMinutes: number; scanning: boolean } {
  const f = findings();
  // Freshest first, capped: the coverflow is a glance, not an archive.
  const cutoff = Date.now() - MAX_AGE_HOURS * 3_600_000;
  const fresh = f.findings.filter((x) => Date.parse(x.investigatedAt) >= cutoff).sort((a, b) => Date.parse(b.investigatedAt) - Date.parse(a.investigatedAt)).slice(0, MAX_CARDS);
  const fromFindings: Story[] = fresh.map((x) => ({
    id: x.id,
    type: "finding",
    kicker: `Argus noticed · ${KIND_LABEL[x.kind] ?? x.kind}`,
    headline: x.headline || x.title,
    deck: x.deck || x.detail,
    body: x.summary,
    accent: x.attribution?.read === "coin-specific" ? "gold" : x.metric >= 0 ? "up" : "down",
    subject: x.subject.type === "coin" ? { type: "coin", id: x.subject.id, symbol: x.subject.symbol } : { type: "market" },
    question: x.question,
    at: x.investigatedAt,
    severity: x.severity,
    attribution: x.attribution,
    meta: { calls: x.calls, credits: x.credits },
  }));
  // Findings lead. The brief lives in its own deck on Home, so only borrow brief cards
  // to keep the coverflow from looking sparse on a quiet day.
  const MIN_CARDS = 5;
  const pad = Math.max(0, MIN_CARDS - fromFindings.length);
  return { stories: [...fromFindings, ...briefStories().slice(0, pad)], lastScanAt: f.lastScanAt, intervalMinutes: f.intervalMinutes, scanning: f.scanning };
}
