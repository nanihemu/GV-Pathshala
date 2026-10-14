import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, tokenStore } from '../../lib/api';
import { ErrorNote, Loading, Pill } from '../../components/ui';

interface Sub {
  id: string; fileName: string | null; textContent: string | null; late: boolean; score: number | null; feedback: string | null;
  feedbackAiAssisted: boolean; gradedAt: string | null; submittedAt: string; user: { name: string; email: string };
}
interface Draft { id: string; strengths: string; improvements: string; suggestedMin: number; suggestedMax: number; status: string }
interface Data { lesson: { id: string; title: string; maxScore: number; body: string }; submissions: Sub[] }

export default function SubmissionsPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const data = useQuery({ queryKey: ['submissions', id], queryFn: () => api<Data>(`/lessons/${id}/submissions`) });
  const [sel, setSel] = useState<string | null>(null);
  if (data.isLoading) return <Loading />;
  const d = data.data;
  if (!d) return <ErrorNote error={data.error} />;
  const current = d.submissions.find((s) => s.id === sel) ?? d.submissions[0];

  return (
    <>
      <div className="crumbs"><Link to="/instructor/courses">My courses</Link> / Submissions</div>
      <h1>{d.lesson.title}</h1>
      <p className="sub">{d.submissions.length} submissions. Maximum score {d.lesson.maxScore}.</p>
      <div className="grid2">
        <section className="card">
          <h2>Students</h2>
          <div className="list" style={{ marginTop: 12 }}>
            {d.submissions.map((s) => (
              <button key={s.id} className="item" onClick={() => setSel(s.id)} style={{ background: s.id === current?.id ? 'var(--brand-soft)' : 'none' }}>
                <span style={{ flex: 1 }}><span className="t">{s.user.name}</span><br /><span className="meta">{new Date(s.submittedAt).toLocaleString('en-IN')}</span></span>
                {s.late && <Pill tone="warn">Late</Pill>}
                <Pill tone={s.gradedAt ? 'ok' : undefined}>{s.gradedAt ? `${s.score}/${d.lesson.maxScore}` : 'To grade'}</Pill>
              </button>
            ))}
            {d.submissions.length === 0 && <p className="meta">No submissions yet.</p>}
          </div>
        </section>
        {current && <Grader key={current.id} sub={current} max={d.lesson.maxScore} onSaved={() => qc.invalidateQueries({ queryKey: ['submissions', id] })} />}
      </div>
    </>
  );
}

function Grader({ sub, max, onSaved }: { sub: Sub; max: number; onSaved: () => void }) {
  const qc = useQueryClient();
  const [score, setScore] = useState<string>(sub.score?.toString() ?? '');
  const [feedback, setFeedback] = useState(sub.feedback ?? '');
  const drafts = useQuery({ queryKey: ['drafts', sub.id], queryFn: () => api<Draft[]>(`/ai/feedback-drafts?submissionId=${sub.id}`) });
  const reloadDrafts = () => qc.invalidateQueries({ queryKey: ['drafts', sub.id] });
  const make = useMutation({ mutationFn: () => api(`/ai/feedback-draft`, { body: { submissionId: sub.id } }), onSuccess: reloadDrafts });
  const grade = useMutation({ mutationFn: () => api(`/submissions/${sub.id}/grade`, { method: 'PATCH', body: { score: Number(score), feedback } }), onSuccess: onSaved });
  const review = useMutation({
    mutationFn: (v: { id: string; action: 'approve' | 'reject'; d?: Draft }) =>
      api(`/ai/feedback-drafts/${v.id}`, { method: 'PATCH', body: { action: v.action } }).then(() => v.d),
    onSuccess: (d, v) => { reloadDrafts(); if (v.action === 'approve' && d) setFeedback(`What works: ${d.strengths}\n\nTo improve: ${d.improvements}`); onSaved(); },
  });
  const pending = drafts.data?.filter((d) => d.status === 'PENDING') ?? [];
  const token = tokenStore.get()?.accessToken;

  return (
    <aside className="stack">
      <section className="card">
        <h2>{sub.user.name}</h2>
        <p className="meta">{sub.user.email}</p>
        {sub.fileName && <p style={{ marginTop: 10 }}>File: {sub.fileName}{' '}
          <button className="ghost" onClick={async () => {
            const r = await fetch(`/api/submissions/${sub.id}/file`, { headers: { Authorization: `Bearer ${token}` } });
            const url = URL.createObjectURL(await r.blob());
            const a = document.createElement('a'); a.href = url; a.download = sub.fileName!; a.click(); URL.revokeObjectURL(url);
          }}>Download</button></p>}
        {sub.textContent && <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', background: 'var(--bg)', padding: 12, borderRadius: 10, marginTop: 10 }}>{sub.textContent}</pre>}
      </section>

      <section className="card">
        <div className="row between"><h2>AI feedback draft</h2><Pill tone="warn">Only you can see drafts</Pill></div>
        <p className="meta" style={{ marginTop: 6 }}>Drafts use your brief and rubric. Nothing reaches the student until you approve it.</p>
        {pending.map((d) => (
          <div key={d.id} className="insight">
            <p><strong>What works:</strong> {d.strengths}</p>
            <p style={{ marginTop: 6 }}><strong>To improve:</strong> {d.improvements}</p>
            <p className="meta" style={{ marginTop: 6 }}>Suggested range {d.suggestedMin} to {d.suggestedMax} out of {max}. You decide the final score.</p>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sm" onClick={() => review.mutate({ id: d.id, action: 'approve', d })}>Use as feedback</button>
              <button className="ghost" onClick={() => review.mutate({ id: d.id, action: 'reject' })}>Discard</button>
            </div>
          </div>
        ))}
        <button className="btn alt sm" style={{ marginTop: 12 }} onClick={() => make.mutate()} disabled={make.isPending}>{make.isPending ? 'Drafting…' : 'Draft feedback with AI'}</button>
        <ErrorNote error={make.error ?? review.error} />
      </section>

      <form className="card" onSubmit={(e) => { e.preventDefault(); grade.mutate(); }}>
        <h2>Grade</h2>
        <div className="field"><label htmlFor="score">Score out of {max}</label><input id="score" type="number" min={0} max={max} value={score} onChange={(e) => setScore(e.target.value)} required /></div>
        <div className="field"><label htmlFor="fb">Feedback for the student</label><textarea id="fb" style={{ minHeight: 140 }} value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>
        <ErrorNote error={grade.error} />
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn" disabled={grade.isPending}>{sub.gradedAt ? 'Update grade' : 'Save grade'}</button>
          {grade.isSuccess && <span className="meta" role="status">Saved. The student has been notified.</span>}
        </div>
        {sub.feedbackAiAssisted && <p className="note">This feedback was drafted with AI and will be labelled that way for the student.</p>}
      </form>
    </aside>
  );
}
