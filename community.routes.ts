import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler, HttpError, paramId } from '../../utils/http';
import { courseAccess, lessonWithAccess, requireOwner } from '../../utils/access';
import { notifyMany } from '../notifications/notify';

export const communityRouter = Router(); // mounted at /api
communityRouter.use(authenticate);

// ---------- Announcements ----------
communityRouter.get('/courses/:id/announcements', asyncHandler(async (req, res) => {
  await courseAccess(req.user!, paramId(req));
  res.json(await prisma.announcement.findMany({ where: { courseId: paramId(req) }, orderBy: { createdAt: 'desc' }, take: 30 }));
}));

communityRouter.post('/courses/:id/announcements', requireRole('INSTRUCTOR', 'ADMIN'), asyncHandler(async (req, res) => {
  const course = await requireOwner(req.user!, paramId(req));
  const body = z.object({ title: z.string().min(2).max(120), body: z.string().min(2).max(3000) }).parse(req.body);
  const a = await prisma.announcement.create({ data: { ...body, courseId: course.id, authorId: req.user!.id } });
  const students = await prisma.enrollment.findMany({ where: { courseId: course.id }, select: { userId: true } });
  await notifyMany(students.map((s) => s.userId), 'ANNOUNCEMENT', `${course.title}: ${body.title}`, `/courses/${course.id}`);
  res.status(201).json(a);
}));

// ---------- Lesson discussion ----------
communityRouter.get('/lessons/:id/comments', asyncHandler(async (req, res) => {
  await lessonWithAccess(req.user!, paramId(req));
  const items = await prisma.comment.findMany({
    where: { lessonId: paramId(req) }, orderBy: { createdAt: 'asc' }, take: 200,
    include: { user: { select: { name: true, role: true } } },
  });
  res.json(items.map((c) => ({ id: c.id, body: c.body, createdAt: c.createdAt, userId: c.userId, name: c.user.name, role: c.user.role })));
}));

communityRouter.post('/lessons/:id/comments', asyncHandler(async (req, res) => {
  await lessonWithAccess(req.user!, paramId(req));
  const { body } = z.object({ body: z.string().min(1).max(2000) }).parse(req.body);
  res.status(201).json(await prisma.comment.create({ data: { lessonId: paramId(req), userId: req.user!.id, body } }));
}));

communityRouter.delete('/comments/:id', asyncHandler(async (req, res) => {
  const c = await prisma.comment.findUnique({ where: { id: paramId(req) }, include: { lesson: true } });
  if (!c) throw new HttpError(404, 'Comment not found');
  if (c.userId !== req.user!.id) await requireOwner(req.user!, c.lesson.courseId); // owner or admin may moderate
  await prisma.comment.delete({ where: { id: c.id } });
  res.status(204).end();
}));
