import { prisma } from '../config/db';
import { weeklySummary } from '../modules/ai/analyzer/summary.service';

let lastRunDay = '';

// Checks hourly; on Mondays it writes one summary per published course, once.
export function startScheduler() {
  setInterval(async () => {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    if (now.getUTCDay() !== 1 || lastRunDay === day) return;
    lastRunDay = day;
    const courses = await prisma.course.findMany({ where: { status: 'PUBLISHED' }, select: { id: true } });
    for (const c of courses) await weeklySummary(c.id).catch((e) => console.error('Weekly summary failed', c.id, e));
  }, 60 * 60 * 1000).unref();
}
