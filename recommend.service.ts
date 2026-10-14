import { prisma } from '../../../config/db';

const DAY = 24 * 60 * 60 * 1000;

// Up to 3 published courses the student is not enrolled in, each with a reason (SRS AIR-1 to AIR-5).
// Scoring: same category as courses they take or finished, their stated interests, then popularity.
export async function recommendFor(userId: string) {
  const [user, enrollments, dismissals] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.enrollment.findMany({ where: { userId }, include: { course: { include: { category: true } } } }),
    prisma.recommendationDismissal.findMany({ where: { userId, until: { gt: new Date() } } }),
  ]);
  const enrolledIds = new Set(enrollments.map((e) => e.courseId));
  const dismissed = new Set(dismissals.map((d) => d.courseId));
  const myCategories = new Map<string, boolean>(); // category name -> has completed a course in it
  for (const e of enrollments) myCategories.set(e.course.category.name, (myCategories.get(e.course.category.name) ?? false) || !!e.completedAt);
  const interests = new Set(user.interests.map((i) => i.toLowerCase()));

  const candidates = await prisma.course.findMany({
    where: { status: 'PUBLISHED', id: { notIn: [...enrolledIds, ...dismissed] } },
    include: { category: true, _count: { select: { enrollments: true } } },
  });

  const scored = candidates.map((c) => {
    let score = Math.min(c._count.enrollments, 50) / 50;
    let reason = 'Popular with other learners';
    if (interests.has(c.category.name.toLowerCase())) {
      score += 3;
      reason = `Matches your interest in ${c.category.name}`;
    }
    if (myCategories.has(c.category.name)) {
      const finished = myCategories.get(c.category.name);
      score += finished ? 4 : 2;
      reason = finished ? `Builds on the ${c.category.name} course you completed` : `Pairs with your current ${c.category.name} course`;
    }
    return { course: c, score, reason };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => ({
      courseId: s.course.id,
      title: s.course.title,
      category: s.course.category.name,
      level: s.course.level,
      reason: s.reason,
    }));
}

export async function dismiss(userId: string, courseId: string) {
  const until = new Date(Date.now() + 30 * DAY);
  return prisma.recommendationDismissal.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, until },
    update: { until },
  });
}
