import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  UPLOAD_DIR: z.string().default('uploads'),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(['voyage', 'local']).default('local'),
  EMBEDDING_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default('voyage-3'),
  AI_SIMILARITY_THRESHOLD: z.coerce.number().default(0.25),
  AI_MONTHLY_TOKEN_BUDGET: z.coerce.number().default(2_000_000),
  AI_TUTOR_HOURLY_LIMIT: z.coerce.number().default(30),
  PSEUDONYM_SECRET: z.string().default('dev-pseudonym-secret'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
// The AI features only call the provider when both values are set.
export const aiConfigured = Boolean(env.ANTHROPIC_API_KEY && env.AI_MODEL);
