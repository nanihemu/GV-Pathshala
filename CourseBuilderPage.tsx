import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { CourseDetail, LessonType, TYPE_LABEL } from '../../lib/types';
import { ErrorNote, Loading } from '../../components/ui';

interface FullLesson {
  id: string; title: string; type: LessonType; body: string; contentUrl?: string | null; durationMin: number;
  passMark?: number | null; maxAttempts?: number | null; dueDate?: string | null; maxScore?: number | null; rubric?: string | null;
}

export default function CourseBuilderPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const course = useQuery({ queryKey: ['course', id], queryFn: () => api<CourseDetail>(`/courses/${id}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['course', id] });
  const [moduleTitle, setModuleTitle] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [news, setNews] = useState({ title: '', body: '' });
  const [msg, setMsg] = useState('');

  const addModule = useMutation({ mutationFn: () => api(`/courses/${id}/modules`, { body: { title: moduleTitle } }), onSuccess: () => { setModuleTitle(''); refresh(); } });
  const addLesson = useMutation({ mutationFn: (v: { moduleId: string; title: string; type: LessonType }) => api<{ id: string }>(`/modules/${v.moduleId}/lessons`, { body: { title: v.title, type: v.type } }), onSuccess: (l) => { refresh(); setEditing(l.id); } });
  const setStatus = useMutation({ mutationFn: (status: string) => api(`/courses/${id}/status`, { body: { status } }), onSuccess: refresh });
  const patchCourse = useMutation({ mutationFn: (b: object) => api(`/courses/${id}`, { method: 'PATCH', body: b }), onSuccess: refresh });
  const announce = useMutation({ mutationFn: () => api(`/courses/${id}/announcements`, { body: news }), onSuccess: () => { setNews({ title: '', body: '' }); setMsg('Announcement posted. Students have been notified.'); } });
  const reindex = useMutation({ mutationFn: () => api<{ chunks: number }>(`/ai/reindex/${id}`, { body: {} }), onSuccess: (r) => setMsg(`The AI tutor re-read ${r.chunks} passages from your lessons.`) });

  if (course.isLoading) return <Loading />;
  const c = course.data;
  if (!c) return <ErrorNote error={course.error} />;

  return (
    <>
      <div className="crumbs"><Link to="/instructor/courses">My courses</Link> / {c.title}</div>
      <div className="row between">
        <h1>{c.title}</h1>
        <div className="row">
          <span className={`pill ${c.status === 'PUBLISHED' ? 'ok' : 'warn'}`}>{c.status.toLowerCase()}</span>
          <Link className="btn alt sm" to={`/instructor/courses/${c.id}/analytics`}>Analytics</Link>
          <Link className="btn alt sm" to={`/courses/${c.id}`}>Preview</Link>
          {c.status !== 'PUBLISHED'
            ? <button className="btn sm" onClick={() => setStatus.mutate('PUBLISHED')}>Publish</button>
            : <button className="btn alt sm" onClick={() => setStatus.mutate('DRAFT')}>Move to draft</button>}
          {user?.role === 'ADMIN' && c.status === 'PUBLISHED' && <button className="btn danger sm" onClick={() => setStatus.mutate('UNPUBLISHED')}>Unpublish</button>}
        </div>
      </div>
      <ErrorNote error={setStatus.error ?? addModule.error ?? addLesson.error ?? announce.error ?? reindex.error} />
      {msg && <p className="meta" role="status" style={{ marginTop: 8 }}>{msg}</p>}

      <div className="grid2">
        <section className="stack">
          {c.modules.map((m, mi) => (
            <ModuleCard key={m.id} mod={m} index={mi} editing={editing} setEditing={setEditing} onAdd={(title, type) => addLesson.mutate({ moduleId: m.id, title, type })} refresh={refresh} />
          ))}
          <form className="card" onSubmit={(e) => { e.preventDefault(); addModule.mutate(); }}>
            <h3>Add a module</h3>
            <div className="row" style={{ marginTop: 10 }}>
              <input style={{ flex: 1, minWidth: 200 }} placeholder="Module title" aria-label="Module title" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} required minLength={2} />
              <button className="btn sm">Add module</button>
            </div>
          </form>
        </section>

        <aside className="stack">
          <div className="card">
            <h2>Course settings</h2>
            <Toggle label="AI tutor on" hint="Students can ask questions answered from your lessons." checked={c.aiTutorEnabled} onChange={(v) => patchCourse.mutate({ aiTutorEnabled: v })} />
            <Toggle label="Academic integrity mode" hint="On quizzes and assignments the tutor gives hints, not answers." checked={c.integrityMode} onChange={(v) => patchCourse.mutate({ integrityMode: v })} />
            <Toggle label="Invite only" hint="Students cannot enroll themselves." checked={c.inviteOnly} onChange={(v) => patchCourse.mutate({ inviteOnly: v })} />
            <button className="ghost" style={{ marginTop: 14 }} onClick={() => reindex.mutate()} disabled={reindex.isPending}>Re-read lessons for the AI tutor</button>
            <p className="note">Lessons are re-read automatically when you save them. The tutor learns from the text, transcript or notes in each lesson.</p>
          </div>
          <form className="card" onSubmit={(e) => { e.preventDefault(); announce.mutate(); }}>
            <h2>Announcement</h2>
            <div className="field"><input aria-label="Title" placeholder="Title" value={news.title} onChange={(e) => setNews({ ...news, title: e.target.value })} required /></div>
            <div className="field"><textarea aria-label="Message" placeholder="Message to all students" value={news.body} onChange={(e) => setNews({ ...news, body: e.target.value })} required /></div>
            <button className="btn sm" style={{ marginTop: 10 }}>Post announcement</button>
          </form>
        </aside>
      </div>
    </>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row" style={{ marginTop: 14, alignItems: 'flex-start', flexWrap: 'nowrap', cursor: 'pointer' }}>
      <input type="checkbox" style={{ width: 20, height: 20, marginTop: 3 }} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><span className="t">{label}</span><br /><span className="meta">{hint}</span></span>
    </label>
  );
}

function ModuleCard({ mod, index, editing, setEditing, onAdd, refresh }: {
  mod: CourseDetail['modules'][number]; index: number; editing: string | null; setEditing: (id: string | null) => void;
  onAdd: (title: string, type: LessonType) => void; refresh: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<LessonType>('VIDEO');
  const move = async (i: number, dir: -1 | 1) => {
    const ids = mod.lessons.map((l) => l.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await api(`/modules/${mod.id}/order`, { method: 'PUT', body: { lessonIds: ids } });
    refresh();
  };
  return (
    <div className="card">
      <div className="row between"><h3>{index + 1}. {mod.title}</h3>
        <button className="ghost" onClick={async () => { if (confirm('Delete this module and its lessons?')) { await api(`/modules/${mod.id}`, { method: 'DELETE' }); refresh(); } }}>Delete module</button></div>
      {mod.lessons.map((l, i) => (
        <div key={l.id}>
          <div className="lrow">
            <span className="st">{TYPE_LABEL[l.type][0]}</span>
            <span style={{ flex: 1 }}><span className="t">{l.title}</span><br /><span className="meta">{TYPE_LABEL[l.type]}, {l.durationMin} min</span></span>
            <button className="ghost" aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
            <button className="ghost" aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
            {l.type === 'QUIZ' && <Link className="btn alt sm" to={`/instructor/lessons/${l.id}/quiz`}>Questions</Link>}
            {l.type === 'ASSIGNMENT' && <Link className="btn alt sm" to={`/instructor/lessons/${l.id}/submissions`}>Submissions</Link>}
            <button className="btn alt sm" onClick={() => setEditing(editing === l.id ? null : l.id)}>{editing === l.id ? 'Close' : 'Edit'}</button>
          </div>
          {editing === l.id && <LessonEditor lessonId={l.id} onSaved={refresh} />}
        </div>
      ))}
      <form className="row" style={{ marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); onAdd(title, type); setTitle(''); }}>
        <input style={{ flex: 1, minWidth: 180 }} placeholder="New lesson title" aria-label="New lesson title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
        <select style={{ width: 150 }} aria-label="Lesson type" value={type} onChange={(e) => setType(e.target.value as LessonType)}>
          {(Object.keys(TYPE_LABEL) as LessonType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <button className="btn sm">Add lesson</button>
      </form>
    </div>
  );
}

function LessonEditor({ lessonId, onSaved }: { lessonId: string; onSaved: () => void }) {
  const q = useQuery({ queryKey: ['lesson-edit', lessonId], queryFn: () => api<FullLesson>(`/lessons/${lessonId}`) });
  const [f, setF] = useState<Partial<FullLesson> | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () => {
      const v = { ...q.data, ...f } as FullLesson;
      return api(`/lessons/${lessonId}`, {
        method: 'PATCH',
        body: {
          title: v.title, body: v.body, durationMin: Number(v.durationMin) || 5, contentUrl: v.contentUrl || undefined,
          ...(v.type === 'QUIZ' ? { passMark: Number(v.passMark) || undefined, maxAttempts: Number(v.maxAttempts) || undefined } : {}),
          ...(v.type === 'ASSIGNMENT' ? { dueDate: v.dueDate ? new Date(v.dueDate).toISOString() : undefined, maxScore: Number(v.maxScore) || undefined, rubric: v.rubric || undefined } : {}),
        },
      });
    },
    onSuccess: () => { setSaved(true); onSaved(); },
  });
  if (!q.data) return <Loading />;
  const v = { ...q.data, ...f } as FullLesson;
  const set = (p: Partial<FullLesson>) => { setF({ ...f, ...p }); setSaved(false); };
  const bodyLabel = v.type === 'ASSIGNMENT' ? 'Assignment brief' : v.type === 'VIDEO' ? 'Transcript or notes (the AI tutor learns from this)' : v.type === 'QUIZ' ? 'Instructions' : 'Lesson text (the AI tutor learns from this)';
  return (
    <div className="card" style={{ margin: '4px 0 12px', background: 'var(--bg)' }}>
      <div className="field" style={{ marginTop: 0 }}><label>Title<input value={v.title} onChange={(e) => set({ title: e.target.value })} /></label></div>
      <div className="field"><label>{bodyLabel}<textarea style={{ minHeight: 160 }} value={v.body} onChange={(e) => set({ body: e.target.value })} /></label></div>
      <div className="row" style={{ marginTop: 12 }}>
        <label style={{ width: 130 }}>Minutes<input type="number" min={1} value={v.durationMin} onChange={(e) => set({ durationMin: +e.target.value })} /></label>
        {v.type === 'VIDEO' && <label style={{ flex: 1, minWidth: 220 }}>Video URL (.mp4)<input type="url" value={v.contentUrl ?? ''} onChange={(e) => set({ contentUrl: e.target.value })} /></label>}
        {v.type === 'QUIZ' && <>
          <label style={{ width: 130 }}>Pass mark %<input type="number" min={1} max={100} value={v.passMark ?? 60} onChange={(e) => set({ passMark: +e.target.value })} /></label>
          <label style={{ width: 130 }}>Max attempts<input type="number" min={1} value={v.maxAttempts ?? ''} onChange={(e) => set({ maxAttempts: +e.target.value })} /></label></>}
        {v.type === 'ASSIGNMENT' && <>
          <label style={{ width: 190 }}>Due date<input type="date" value={v.dueDate ? v.dueDate.slice(0, 10) : ''} onChange={(e) => set({ dueDate: e.target.value })} /></label>
          <label style={{ width: 130 }}>Max score<input type="number" min={1} value={v.maxScore ?? 100} onChange={(e) => set({ maxScore: +e.target.value })} /></label></>}
      </div>
      {v.type === 'ASSIGNMENT' && <div className="field"><label>Rubric (used for AI feedback drafts)<textarea value={v.rubric ?? ''} onChange={(e) => set({ rubric: e.target.value })} /></label></div>}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn sm" onClick={() => save.mutate()} disabled={save.isPending}>Save lesson</button>
        {saved && <span className="meta" role="status">Saved</span>}
        <button className="ghost" onClick={async () => { if (confirm('Delete this lesson?')) { await api(`/lessons/${lessonId}`, { method: 'DELETE' }); onSaved(); } }}>Delete lesson</button>
      </div>
      <ErrorNote error={save.error} />
    </div>
  );
}
