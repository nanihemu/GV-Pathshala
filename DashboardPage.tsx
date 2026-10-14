import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { colorFor, TYPE_LABEL, LessonType } from '../../lib/types';
import { Loading, Strip, fmtDate } from '../../components/ui';
import { InsightsCard, Recommendations } from '../ai/InsightsCard';

interface Enrollment {
  courseId: string; title: string; instructor: string; total: number; completed: number;
  lessonStates: { id: string; done: boolean }[]; next: { id: string; title: string; type: LessonType } | null;
}
interface Grade { lessonId: string; title: string; course: string; status: string; dueDate: string | null }

export default function DashboardPage() {
  const { user } = useAuth();
  return user?.role === 'STUDENT' ? <StudentDashboard name={user.name} /> : <StaffDashboard role={user!.role} />;
}

function StudentDashboard({ name }: { name: string }) {
  const mine = useQuery({ queryKey: ['enrollments'], queryFn: () => api<Enrollment[]>('/enrollments/mine') });
  const grades = useQuery({ queryKey: ['grades'], queryFn: () => api<Grade[]>('/grades') });
  if (mine.isLoading) return <Loading />;
  const list = mine.data ?? [];
  const resume = list.find((e) => e.completed < e.total) ?? list[0];
  const due = (grades.data ?? []).filter((g) => g.dueDate && g.status !== 'PASSED' && g.status !== 'GRADED' && g.status !== 'SUBMITTED').sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!));

  return (
    <>
      <h1>Welcome back, {name.split(' ')[0]}</h1>
      <p className="sub">{due.length ? `You have ${due.length} item${due.length > 1 ? 's' : ''} due soon.` : 'Nothing is due. Nice work.'}</p>
      {resume?.next ? (
        <div className="card resume" style={{ marginTop: 22 }}>
          <div className="meta">Continue learning in {resume.title}</div>
          <h1>{resume.next.title}</h1>
          <div className="meta">{TYPE_LABEL[resume.next.type]}. You have finished {resume.completed} of {resume.total} lessons.</div>
          <Strip states={resume.lessonStates} />
          <Link className="btn" to={`/lessons/${resume.next.id}`}>Resume lesson</Link>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 22 }}><h2>Start your first course</h2><p className="sub">Pick something from the catalog.</p><Link className="btn" style={{ marginTop: 14 }} to="/catalog">Browse courses</Link></div>
      )}
      <div className="grid2">
        <section className="card">
          <h2>My courses</h2>
          <div className="list" style={{ marginTop: 12 }}>
            {list.map((e) => (
              <Link key={e.courseId} className="item" to={`/courses/${e.courseId}`}>
                <span className="thumb" style={{ background: colorFor(e.title) }}>{e.title.slice(0, 2).toUpperCase()}</span>
                <span style={{ flex: 1 }}><span className="t">{e.title}</span><br /><span className="meta">{e.completed} of {e.total} lessons finished, {e.instructor}</span><Strip states={e.lessonStates} /></span>
              </Link>
            ))}
            {list.length === 0 && <p className="meta">You are not enrolled in any course yet.</p>}
          </div>
        </section>
        <div className="stack">
          <InsightsCard />
          <section className="card">
            <h2>Due soon</h2>
            <div className="list" style={{ marginTop: 12 }}>
              {due.map((g) => (
                <Link key={g.lessonId} to={`/lessons/${g.lessonId}`} className="item"><span style={{ flex: 1 }}><span className="t">{g.title}</span><br /><span className="meta">{g.course}</span></span><span className="pill warn">{fmtDate(g.dueDate)}</span></Link>
              ))}
              {due.length === 0 && <p className="meta">Nothing due.</p>}
            </div>
          </section>
          <Recommendations />
        </div>
      </div>
    </>
  );
}

function StaffDashboard({ role }: { role: string }) {
  const courses = useQuery({ queryKey: ['my-courses'], queryFn: () => api<{ id: string; title: string; status: string; _count: { enrollments: number; lessons: number } }[]>('/courses/mine') });
  return (
    <>
      <h1>{role === 'ADMIN' ? 'Administrator dashboard' : 'Instructor dashboard'}</h1>
      <p className="sub">Your courses at a glance.</p>
      <section className="card" style={{ marginTop: 20 }}>
        <div className="row between"><h2>Courses</h2><Link className="btn sm" to="/instructor/courses">Manage courses</Link></div>
        <div className="list" style={{ marginTop: 12 }}>
          {courses.data?.map((c) => (
            <div className="item" key={c.id}>
              <span style={{ flex: 1 }}><Link className="t" to={`/instructor/courses/${c.id}`}>{c.title}</Link><br /><span className="meta">{c._count.enrollments} students, {c._count.lessons} lessons</span></span>
              <span className={`pill ${c.status === 'PUBLISHED' ? 'ok' : 'warn'}`}>{c.status.toLowerCase()}</span>
              <Link className="btn alt sm" to={`/instructor/courses/${c.id}/analytics`}>Analytics</Link>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
