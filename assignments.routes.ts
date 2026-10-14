import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticate, requireRole } from '../../middleware/auth';
import { upload, uploadDir } from '../../middleware/upload';
import { asyncHandler, HttpError, paramId } from '../../utils/http';
import { lessonOwner, lessonWithAccess, requireOwner } from '../../utils/access';
import { markComplete } from '../lessons/progress.service';
import { notify } from '../notifications/notify';

export const assignmentsRouter = Router();
assignmentsRouter.use(authenticate);
const instructor = requireRole('INSTRUCTOR', 'ADMIN');

// Student: submit a file and/or pasted text. Text lets the instructor use AI feedback drafts.
assignmentsRouter.post('/lessons/:id/assignment/submit', upload.single('file'), asyncHandler(async (req, res) => {
  const { lesson, mode, course } = await lessonWithAccess(req.user!, paramId(req));
  if (lesson.type !== 'ASSIGNMENT') throw new HttpError(400, 'This lesson is not an assignment');
  if (mode !== 'student') throw new HttpError(400, 'Only students can submit');

  let textContent: string | undefined = typeof req.body.textContent === 'string' ? req.body.textContent.slice(0, 50_000) : undefined;
  const file = req.file;
  if (!file && !textContent?.trim()) throw new HttpError(400, 'Attach a file or paste your work');
  if (file && ['.txt', '.md'].includes(path.extname(file.originalname).toLowerCase()) && !textContent)
    textContent = fs.readFileSync(file.path, 'utf8').slice(0, 50_000);

  const existing = await prisma.submission.findUnique({ where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } } });
  if (existing?.gradedAt) throw new HttpError(409, 'This assignment has already been graded');
  const late = !!lesson.dueDate && lesson.dueDate < new Date();

  const data = { fileUrl: file?.filename ?? existing?.fileUrl ?? null, fileName: file?.originalname ?? existing?.fileName ?? null, textContent: textContent ?? existing?.textContent ?? null, late, submittedAt: new Date() };
  const submission = await prisma.submission.upsert({
    where: { userId_lessonId: { userId: req.user!.id, lessonId: lesson.id } },
    create: { userId: req.user!.id, lessonId: lesson.id, ...data }, update: data,
  });
  await markComplete(req.user!.id, lesson.id);
  await notify(course.instructorId, 'SUBMISSION', `New submission for "${lesson.title}"`, `/instructor/lessons/${lesson.id}/submissions`);
  res.status(201).json({ id: submission.id, late });
}));

// Instructor: list submissions for an assignment
assignmentsRouter.get('/lessons/:id/submissions', instructor, asyncHandler(async (req, res) => {
  const { lesson } = await lessonOwner(req.user!, paramId(req));
  const subs = await prisma.submission.findMany({
    where: { lessonId: lesson.id }, orderBy: { submittedAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.json({ lesson: { id: lesson.id, title: lesson.title, maxScore: lesson.maxScore ?? 100, dueDate: lesson.dueDate, body: lesson.body, rubric: lesson.rubric }, submissions: subs });
}));

assignmentsRouter.patch('/submissions/:id/grade', instructor, asyncHandler(async (req, res) => {
  const body = z.object({ score: z.number().min(0), feedback: z.string().max(5000).optional() }).parse(req.body);
  const sub = await prisma.submission.findUnique({ where: { id: paramId(req) }, include: { lesson: true } });
  if (!sub) throw new HttpError(404, 'Submission not found');
  await requireOwner(req.user!, sub.lesson.courseId);
  const max = sub.lesson.maxScore ?? 100;
  if (body.score > max) throw new HttpError(400, `The score cannot be higher than ${max}`);
  const updated = await prisma.submission.update({
    where: { id: sub.id },
    data: { score: body.score, gradedAt: new Date(), ...(body.feedback !== undefined ? { feedback: body.feedback, feedbackAiAssisted: false } : {}) },
  });
  await notify(sub.userId, 'GRADED', `"${sub.lesson.title}" has been graded`, `/lessons/${sub.lessonId}`);
  res.json(updated);
}));

assignmentsRouter.get('/submissions/:id/file', asyncHandler(async (req, res) => {
  const sub = await prisma.submission.findUnique({ where: { id: paramId(req) }, include: { lesson: true } });
  if (!sub || !sub.fileUrl) throw new HttpError(404, 'File not found');
  if (sub.userId !== req.user!.id) await requireOwner(req.user!, sub.lesson.courseId);
  res.download(path.join(uploadDir, sub.fileUrl), sub.fileName ?? sub.fileUrl);
}));
