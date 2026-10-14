import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, HttpError } from '../../utils/http';

export const usersRouter = Router();
usersRouter.use(authenticate);

usersRouter.patch('/me', asyncHandler(async (req, res) => {
  const body = z.object({ name: z.string().min(2).max(80).optional(), interests: z.array(z.string().max(40)).max(10).optional() }).parse(req.body);
  const u = await prisma.user.update({ where: { id: req.user!.id }, data: body });
  res.json({ id: u.id, name: u.name, interests: u.interests });
}));

usersRouter.post('/me/password', asyncHandler(async (req, res) => {
  const body = z.object({ currentPassword: z.string(), newPassword: z.string().min(8).max(100) }).parse(req.body);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await bcrypt.compare(body.currentPassword, u.passwordHash))) throw new HttpError(400, 'Your current password is incorrect');
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(body.newPassword, 10) } });
  res.json({ message: 'Password changed' });
}));
