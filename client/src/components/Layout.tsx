import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { brand } from '../lib/brand';
import { initials } from '../lib/types';

interface Notifs { unread: number; items: { id: string; text: string; link?: string; readAt: string | null }[] }

export default function Layout() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const notifs = useQuery({ queryKey: ['notifications'], queryFn: () => api<Notifs>('/notifications'), refetchInterval: 60_000 });
  if (!user) return null;

  const toggleTheme = () => {
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark';
  };
  const links: [string, string][] = [['/', 'Dashboard'], ['/catalog', 'Course catalog']];
  if (user.role === 'STUDENT') links.push(['/grades', 'Grades']);
  if (user.role !== 'STUDENT') links.splice(1, 0, ['/instructor/courses', 'My courses']);
  if (user.role === 'ADMIN') links.push(['/admin', 'Administration']);

  return (
    <div className="app">
      <aside className="side">
        <Link to="/" className="logo">
          <i aria-hidden="true">{brand.short}</i>
          {brand.name}
        </Link>
        <nav className="nav-list" aria-label="Main">
          {links.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav ${isActive ? 'active' : ''}`}>{label}</NavLink>)}
        </nav>
        <div className="me">
          <div className="bell">
            <button className="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>Notifications</button>
            {!!notifs.data?.unread && <span className="badge">{notifs.data.unread}</span>}
            {open && (
              <div className="pop">
                {notifs.data?.items.length ? notifs.data.items.map((n) => (
                  <Link key={n.id} to={n.link ?? '/'} onClick={() => setOpen(false)} className="item" style={{ padding: '8px 0', opacity: n.readAt ? 0.6 : 1 }}>{n.text}</Link>
                )) : <p className="meta">Nothing new.</p>}
                <button className="ghost" style={{ marginTop: 8 }} onClick={async () => { await api('/notifications/read-all', { method: 'POST', body: {} }); qc.invalidateQueries({ queryKey: ['notifications'] }); }}>Mark all read</button>
              </div>
            )}
          </div>
          <div className="who"><div className="av">{initials(user.name)}</div><div>{user.name}<small>{user.role.toLowerCase()}</small></div></div>
          <div className="row">
            <button className="ghost" onClick={toggleTheme}>Theme</button>
            <button className="ghost" onClick={logout}>Sign out</button>
          </div>
        </div>
      </aside>
      <main><Outlet /></main>
    </div>
  );
}
