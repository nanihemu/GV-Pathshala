import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler, HttpError, paramId } from '../../utils/http';
import { lessonOwner, lessonWithAccess, requireOwner } from '../../utils/access';
import { askTutor, chatHistory, rateMessage } from './tutor/tutor.service';
import { draftQuestions, practiceQuestions } from './generator/questions.service';
import { draftFeedback, reviewDraft } from './generator/feedback.service';
import { atRiskStudents } from './analyzer/atRisk';
import { courseIndicators, studentInsights } from './analyzer/indicators';
import { studentWeakTopics, topicsMissed } from './analyzer/topics';
import { weeklySummary } from './analyzer/summary.service';
import { dismiss, recommendFor } from './recommender/recommend.service';
import { indexCourse } from './retrieval/indexer';

export const aiRouter = Router();
aiRouter.use(authenticate);
const instructor = requireRole('INSTRUCTOR', 'ADMIN');

// ---------- AI tutor ----------
aiRouter.post('/tutor', asyncHandler(async (req, res) => {
  const body = z.object({ courseId: z.string(), lessonId: z.string().optional(), message: z.string() }).parse(req.body);
  res.json(await askTutor(req.user!, body));
}));

aiRouter.get('/tutor/history', asyncHandler(async (req, res) => {
  const courseId = z.string().parse(req.query.courseId);
  res.json(await chatHistory(req.user!.id, courseId));
}));

aiRouter.post('/tutor/:id/rating', asyncHandler(async (req, res) => {
  const { rating } = z.object({ rating: z.number() }).parse(req.body);
  await rateMessage(req.user!.id, paramId(req), rating);
  res.json({ ok: true });
}));

// Instructor report: how helpful were the answers, and which questions could not be answered
aiRouter.get('/tutor/report/:courseId', instructor, asyncHandler(async (req, res) => {
  const courseId = paramId(req, 'courseId');
  await requireOwner(req.user!, courseId);
  const [up, down, refused, total, unanswered] = await Promise.all([
    prisma.chatMessage.count({ where: { courseId, rating: 1 } }),
    prisma.chatMessage.count({ where: { courseId, rating: -1 } }),
    prisma.chatMessage.count({ where: { courseId, role: 'assistant', refused: true } }),
    prisma.chatMessage.count({ where: { courseId, role: 'assistant' } }),
    prisma.chatMessage.findMany({ where: { courseId, role: 'user' }, orderBy: { createdAt: 'desc' }, take: 200, select: { text: true, createdAt: true } }),
  ]);
  res.json({ helpful: up, notHelpful: down, answers: total, refused, recentQuestions: unanswered.slice(0, 20) });
}));

// ---------- Practice questions (student, ungraded) ----------
aiRouter.post('/practice', asyncHandler(async (req, res) => {
  const { lessonId, count } = z.object({ lessonId: z.string(), count: z.number().int().min(1).max(5).default(3) }).parse(req.body);
  await lessonWithAccess(req.user!, lessonId);
  res.json({ aiGenerated: true, questions: await practiceQuestions(lessonId, count) });
}));

// ---------- Quiz question generator (instructor) ----------
aiRouter.post('/generate-questions', instructor, asyncHandler(async (req, res) => {
  const body = z.object({
    sourceLessonId: z.string(),
    quizLessonId: z.string(),
    count: z.number().int().min(1).max(10).default(5),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  }).parse(req.body);
  const [a, b] = await Promise.all([lessonOwner(req.user!, body.sourceLessonId), lessonOwner(req.user!, body.quizLessonId)]);
  if (b.lesson.type !== 'QUIZ') throw new HttpError(400, 'The target lesson must be a quiz');
  if (a.lesson.courseId !== b.lesson.courseId) throw new HttpError(400, 'Both lessons must be in the same course');
  res.status(201).json(await draftQuestions(body));
}));

// ---------- Assignment feedback drafts (instructor) ----------
aiRouter.post('/feedback-draft', instructor, asyncHandler(async (req, res) => {
  const { submissionId } = z.object({ submissionId: z.string() }).parse(req.body);
  const sub = await prisma.submission.findUnique({ where: { id: submissionId }, include: { lesson: true } });
  if (!sub) throw new HttpError(404, 'Submission not found');
  await requireOwner(req.user!, sub.lesson.courseId);
  res.status(201).json(await draftFeedback(submissionId));
}));

aiRouter.get('/feedback-drafts', instructor, asyncHandler(async (req, res) => {
  const submissionId = z.string().parse(req.query.submissionId);
  const sub = await prisma.submission.findUnique({ where: { id: submissionId }, include: { lesson: true } });
  if (!sub) throw new HttpError(404, 'Submission not found');
  await requireOwner(req.user!, sub.lesson.courseId);
  res.json(await prisma.aiFeedbackDraft.findMany({ where: { submissionId }, orderBy: { createdAt: 'desc' } }));
}));

aiRouter.patch('/feedback-drafts/:id', instructor, asyncHandler(async (req, res) => {
  const body = z.object({
    action: z.enum(['approve', 'reject']),
    edits: z.object({ strengths: z.string().optional(), improvements: z.string().optional() }).optional(),
  }).parse(req.body);
  const draft = await prisma.aiFeedbackDraft.findUnique({ where: { id: paramId(req) }, include: { submission: { include: { lesson: true } } } });
  if (!draft) throw new HttpError(404, 'Draft not found');
  await requireOwner(req.user!, draft.submission.lesson.courseId);
  res.json(await reviewDraft(draft.id, req.user!.id, body.action, body.edits));
}));

// ---------- Analyzer ----------
aiRouter.get('/insights/student', asyncHandler(async (req, res) => {
  const insights = await studentInsights(req.user!.id);
  if (insights.optedOut) return res.json(insights);
  res.json({ ...insights, weakTopics: await studentWeakTopics(req.user!.id) });
}));

aiRouter.put('/insights/opt-out', asyncHandler(async (req, res) => {
  const { optOut } = z.object({ optOut: z.boolean() }).parse(req.body);
  await prisma.user.update({ where: { id: req.user!.id }, data: { insightsOptOut: optOut } });
  res.json({ optOut });
}));

aiRouter.get('/insights/course/:id', instructor, asyncHandler(async (req, res) => {
  const courseId = paramId(req);
  await requireOwner(req.user!, courseId);
  const [indicators, atRisk, topics, summary] = await Promise.all([
    courseIndicators(courseId),
    atRiskStudents(courseId),
    topicsMissed(courseId),
    prisma.insight.findFirst({ where: { courseId, type: 'WEEKLY_SUMMARY' }, orderBy: { generatedAt: 'desc' } }),
  ]);
  res.json({ indicators, atRisk, topics, summary });
}));

aiRouter.post('/insights/course/:id/summary', instructor, asyncHandler(async (req, res) => {
  await requireOwner(req.user!, paramId(req));
  res.status(201).json(await weeklySummary(paramId(req)));
}));

// ---------- Recommendations ----------
aiRouter.get('/recommendations', asyncHandler(async (req, res) => {
  res.json(await recommendFor(req.user!.id));
}));

aiRouter.post('/recommendations/:courseId/dismiss', asyncHandler(async (req, res) => {
  await dismiss(req.user!.id, paramId(req, 'courseId'));
  res.json({ ok: true });
}));

// ---------- Index maintenance ----------
aiRouter.post('/reindex/:courseId', instructor, asyncHandler(async (req, res) => {
  await requireOwner(req.user!, paramId(req, 'courseId'));
  res.json({ chunks: await indexCourse(paramId(req, 'courseId')) });
}));
