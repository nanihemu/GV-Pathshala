import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler, HttpError, paramId } from '../../utils/http';
import { lessonOwner, lessonWithAccess, requireOwner } from '../../utils/access';
import { queueIndex } from '../../jobs/indexContent.job';
import { markComplete } from './progress.service';

export const lessonsRouter = Router();
export const modulesRouter = Router();
lessonsRouter.use(authenticate);
modulesRouter.use(authenticate);
const instructor = requireRole('INSTRUCTOR', 'ADMIN');

const lessonBody = z.object({
  title: z.string().min(2).max(120),
  type: z.enum(['VIDEO', 'READING', 'QUIZ', 'ASSIGNMENT']),
  body: z.string().max(100_000).default(''),
  contentUrl: z.string().url().optional(),
  durationMin: z.number().int().min(1).max(600).default(5),
  passMark: z.number().int().min(1).max(100).optional(),
  maxAttempts: z.number().int().min(1).max(20).optional(),
  timeLimitMin: z.number().int().min(1).max(300).optional(),
  dueDate: z.coerce.date().optional(),
  maxScore: z.number().int().min(1).max(1000).optional(),
  rubric: z.string().max(5000).optional(),
});

// ---------- Authoring ----------
modulesRouter.post('/:id/lessons', instructor, asyncHandler(async (req, res) => {
  const mod = await prisma.module.findUnique({ where: { id: paramId(req) } });
  if (!mod) throw new HttpError(404, 'Module not found');
  await requireOwner(req.user!, mod.courseId);
  const body = lessonBody.parse(req.body);
  const position = await prisma.lesson.count({ where: { moduleId: mod.id } });
  const lesson = await prisma.lesson.create({ data: { ...body, moduleId: mod.id, courseId: mod.courseId, position } });
  queueIndex(lesson.id);
  res.status(201).json(lesson);
}));

modulesRouter.put('/:id/order', instructor, asyncHandler(async (req, res) => {
  const mod = await prisma.module.findUnique({ where: { id: paramId(req) } });
  if (!mod) throw new HttpError(404, 'Module not found');
  await requireOwner(req.user!, mod.courseId);
  const { lessonIds } = z.object({ lessonIds: z.array(z.string()) }).parse(req.body);
  await prisma.$transaction(lessonIds.map((id, position) => prisma.lesson.updateMany({ where: { id, moduleId: mod.id }, data: { position } })));
  res.json({ ok: true });
}));

modulesRouter.delete('/:id', instructor, asyncHandler(async (req, res) => {
  const mod = await prisma.module.findUnique({ where: { id: paramId(req) } });
  if (!mod) throw new HttpError(404, 'Module not found');
  await requireOwner(req.user!, mod.courseId);
  await prisma.module.delete({ where: { id: mod.id } });
  res.status(204).end();
}));

lessonsRouter.patch('/:id', instructor, asyncHandler(async (req, res) => {
  const { lesson } = await lessonOwner(req.user!, paramId(req));
  const body = lessonBody.partial().parse(req.body);
  const updated = await prisma.lesson.update({ where: { id: lesson.id }, data: body });
  if (body.body !== undefined || body.title !== undefined) queueIndex(lesson.id); // keep the tutor's knowledge fresh
  res.json(updated);
}));

lessonsRouter.delete('/:id', instructor, asyncHandler(async (req, res) => {
  const { lesson } = await lessonOwner(req.user!, paramId(req));
  await prisma.lesson.delete({ where: { id: lesson.id } });
  res.status(204).end();
}));

// ---------- Learning ----------
lessonsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { lesson, mode, course } = await lessonWithAccess(req.user!, paramId(req));
  const all = await prisma.lesson.findMany({
    where: { courseId: lesson.courseId },
    select: { id: true, module: { select: { position: true } }, position: true },
  });
  all.sort((a, b) => a.module.position - b.module.position || a.position - b.position);
  const i = all.findIndex((l) => l.id === lesson.id);
  const progress = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } } });
  const submission =
    lesson.type === 'ASSIGNMENT' && mode === 'student'
      ? await prisma.submission.findUnique({ where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } } })
      : null;
  res.json({
    ...lesson, mode, courseTitle: course.title, aiTutorEnabled: course.aiTutorEnabled,
    completed: progress?.completed ?? false, lastPosition: progress?.lastPosition ?? 0,
    prevId: all[i - 1]?.id ?? null, nextId: all[i + 1]?.id ?? null,
    // feedback is the instructor-approved text only; AI drafts live in another table
    submission: submission && { id: submission.id, fileName: submission.fileName, submittedAt: submission.submittedAt, late: submission.late, score: submission.score, feedback: submission.feedback, feedbackAiAssisted: submission.feedbackAiAssisted, gradedAt: submission.gradedAt },
  });
}));

lessonsRouter.post('/:id/complete', asyncHandler(async (req, res) => {
  const { lesson, mode } = await lessonWithAccess(req.user!, paramId(req));
  if (mode !== 'student') throw new HttpError(400, 'Only students track progress');
  if (lesson.type === 'QUIZ' || lesson.type === 'ASSIGNMENT') throw new HttpError(400, 'This lesson is completed by passing the quiz or submitting the assignment');
  res.json(await markComplete(req.user!.id, lesson.id));
}));

// Video position, saved so playback resumes. Watching 90% completes the lesson (SRS LRN-1, LRN-2).
lessonsRouter.put('/:id/position', asyncHandler(async (req, res) => {
  const { seconds } = z.object({ seconds: z.number().min(0) }).parse(req.body);
  const { lesson, mode } = await lessonWithAccess(req.user!, paramId(req));
  if (mode !== 'student') return res.json({ ok: true });
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
    create: { userId: req.user!.id, lessonId: lesson.id, lastPosition: Math.floor(seconds) },
    update: { lastPosition: Math.floor(seconds) },
  });
  if (lesson.type === 'VIDEO' && seconds >= lesson.durationMin * 60 * 0.9) await markComplete(req.user!.id, lesson.id);
  res.json({ ok: true });
}));
