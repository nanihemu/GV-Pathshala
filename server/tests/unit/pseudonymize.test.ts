import { describe, expect, it } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://x:x@localhost:5432/x';
process.env.JWT_SECRET ??= 'test-secret-test-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-test-refresh';

describe('pseudonymize', async () => {
  const { pseudonym, pseudonymMap, restoreNames } = await import('../../src/modules/ai/guardrails/pseudonymize');
  it('is stable and hides the id', () => {
    expect(pseudonym('user-1')).toBe(pseudonym('user-1'));
    expect(pseudonym('user-1')).not.toBe(pseudonym('user-2'));
    expect(pseudonym('user-1')).not.toContain('user-1');
  });
  it('restores real names in model output', () => {
    const map = pseudonymMap([{ id: 'user-1', name: 'Priya Singh' }]);
    expect(restoreNames(`${pseudonym('user-1')} has been inactive.`, map)).toBe('Priya Singh has been inactive.');
  });
});
