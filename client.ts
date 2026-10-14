import Anthropic from '@anthropic-ai/sdk';
import { aiConfigured, env } from '../../../config/env';
import { prisma } from '../../../config/db';
import { assertWithinBudget, recordUsage } from '../guardrails/budget';

export class AiUnavailableError extends Error {
  constructor(message = 'The AI assistant is not available right now.') {
    super(message);
  }
}

let client: Anthropic | null = null;

export interface CompleteOptions {
  kind: string; // tutor | questions | feedback | summary, used for the log
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  maxTokens?: number;
  temperature?: number;
}

/**
 * The ONLY place in the codebase that calls the AI provider.
 * Budget checks, usage counting and de-identified logging all live here (SRS SEC-5, AI-5, AI-6).
 * Callers must pseudonymise personal data before building the prompt.
 */
export async function complete(opts: CompleteOptions): Promise<string> {
  if (!aiConfigured) throw new AiUnavailableError('AI is not configured. Set ANTHROPIC_API_KEY and AI_MODEL on the server.');
  await assertWithinBudget();
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  let text = '';
  try {
    const res = await client.messages.create({
      model: env.AI_MODEL as string,
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.2,
      system: opts.system,
      messages: opts.messages,
    });
    text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    await recordUsage(res.usage.input_tokens, res.usage.output_tokens);
  } catch (err) {
    console.error('AI provider error', err);
    throw new AiUnavailableError();
  }
  await prisma.aiLog
    .create({ data: { kind: opts.kind, prompt: JSON.stringify({ system: opts.system, messages: opts.messages }), response: text } })
    .catch(() => undefined);
  return text;
}
