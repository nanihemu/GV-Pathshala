import { Passage } from '../retrieval/search';

export interface ParsedAnswer {
  notFound: boolean;
  text: string;
  sources: { lessonId: string; lessonTitle: string }[];
}

// Turns "[S1]" tags in the model's answer into a list of source lessons and removes the tags from the text.
export function parseAnswer(raw: string, passages: Passage[]): ParsedAnswer {
  const trimmed = raw.trim();
  if (/^NOT_FOUND\b/i.test(trimmed)) return { notFound: true, text: '', sources: [] };

  const used = new Set<number>();
  for (const m of trimmed.matchAll(/\[S(\d+)\]/g)) {
    const idx = Number(m[1]) - 1;
    if (idx >= 0 && idx < passages.length) used.add(idx);
  }
  // An answer without any valid citation is treated as unsupported (SRS AIT-3, AI-2).
  if (used.size === 0) return { notFound: true, text: '', sources: [] };

  const seen = new Set<string>();
  const sources: ParsedAnswer['sources'] = [];
  for (const i of [...used].sort((a, b) => a - b)) {
    const p = passages[i];
    if (!seen.has(p.lessonId)) {
      seen.add(p.lessonId);
      sources.push({ lessonId: p.lessonId, lessonTitle: p.lessonTitle });
    }
  }
  const text = trimmed.replace(/\s*\[S\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
  return { notFound: false, text, sources };
}
