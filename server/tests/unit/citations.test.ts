import { describe, expect, it } from 'vitest';
import { parseAnswer } from '../../src/modules/ai/tutor/citations';

const passages = [
  { id: 'c1', lessonId: 'l1', lessonTitle: 'Layout with flexbox', text: 'x', score: 0.9 },
  { id: 'c2', lessonId: 'l2', lessonTitle: 'Selectors', text: 'y', score: 0.8 },
];

describe('parseAnswer', () => {
  it('extracts sources and removes citation tags', () => {
    const r = parseAnswer('Items spread along the main axis [S1]. Use a class selector [S2].', passages);
    expect(r.notFound).toBe(false);
    expect(r.text).toBe('Items spread along the main axis. Use a class selector.');
    expect(r.sources.map((s) => s.lessonTitle)).toEqual(['Layout with flexbox', 'Selectors']);
  });
  it('treats NOT_FOUND as a refusal', () => {
    expect(parseAnswer('NOT_FOUND', passages).notFound).toBe(true);
  });
  it('treats an answer with no valid citation as unsupported', () => {
    expect(parseAnswer('The capital of France is Paris.', passages).notFound).toBe(true);
    expect(parseAnswer('Something [S9].', passages).notFound).toBe(true);
  });
  it('lists a lesson only once', () => {
    const r = parseAnswer('A [S1] and B [S1].', passages);
    expect(r.sources).toHaveLength(1);
  });
});
