import { env } from '../../../config/env';

export const EMBEDDING_DIM = 1024;

const STOP = new Set(
  'a an the and or but if of to in on at for with by from as is are was were be been it its this that these those i you he she we they what which who how why when where do does did can could should would will may might about into than then so not no yes your my our their'.split(' ')
);

function fnv(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const stem = (w: string) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w);

/**
 * Offline fallback: a hashed bag-of-words vector. It finds passages that share words with the question,
 * which is good enough for demos and tests. Use EMBEDDING_PROVIDER=voyage for real semantic search.
 */
export function localEmbed(text: string): number[] {
  const v = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOP.has(t)).map(stem);
  for (const t of tokens) v[fnv(t) % EMBEDDING_DIM] += 1;
  for (let i = 0; i < tokens.length - 1; i++) v[fnv(tokens[i] + '_' + tokens[i + 1]) % EMBEDDING_DIM] += 0.5;
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

export async function embed(texts: string[], inputType: 'document' | 'query' = 'document'): Promise<number[][]> {
  if (env.EMBEDDING_PROVIDER === 'voyage' && env.EMBEDDING_API_KEY) {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.EMBEDDING_API_KEY}` },
      body: JSON.stringify({ input: texts, model: env.EMBEDDING_MODEL, input_type: inputType }),
    });
    if (!res.ok) throw new Error(`Embedding request failed: ${res.status}`);
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }
  return texts.map(localEmbed);
}

export const toVector = (v: number[]) => `[${v.join(',')}]`;
