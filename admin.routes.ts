import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler, HttpError, paramId } from '../../utils/http';

export const adminRouter = Router();
adminRouter.use(authenticate, requireRole('ADMIN'));

adminRouter.get('/users', asyncHandler(async (req, res) => {
  const q = z.object({ search: z.string().optional(), role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']).optional() }).parse(req.query);
  res.json(await prisma.user.findMany({
    where: { ...(q.role ? { role: q.role } : {}), ...(q.search ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }] } : {}) },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 200,
  }));
}));

adminRouter.post('/users', asyncHandler(async (req, res) => {
  const b = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']) }).parse(req.body);
  if (await prisma.user.findUnique({ where: { email: b.email.toLowerCase() } })) throw new HttpError(409, 'An account with this email already exists');
  const u = await prisma.user.create({ data: { name: b.name, email: b.email.toLowerCase(), role: b.role, passwordHash: await bcrypt.hash(b.password, 10) } });
  res.status(201).json({ id: u.id, name: u.name, email: u.email, role: u.role });
}));

adminRouter.patch('/users/:id', asyncHandler(async (req, res) => {
  const b = z.object({ role: z.enum(['STUDENT', 'INSTRUCTOR', 'ADMIN']).optional(), active: z.boolean().optional() }).parse(req.body);
  if (paramId(req) === req.user!.id) throw new HttpError(400, 'You cannot change your own role or status');
  const u = await prisma.user.update({ where: { id: paramId(req) }, data: b });
  await prisma.auditLog.create({ data: { actorId: req.user!.id, action: 'USER_UPDATE', target: u.id, detail: JSON.stringify(b) } });
  res.json({ id: u.id, role: u.role, active: u.active });
}));

adminRouter.get('/courses', asyncHandler(async (_req, res) => {
  res.json(await prisma.course.findMany({ include: { instructor: { select: { name: true } }, _count: { select: { enrollments: true } } }, orderBy: { createdAt: 'desc' } }));
}));

adminRouter.patch('/courses/:id/status', asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED']) }).parse(req.body);
  const c = await prisma.course.update({ where: { id: paramId(req) }, data: { status } });
  await prisma.auditLog.create({ data: { actorId: req.user!.id, action: 'COURSE_STATUS', target: c.id, detail: status } });
  res.json(c);
}));

adminRouter.get('/stats', asyncHandler(async (_req, res) => {
  const day = 24 * 60 * 60 * 1000;
  const since = (d: number) => new Date(Date.now() - d * day);
  const [users, courses, enrollments, completed, a7, a30, ai] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: true }),
    prisma.course.count({ where: { status: 'PUBLISHED' } }),
    prisma.enrollment.count(),
    prisma.enrollment.count({ where: { completedAt: { not: null } } }),
    prisma.lessonProgress.groupBy({ by: ['userId'], where: { updatedAt: { gte: since(7) } } }),
    prisma.lessonProgress.groupBy({ by: ['userId'], where: { updatedAt: { gte: since(30) } } }),
    prisma.aiUsage.findUnique({ where: { month: new Date().toISOString().slice(0, 7) } }),
  ]);
  res.json({
    users: Object.fromEntries(users.map((u) => [u.role, u._count])),
    publishedCourses: courses, enrollments,
    completionRate: enrollments ? Math.round((completed / enrollments) * 100) : 0,
    activeUsers7d: a7.length, activeUsers30d: a30.length,
    aiTokensThisMonth: (ai?.inputTokens ?? 0) + (ai?.outputTokens ?? 0),
  });
}));

adminRouter.get('/audit-log', asyncHandler(async (_req, res) => {
  res.json(await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }));
}));
