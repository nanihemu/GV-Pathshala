import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ErrorNote, Loading, Pill } from '../../components/ui';

interface Stats { users: Record<string, number>; publishedCourses: number; enrollments: number; completionRate: number; activeUsers7d: number; activeUsers30d: number; aiTokensThisMonth: number }
interface U { id: string; name: string; email: string; role: string; active: boolean }

export default function AdminPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: () => api<Stats>('/admin/stats') });
  const users = useQuery({ queryKey: ['admin-users', search], queryFn: () => api<U[]>(`/admin/users?search=${encodeURIComponent(search)}`) });
  const courses = useQuery({ queryKey: ['admin-courses'], queryFn: () => api<{ id: string; title: string; status: string; instructor: { name: string }; _count: { enrollments: number } }[]>('/admin/courses') });
  const patch = useMutation({ mutationFn: (v: { id: string; body: object }) => api(`/admin/users/${v.id}`, { method: 'PATCH', body: v.body }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }) });
  const status = useMutation({ mutationFn: (v: { id: string; status: string }) => api(`/admin/courses/${v.id}/status`, { method: 'PATCH', body: { status: v.status } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-courses'] }) });
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'INSTRUCTOR' });
  const create = useMutation({ mutationFn: () => api('/admin/users', { body: nu }), onSuccess: () => { setNu({ name: '', email: '', password: '', role: 'INSTRUCTOR' }); qc.invalidateQueries({ queryKey: ['admin-users'] }); } });

  if (stats.isLoading) return <Loading />;
  const s = stats.data;
  return (
    <>
      <h1>Administration</h1>
      <p className="sub">Usage, people and courses.</p>
      {s && (
        <div className="cards" style={{ marginTop: 20 }}>
          {[
            ['Students', s.users.STUDENT ?? 0], ['Instructors', s.users.INSTRUCTOR ?? 0], ['Published courses', s.publishedCourses],
            ['Enrollments', s.enrollments], ['Completion rate', `${s.completionRate}%`], ['Active, 7 days', s.activeUsers7d],
            ['Active, 30 days', s.activeUsers30d], ['AI tokens this month', s.aiTokensThisMonth.toLocaleString('en-IN')],
          ].map(([label, v]) => <div className="card" key={label as string}><div className="meta">{label}</div><div className="score" style={{ fontSize: '2rem' }}>{v}</div></div>)}
        </div>
      )}

      <section className="card" style={{ marginTop: 24 }}>
        <div className="row between"><h2>People</h2><input className="search" style={{ maxWidth: 300 }} type="search" placeholder="Search name or email" aria-label="Search users" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="tablewrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>{users.data?.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td><td>{u.email}</td>
              <td><select aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => patch.mutate({ id: u.id, body: { role: e.target.value } })}><option>STUDENT</option><option>INSTRUCTOR</option><option>ADMIN</option></select></td>
              <td><button className="ghost" onClick={() => patch.mutate({ id: u.id, body: { active: !u.active } })}>{u.active ? 'Deactivate' : 'Activate'}</button></td>
            </tr>))}</tbody>
        </table></div>
        <ErrorNote error={patch.error} />
        <form className="row" style={{ marginTop: 16, alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <label style={{ flex: 1, minWidth: 140 }}>Name<input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} required /></label>
          <label style={{ flex: 1, minWidth: 180 }}>Email<input type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} required /></label>
          <label style={{ flex: 1, minWidth: 140 }}>Temporary password<input type="password" minLength={8} value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} required /></label>
          <label style={{ width: 150 }}>Role<select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}><option>STUDENT</option><option>INSTRUCTOR</option><option>ADMIN</option></select></label>
          <button className="btn">Create user</button>
        </form>
        <ErrorNote error={create.error} />
      </section>

      <section className="card" style={{ marginTop: 24 }}>
        <h2>Courses</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Title</th><th>Instructor</th><th>Students</th><th>Status</th></tr></thead>
          <tbody>{courses.data?.map((c) => (
            <tr key={c.id}><td>{c.title}</td><td>{c.instructor.name}</td><td>{c._count.enrollments}</td>
              <td><Pill tone={c.status === 'PUBLISHED' ? 'ok' : 'warn'}>{c.status.toLowerCase()}</Pill>{' '}
                <button className="ghost" onClick={() => status.mutate({ id: c.id, status: c.status === 'PUBLISHED' ? 'UNPUBLISHED' : 'PUBLISHED' })}>{c.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}</button></td></tr>))}</tbody>
        </table></div>
      </section>
    </>
  );
}
