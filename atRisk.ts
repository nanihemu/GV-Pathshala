import { courseIndicators } from './indicators';

export interface AtRiskStudent {
  userId: string;
  name: string;
  reasons: string[];
  progressPct: number;
  daysInactive: number | null;
}

// Rules from SRS AIA-2: no activity for 7 days, or two failed quiz attempts, or a missed deadline.
export async function atRiskStudents(courseId: string): Promise<AtRiskStudent[]> {
  const rows = await courseIndicators(courseId);
  const out: AtRiskStudent[] = [];
  for (const r of rows) {
    const reasons: string[] = [];
    if (r.daysInactive !== null && r.daysInactive >= 7) reasons.push(`No activity for ${r.daysInactive} days`);
    if (r.failedAttempts >= 2) reasons.push(`Failed ${r.failedAttempts} quiz attempts`);
    if (r.missedDeadlines > 0) reasons.push(`Missed ${r.missedDeadlines} assignment deadline${r.missedDeadlines > 1 ? 's' : ''}`);
    if (reasons.length) out.push({ userId: r.userId, name: r.name, reasons, progressPct: r.progressPct, daysInactive: r.daysInactive });
  }
  return out.sort((a, b) => b.reasons.length - a.reasons.length);
}
