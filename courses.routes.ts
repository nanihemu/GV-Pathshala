import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticate, optionalAuth, requireRole } from '../../middleware/auth';
import { asyncHandler, HttpError, paramId } from '../../utils/http';
import { requireOwner } from '../../utils/access';
import { indexCourse } from '../ai/retrieval/indexer';

export const coursesRouter = Router();
export const categoriesRouter = Router();
const instructor = requireRole('INSTRUCTOR', 'ADMIN');

// ---------- Categories ----------
categoriesRouter.get('/', asyncHandler(async (_req, res) => {
  res.json(await prisma.category.findMany({ orderBy: { name: 'asc' } }));
}));
categoriesRouter.post('/', authenticate, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { name } = z.object({ name: z.string().min(2).max(40) }).parse(req.body);
  res.status(201).json(await prisma.category.create({ data: { name } }));
}));

// ---------- Catalog ----------
coursesRouter.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const q = z.object({ search: z.string().optional(), category: z.string().optional(), level: z.string().optional(), minRating: z.coerce.number().optional() }).parse(req.query);
  const courses = await prisma.course.findMany({
    where: {
      status: 'PUBLISHED',
      ...(q.category ? { categoryId: q.category } : {}),
      ...(q.level ? { level: q.level } : {}),
      ...(q.search
        ? { OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { description: { contains: q.search, mode: 'insensitive' } }, { instructor: { name: { contains: q.search, mode: 'insensitive' } } }] }
        : {}),
    },
    include: { category: true, instructor: { select: { name: true } }, _count: { select: { enrollments: true, lessons: true } } },
    orderBy: { createdAt: 'desc' },
  });
  const ratings = await prisma.review.groupBy({ by: ['courseId'], _avg: { rating: true }, _count: true });
  const rmap = new Map(ratings.map((r) => [r.courseId, r]));
  const enrolled = req.user ? new Set((await prisma.enrollment.findMany({ where: { userId: req.user.id }, select: { courseId: true } })).map((e) => e.courseId)) : new Set<string>();
  const out = courses
    .map((c) => ({
      id: c.id, title: c.title, description: c.description, level: c.level, thumbnail: c.thumbnail,
      category: c.category.name, instructor: c.instructor.name,
      students: c._count.enrollments, lessons: c._count.lessons,
      rating: rmap.get(c.id)?._avg.rating ?? null, reviews: rmap.get(c.id)?._count ?? 0,
      enrolled: enrolled.has(c.id),
    }))
    .filter((c) => !q.minRating || (c.rating ?? 0) >= q.minRating);
  res.json(out);
}));

coursesRouter.get('/mine', authenticate, instructor, asyncHandler(async (req, res) => {
  const where = req.user!.role === 'ADMIN' ? {} : { instructorId: req.user!.id };
  res.json(await prisma.course.findMany({
    where, orderBy: { createdAt: 'desc' },
    include: { category: true, _count: { select: { enrollments: true, lessons: true } } },
  }));
}));

coursesRouter.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { id: paramId(req) },
    include: {
      category: true, instructor: { select: { id: true, name: true } },
      modules: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' }, select: { id: true, title: true, type: true, durationMin: true, position: true, dueDate: true } } } },
    },
  });
  if (!course) throw new HttpError(404, 'Course not found');
  const canEdit = !!req.user && (req.user.role === 'ADMIN' || course.instructorId === req.user.id);
  if (course.status !== 'PUBLISHED' && !canEdit) throw new HttpError(404, 'Course not found');

  let enrolled = false;
  let completedLessonIds: string[] = [];
  if (req.user) {
    enrolled = !!(await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: req.user.id, courseId: course.id } } }));
    completedLessonIds = (await prisma.lessonProgress.findMany({ where: { userId: req.user.id, completed: true, lesson: { courseId: course.id } }, select: { lessonId: true } })).map((p) => p.lessonId);
  }
  const rating = await prisma.review.aggregate({ where: { courseId: course.id }, _avg: { rating: true }, _count: true });
  res.json({ ...course, enrolled, canEdit, completedLessonIds, rating: rating._avg.rating, reviews: rating._count });
}));

// ---------- Authoring ----------
const courseBody = z.object({
  title: z.string().min(3).max(120), description: z.string().min(10).max(2000),
  categoryId: z.string(), level: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
  thumbnail: z.string().url().optional(),
});

coursesRouter.post('/', authenticate, instructor, asyncHandler(async (req, res) => {
  const body = courseBody.parse(req.body);
  res.status(201).json(await prisma.course.create({ data: { ...body, instructorId: req.user!.id } }));
}));

coursesRouter.patch('/:id', authenticate, instructor, asyncHandler(async (req, res) => {
  await requireOwner(req.user!, paramId(req));
  const body = courseBody.partial().extend({ aiTutorEnabled: z.boolean().optional(), integrityMode: z.boolean().optional(), inviteOnly: z.boolean().optional() }).parse(req.body);
  res.json(await prisma.course.update({ where: { id: paramId(req) }, data: body }));
}));

coursesRouter.post('/:id/status', authenticate, instructor, asyncHandler(async (req, res) => {
  const { status } = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'UNPUBLISHED']) }).parse(req.body);
  await requireOwner(req.user!, paramId(req));
  if (status === 'UNPUBLISHED' && req.user!.role !== 'ADMIN') throw new HttpError(403, 'Only an administrator can unpublish a course');
  if (status === 'PUBLISHED') {
    if ((await prisma.lesson.count({ where: { courseId: paramId(req) } })) === 0) throw new HttpError(400, 'Add at least one lesson before publishing');
    // make the AI tutor ready: index every lesson in the background
    indexCourse(paramId(req)).catch((e) => console.error('Index on publish failed', e));
  }
  res.json(await prisma.course.update({ where: { id: paramId(req) }, data: { status } }));
}));

coursesRouter.post('/:id/modules', authenticate, instructor, asyncHandler(async (req, res) => {
  await requireOwner(req.user!, paramId(req));
  const { title } = z.object({ title: z.string().min(2).max(120) }).parse(req.body);
  const position = await prisma.module.count({ where: { courseId: paramId(req) } });
  res.status(201).json(await prisma.module.create({ data: { courseId: paramId(req), title, position } }));
}));

coursesRouter.delete('/:id', authenticate, instructor, asyncHandler(async (req, res) => {
  await requireOwner(req.user!, paramId(req));
  await prisma.course.delete({ where: { id: paramId(req) } });
  res.status(204).end();
}));
