import { Router } from 'express';
import { prisma } from '../../config/db';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, HttpError, paramId } from '../../utils/http';

export const enrollmentsRouter = Router(); // mounted at /api
enrollmentsRouter.use(authenticate);

enrollmentsRouter.post('/courses/:id/enroll', asyncHandler(async (req, res) => {
  const course = await prisma.course.findUnique({ where: { id: paramId(req) } });
  if (!course || course.status !== 'PUBLISHED') throw new HttpError(404, 'Course not found');
  if (course.inviteOnly) throw new HttpError(403, 'This course is invite-only');
  const e = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: req.user!.id, courseId: course.id } },
    create: { userId: req.user!.id, courseId: course.id }, update: {},
  });
  res.status(201).json(e);
}));

// Progress is kept, so enrolling again later picks up where the student left off (SRS ENR-4).
enrollmentsRouter.delete('/courses/:id/enroll', asyncHandler(async (req, res) => {
  await prisma.enrollment.deleteMany({ where: { userId: req.user!.id, courseId: paramId(req) } });
  res.status(204).end();
}));

enrollmentsRouter.get('/enrollments/mine', asyncHandler(async (req, res) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: req.user!.id, course: { status: 'PUBLISHED' } },
    include: {
      course: {
        include: {
          category: true, instructor: { select: { name: true } },
          lessons: { select: { id: true, title: true, type: true, position: true, module: { select: { position: true } } } },
        },
      },
    },
    orderBy: { enrolledAt: 'desc' },
  });
  const done = await prisma.lessonProgress.findMany({ where: { userId: req.user!.id, completed: true }, select: { lessonId: true } });
  const doneSet = new Set(done.map((d) => d.lessonId));
  res.json(enrollments.map((e) => {
    const ordered = [...e.course.lessons].sort((a, b) => a.module.position - b.module.position || a.position - b.position);
    const completed = ordered.filter((l) => doneSet.has(l.id)).length;
    const next = ordered.find((l) => !doneSet.has(l.id)) ?? ordered[0] ?? null;
    return {
      courseId: e.courseId, title: e.course.title, category: e.course.category.name, instructor: e.course.instructor.name,
      total: ordered.length, completed, completedAt: e.completedAt,
      lessonStates: ordered.map((l) => ({ id: l.id, done: doneSet.has(l.id) })),
      next: next && { id: next.id, title: next.title, type: next.type },
    };
  }));
}));

enrollmentsRouter.get('/courses/:id/progress', asyncHandler(async (req, res) => {
  const lessons = await prisma.lesson.count({ where: { courseId: paramId(req) } });
  const done = await prisma.lessonProgress.count({ where: { userId: req.user!.id, completed: true, lesson: { courseId: paramId(req) } } });
  res.json({ total: lessons, completed: done, percent: lessons ? Math.round((done / lessons) * 100) : 0 });
}));
