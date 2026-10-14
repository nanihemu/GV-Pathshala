import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { initials } from '../../lib/types';
import { ErrorNote } from '../../components/ui';

interface Comment { id: string; body: string; userId: string; name: string; role: string; createdAt: string }

export default function Discussion({ lessonId }: { lessonId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const key = ['comments', lessonId];
  const list = useQuery({ queryKey: key, queryFn: () => api<Comment[]>(`/lessons/${lessonId}/comments`) });
  const post = useMutation({ mutationFn: () => api(`/lessons/${lessonId}/comments`, { body: { body } }), onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: key }); } });
  const remove = useMutation({ mutationFn: (id: string) => api(`/comments/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });

  return (
    <section className="card" style={{ marginTop: 22 }}>
      <h2>Discussion</h2>
      {list.data?.map((c) => (
        <div className="cm" key={c.id}>
          <div className="av">{initials(c.name)}</div>
          <div style={{ flex: 1 }}>
            <strong>{c.name}</strong> {c.role !== 'STUDENT' && <span className="pill">{c.role.toLowerCase()}</span>}
            <p>{c.body}</p>
          </div>
          {(c.userId === user?.id || user?.role !== 'STUDENT') && <button className="ghost" onClick={() => remove.mutate(c.id)} aria-label="Delete comment">Delete</button>}
        </div>
      ))}
      {list.data?.length === 0 && <p className="meta" style={{ marginTop: 8 }}>No questions yet. Ask the first one.</p>}
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (body.trim()) post.mutate(); }} style={{ marginTop: 14 }}>
        <textarea aria-label="Write a comment" placeholder="Ask a question or share a tip" value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="btn sm" style={{ marginTop: 10 }} disabled={post.isPending}>Post comment</button>
      </form>
      <ErrorNote error={post.error} />
    </section>
  );
}
