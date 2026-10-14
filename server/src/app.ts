import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { categoriesRouter, coursesRouter } from './modules/courses/courses.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { lessonsRouter, modulesRouter } from './modules/lessons/lessons.routes';
import { certificatesRouter } from './modules/certificates/certificates.routes';
import { enrollmentsRouter } from './modules/enrollments/enrollments.routes';
import { quizzesRouter } from './modules/quizzes/quizzes.routes';
import { assignmentsRouter } from './modules/assignments/assignments.routes';
import { communityRouter } from './modules/community/community.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { gradesRouter } from './modules/grades/grades.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { aiRouter } from './modules/ai/ai.routes';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Brute-force protection on sign-in and password routes (in addition to the per-account lockout)
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }), authRouter);

// Public or optionally-authenticated routes come first. Routers mounted at /api below require sign-in.
app.use('/api/categories', categoriesRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/courses', reviewsRouter);
app.use('/api', certificatesRouter);

app.use('/api/users', usersRouter);
app.use('/api/lessons', lessonsRouter);
app.use('/api/modules', modulesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/grades', gradesRouter);
app.use('/api/admin', adminRouter);
app.use('/api/ai', aiRouter);
app.use('/api', enrollmentsRouter);
app.use('/api', quizzesRouter);
app.use('/api', assignmentsRouter);
app.use('/api', communityRouter);

app.use(notFound);
app.use(errorHandler);
