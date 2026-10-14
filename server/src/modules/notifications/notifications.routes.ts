import { Router } from 'express';
import { prisma } from '../../config/db';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, paramId } from '../../utils/http';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', asyncHandler(async (req, res) => {
  const items = await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json({ unread: items.filter((i) => !i.readAt).length, items });
}));

notificationsRouter.post('/read-all', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));

notificationsRouter.patch('/:id/read', asyncHandler(async (req, res) => {
  await prisma.notification.updateMany({ where: { id: paramId(req), userId: req.user!.id }, data: { readAt: new Date() } });
  res.json({ ok: true });
}));
