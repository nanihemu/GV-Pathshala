import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ErrorNote, Loading, Pill } from '../../components/ui';

interface Quiz {
  settings: { passMark: number; maxAttempts: number | null };
  attemptsUsed: number;
  lastAttempt?: { score: number; total: number; passed: boolean };
  questions: { id: string; text: string; options: string[] }[];
}
interface Result {
  score: number; total: number; percent: number; passed: boolean; passMark: number;
  review: { questionId: string; text: string; options: string[]; correctIndex: number; yourChoice: number | null; explanation: string | null }[];
}

export default function QuizPlayer({ lessonId, instructions, onDone }: { lessonId: string; instructions: string; onDone: () => void }) {
  const quiz = useQuery({ queryKey: ['quiz', lessonId], queryFn: () => api<Quiz>(`/lessons/${lessonId}/quiz`) });
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const submit = useMutation({
    mutationFn: () => api<Result>(`/lessons/${lessonId}/quiz/attempt`, { body: { answers: Object.entries(answers).map(([questionId, choice]) => ({ questionId, choice })) } }),
    onSuccess: (r) => { setResult(r); onDone(); quiz.refetch(); },
  });
  if (quiz.isLoading) return <Loading />;
  const q = quiz.data;
  if (!q) return <ErrorNote error={quiz.error} />;
  if (!q.questions.length) return <section className="card"><p>This quiz has no questions yet. Check back soon.</p></section>;

  if (result) {
    return (
      <section className="card">
        <div className="score">{result.score}/{result.total}</div>
        <div className="row" style={{ marginTop: 6 }}><Pill tone={result.passed ? 'ok' : 'warn'}>{result.passed ? 'Passed' : 'Not passed'}</Pill><span className="meta">{result.percent}%, pass mark {result.passMark}%</span></div>
        {result.review.map((r, n) => (
          <div key={r.questionId} style={{ marginTop: 20 }}>
            <h3>{n + 1}. {r.text}</h3>
            {r.options.map((o, k) => (
              <div key={k} className={`opt ${k === r.correctIndex ? 'right' : r.yourChoice === k ? 'wrong' : ''}`}>
                <span className="k">{'ABCD'[k]}</span>{o}{k === r.correctIndex ? ' (correct)' : r.yourChoice === k ? ' (your answer)' : ''}
              </div>
            ))}
            {r.explanation && <p className="meta" style={{ marginTop: 6 }}>{r.explanation}</p>}
          </div>
        ))}
        <div className="row" style={{ marginTop: 22 }}><button className="btn alt" onClick={() => { setResult(null); setAnswers({}); setI(0); }}>Retake quiz</button></div>
      </section>
    );
  }

  const cur = q.questions[i];
  const last = i === q.questions.length - 1;
  return (
    <section className="card">
      <div className="meta">Question {i + 1} of {q.questions.length}. Pass mark {q.settings.passMark}%.{q.lastAttempt ? ` Last score ${q.lastAttempt.score}/${q.lastAttempt.total}.` : ''}</div>
      {instructions && i === 0 && <p className="meta" style={{ marginTop: 6 }}>{instructions}</p>}
      <div className="strip">{q.questions.map((x, n) => <span key={x.id} className={`seg ${answers[x.id] !== undefined ? 'done' : n === i ? 'cur' : ''}`} />)}</div>
      <h2 style={{ margin: '14px 0 6px' }}>{cur.text}</h2>
      {cur.options.map((o, k) => (
        <button key={k} className="opt" aria-pressed={answers[cur.id] === k} onClick={() => setAnswers({ ...answers, [cur.id]: k })}><span className="k">{'ABCD'[k]}</span>{o}</button>
      ))}
      <div className="row between" style={{ marginTop: 20 }}>
        <button className="btn alt" onClick={() => setI(i - 1)} disabled={i === 0}>Previous</button>
        {last
          ? <button className="btn" onClick={() => submit.mutate()} disabled={submit.isPending || Object.keys(answers).length < q.questions.length}>Submit quiz</button>
          : <button className="btn" onClick={() => setI(i + 1)} disabled={answers[cur.id] === undefined}>Next question</button>}
      </div>
      <ErrorNote error={submit.error} />
    </section>
  );
}
