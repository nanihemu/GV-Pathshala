import { FormEvent, InputHTMLAttributes, ReactNode, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { ErrorNote } from '../../components/ui';
import { brand } from '../../lib/brand';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="logo" style={{ padding: 0, marginBottom: 18 }}><i aria-hidden="true">{brand.short}</i>{brand.name}</div>
        <h1 style={{ fontSize: '1.6rem' }}>{title}</h1>
        {children}
      </div>
    </div>
  );
}
const Field = ({ label, ...p }: { label: string } & InputHTMLAttributes<HTMLInputElement>) => (
  <div className="field"><label>{label}<input {...p} style={{ marginTop: 6 }} /></label></div>
);

export function LoginPage() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('student@gvpathshala.dev');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  if (user) return <Navigate to="/" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await login(email, password); nav('/'); } catch (err) { setError(err); }
  }
  return (
    <Shell title="Sign in">
      <form onSubmit={submit}>
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <ErrorNote error={error} />
        <button className="btn" style={{ marginTop: 18, width: '100%' }}>Sign in</button>
      </form>
      <p className="meta" style={{ marginTop: 14 }}><Link to="/forgot-password">Forgot your password?</Link> &nbsp; <Link to="/register">Create an account</Link></p>
      <p className="note">Demo accounts after seeding: student@, instructor@ and admin@gvpathshala.dev with password Password123!</p>
    </Shell>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<unknown>(null);
  if (user) return <Navigate to="/" replace />;
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await register(f.name, f.email, f.password); nav('/'); } catch (err) { setError(err); }
  }
  return (
    <Shell title="Create your account">
      <form onSubmit={submit}>
        <Field label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} />
        <Field label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        <Field label="Password (at least 8 characters)" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} />
        <ErrorNote error={error} />
        <button className="btn" style={{ marginTop: 18, width: '100%' }}>Create account</button>
      </form>
      <p className="meta" style={{ marginTop: 14 }}>Already registered? <Link to="/login">Sign in</Link></p>
    </Shell>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState<unknown>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { setMsg((await api<{ message: string }>('/auth/forgot-password', { body: { email } })).message); } catch (err) { setError(err); }
  }
  return (
    <Shell title="Reset your password">
      <form onSubmit={submit}>
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <ErrorNote error={error} />
        {msg && <p className="meta" style={{ marginTop: 10 }}>{msg}</p>}
        <button className="btn" style={{ marginTop: 18, width: '100%' }}>Send reset link</button>
      </form>
      <p className="meta" style={{ marginTop: 14 }}><Link to="/login">Back to sign in</Link></p>
    </Shell>
  );
}

export function ResetPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await api('/auth/reset-password', { body: { token: params.get('token'), password } }); nav('/login'); } catch (err) { setError(err); }
  }
  return (
    <Shell title="Choose a new password">
      <form onSubmit={submit}>
        <Field label="New password (at least 8 characters)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <ErrorNote error={error} />
        <button className="btn" style={{ marginTop: 18, width: '100%' }}>Update password</button>
      </form>
    </Shell>
  );
}
