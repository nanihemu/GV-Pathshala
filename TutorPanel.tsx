import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { ChatItem } from '../../lib/types';
import { ErrorNote } from '../../components/ui';

const SUGGESTIONS = ['Explain this lesson simply', 'Give me practice questions', 'When is my next deadline?'];

// Chat panel scoped to one course. The server answers only from the course material and cites the lesson.
export default function TutorPanel({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<ChatItem[]>(`/ai/tutor/history?courseId=${courseId}`).then(setItems).catch(() => undefined);
  }, [courseId]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [items, busy]);

  async function ask(message: string) {
    const q = message.trim();
    if (!q || busy) return;
    setText(''); setError(null); setBusy(true);
    setItems((i) => [...i, { role: 'user', text: q }]);
    try {
      if (/practice question/i.test(q)) {
        const r = await api<{ questions: { text: string; options: string[] }[] }>('/ai/practice', { body: { lessonId, count: 3 } });
        const body = r.questions.map((x, n) => `${n + 1}. ${x.text}\n   ${x.options.map((o, k) => `${'ABCD'[k]}) ${o}`).join('   ')}`).join('\n\n');
        setItems((i) => [...i, { role: 'assistant', text: `Here are three practice questions (not graded):\n\n${body}` }]);
      } else {
        const r = await api<ChatItem & { id: string }>('/ai/tutor', { body: { courseId, lessonId, message: q } });
        setItems((i) => [...i, { id: r.id, role: 'assistant', text: r.text, sources: r.sources, refused: r.refused }]);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function rate(id: string, rating: number) {
    await api(`/ai/tutor/${id}/rating`, { body: { rating } }).catch(() => undefined);
    setItems((i) => i.map((m) => (m.id === id ? { ...m, rating } : m)));
  }

  return (
    <section className="card ai">
      <div className="row between"><h2>AI tutor</h2></div>
      <div className="chatlog" ref={log} aria-live="polite">
        <div className="bub">Hi, I am your course tutor. Ask me about this lesson or the course. I answer from your course material and name the lesson I used.</div>
        {items.map((m, i) => (
          <div key={m.id ?? i} className={`bub ${m.role === 'user' ? 'u' : ''} ${m.refused ? 'refused' : ''}`}>
            {m.text}
            {m.role === 'assistant' && !!m.sources?.length && (
              <div className="src">Source: {m.sources.map((s, k) => <span key={s.lessonId}>{k > 0 && ', '}<Link to={`/lessons/${s.lessonId}`}>{s.lessonTitle}</Link></span>)}</div>
            )}
            {m.role === 'assistant' && m.id && (
              <div className="rate">
                <button className={m.rating === 1 ? 'on' : ''} onClick={() => rate(m.id!, 1)} aria-label="Helpful">👍</button>
                <button className={m.rating === -1 ? 'on' : ''} onClick={() => rate(m.id!, -1)} aria-label="Not helpful">👎</button>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="bub">Thinking…</div>}
      </div>
      <div className="chips">{SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => ask(s)} disabled={busy}>{s}</button>)}</div>
      <form className="ask" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about this course" aria-label="Ask the AI tutor" maxLength={1000} />
        <button className="btn sm" disabled={busy || !text.trim()}>Ask</button>
      </form>
      <ErrorNote error={error} />
      <p className="note">AI-generated answers can contain mistakes. Check important details with your instructor.</p>
    </section>
  );
}
