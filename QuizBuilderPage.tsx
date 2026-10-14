import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CourseDetail } from '../../lib/types';
import { ErrorNote, Loading, Pill } from '../../components/ui';

interface Question { id: string; text: string; options: string[]; correctIndex: number; explanation: string | null; topic: string | null; status: 'PENDING' | 'APPROVED' | 'REJECTED'; source: 'MANUAL' | 'AI' }

export default function QuizBuilderPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const lesson = useQuery({ queryKey: ['lesson', id], queryFn: () => api<{ courseId: string; title: string }>(`/lessons/${id}`) });
  const quiz = useQuery({ queryKey: ['quiz-edit', id], queryFn: () => api<{ questions: Question[] }>(`/lessons/${id}/quiz`) });
  const course = useQuery({ queryKey: ['course', lesson.data?.courseId], queryFn: () => api<CourseDetail>(`/courses/${lesson.data!.courseId}`), enabled: !!lesson.data });
  const reload = () => qc.invalidateQueries({ queryKey: ['quiz-edit', id] });

  const [source, setSource] = useState('');
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const generate = useMutation({
    mutationFn: () => api('/ai/generate-questions', { body: { sourceLessonId: source || sourceOptions[0]?.id, quizLessonId: id, count, difficulty } }),
    onSuccess: reload,
  });
  const setStatus = useMutation({ mutationFn: (v: { qid: string; status: string }) => api(`/questions/${v.qid}`, { method: 'PATCH', body: { status: v.status } }), onSuccess: reload });
  const remove = useMutation({ mutationFn: (qid: string) => api(`/questions/${qid}`, { method: 'DELETE' }), onSuccess: reload });

  const sourceOptions = course.data?.modules.flatMap((m) => m.lessons).filter((l) => l.type === 'VIDEO' || l.type === 'READING') ?? [];
  if (quiz.isLoading) return <Loading />;
  const qs = quiz.data?.questions ?? [];
  const drafts = qs.filter((q) => q.status === 'PENDING');

  return (
    <>
      <div className="crumbs">{lesson.data && <Link to={`/instructor/courses/${lesson.data.courseId}`}>Course builder</Link>} / {lesson.data?.title}</div>
      <h1>Quiz questions</h1>
      <p className="sub">Only approved questions are shown to students.</p>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="row between"><h2>Draft questions with AI</h2><Pill tone="warn">You approve every question</Pill></div>
        <p className="meta" style={{ marginTop: 6 }}>The AI writes questions from the text of a lesson you choose. Check each one for accuracy before approving.</p>
        <form className="row" style={{ marginTop: 14 }} onSubmit={(e: FormEvent) => { e.preventDefault(); generate.mutate(); }}>
          <select aria-label="Source lesson" style={{ flex: 1, minWidth: 220 }} value={source || sourceOptions[0]?.id || ''} onChange={(e) => setSource(e.target.value)}>
            {sourceOptions.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
          <select aria-label="Number of questions" style={{ width: 130 }} value={count} onChange={(e) => setCount(+e.target.value)}>{[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} questions</option>)}</select>
          <select aria-label="Difficulty" style={{ width: 130 }} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option>easy</option><option>medium</option><option>hard</option></select>
          <button className="btn" disabled={generate.isPending || !sourceOptions.length}>{generate.isPending ? 'Writing…' : 'Generate drafts'}</button>
        </form>
        <ErrorNote error={generate.error} />
      </section>

      {drafts.length > 0 && <h2 style={{ marginTop: 24 }}>Drafts waiting for review ({drafts.length})</h2>}
      <div className="stack" style={{ marginTop: 12 }}>
        {drafts.map((q) => <QuestionCard key={q.id} q={q} onApprove={() => setStatus.mutate({ qid: q.id, status: 'APPROVED' })} onReject={() => setStatus.mutate({ qid: q.id, status: 'REJECTED' })} onSaved={reload} />)}
      </div>

      <h2 style={{ marginTop: 24 }}>Approved questions ({qs.filter((q) => q.status === 'APPROVED').length})</h2>
      <div className="stack" style={{ marginTop: 12 }}>
        {qs.filter((q) => q.status === 'APPROVED').map((q) => <QuestionCard key={q.id} q={q} onDelete={() => remove.mutate(q.id)} onSaved={reload} />)}
      </div>
      <NewQuestion lessonId={id!} onSaved={reload} />
    </>
  );
}

function QuestionCard({ q, onApprove, onReject, onDelete, onSaved }: { q: Question; onApprove?: () => void; onReject?: () => void; onDelete?: () => void; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ text: q.text, options: q.options, correctIndex: q.correctIndex, explanation: q.explanation ?? '' });
  const save = useMutation({ mutationFn: () => api(`/questions/${q.id}`, { method: 'PATCH', body: f }), onSuccess: () => { setEdit(false); onSaved(); } });
  return (
    <div className="card">
      <div className="row between"><div className="row">{q.source === 'AI' && <Pill tone="warn">AI draft</Pill>}{q.topic && <Pill>{q.topic}</Pill>}</div>
        <div className="row">
          <button className="ghost" onClick={() => setEdit(!edit)}>{edit ? 'Cancel' : 'Edit'}</button>
          {onApprove && <button className="btn sm" onClick={onApprove}>Approve</button>}
          {onReject && <button className="ghost" onClick={onReject}>Reject</button>}
          {onDelete && <button className="ghost" onClick={onDelete}>Delete</button>}
        </div></div>
      {edit ? (
        <>
          <div className="field"><textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} aria-label="Question" /></div>
          {f.options.map((o, i) => (
            <div className="row" key={i} style={{ marginTop: 8, flexWrap: 'nowrap' }}>
              <input type="radio" name={`c-${q.id}`} style={{ width: 20 }} checked={f.correctIndex === i} onChange={() => setF({ ...f, correctIndex: i })} aria-label={`Option ${'ABCD'[i]} is correct`} />
              <input value={o} onChange={(e) => setF({ ...f, options: f.options.map((x, k) => (k === i ? e.target.value : x)) })} aria-label={`Option ${'ABCD'[i]}`} />
            </div>
          ))}
          <div className="field"><input value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} placeholder="Explanation (optional)" aria-label="Explanation" /></div>
          <button className="btn sm" style={{ marginTop: 12 }} onClick={() => save.mutate()}>Save changes</button>
          <ErrorNote error={save.error} />
        </>
      ) : (
        <>
          <h3 style={{ marginTop: 10 }}>{q.text}</h3>
          {q.options.map((o, i) => <div key={i} className={`opt ${i === q.correctIndex ? 'right' : ''}`}><span className="k">{'ABCD'[i]}</span>{o}</div>)}
          {q.explanation && <p className="meta" style={{ marginTop: 8 }}>{q.explanation}</p>}
        </>
      )}
    </div>
  );
}

function NewQuestion({ lessonId, onSaved }: { lessonId: string; onSaved: () => void }) {
  const blank = { text: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' };
  const [f, setF] = useState(blank);
  const add = useMutation({ mutationFn: () => api(`/lessons/${lessonId}/quiz/questions`, { body: { ...f, explanation: f.explanation || undefined } }), onSuccess: () => { setF(blank); onSaved(); } });
  return (
    <form className="card" style={{ marginTop: 24 }} onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
      <h2>Add a question yourself</h2>
      <div className="field"><textarea aria-label="Question" placeholder="Question" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} required minLength={5} /></div>
      {f.options.map((o, i) => (
        <div className="row" key={i} style={{ marginTop: 8, flexWrap: 'nowrap' }}>
          <input type="radio" name="correct" style={{ width: 20 }} checked={f.correctIndex === i} onChange={() => setF({ ...f, correctIndex: i })} aria-label={`Option ${'ABCD'[i]} is correct`} />
          <input value={o} placeholder={`Option ${'ABCD'[i]}`} onChange={(e) => setF({ ...f, options: f.options.map((x, k) => (k === i ? e.target.value : x)) })} required />
        </div>
      ))}
      <div className="field"><input aria-label="Explanation" placeholder="Explanation (optional)" value={f.explanation} onChange={(e) => setF({ ...f, explanation: e.target.value })} /></div>
      <ErrorNote error={add.error} />
      <button className="btn" style={{ marginTop: 14 }} disabled={add.isPending}>Add question</button>
    </form>
  );
}
