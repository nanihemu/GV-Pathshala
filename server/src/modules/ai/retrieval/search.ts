import { prisma } from '../../../config/db';
import { embed, toVector } from '../llm/embeddings';

export interface Passage {
  id: string;
  lessonId: string;
  lessonTitle: string;
  text: string;
  score: number;
}

// Cosine similarity search inside one course (pgvector: <=> is cosine distance).
export async function searchCourse(courseId: string, query: string, k = 5): Promise<Passage[]> {
  const [qv] = await embed([query], 'query');
  const vec = toVector(qv);
  const rows = await prisma.$queryRaw<
    { id: string; lessonId: string; lessonTitle: string; text: string; score: number | string }[]
  >`
    SELECT c.id, c."lessonId", l.title AS "lessonTitle", c.text,
           1 - (c.embedding <=> ${vec}::vector) AS score
    FROM "ContentChunk" c
    JOIN "Lesson" l ON l.id = c."lessonId"
    WHERE c."courseId" = ${courseId} AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vec}::vector
    LIMIT ${k}`;
  return rows.map((r) => ({ ...r, score: Number(r.score) }));
}
