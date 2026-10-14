import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { colorFor } from '../../lib/types';
import { Loading } from '../../components/ui';

interface Card { id: string; title: string; category: string; level: string; instructor: string; students: number; lessons: number; rating: number | null; enrolled: boolean }

export default function CatalogPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<{ id: string; name: string }[]>('/categories') });
  const params = new URLSearchParams({ ...(search && { search }), ...(category && { category }), ...(level && { level }) }).toString();
  const courses = useQuery({ queryKey: ['catalog', params], queryFn: () => api<Card[]>(`/courses?${params}`) });

  return (
    <>
      <h1>Course catalog</h1>
      <p className="sub">Find a course and enroll in one click.</p>
      <div className="tools">
        <input className="search" type="search" placeholder="Search by title, instructor or topic" aria-label="Search courses" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)} style={{ width: 170 }}>
          <option value="">All levels</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option>
        </select>
      </div>
      <div className="chips" style={{ marginBottom: 18 }}>
        <button className="chip" aria-pressed={category === ''} onClick={() => setCategory('')}>All</button>
        {cats.data?.map((c) => <button key={c.id} className="chip" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.name}</button>)}
      </div>
      {courses.isLoading ? <Loading /> : (
        <div className="cards">
          {courses.data?.map((c) => (
            <article key={c.id} className="card course">
              <div className="top" style={{ background: colorFor(c.title) }}>{c.title}</div>
              <div className="body">
                <div className="row"><span className="pill">{c.category}</span><span className="meta">{c.level}</span></div>
                <p className="meta">{c.instructor}. {c.lessons} lessons{c.rating ? `, rated ${c.rating.toFixed(1)}` : ''}, {c.students} students.</p>
                <Link className={`btn ${c.enrolled ? 'alt' : ''}`} to={`/courses/${c.id}`}>{c.enrolled ? 'Open course' : 'View course'}</Link>
              </div>
            </article>
          ))}
          {courses.data?.length === 0 && <p className="meta">No courses match. Clear the search or pick another category.</p>}
        </div>
      )}
    </>
  );
}
