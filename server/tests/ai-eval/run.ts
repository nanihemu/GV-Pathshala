/**
 * Measures the AI tutor against a question set (SRS AI-1, AI-2).
 * Start the server and seed the database first. Then:
 *   EVAL_EMAIL=student@gvpathshala.dev EVAL_PASSWORD='Password123!' npm run eval:ai
 * Review the printed answers by hand: "pass" here is a keyword check, not a replacement for two human reviewers.
 */
import fs from 'fs';
import path from 'path';

const API = process.env.API_URL ?? 'http://localhost:4000/api';

async function call(pathname: string, init: RequestInit & { token?: string } = {}) {
  const res = await fetch(API + pathname, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}) },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);
  return json;
}

async function main() {
  const set = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
  const login = await call('/auth/login', { method: 'POST', body: JSON.stringify({ email: process.env.EVAL_EMAIL, password: process.env.EVAL_PASSWORD }) });
  const token = login.accessToken as string;
  const courses = await call('/courses');
  const course = courses.find((c: { title: string }) => c.title === set.course);
  if (!course) throw new Error(`Course not found: ${set.course}`);

  let pass = 0;
  for (const item of set.items) {
    const r = await call('/ai/tutor', { method: 'POST', token, body: JSON.stringify({ courseId: course.id, message: item.q }) });
    const text = String(r.text).toLowerCase();
    const ok = item.refuse ? r.refused === true : !r.refused && item.expect.every((w: string) => text.includes(w.toLowerCase()));
    if (ok) pass++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${item.q}\n      -> ${String(r.text).slice(0, 140).replace(/\n/g, ' ')}${r.sources?.length ? `  [${r.sources.map((s: { lessonTitle: string }) => s.lessonTitle).join(', ')}]` : ''}`);
  }
  console.log(`\n${pass}/${set.items.length} passed (${Math.round((pass / set.items.length) * 100)}%). Target in the SRS: at least 90% on 100 questions.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
