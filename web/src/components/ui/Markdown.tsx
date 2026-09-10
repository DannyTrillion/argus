import { useMemo } from "react";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

export function Markdown({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => marked.parse(text, { async: false }) as string, [text]);
  return <div className={`prose-argus text-[13.5px] text-ink-2 ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
