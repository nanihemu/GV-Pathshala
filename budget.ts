import { prisma } from '../../../config/db';
import { env } from '../../../config/env';
import { HttpError } from '../../../utils/http';

const monthKey = () => new Date().toISOString().slice(0, 7);

// Monthly spending cap, measured in tokens (SRS AI-5). When reached, AI calls are refused.
export async function assertWithinBudget() {
  const row = await prisma.aiUsage.findUnique({ where: { month: monthKey() } });
  const used = (row?.inputTokens ?? 0) + (row?.outputTokens ?? 0);
  if (used >= env.AI_MONTHLY_TOKEN_BUDGET)
    throw new HttpError(429, 'The AI assistant has reached its monthly limit. It will be back next month.');
}

export async function recordUsage(input: number, output: number) {
  await prisma.aiUsage.upsert({
    where: { month: monthKey() },
    create: { month: monthKey(), inputTokens: input, outputTokens: output },
    update: { inputTokens: { increment: input }, outputTokens: { increment: output } },
  });
}
