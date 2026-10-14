import { Role } from '@prisma/client';
import { prisma } from '../../../config/db';
import { aiConfigured, env } from '../../../config/env';
import { HttpError } from '../../../utils/http';
import { courseAccess } from '../../../utils/access';
import { complete } from '../llm/client';
import { searchCourse } from '../retrieval/search';
import { assertTutorRate } from '../guardrails/rateLimit';
import { buildUserTurn, tutorSystemPrompt } from './tutor.prompt';
import { parseAnswer } from './citations';

export const NOT_FOUND_TEXT =
  "I can't find that in this course's material, so I won't guess. Try rephrasing, or post it in the lesson discussion for your instructor.";
export const AI_NOTICE = 'AI-generated answer. It may contain mistakes, so check important details with your instructor.';

export async function askTutor(user: { id: string; role: Role }, input: { courseId: string; lessonId?: string; message: string }) {
  const message = input.message.trim();
  if (!message) throw new HttpError(400, 'Type a question first');
  if (message.length > 1000) throw new HttpError(400, 'Keep your question under 1000 characters');

  const { course } = await courseAccess(user, input.courseId);
  if (!course.aiTutorEnabled) throw new HttpError(403, 'The AI tutor is turned off for this course');
  await assertTutorRate(user.id);

  const lesson = input.lessonId ? await prisma.lesson.findUnique({ where: { id: input.lessonId } }) : null;
  const graded = Boolean(lesson && (lesson.type === 'QUIZ' || lesson.type === 'ASSIGNMENT'));
  const integrity = course.integrityMode && graded;

  await prisma.chatMessage.create({
    data: { userId: user.id, courseId: course.id, lessonId: lesson?.id, role: 'user', text: message },
  });

  const passages = (await searchCourse(course.id, message, 5)).filter((p) => p.score >= env.AI_SIMILARITY_THRESHOLD);

  let text = NOT_FOUND_TEXT;
  let sources: { lessonId: string; lessonTitle: string }[] = [];
  let refused = true;

  if (passages.length > 0) {
    if (!aiConfigured) {
      // No AI key: show the closest passage so the feature still works in demos.
      const top = passages[0];
      text = `The AI model is not configured on this server, so here is the closest passage from "${top.lessonTitle}":\n\n${top.text.slice(0, 600)}`;
      sources = [{ lessonId: top.lessonId, lessonTitle: top.lessonTitle }];
      refused = false;
    } else {
      const history = await prisma.chatMessage.findMany({
        where: { userId: user.id, courseId: course.id, refused: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      // history includes the message just saved; drop it, it is sent with the passages instead
      const asc = history.reverse();
      const last = asc[asc.length - 1];
      if (last && last.role === 'user' && last.text === message) asc.pop();
      const prior = asc.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.text }));
      const raw = await complete({
        kind: 'tutor',
        system: tutorSystemPrompt(course.title, integrity),
        messages: [...prior.slice(-18), { role: 'user', content: buildUserTurn(passages, message) }],
        maxTokens: 700,
      });
      const parsed = parseAnswer(raw, passages);
      if (!parsed.notFound) {
        text = parsed.text;
        sources = parsed.sources;
        refused = false;
      }
    }
  }

  const saved = await prisma.chatMessage.create({
    data: { userId: user.id, courseId: course.id, lessonId: lesson?.id, role: 'assistant', text, sources, refused },
  });
  return { id: saved.id, text, sources, refused, notice: AI_NOTICE, aiGenerated: true };
}

export async function chatHistory(userId: string, courseId: string) {
  return prisma.chatMessage.findMany({
    where: { userId, courseId },
    orderBy: { createdAt: 'asc' },
    take: 60,
    select: { id: true, role: true, text: true, sources: true, rating: true, refused: true, createdAt: true },
  });
}

export async function rateMessage(userId: string, messageId: string, rating: number) {
  const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!msg || msg.userId !== userId || msg.role !== 'assistant') throw new HttpError(404, 'Message not found');
  return prisma.chatMessage.update({ where: { id: messageId }, data: { rating: rating > 0 ? 1 : -1 } });
}
