import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { brand } from '../../lib/brand';
import { CourseDetail, TYPE_LABEL } from '../../lib/types';
import { ErrorNote, Loading, Strip } from '../../components/ui';

export default function CoursePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const course = useQuery({ queryKey: ['course', id], queryFn: () => api<CourseDetail>(`/courses/${id}`) });
  const news = useQuery({ queryKey: ['announcements', id], queryFn: () => api<{ id: string; title: string; body: string; createdAt: string }[]>(`/courses/${id}/announcements`), enabled: !!course.data?.enrolled || !!course.data?.canEdit });
  const reviews = useQuery({ queryKey: ['reviews', id], queryFn: () => api<{ id: string; rating: number; text: string | null; name: string }[]>(`/courses/${id}/reviews`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['course', id] }); qc.invalidateQueries({ queryKey: ['enrollments'] }); qc.invalidateQueries({ queryKey: ['recommendations'] }); };
  const enroll = useMutation({ mutationFn: () => api(`/courses/${id}/enroll`, { body: {} }), onSuccess: refresh });
  const leave = useMutation({ mutationFn: () => api(`/courses/${id}/enroll`, { method: 'DELETE' }), onSuccess: refresh });
  const [cert, setCert] = useState<{ code: string; student: string; course: string; issuedAt: string } | null>(null);
  const [certError, setCertError] = useState<unknown>(null);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const review = useMutation({
    mutationFn: () => api(`/courses/${id}/reviews`, { body: { rating, text: text || undefined } }),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['reviews', id] }); },
  });

  if (course.isLoading) return <Loading />;
  const c = course.data;
  if (!c) return <ErrorNote error={course.error} />;
  const all = c.modules.flatMap((m) => m.lessons);
  const done = new Set(c.completedLessonIds);
  const next = all.find((l) => !done.has(l.id)) ?? all[0];
  const states = all.map((l) => ({ id: l.id, done: done.has(l.id) }));
  const complete = all.length > 0 && done.size >= all.length;
  const open = c.enrolled || c.canEdit;

  async function getCert() {
    try { setCert(await api(`/courses/${id}/certificate`)); setCertError(null); } catch (e) { setCertError(e); }
  }

  return (
    <>
      <div className="crumbs"><Link to="/catalog">Course catalog</Link> / {c.title}</div>
      <h1>{c.title}</h1>
      <p className="sub" style={{ maxWidth: '62ch' }}>{c.description}</p>
      <div className="grid2">
        <section className="card">
          <h2>Course content</h2>
          {c.modules.map((m) => (
            <div className="mod" key={m.id}>
              <h3>{m.title}</h3>
              {m.lessons.map((l) => {
                const d = done.has(l.id);
                const body = (
                  <>
                    <span className={`st ${d ? 'done' : l.id === next?.id && open ? 'cur' : ''}`}>{d ? '✓' : TYPE_LABEL[l.type][0]}</span>
                    <span style={{ flex: 1 }}><span className="t">{l.title}</span><br /><span className="meta">{TYPE_LABEL[l.type]}, {l.durationMin} min</span></span>
                  </>
                );
                return open ? <Link key={l.id} to={`/lessons/${l.id}`} className="lrow">{body}</Link> : <div key={l.id} className="lrow locked">{body}</div>;
              })}
            </div>
          ))}
        </section>
        <aside className="stack">
          <div className="card">
            <div className="meta">Taught by</div>
            <h3 style={{ margin: '2px 0 12px' }}>{c.instructor.name}</h3>
            <p className="meta">{c.category.name}, {c.level}, {all.length} lessons{c.rating ? `, rated ${c.rating.toFixed(1)} from ${c.reviews} reviews` : ''}</p>
            {c.enrolled ? (
              <>
                <Strip states={states} />
                <p className="meta">{done.size} of {all.length} lessons finished</p>
                <div className="row" style={{ marginTop: 14 }}>
                  {next && <Link className="btn" to={`/lessons/${next.id}`}>{done.size ? 'Continue' : 'Start course'}</Link>}
                  {complete && <button className="btn alt" onClick={getCert}>Get certificate</button>}
                  <button className="ghost" onClick={() => leave.mutate()}>Leave course</button>
                </div>
                <ErrorNote error={certError} />
                {cert && (
                  <div className="card" style={{ marginTop: 14 }}>
                    <div className="meta">{brand.name}</div>
                    <h3>Certificate of completion</h3>
                    <p style={{ marginTop: 8 }}>{cert.student} completed {cert.course}.</p>
                    <p className="meta">Code {cert.code}, issued {new Date(cert.issuedAt).toLocaleDateString('en-IN')}</p>
                    <button className="ghost" style={{ marginTop: 10 }} onClick={() => window.print()}>Print or save as PDF</button>
                  </div>
                )}
              </>
            ) : c.canEdit ? (
              <div className="row" style={{ marginTop: 14 }}><Link className="btn" to={`/instructor/courses/${c.id}`}>Edit course</Link></div>
            ) : (
              <>
                <div style={{ marginTop: 14 }}><button className="btn" onClick={() => enroll.mutate()} disabled={enroll.isPending || user?.role !== 'STUDENT'}>Enroll for free</button></div>
                <ErrorNote error={enroll.error} />
                <p className="note">{user?.role === 'STUDENT' ? 'Lessons unlock after you enroll.' : 'Sign in as a student to enroll.'}</p>
              </>
            )}
          </div>
          {open && !!news.data?.length && (
            <div className="card"><h2>Announcements</h2>
              {news.data.slice(0, 3).map((n) => <div className="insight" key={n.id}><div className="t">{n.title}</div><p className="meta">{n.body}</p></div>)}
            </div>
          )}
          <div className="card">
            <h2>Reviews</h2>
            {reviews.data?.length ? reviews.data.slice(0, 4).map((r) => <div className="insight" key={r.id}><div className="t">{'★'.repeat(r.rating)} <span className="meta">{r.name}</span></div>{r.text && <p className="meta">{r.text}</p>}</div>) : <p className="meta" style={{ marginTop: 8 }}>No reviews yet.</p>}
            {c.enrolled && (
              <form style={{ marginTop: 14 }} onSubmit={(e: FormEvent) => { e.preventDefault(); review.mutate(); }}>
                <div className="field" style={{ marginTop: 0 }}><label htmlFor="rating">Your rating</label>
                  <select id="rating" value={rating} onChange={(e) => setRating(+e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} out of 5</option>)}</select></div>
                <div className="field"><textarea aria-label="Your review" placeholder="What did you think?" value={text} onChange={(e) => setText(e.target.value)} /></div>
                <button className="btn sm" style={{ marginTop: 10 }} disabled={review.isPending}>Post review</button>
              </form>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
