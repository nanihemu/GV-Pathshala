import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../config/db';
import { brand } from '../../config/brand';
import { env } from '../../config/env';
import { authenticate } from '../../middleware/auth';
import { asyncHandler, HttpError } from '../../utils/http';
import { decodeSub, signAccess, signRefresh, signReset, verifyRefresh, verifyReset } from '../../utils/jwt';
import { sendMail } from '../../jobs/email.job';

export const authRouter = Router();

const publicUser = (u: { id: string; name: string; email: string; role: string }) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const tokensFor = (u: { id: string; role: any }) => ({ accessToken: signAccess(u.id, u.role), refreshToken: signRefresh(u.id) });
const password = z.string().min(8, 'Use at least 8 characters').max(100);

authRouter.post('/register', asyncHandler(async (req, res) => {
  const body = z.object({ name: z.string().min(2).max(80), email: z.string().email(), password }).parse(req.body);
  const email = body.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'An account with this email already exists');
  const user = await prisma.user.create({ data: { name: body.name, email, passwordHash: await bcrypt.hash(body.password, 10) } });
  res.status(201).json({ user: publicUser(user), ...tokensFor(user) });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  const bad = new HttpError(401, 'Email or password is incorrect');
  if (!user || !user.active) throw bad;
  if (user.lockedUntil && user.lockedUntil > new Date())
    throw new HttpError(423, 'Too many failed attempts. Try again in 15 minutes or reset your password.');
  if (!(await bcrypt.compare(body.password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: failed >= 5 ? { failedLogins: 0, lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } : { failedLogins: failed },
    });
    throw bad;
  }
  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  res.json({ user: publicUser(user), ...tokensFor(user) });
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
  try {
    const { sub } = verifyRefresh(refreshToken);
    const user = await prisma.user.findUnique({ where: { id: sub } });
    if (!user || !user.active) throw new Error('inactive');
    res.json(tokensFor(user));
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.');
  }
}));

authRouter.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw new HttpError(401, 'Sign in required');
  res.json({ ...publicUser(user), interests: user.interests, insightsOptOut: user.insightsOptOut });
}));

// Always answers the same way so the endpoint cannot be used to discover which emails have accounts.
authRouter.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (user) {
    const token = signReset(user.id, user.passwordHash);
    await sendMail(user.email, `Reset your ${brand.name} password`, `Open this link within 30 minutes:\n${env.CLIENT_URL}/reset-password?token=${token}`);
  }
  res.json({ message: 'If that email has an account, a reset link is on its way.' });
}));

authRouter.post('/reset-password', asyncHandler(async (req, res) => {
  const body = z.object({ token: z.string(), password }).parse(req.body);
  const sub = decodeSub(body.token);
  const user = sub ? await prisma.user.findUnique({ where: { id: sub } }) : null;
  try {
    if (!user) throw new Error('no user');
    verifyReset(body.token, user.passwordHash);
  } catch {
    throw new HttpError(400, 'This reset link is invalid or has expired. Request a new one.');
  }
  await prisma.user.update({ where: { id: user!.id }, data: { passwordHash: await bcrypt.hash(body.password, 10), failedLogins: 0, lockedUntil: null } });
  res.json({ message: 'Password updated. You can sign in now.' });
}));
