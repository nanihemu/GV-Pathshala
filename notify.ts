import { prisma } from '../../config/db';

export async function notify(userId: string, type: string, text: string, link?: string) {
  await prisma.notification.create({ data: { userId, type, text, link } });
}

export async function notifyMany(userIds: string[], type: string, text: string, link?: string) {
  if (!userIds.length) return;
  await prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, type, text, link })) });
}
