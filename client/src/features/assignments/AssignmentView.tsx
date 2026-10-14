import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ErrorNote, Pill, fmtDate } from '../../components/ui';

export interface Submission {
  id: string; fileName: string | null; submittedAt: string; late: boolean;
  score: number | null; feedback: string | null; feedbackAiAssisted: boolean; gradedAt: string | null;
}

export default function AssignmentView({ lessonId, brief, dueDate, maxScore, submission, onDone }: {
  lessonId: string; brief: string; dueDate: string | null; maxScore: number; submission: Submission | null; onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const send = useMutation({
    mutationFn: () => {
      const form = new FormData();
      if (file) form.append('file', file);
      if (text.trim()) form.append('textContent', text);
      return api(`/lessons/${lessonId}/assignment/submit`, { form });
    },
    onSuccess: () => { setFile(null); setText(''); onDone(); },
  });

  return (
    <section className="card">
      <h2>Assignment</h2>
      <p className="meta" style={{ marginTop: 6 }}>{dueDate ? `Due ${fmtDate(dueDate)}. ` : ''}Maximum score {maxScore}. Upload a .pdf, .zip, .docx, .txt or .md file up to 20 MB.</p>
      <p style={{ marginTop: 14, maxWidth: '62ch', whiteSpace: 'pre-line' }}>{brief}</p>

      {submission && (
        <div className="drop" style={{ textAlign: 'left' }}>
          <div className="row">
            <Pill tone={submission.gradedAt ? 'ok' : undefined}>{submission.gradedAt ? 'Graded' : 'Submitted'}</Pill>
            {submission.late && <Pill tone="warn">Late</Pill>}
            <span className="meta">{submission.fileName ?? 'Pasted text'}, {new Date(submission.submittedAt).toLocaleString('en-IN')}</span>
          </div>
          {submission.gradedAt ? (
            <>
              <p className="score" style={{ fontSize: '2rem', marginTop: 10 }}>{submission.score}/{maxScore}</p>
              {submission.feedback && (
                <div style={{ marginTop: 8 }}>
                  <p style={{ whiteSpace: 'pre-line' }}>{submission.feedback}</p>
                  {submission.feedbackAiAssisted && <p className="note">This feedback was drafted with AI and reviewed by your instructor.</p>}
                </div>
              )}
            </>
          ) : <p className="meta" style={{ marginTop: 10 }}>Waiting for your instructor to grade it. You can submit again until it is graded.</p>}
        </div>
      )}

      {!submission?.gradedAt && (
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); send.mutate(); }} style={{ marginTop: 16 }}>
          <div className="field" style={{ marginTop: 0 }}><label htmlFor="file">{submission ? 'Replace your file' : 'Choose a file'}</label>
            <input id="file" type="file" accept=".pdf,.zip,.docx,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          <div className="field"><label htmlFor="txt">Or paste your work</label><textarea id="txt" value={text} onChange={(e) => setText(e.target.value)} placeholder="Pasting text helps your instructor give faster feedback." /></div>
          <ErrorNote error={send.error} />
          <button className="btn" style={{ marginTop: 14 }} disabled={send.isPending || (!file && !text.trim())}>{submission ? 'Resubmit' : 'Submit assignment'}</button>
        </form>
      )}
    </section>
  );
}
