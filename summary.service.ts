import { prisma } from '../../../config/db';
import { aiConfigured } from '../../../config/env';
import { complete } from '../llm/client';
import { pseudonym, pseudonymMap, restoreNames } from '../guardrails/pseudonymize';
import { atRiskStudents } from './atRisk';
import { courseIndicators } from './indicators';
import { topicsMissed } from './topics';

// Weekly plain-language summary for the instructor, written from analytics data (SRS AIA-5).
// The model only sees pseudonyms; names are restored afterwards. Without AI a plain template is used.
export async function weeklySummary(courseId: string) {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  const [indicators, risk, topics] = await Promise.all([courseIndicators(courseId), atRiskStudents(courseId), topicsMissed(courseId)]);
  const avg = indicators.length ? Math.round(indicators.reduce((s, i) => s + i.progressPct, 0) / indicators.length) : 0;
  const evidence = {
    students: indicators.length,
    averageProgressPct: avg,
    atRisk: risk.map((r) => ({ student: pseudonym(r.userId), reasons: r.reasons })),
    topicsMissed: topics.slice(0, 5),
  };

  let text: string;
  if (aiConfigured) {
    const raw = await complete({
      kind: 'summary',
      system:
        'You write a short weekly summary (under 120 words, plain language, no headings) for a course instructor from the analytics JSON. Mention average progress, who needs attention and why, and the topics most missed, with one suggested action. Use only the data given. Refer to students by the labels in the data.',
      messages: [{ role: 'user', content: `Course: ${course.title}\nData: ${JSON.stringify(evidence)}` }],
      maxTokens: 350,
    });
    const map = pseudonymMap(indicators.map((i) => ({ id: i.userId, name: i.name })));
    text = restoreNames(raw.trim(), map);
  } else {
    text =
      `${indicators.length} students, average progress ${avg}%. ` +
      (risk.length ? `${risk.length} need attention: ${risk.map((r) => `${r.name} (${r.reasons.join(', ')})`).join('; ')}. ` : 'Nobody is flagged this week. ') +
      (topics.length ? `Most missed topic: ${topics[0].topic} (${topics[0].missed} wrong answers).` : '');
  }
  return prisma.insight.create({ data: { courseId, type: 'WEEKLY_SUMMARY', text, evidence } });
}
