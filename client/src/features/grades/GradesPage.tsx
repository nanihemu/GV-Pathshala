import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Loading, Pill, fmtDate } from '../../components/ui';

interface Grade {
  lessonId: string; title: string; course: string; type: 'QUIZ' | 'ASSIGNMENT'; dueDate: string | null;
  status: string; score: number | null; total: number | null; late?: boolean; feedback?: string | null; feedbackAiAssisted?: boolean;
}
const LABEL: Record<string, string> = { NOT_STARTED: 'Not started', PASSED: 'Passed', NOT_PASSED: 'Not passed', SUBMITTED: 'Awaiting grade', GRADED: 'Graded' };

export default function GradesPage() {
  const q = useQuery({ queryKey: ['grades'], queryFn: () => api<Grade[]>('/grades') });
  if (q.isLoading) return <Loading />;
  return (
    <>
      <h1>Grades</h1>
      <p className="sub">Quiz scores and assignment results for your courses.</p>
      <div className="card tablewrap" style={{ marginTop: 20 }}>
        <table>
          <thead><tr><th>Item</th><th>Course</th><th>Type</th><th>Due</th><th>Result</th></tr></thead>
          <tbody>
            {q.data?.map((g) => (
              <tr key={g.lessonId}>
                <td><Link to={`/lessons/${g.lessonId}`}>{g.title}</Link>{g.feedback && <p className="meta">{g.feedback.slice(0, 90)}{g.feedback.length > 90 ? '…' : ''}{g.feedbackAiAssisted ? ' (drafted with AI, reviewed by instructor)' : ''}</p>}</td>
                <td>{g.course}</td>
                <td>{g.type === 'QUIZ' ? 'Quiz' : 'Assignment'}</td>
                <td>{fmtDate(g.dueDate) || 'Not set'}</td>
                <td><Pill tone={g.status === 'PASSED' || g.status === 'GRADED' ? 'ok' : g.status === 'NOT_PASSED' ? 'warn' : undefined}>{g.score !== null ? `${g.score}/${g.total}` : LABEL[g.status]}</Pill> {g.late && <Pill tone="warn">Late</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.data?.length === 0 && <p className="meta">Nothing to show yet. Enroll in a course to see its quizzes and assignments.</p>}
      </div>
    </>
  );
}
