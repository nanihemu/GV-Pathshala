# GV Pathshala

A learning management system (LMS) with four AI features: a course tutor, a quiz and feedback generator, a learning analyzer and course recommendations.

- **Students** find courses, learn, take quizzes, submit assignments, ask the AI tutor and see their progress.
- **Instructors** build courses, draft quiz questions and feedback with AI (and approve them), grade work and see who needs help.
- **Administrators** manage people and courses and watch usage.

The requirements are in [`docs/srs`](docs/srs) (Word, HTML and PowerPoint). A clickable prototype is in [`docs/prototype/index.html`](docs/prototype/index.html) and a walkthrough video is at [`docs/GV-Pathshala-walkthrough.mp4`](docs/GV-Pathshala-walkthrough.mp4).

> **Status:** this code was written to the SRS but has not been run yet. Expect to fix a few small type or setup errors on the first run. `npm run typecheck` shows them.

## Stack

| Layer | Choice |
|---|---|
| Client | React 18, Vite, TypeScript, React Router, TanStack Query, plain CSS (design tokens from the prototype) |
| Server | Node.js 20, Express, TypeScript, Zod |
| Database | PostgreSQL 16 with pgvector, Prisma |
| Auth | JWT access and refresh tokens, bcrypt |
| AI | Claude API (server only) for text, Voyage AI or a built-in offline fallback for embeddings |
| Tests | Vitest (unit), Playwright (smoke), an AI evaluation script |

## Branding

The name lives in two small files, so renaming the organisation is a one-minute change:

| File | What it controls |
|---|---|
| `client/src/lib/brand.ts` | Name and short mark ("GV") in the sidebar, sign-in pages and certificates |
| `server/src/config/brand.ts` | Email sender name, certificate code prefix (`GVP-...`), AI tutor introduction, server log |
| `client/index.html` and `client/public/favicon.svg` | Browser tab title and icon |
| `client/src/styles/global.css` | Colours. Edit the variables at the top (`--brand`, `--accent`) to use the institution's colours. |
| `.env` (`MAIL_FROM`) | The "from" name and address on emails |

The logo is currently a "GV" monogram. To use a real logo image, put the file in `client/public/` and replace the `<i>` mark in `client/src/components/Layout.tsx` with an `<img>`.

## Quick start

You need Node.js 20+ and Docker.

```bash
npm install
cp .env.example server/.env        # then edit the secrets
npm run db:up                      # Postgres with pgvector
npm run db:setup                   # creates tables and demo data
npm run dev:server                 # API on http://localhost:4000
npm run dev:client                 # app on http://localhost:5173   (second terminal)
```

Demo accounts (password `Password123!`): `student@gvpathshala.dev`, `instructor@gvpathshala.dev`, `admin@gvpathshala.dev`.

### Turn on the AI

The app works without any AI key. The tutor then shows the closest passage from the course, and the generators say AI is not configured.

For the full experience, set these in `server/.env`:

```
ANTHROPIC_API_KEY=your key
AI_MODEL=a current model name from Anthropic's documentation
```

For better search than the offline fallback, also set `EMBEDDING_PROVIDER=voyage` and `EMBEDDING_API_KEY`. After changing the embedding provider, re-run `npm run db:seed` or press "Re-read lessons for the AI tutor" on each course.

**Keys never go to the browser.** Only `server/src/modules/ai/llm/client.ts` calls the AI provider.

## How the AI features work

| Feature | Where | What it does |
|---|---|---|
| Tutor | `modules/ai/tutor`, `retrieval` | Finds the 5 most similar passages in the course (pgvector), asks the model to answer only from them with `[S1]` citations, rejects answers without a valid citation, and says so when nothing relevant exists. Hints only for graded work. 30 messages per hour per student. |
| Question generator | `modules/ai/generator/questions.service.ts` | Writes questions from a lesson as **PENDING drafts**. Only questions the instructor approves reach students. |
| Feedback drafts | `modules/ai/generator/feedback.service.ts` | Drafts strengths, improvements and a suggested score range from the brief and rubric. **Hidden from the student** until the instructor approves it. Feedback is labelled "drafted with AI". |
| Analyzer | `modules/ai/analyzer` | Plain rules and counts (no model): progress, inactivity, failed quizzes, missed deadlines, topics missed. A model only writes the weekly summary, and it sees pseudonyms instead of names. |
| Recommendations | `modules/ai/recommender` | Scores unenrolled courses by category match, interests and popularity, with a reason. Dismissed courses are hidden for 30 days. |

Guardrails live in `modules/ai/guardrails`: pseudonymisation, rate limit and a monthly token budget. Prompts and answers are logged without personal identifiers (`AiLog` table).

## Measure the tutor

```bash
EVAL_EMAIL=student@gvpathshala.dev EVAL_PASSWORD='Password123!' npm -w server run eval:ai
```

`server/tests/ai-eval/questions.json` has 13 sample questions. Grow it to 100 for the SRS target (AI-1, at least 90% of answers supported by the course), and tune `AI_SIMILARITY_THRESHOLD` using the results.

## Project structure

```
gv-pathshala/
├── docker-compose.yml        Postgres + pgvector
├── docs/                     SRS, prototype, walkthrough video, diagrams
├── server/
│   ├── prisma/               schema.prisma, seed.ts
│   ├── src/
│   │   ├── config/           env, database
│   │   ├── middleware/       auth, roles, uploads, errors
│   │   ├── modules/          auth, users, courses, lessons, enrollments, quizzes,
│   │   │                     assignments, community, notifications, reviews,
│   │   │                     certificates, grades, admin, ai/
│   │   ├── jobs/             background indexing, weekly summary, email
│   │   ├── utils/
│   │   ├── app.ts            routes
│   │   └── server.ts
│   └── tests/                unit tests, AI evaluation
├── client/src/
│   ├── app/                  router
│   ├── components/           layout, shared UI
│   ├── features/             auth, catalog, courses, lessons, quizzes, assignments,
│   │                         dashboard, grades, admin, ai
│   ├── lib/                  API client, auth, types
│   └── styles/
└── e2e/                      Playwright smoke tests
```

## API overview

```
POST /api/auth/register | login | refresh | forgot-password | reset-password     GET /api/auth/me
GET  /api/courses?search=&category=&level=      GET /api/courses/:id      POST /api/courses
POST /api/courses/:id/enroll                    POST /api/courses/:id/status
GET  /api/lessons/:id                           POST /api/lessons/:id/complete
GET  /api/lessons/:id/quiz                      POST /api/lessons/:id/quiz/attempt
POST /api/lessons/:id/assignment/submit         PATCH /api/submissions/:id/grade
POST /api/ai/tutor                              GET  /api/ai/tutor/history?courseId=
POST /api/ai/generate-questions                 PATCH /api/questions/:id        (approve or reject)
POST /api/ai/feedback-draft                     PATCH /api/ai/feedback-drafts/:id
GET  /api/ai/insights/student                   GET  /api/ai/insights/course/:id
GET  /api/ai/recommendations
GET  /api/admin/stats | users | courses
```

## Testing

```bash
npm test               # unit tests (chunking, citations, embeddings, pseudonyms)
npm run typecheck      # server and client
npx playwright test    # from e2e/, with the app running and seeded
```

## SRS coverage

Built: authentication with lockout and password reset, role-based access, course authoring, catalog and filters, enrollment, progress and resume, quizzes with auto-grading, assignments with grading, announcements, discussion, notifications, reviews, certificates (as data), gradebook with CSV export, admin tools, audit log, and all four AI features with their guardrails.

Not built yet (so you know what to add):

| SRS | Gap |
|---|---|
| AUTH-2 | Email verification |
| QZ-2, QZ-4, QZ-5 | Time limit is stored but not enforced. Instructors cannot hide correct answers. No question shuffling. |
| CRT-1 | Certificate is shown as a printable page, not a generated PDF file. No public verify page in the client (the API exists). |
| ASG-3 | Late submissions are flagged, not blocked |
| LRN-1 | Videos are linked by URL, not uploaded or streamed with HLS |
| COM-4 | Email notifications opt-in. Emails are sent only for password reset. |
| CRS-6 | Duplicate a course |
| AIG-5 | AI feedback drafts need a text submission (pasted text, .txt or .md). PDFs and zips are not read. |
| AIG-8, AIA-8 | Short-answer mark suggestions and messaging a flagged student |
| Stack | Tailwind and BullMQ are not used. Plain CSS and an in-process job are used instead. |

## Deployment notes

- Set strong `JWT_SECRET`, `JWT_REFRESH_SECRET` and `PSEUDONYM_SECRET`, and set `CLIENT_URL` to your real address.
- Use a managed Postgres that supports pgvector. Run `npm -w server run db:migrate` (or `db:push` for a demo).
- Uploaded files are stored on local disk in `server/uploads`. Use object storage for production.
- Before launch, check your AI provider's data terms (SRS PRIV-4).
