import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, HttpError, paramId } from '../../utils/http';

export const reviewsRouter = Router(); // mounted at /api/courses

reviewsRouter.get('/:id/reviews', asyncHandler(async (req, res) => {
  const items = await prisma.review.findMany({ where: { courseId: paramId(req) }, orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true } } } });
  res.json(items.map((r) => ({ id: r.id, rating: r.rating, text: r.text, name: r.user.name, createdAt: r.createdAt })));
}));

reviewsRouter.post('/:id/reviews', authenticate, asyncHandler(async (req, res) => {
  const body = z.object({ rating: z.number().int().min(1).max(5), text: z.string().max(1500).optional() }).parse(req.body);
  const enrolled = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: req.user!.id, courseId: paramId(req) } } });
  if (!enrolled) throw new HttpError(403, 'Enroll in this course to review it');
  res.status(201).json(await prisma.review.upsert({
    where: { userId_courseId: { userId: req.user!.id, courseId: paramId(req) } },
    create: { ...body, userId: req.user!.id, courseId: paramId(req) }, update: body,
  }));
}));
