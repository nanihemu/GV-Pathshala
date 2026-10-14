import { prisma } from '../../../config/db';

export interface StudentIndicator {
  userId: string;
  name: string;
  progressPct: number;
  lastActivity: Date | null;
  daysInactive: number | null;
  failedAttempts: number;
  missedDeadlines: number;
}

const DAY = 24 * 60 * 60 * 1000;

// Per-student indicators for one course: progress, last activity, quiz trend, missed deadlines (SRS AIA-1).
export async function courseIndicators(courseId: string): Promise<StudentIndicator[]> {
  const [lessons, enrollments] = await Promise.all([
    prisma.lesson.findMany({ where: { courseId }, select: { id: true, type: true, dueDate: true } }),
    prisma.enrollment.findMany({ where: { courseId }, include: { user: { select: { id: true, name: true } } } }),
  ]);
  const ids = lessons.map((l) => l.id);
  const [progress, attempts, subs] = await Promise.all([
    prisma.lessonProgress.findMany({ where: { lessonId: { in: ids } } }),
    prisma.quizAttempt.findMany({ where: { lessonId: { in: ids } }, orderBy: { takenAt: 'asc' } }),
    prisma.submission.findMany({ where: { lessonId: { in: ids } } }),
  ]);
  const now = Date.now();
  return enrollments.map((e) => {
    const uid = e.userId;
    const done = progress.filter((p) => p.userId === uid && p.completed).length;
    const mine = attempts.filter((a) => a.userId === uid);
    const stamps = [
      e.enrolledAt,
      ...progress.filter((p) => p.userId === uid).map((p) => p.updatedAt),
      ...mine.map((a) => a.takenAt),
      ...subs.filter((s) => s.userId === uid).map((s) => s.submittedAt),
    ];
    const last = stamps.reduce<Date | null>((m, d) => (!m || d > m ? d : m), null);
    // quizzes whose most recent attempt was not passed
    const latestByLesson = new Map<string, boolean>();
    for (const a of mine) latestByLesson.set(a.lessonId, a.passed);
    const failedAttempts = mine.filter((a) => !a.passed).length;
    const missed = lessons.filter(
      (l) => l.type === 'ASSIGNMENT' && l.dueDate && l.dueDate.getTime() < now && !subs.some((s) => s.userId === uid && s.lessonId === l.id)
    ).length;
    return {
      userId: uid,
      name: e.user.name,
      progressPct: lessons.length ? Math.round((done / lessons.length) * 100) : 0,
      lastActivity: last,
      daysInactive: last ? Math.floor((now - last.getTime()) / DAY) : null,
      failedAttempts,
      missedDeadlines: missed,
    };
  });
}

// Student-facing insights: pace and finishing date, plus the evidence they are based on (SRS AIA-4, AIA-6).
export async function studentInsights(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.insightsOptOut) return { optedOut: true as const };

  const enrollments = await prisma.enrollment.findMany({ where: { userId, completedAt: null }, include: { course: true } });
  const since = new Date(Date.now() - 14 * DAY);
  const courses = [];
  for (const e of enrollments) {
    const total = await prisma.lesson.count({ where: { courseId: e.courseId } });
    const done = await prisma.lessonProgress.count({ where: { userId, completed: true, lesson: { courseId: e.courseId } } });
    const recent = await prisma.lessonProgress.count({
      where: { userId, completed: true, updatedAt: { gte: since }, lesson: { courseId: e.courseId } },
    });
    const perWeek = recent / 2;
    const left = total - done;
    const weeks = perWeek > 0 ? Math.ceil(left / perWeek) : null;
    courses.push({
      courseId: e.courseId,
      title: e.course.title,
      lessonsLeft: left,
      lessonsPerWeek: Math.round(perWeek * 10) / 10,
      estimatedFinish: weeks !== null ? new Date(Date.now() + weeks * 7 * DAY) : null,
      evidence: `${done} of ${total} lessons finished, ${recent} in the last 14 days.`,
    });
  }
  return { optedOut: false as const, courses };
}
