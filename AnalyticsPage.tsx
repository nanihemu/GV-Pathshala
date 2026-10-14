import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ErrorNote, Loading, Pill } from '../../components/ui';

interface CourseInsights {
  indicators: { userId: string; name: string; progressPct: number; daysInactive: number | null; failedAttempts: number; missedDeadlines: number }[];
  atRisk: { userId: string; name: string; reasons: string[]; progressPct: number }[];
  topics: { topic: string; missed: number; total: number }[];
  summary: { text: string; generatedAt: string } | null;
}
interface Report { helpful: number; notHelpful: number; answers: number; refused: number; recentQuestions: { text: string }[] }

export default function AnalyticsPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['course-insights', id], queryFn: () => api<CourseInsights>(`/ai/insights/course/${id}`) });
  const report = useQuery({ queryKey: ['tutor-report', id], queryFn: () => api<Report>(`/ai/tutor/report/${id}`) });
  const gen = useMutation({
    mutationFn: () => api(`/ai/insights/course/${id}/summary`, { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['course-insights', id] }),
  });
  if (data.isLoading) return <Loading />;
  const d = data.data;
  if (!d) return <ErrorNote error={data.error} />;
  const maxMissed = Math.max(1, ...d.topics.map((t) => t.missed));

  return (
    <>
      <div className="crumbs"><Link to={`/instructor/courses/${id}`}>Course builder</Link> / Analytics</div>
      <h1>Course analytics</h1>
      <p className="sub">Who needs help, which topics are hard, and how the AI tutor is doing.</p>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="row between"><h2>Weekly summary</h2><Pill>AI-written from the data below</Pill></div>
        <p style={{ marginTop: 12, maxWidth: '70ch' }}>{d.summary?.text ?? 'No summary yet. Generate one to get a plain-language overview.'}</p>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn sm" onClick={() => gen.mutate()} disabled={gen.isPending}>{gen.isPending ? 'Writing…' : 'Generate summary'}</button>
          {d.summary && <span className="meta">Last written {new Date(d.summary.generatedAt).toLocaleDateString('en-IN')}</span>}
        </div>
        <ErrorNote error={gen.error} />
      </section>

      <div className="grid2">
        <section className="card">
          <h2>At risk</h2>
          {d.atRisk.length === 0 ? <p className="meta" style={{ marginTop: 10 }}>Nobody is flagged right now.</p> : (
            <div className="list" style={{ marginTop: 12 }}>
              {d.atRisk.map((s) => (
                <div className="item" key={s.userId} style={{ alignItems: 'flex-start' }}>
                  <span style={{ flex: 1 }}><span className="t">{s.name}</span><br />{s.reasons.map((r) => <Pill key={r} tone="warn">{r}</Pill>)}</span>
                  <span className="meta">{s.progressPct}% done</span>
                </div>
              ))}
            </div>
          )}
          <p className="note">Flags use fixed rules: 7 days without activity, 2 failed quiz attempts, or a missed deadline.</p>
        </section>
        <section className="card">
          <h2>Topics missed most</h2>
          {d.topics.length === 0 ? <p className="meta" style={{ marginTop: 10 }}>No quiz data yet.</p> : d.topics.map((t) => (
            <div key={t.topic} style={{ marginTop: 14 }}>
              <div className="row between"><span className="t">{t.topic}</span><span className="meta">{t.missed} of {t.total} wrong</span></div>
              <div className="bar" style={{ width: `${(t.missed / maxMissed) * 100}%`, marginTop: 4 }} />
            </div>
          ))}
        </section>
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <h2>Students</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Name</th><th>Progress</th><th>Days inactive</th><th>Failed attempts</th><th>Missed deadlines</th></tr></thead>
          <tbody>{d.indicators.map((s) => <tr key={s.userId}><td>{s.name}</td><td>{s.progressPct}%</td><td>{s.daysInactive ?? '-'}</td><td>{s.failedAttempts}</td><td>{s.missedDeadlines}</td></tr>)}</tbody>
        </table></div>
      </section>

      <section className="card" style={{ marginTop: 20 }}>
        <h2>AI tutor report</h2>
        {report.data && (
          <p style={{ marginTop: 10 }}>
            {report.data.answers} answers, {report.data.helpful} rated helpful, {report.data.notHelpful} not helpful, {report.data.refused} declined because the course material had no answer.
          </p>
        )}
        <p className="note">Many declined questions means a topic is missing from your lessons. Add notes or a transcript, then the tutor can answer.</p>
        {!!report.data?.recentQuestions.length && (
          <><h3 style={{ marginTop: 14 }}>Recent student questions</h3>
          <ul>{report.data.recentQuestions.map((q, i) => <li key={i} className="meta">{q.text}</li>)}</ul></>
        )}
      </section>
    </>
  );
}
