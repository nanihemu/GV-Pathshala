import { createHmac } from 'crypto';
import { env } from '../../../config/env';

// The AI provider never receives names or emails: students appear as "Student-ab12cd" (SRS PRIV-1).
export const pseudonym = (userId: string) =>
  'Student-' + createHmac('sha256', env.PSEUDONYM_SECRET).update(userId).digest('hex').slice(0, 6);

export function pseudonymMap(users: { id: string; name: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of users) map.set(pseudonym(u.id), u.name);
  return map;
}

// Swap pseudonyms in the model's output back to real names before showing it to the instructor.
export function restoreNames(text: string, map: Map<string, string>): string {
  let out = text;
  for (const [alias, name] of map) out = out.split(alias).join(name);
  return out;
}
