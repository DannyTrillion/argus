/** Split the agent's brief into sections by markdown heading, tolerant of bold-line headings. */
export interface BriefSection { title: string; headline?: string; body: string }

export function parseBrief(text: string): BriefSection[] {
  const lines = text.split(/\r?\n/);
  const hasHashHeadings = /^#{1,4}\s+\S/m.test(text);
  const out: BriefSection[] = [];
  let cur: BriefSection | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    // Bold lines are headings only in documents without markdown headings; otherwise a bold
    // line directly under a heading is that section's headline.
    const h = line.match(/^#{1,4}\s+(.+?)\s*$/) ?? (hasHashHeadings ? null : line.match(/^\*\*(.+?)\*\*:?\s*$/));
    if (h) {
      cur = { title: h[1].trim(), body: "" };
      out.push(cur);
      continue;
    }
    const bold = line.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (bold && cur && !cur.body && !cur.headline) {
      cur.headline = bold[1].trim();
      continue;
    }
    if (!cur) {
      if (!line) continue;
      cur = { title: "Brief", body: "" };
      out.push(cur);
    }
    cur.body += (cur.body ? "\n" : "") + raw;
  }
  return out.map((s) => ({ ...s, body: s.body.trim() })).filter((s) => s.body);
}
