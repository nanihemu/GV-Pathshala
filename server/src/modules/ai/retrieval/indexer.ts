import { randomUUID } from 'crypto';
import { prisma } from '../../../config/db';
import { embed, toVector } from '../llm/embeddings';
import { chunkText } from './chunker';

// Re-index one lesson: replace its chunks with fresh ones (SRS AIT-11). Quizzes are never indexed.
export async function indexLesson(lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return 0;
  await prisma.contentChunk.deleteMany({ where: { lessonId } });
  if (lesson.type === 'QUIZ' || !lesson.body.trim()) return 0;

  const chunks = chunkText(lesson.body);
  const vectors = await embed(chunks.map((c) => `${lesson.title}\n${c}`), 'document');
  for (let i = 0; i < chunks.length; i++) {
    await prisma.$executeRaw`
      INSERT INTO "ContentChunk" (id, "courseId", "lessonId", text, embedding, "updatedAt")
      VALUES (${randomUUID()}, ${lesson.courseId}, ${lesson.id}, ${chunks[i]}, ${toVector(vectors[i])}::vector, NOW())`;
  }
  return chunks.length;
}

export async function indexCourse(courseId: string) {
  const lessons = await prisma.lesson.findMany({ where: { courseId }, select: { id: true } });
  let total = 0;
  for (const l of lessons) total += await indexLesson(l.id);
  return total;
}
