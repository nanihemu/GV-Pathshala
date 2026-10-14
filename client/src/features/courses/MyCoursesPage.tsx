import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ErrorNote, Loading } from '../../components/ui';

export default function MyCoursesPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ['my-courses'], queryFn: () => api<{ id: string; title: string; status: string; category: { name: string }; _count: { enrollments: number; lessons: number } }[]>('/courses/mine') });
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<{ id: string; name: string }[]>('/categories') });
  const [f, setF] = useState({ title: '', description: '', categoryId: '', level: 'Beginner' });
  const create = useMutation({
    mutationFn: () => api<{ id: string }>('/courses', { body: { ...f, categoryId: f.categoryId || cats.data?.[0]?.id } }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['my-courses'] }); nav(`/instructor/courses/${c.id}`); },
  });
  return (
    <>
      <h1>My courses</h1>
      <p className="sub">Create a course, add lessons, then publish it.</p>
      <div className="grid2">
        <section className="card">
          <h2>Courses</h2>
          {courses.isLoading ? <Loading /> : (
            <div className="list" style={{ marginTop: 12 }}>
              {courses.data?.map((c) => (
                <div className="item" key={c.id}>
                  <span style={{ flex: 1 }}><Link className="t" to={`/instructor/courses/${c.id}`}>{c.title}</Link><br /><span className="meta">{c.category.name}, {c._count.lessons} lessons, {c._count.enrollments} students</span></span>
                  <span className={`pill ${c.status === 'PUBLISHED' ? 'ok' : 'warn'}`}>{c.status.toLowerCase()}</span>
                </div>
              ))}
              {courses.data?.length === 0 && <p className="meta">No courses yet. Create your first one.</p>}
            </div>
          )}
        </section>
        <form className="card" onSubmit={(e: FormEvent) => { e.preventDefault(); create.mutate(); }}>
          <h2>New course</h2>
          <div className="field"><label htmlFor="t">Title</label><input id="t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required minLength={3} /></div>
          <div className="field"><label htmlFor="d">Description</label><textarea id="d" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required minLength={10} /></div>
          <div className="field"><label htmlFor="c">Category</label>
            <select id="c" value={f.categoryId || cats.data?.[0]?.id || ''} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label htmlFor="l">Level</label>
            <select id="l" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
          <ErrorNote error={create.error} />
          <button className="btn" style={{ marginTop: 16 }} disabled={create.isPending}>Create course</button>
        </form>
      </div>
    </>
  );
}
