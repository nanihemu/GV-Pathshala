import { SyntheticEvent, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { CourseDetail, LessonType, TYPE_LABEL } from '../../lib/types';
import { ErrorNote, Loading } from '../../components/ui';
import TutorPanel from '../ai/TutorPanel';
import QuizPlayer from '../quizzes/QuizPlayer';
import AssignmentView, { Submission } from '../assignments/AssignmentView';
import Discussion from './Discussion';

interface Lesson {
  id: string; courseId: string; courseTitle: string; title: string; type: LessonType; body: string; contentUrl: string | null;
  durationMin: number; dueDate: string | null; maxScore: number | null; mode: 'student' | 'owner' | 'admin'; aiTutorEnabled: boolean;
  completed: boolean; lastPosition: number; prevId: string | null; nextId: string | null; submission: Submission | null;
}

export default function LessonPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const lesson = useQuery({ queryKey: ['lesson', id], queryFn: () => api<Lesson>(`/lessons/${id}`) });
  const courseId = lesson.data?.courseId;
  const course = useQuery({ queryKey: ['course', courseId], queryFn: () => api<CourseDetail>(`/courses/${courseId}`), enabled: !!courseId });
  const lastSaved = useRef(0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['lesson', id] });
    qc.invalidateQueries({ queryKey: ['course', courseId] });
    qc.invalidateQueries({ queryKey: ['enrollments'] });
    qc.invalidateQueries({ queryKey: ['grades'] });
    qc.invalidateQueries({ queryKey: ['insights'] });
  };
  const complete = useMutation({ mutationFn: () => api(`/lessons/${id}/complete`, { body: {} }), onSuccess: refresh });

  if (lesson.isLoading) return <Loading />;
  const l = lesson.data;
  if (!l) return <ErrorNote error={lesson.error} />;
  const isStudent = l.mode === 'student';
  const done = new Set(course.data?.completedLessonIds ?? []);

  // Save the video position every 10 seconds so playback resumes, and auto-complete at 90% (server side)
  const onTime = (e: SyntheticEvent<HTMLVideoElement>) => {
    const t = e.currentTarget.currentTime;
    if (isStudent && t - lastSaved.current > 10) {
      lastSaved.current = t;
      api(`/lessons/${id}/position`, { method: 'PUT', body: { seconds: t } }).then(refresh).catch(() => undefined);
    }
  };

  return (
    <>
      <div className="crumbs"><Link to={`/courses/${l.courseId}`}>{l.courseTitle}</Link> / {l.title}</div>
      <h1>{l.title}</h1>
      <div className="lesson">
        <div>
          {l.type === 'VIDEO' && (
            <>
              <div className="stage"><div className="screen">
                {l.contentUrl
                  ? <video controls src={l.contentUrl} onTimeUpdate={onTime} onLoadedMetadata={(e) => { e.currentTarget.currentTime = l.lastPosition; }} />
                  : <div><h2 style={{ color: '#EAF4F6' }}>{l.title}</h2><p className="meta" style={{ color: '#9FB6BD', marginTop: 8 }}>No video file is attached yet. The notes below are the lesson.</p></div>}
              </div></div>
              {l.body && <section className="card read" style={{ marginTop: 16 }}><h3>Notes and transcript</h3><p>{l.body}</p></section>}
            </>
          )}
          {l.type === 'READING' && <section className="card read"><h2>{l.title}</h2><p>{l.body}</p></section>}
          {l.type === 'QUIZ' && (
            isStudent
              ? <QuizPlayer lessonId={l.id} instructions={l.body} onDone={refresh} />
              : <section className="card"><p>Students take this quiz here.</p><Link className="btn" style={{ marginTop: 12 }} to={`/instructor/lessons/${l.id}/quiz`}>Manage questions</Link></section>
          )}
          {l.type === 'ASSIGNMENT' && (
            isStudent
              ? <AssignmentView lessonId={l.id} brief={l.body} dueDate={l.dueDate} maxScore={l.maxScore ?? 100} submission={l.submission} onDone={refresh} />
              : <section className="card"><p>{l.body}</p><Link className="btn" style={{ marginTop: 12 }} to={`/instructor/lessons/${l.id}/submissions`}>View submissions</Link></section>
          )}

          <div className="row" style={{ marginTop: 18 }}>
            {isStudent && (l.type === 'VIDEO' || l.type === 'READING') && (
              <button className="btn" onClick={() => complete.mutate()} disabled={l.completed || complete.isPending}>{l.completed ? 'Completed' : 'Mark as complete'}</button>
            )}
            {l.prevId && <button className="btn alt" onClick={() => nav(`/lessons/${l.prevId}`)}>Previous lesson</button>}
            {l.nextId ? <button className="btn alt" onClick={() => nav(`/lessons/${l.nextId}`)}>Next lesson</button> : <button className="btn alt" onClick={() => nav(`/courses/${l.courseId}`)}>Back to course</button>}
          </div>
          <ErrorNote error={complete.error} />
          <Discussion lessonId={l.id} />
        </div>

        <aside className="stack">
          {l.aiTutorEnabled && <TutorPanel courseId={l.courseId} lessonId={l.id} />}
          <section className="card">
            <h2>Lessons</h2>
            {course.data?.modules.map((m) => (
              <div key={m.id}>
                <h3 className="meta" style={{ margin: '14px 0 2px' }}>{m.title}</h3>
                {m.lessons.map((x) => (
                  <Link key={x.id} to={`/lessons/${x.id}`} className={`lrow ${x.id === l.id ? 'on' : ''}`} style={{ padding: '10px 0' }}>
                    <span className={`st ${done.has(x.id) ? 'done' : x.id === l.id ? 'cur' : ''}`}>{done.has(x.id) ? '✓' : TYPE_LABEL[x.type][0]}</span>
                    <span className="t" style={{ flex: 1 }}>{x.title}</span>
                  </Link>
                ))}
              </div>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
