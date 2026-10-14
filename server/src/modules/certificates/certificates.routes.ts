import { randomBytes } from 'crypto';
import { Router } from 'express';
import { brand } from '../../config/brand';
import { prisma } from '../../config/db';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, HttpError, paramId } from '../../utils/http';

export const certificatesRouter = Router(); // mounted at /api

// Public: anyone can check a certificate code (SRS CRT-2)
certificatesRouter.get('/certificates/verify/:code', asyncHandler(async (req, res) => {
  const cert = await prisma.certificate.findUnique({ where: { code: paramId(req, 'code') }, include: { user: { select: { name: true } }, course: { select: { title: true } } } });
  if (!cert) return res.json({ valid: false });
  res.json({ valid: true, student: cert.user.name, course: cert.course.title, issuedAt: cert.issuedAt, code: cert.code, issuer: brand.name });
}));

// Issues the certificate once every lesson is complete (quizzes complete only when passed).
// The response is data; rendering it as a PDF is left to the client or a later job.
certificatesRouter.get('/courses/:id/certificate', authenticate, asyncHandler(async (req, res) => {
  const courseId = paramId(req);
  const enrollment = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: req.user!.id, courseId } }, include: { course: true, user: true } });
  if (!enrollment) throw new HttpError(403, 'You are not enrolled in this course');
  if (!enrollment.completedAt) throw new HttpError(400, 'Finish every lesson and pass every quiz to get your certificate');
  const cert = await prisma.certificate.upsert({
    where: { userId_courseId: { userId: req.user!.id, courseId } },
    create: { userId: req.user!.id, courseId, code: `${brand.certificatePrefix}-` + randomBytes(5).toString('hex').toUpperCase() }, update: {},
  });
  res.json({ code: cert.code, issuedAt: cert.issuedAt, student: enrollment.user.name, course: enrollment.course.title, issuer: brand.name });
}));
