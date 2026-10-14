import { describe, expect, it } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://x:x@localhost:5432/x';
process.env.JWT_SECRET ??= 'test-secret-test-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-test-refresh';

const cos = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

describe('localEmbed', async () => {
  const { localEmbed, EMBEDDING_DIM } = await import('../../src/modules/ai/llm/embeddings');
  it('returns a unit-length vector of the right size', () => {
    const v = localEmbed('flexbox layout');
    expect(v).toHaveLength(EMBEDDING_DIM);
    expect(Math.sqrt(v.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 5);
  });
  it('scores related text higher than unrelated text', () => {
    const q = localEmbed('How does justify-content work in flexbox?');
    const related = localEmbed('The justify-content property spreads flex items along the main axis in a flexbox layout.');
    const unrelated = localEmbed('A foreign key refers to the primary key of another table in the database.');
    expect(cos(q, related)).toBeGreaterThan(cos(q, unrelated));
  });
});
