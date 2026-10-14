import { prisma } from '../../../config/db';

interface Answer { questionId: string; choice: number }

export interface TopicStat { topic: string; missed: number; total: number }

async function tally(attempts: { answers: unknown }[]): Promise<TopicStat[]> {
  const ids = new Set<string>();
  for (const a of attempts) for (const x of a.answers as Answer[]) ids.add(x.questionId);
  const questions = await prisma.question.findMany({ where: { id: { in: [...ids] } } });
  const byId = new Map(questions.map((q) => [q.id, q]));
  const stats = new Map<string, TopicStat>();
  for (const a of attempts) {
    for (const ans of a.answers as Answer[]) {
      const q = byId.get(ans.questionId);
      if (!q) continue;
      const topic = q.topic ?? 'General';
      const s = stats.get(topic) ?? { topic, missed: 0, total: 0 };
      s.total += 1;
      if (ans.choice !== q.correctIndex) s.missed += 1;
      stats.set(topic, s);
    }
  }
  return [...stats.values()].filter((s) => s.missed > 0).sort((a, b) => b.missed - a.missed);
}

// Topics students miss most across a course (SRS AIA-3).
export async function topicsMissed(courseId: string) {
  const attempts = await prisma.quizAttempt.findMany({ where: { lesson: { courseId } } });
  return tally(attempts);
}

export async function studentWeakTopics(userId: string) {
  const attempts = await prisma.quizAttempt.findMany({ where: { userId } });
  return tally(attempts);
}
