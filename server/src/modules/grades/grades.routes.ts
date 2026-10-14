import { Router } from 'express';
import { prisma } from '../../config/db';
import { authenticate, requireRole } from '../../middleware/auth';
import { asyncHandler, paramId } from '../../utils/http';
import { requireOwner } from '../../utils/access';

export const gradesRouter = Router();
gradesRouter.use(authenticate);

// Student gradebook: best quiz result and assignment status for every enrolled course (SRS ASG-6)
gradesRouter.get('/', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const lessons = await prisma.lesson.findMany({
    where: { type: { in: ['QUIZ', 'ASSIGNMENT'] }, course: { enrollments: { some: { userId } }, status: 'PUBLISHED' } },
    include: { course: { select: { title: true } } }, orderBy: [{ courseId: 'asc' }, { position: 'asc' }],
  });
  const ids = lessons.map((l) => l.id);
  const [attempts, subs] = await Promise.all([
    prisma.quizAttempt.findMany({ where: { userId, lessonId: { in: ids } } }),
    prisma.submission.findMany({ where: { userId, lessonId: { in: ids } } }),
  ]);
  res.json(lessons.map((l) => {
    const base = { lessonId: l.id, title: l.title, course: l.course.title, type: l.type, dueDate: l.dueDate };
    if (l.type === 'QUIZ') {
      const mine = attempts.filter((a) => a.lessonId === l.id);
      const best = mine.sort((a, b) => b.score / b.total - a.score / a.total)[0];
      return { ...base, status: best ? (best.passed ? 'PASSED' : 'NOT_PASSED') : 'NOT_STARTED', score: best?.score ?? null, total: best?.total ?? null, attempts: mine.length };
    }
    const s = subs.find((x) => x.lessonId === l.id);
    return { ...base, status: s ? (s.gradedAt ? 'GRADED' : 'SUBMITTED') : 'NOT_STARTED', score: s?.score ?? null, total: l.maxScore ?? 100, late: s?.late ?? false, feedback: s?.feedback ?? null, feedbackAiAssisted: s?.feedbackAiAssisted ?? false };
  }));
}));

// Instructor: course gradebook as CSV
gradesRouter.get('/course/:id/export.csv', requireRole('INSTRUCTOR', 'ADMIN'), asyncHandler(async (req, res) => {
  const courseId = paramId(req);
  await requireOwner(req.user!, courseId);
  const [lessons, enrollments] = await Promise.all([
    prisma.lesson.findMany({ where: { courseId, type: { in: ['QUIZ', 'ASSIGNMENT'] } }, orderBy: { position: 'asc' } }),
    prisma.enrollment.findMany({ where: { courseId }, include: { user: { select: { id: true, name: true, email: true } } } }),
  ]);
  const ids = lessons.map((l) => l.id);
  const [attempts, subs] = await Promise.all([
    prisma.quizAttempt.findMany({ where: { lessonId: { in: ids } } }),
    prisma.submission.findMany({ where: { lessonId: { in: ids } } }),
  ]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Name', 'Email', ...lessons.map((l) => l.title)].map(esc).join(',')];
  for (const e of enrollments) {
    const cells = lessons.map((l) => {
      if (l.type === 'QUIZ') {
        const best = attempts.filter((a) => a.userId === e.userId && a.lessonId === l.id).sort((a, b) => b.score / b.total - a.score / a.total)[0];
        return best ? `${best.score}/${best.total}` : '';
      }
      return subs.find((s) => s.userId === e.userId && s.lessonId === l.id)?.score ?? '';
    });
    rows.push([e.user.name, e.user.email, ...cells].map(esc).join(','));
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="gradebook.csv"');
  res.send(rows.join('\n'));
}));
