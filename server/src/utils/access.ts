import { Role } from '@prisma/client';
import { prisma } from '../config/db';
import { HttpError } from './http';

type U = { id: string; role: Role };

// Who may open a course's content: the admin, the owner, or an enrolled student of a published course.
export async function courseAccess(user: U, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new HttpError(404, 'Course not found');
  if (user.role === 'ADMIN') return { course, mode: 'admin' as const };
  if (course.instructorId === user.id) return { course, mode: 'owner' as const };
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
  });
  if (enrollment && course.status === 'PUBLISHED') return { course, mode: 'student' as const };
  throw new HttpError(403, 'Enroll in this course to open its content');
}

export async function requireOwner(user: U, courseId: string) {
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new HttpError(404, 'Course not found');
  if (user.role !== 'ADMIN' && course.instructorId !== user.id)
    throw new HttpError(403, 'Only the course instructor can do this');
  return course;
}

export async function lessonWithAccess(user: U, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  const access = await courseAccess(user, lesson.courseId);
  return { lesson, ...access };
}

export async function lessonOwner(user: U, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new HttpError(404, 'Lesson not found');
  const course = await requireOwner(user, lesson.courseId);
  return { lesson, course };
}
