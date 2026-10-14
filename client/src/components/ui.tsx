import { ReactNode } from 'react';
import { ApiError } from '../lib/api';

export const Pill = ({ children, tone }: { children: ReactNode; tone?: 'warn' | 'ok' | 'bad' }) => <span className={`pill ${tone ?? ''}`}>{children}</span>;

// One segment per lesson: done, current (next to do), or still to do.
export function Strip({ states }: { states: { id: string; done: boolean }[] }) {
  const cur = states.find((s) => !s.done)?.id;
  return (
    <div className="strip" aria-hidden="true">
      {states.map((s) => <span key={s.id} className={`seg ${s.done ? 'done' : s.id === cur ? 'cur' : ''}`} />)}
    </div>
  );
}

export const Loading = ({ text = 'Loading' }: { text?: string }) => <p className="muted" role="status">{text}…</p>;

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const msg = error instanceof ApiError || error instanceof Error ? error.message : 'Something went wrong. Try again.';
  return <p className="error" role="alert">{msg}</p>;
}

export const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : '');
