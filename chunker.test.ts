import { describe, expect, it } from 'vitest';
import { chunkText } from '../../src/modules/ai/retrieval/chunker';

describe('chunkText', () => {
  it('keeps short text as one chunk', () => {
    expect(chunkText('One paragraph.')).toEqual(['One paragraph.']);
  });
  it('splits long text into chunks no larger than the maximum', () => {
    const para = 'This is a sentence about flexbox. '.repeat(20);
    const chunks = chunkText([para, para, para].join('\n\n'), 800, 1200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1300);
  });
  it('splits one very long paragraph by sentence', () => {
    const chunks = chunkText('A sentence here. '.repeat(200), 800, 1200);
    expect(chunks.length).toBeGreaterThan(2);
  });
  it('ignores empty input', () => {
    expect(chunkText('  \n\n  ')).toEqual([]);
  });
});
