import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler, HttpError, paramId } from '../../utils/http';
import { lessonOwner, lessonWithAccess, requireOwner } from '../../utils/access';
import { markComplete } from '../lessons/progress.service';

export const quizzesRouter = Router();
quizzesRouter.use(authenticate);
const instructor = requireRole('INSTRUCTOR', 'ADMIN');

interface Answer { questionId: string; choice: number }

async function quizLesson(user: { id: string; role: any }, lessonId: string) {
  const r = await lessonWithAccess(user, lessonId);
  if (r.lesson.type !== 'QUIZ') throw new HttpError(400, 'This lesson is not a quiz');
  return r;
}

// Students get approved questions without answers. Instructors get everything, including drafts.
quizzesRouter.get('/lessons/:id/quiz', asyncHandler(async (req, res) => {
  const { lesson, mode } = await quizLesson(req.user!, paramId(req));
  const settings = { passMark: lesson.passMark ?? 60, maxAttempts: lesson.maxAttempts ?? null, timeLimitMin: lesson.timeLimitMin ?? null };
  if (mode !== 'student') {
    const questions = await prisma.question.findMany({ where: { lessonId: lesson.id }, orderBy: { createdAt: 'asc' } });
    return res.json({ settings, questions });
  }
  const questions = await prisma.question.findMany({ where: { lessonId: lesson.id, status: 'APPROVED' }, orderBy: { createdAt: 'asc' } });
  const attempts = await prisma.quizAttempt.findMany({ where: { userId: req.user!.id, lessonId: lesson.id }, orderBy: { takenAt: 'desc' } });
  res.json({
    settings,
    attemptsUsed: attempts.length,
    lastAttempt: attempts[0] && { score: attempts[0].score, total: attempts[0].total, passed: attempts[0].passed, takenAt: attempts[0].takenAt },
    questions: questions.map((q) => ({ id: q.id, text: q.text, options: q.options, topic: q.topic })),
  });
}));

quizzesRouter.post('/lessons/:id/quiz/attempt', asyncHandler(async (req, res) => {
  const { lesson, mode } = await quizLesson(req.user!, paramId(req));
  if (mode !== 'student') throw new HttpError(400, 'Only students can take quizzes');
  const { answers } = z.object({ answers: z.array(z.object({ questionId: z.string(), choice: z.number().int().min(0).max(3) })) }).parse(req.body);

  if (lesson.maxAttempts) {
    const used = await prisma.quizAttempt.count({ where: { userId: req.user!.id, lessonId: lesson.id } });
    if (used >= lesson.maxAttempts) throw new HttpError(403, `You have used all ${lesson.maxAttempts} attempts`);
  }
  const questions = await prisma.question.findMany({ where: { lessonId: lesson.id, status: 'APPROVED' } });
  if (!questions.length) throw new HttpError(400, 'This quiz has no questions yet');
  const given = new Map(answers.map((a) => [a.questionId, a.choice]));
  const score = questions.filter((q) => given.get(q.id) === q.correctIndex).length;
  const percent = Math.round((score / questions.length) * 100);
  const passed = percent >= (lesson.passMark ?? 60);

  await prisma.quizAttempt.create({
    data: { userId: req.user!.id, lessonId: lesson.id, answers: answers as unknown as Prisma.InputJsonValue, score, total: questions.length, passed },
  });
  if (passed) await markComplete(req.user!.id, lesson.id);
  res.json({
    score, total: questions.length, percent, passed, passMark: lesson.passMark ?? 60,
    review: questions.map((q) => ({ questionId: q.id, text: q.text, options: q.options, correctIndex: q.correctIndex, yourChoice: given.get(q.id) ?? null, explanation: q.explanation })),
  });
}));

// ---------- Question management (instructor) ----------
const questionBody = z.object({
  text: z.string().min(5).max(500),
  options: z.array(z.string().min(1).max(200)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().max(500).optional(),
  topic: z.string().max(60).optional(),
});

quizzesRouter.post('/lessons/:id/quiz/questions', instructor, asyncHandler(async (req, res) => {
  const { lesson } = await lessonOwner(req.user!, paramId(req));
  if (lesson.type !== 'QUIZ') throw new HttpError(400, 'This lesson is not a quiz');
  const body = questionBody.parse(req.body);
  res.status(201).json(await prisma.question.create({ data: { ...body, lessonId: lesson.id, status: 'APPROVED', source: 'MANUAL' } }));
}));

// Edit a question, or approve / reject an AI draft
quizzesRouter.patch('/questions/:id', instructor, asyncHandler(async (req, res) => {
  const q = await prisma.question.findUnique({ where: { id: paramId(req) }, include: { lesson: true } });
  if (!q) throw new HttpError(404, 'Question not found');
  await requireOwner(req.user!, q.lesson.courseId);
  const body = questionBody.partial().extend({ status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() }).parse(req.body);
  res.json(await prisma.question.update({ where: { id: q.id }, data: body }));
}));

quizzesRouter.delete('/questions/:id', instructor, asyncHandler(async (req, res) => {
  const q = await prisma.question.findUnique({ where: { id: paramId(req) }, include: { lesson: true } });
  if (!q) throw new HttpError(404, 'Question not found');
  await requireOwner(req.user!, q.lesson.courseId);
  await prisma.question.delete({ where: { id: q.id } });
  res.status(204).end();
}));
