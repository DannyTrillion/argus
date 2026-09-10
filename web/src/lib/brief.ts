/** Split the agent's brief into sections by markdown heading, tolerant of bold-line headings. */
export interface BriefSection { title: string; body: string }

export function parseBrief(text: string): BriefSection[] {
  const lines = text.split(/\r?\n/);
  const out: BriefSection[] = [];
  let cur: BriefSection | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^#{1,4}\s+(.+?)\s*$/) ?? line.match(/^\*\*(.+?)\*\*:?\s*$/);
    if (h) {
      cur = { title: h[1].trim(), body: "" };
      out.push(cur);
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
