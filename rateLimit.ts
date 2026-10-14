import { prisma } from '../../../config/db';
import { env } from '../../../config/env';
import { HttpError } from '../../../utils/http';

// Each student may send a limited number of tutor messages per hour (SRS AIT-9).
export async function assertTutorRate(userId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.chatMessage.count({ where: { userId, role: 'user', createdAt: { gte: since } } });
  if (count >= env.AI_TUTOR_HOURLY_LIMIT)
    throw new HttpError(429, `You have reached the limit of ${env.AI_TUTOR_HOURLY_LIMIT} tutor messages per hour. Try again later.`);
}
