// Splits lesson text into passages of roughly 800 characters, keeping paragraphs together where possible.
export function chunkText(text: string, target = 800, max = 1200): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const pieces: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= max) {
      pieces.push(p);
      continue;
    }
    // a very long paragraph: split by sentence
    let cur = '';
    for (const s of p.split(/(?<=[.!?])\s+/)) {
      if ((cur + ' ' + s).length > target && cur) {
        pieces.push(cur.trim());
        cur = s;
      } else cur = (cur + ' ' + s).trim();
    }
    if (cur) pieces.push(cur.trim());
  }
  const chunks: string[] = [];
  let cur = '';
  for (const p of pieces) {
    if (cur && (cur + '\n\n' + p).length > target) {
      chunks.push(cur);
      cur = p;
    } else cur = cur ? cur + '\n\n' + p : p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}
