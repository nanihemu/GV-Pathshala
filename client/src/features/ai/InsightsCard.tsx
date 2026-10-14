import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Loading, Pill } from '../../components/ui';

interface Insights {
  optedOut: boolean;
  courses?: { courseId: string; title: string; lessonsLeft: number; lessonsPerWeek: number; estimatedFinish: string | null; evidence: string }[];
  weakTopics?: { topic: string; missed: number; total: number }[];
}

export function InsightsCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['insights'], queryFn: () => api<Insights>('/ai/insights/student') });
  const optOut = useMutation({
    mutationFn: (v: boolean) => api('/ai/insights/opt-out', { method: 'PUT', body: { optOut: v } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insights'] }),
  });
  if (q.isLoading) return <Loading />;
  const d = q.data;
  return (
    <section className="card">
      <div className="row between"><h2>Learning insights</h2><Pill>AI analyzer</Pill></div>
      {d?.optedOut ? (
        <p className="meta" style={{ marginTop: 12 }}>Personal insights are turned off.</p>
      ) : (
        <>
          {d?.courses?.map((c) => (
            <div className="insight" key={c.courseId}>
              <div className="t">Pace in {c.title}</div>
              <p className="meta">
                {c.estimatedFinish
                  ? `At about ${c.lessonsPerWeek} lessons a week you finish around ${new Date(c.estimatedFinish).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`
                  : `${c.lessonsLeft} lessons left. Finish a lesson this week to see an estimate.`}
              </p>
              <p className="note">Based on: {c.evidence}</p>
            </div>
          ))}
          <div className="insight">
            <div className="t">Topics to revisit</div>
            {d?.weakTopics?.length
              ? <p className="meta">{d.weakTopics.slice(0, 3).map((t) => `${t.topic} (${t.missed} of ${t.total} missed)`).join(', ')}. Ask the tutor for practice questions.</p>
              : <p className="meta">Take a quiz and the analyzer will point out topics to revisit.</p>}
          </div>
        </>
      )}
      <button className="ghost" style={{ marginTop: 14 }} onClick={() => optOut.mutate(!d?.optedOut)}>{d?.optedOut ? 'Turn insights on' : 'Turn insights off'}</button>
    </section>
  );
}

export function Recommendations() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['recommendations'], queryFn: () => api<{ courseId: string; title: string; category: string; level: string; reason: string }[]>('/ai/recommendations') });
  const dismiss = useMutation({
    mutationFn: (id: string) => api(`/ai/recommendations/${id}/dismiss`, { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recommendations'] }),
  });
  if (!q.data?.length) return null;
  return (
    <section className="card">
      <h2>Recommended next</h2>
      <div className="list" style={{ marginTop: 12 }}>
        {q.data.map((r) => (
          <div className="item" key={r.courseId}>
            <span style={{ flex: 1 }}>
              <Link to={`/courses/${r.courseId}`} className="t">{r.title}</Link><br />
              <span className="meta">{r.reason}</span>
            </span>
            <button className="ghost" onClick={() => dismiss.mutate(r.courseId)} aria-label={`Hide ${r.title}`}>Hide</button>
          </div>
        ))}
      </div>
    </section>
  );
}
