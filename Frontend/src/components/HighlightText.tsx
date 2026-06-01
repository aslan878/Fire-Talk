import React from "react";

export function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let start = 0;
  let key = 0;

  while (start < text.length) {
    const idx = lower.indexOf(needle, start);
    if (idx === -1) {
      parts.push(text.slice(start));
      break;
    }
    if (idx > start) {
      parts.push(text.slice(start, idx));
    }
    parts.push(
      <mark key={key++} className="search-highlight">
        {text.slice(idx, idx + needle.length)}
      </mark>,
    );
    start = idx + needle.length;
  }

  return <>{parts}</>;
}
