import { prisma } from '../../config/db';
import { notify } from '../notifications/notify';

// Marks a lesson complete and, when every lesson in the course is done, completes the enrollment.
export async function markComplete(userId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, completed: true },
    update: { completed: true },
  });
  const [total, done, enrollment] = await Promise.all([
    prisma.lesson.count({ where: { courseId: lesson.courseId } }),
    prisma.lessonProgress.count({ where: { userId, completed: true, lesson: { courseId: lesson.courseId } } }),
    prisma.enrollment.findUnique({ where: { userId_courseId: { userId, courseId: lesson.courseId } } }),
  ]);
  if (enrollment && !enrollment.completedAt && total > 0 && done >= total) {
    await prisma.enrollment.update({ where: { id: enrollment.id }, data: { completedAt: new Date() } });
    await notify(userId, 'COURSE_COMPLETE', 'You finished the course. Your certificate is ready.', `/courses/${lesson.courseId}`);
  }
  return { done, total };
}
