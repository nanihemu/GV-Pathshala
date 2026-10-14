import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../config/env';

export interface AccessPayload { sub: string; role: Role }

export const signAccess = (id: string, role: Role) =>
  jwt.sign({ role }, env.JWT_SECRET, { subject: id, expiresIn: '15m' });

export const signRefresh = (id: string) =>
  jwt.sign({ typ: 'refresh' }, env.JWT_REFRESH_SECRET, { subject: id, expiresIn: '7d' });

export const verifyAccess = (token: string): AccessPayload =>
  jwt.verify(token, env.JWT_SECRET) as unknown as AccessPayload;

export const verifyRefresh = (token: string): { sub: string } =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as unknown as { sub: string };

// Reset tokens are signed with the current password hash, so they stop working after one use.
export const signReset = (id: string, passwordHash: string) =>
  jwt.sign({ typ: 'reset' }, env.JWT_REFRESH_SECRET + passwordHash, { subject: id, expiresIn: '30m' });

export const verifyReset = (token: string, passwordHash: string): { sub: string } =>
  jwt.verify(token, env.JWT_REFRESH_SECRET + passwordHash) as unknown as { sub: string };

export const decodeSub = (token: string): string | null => {
  const d = jwt.decode(token);
  return d && typeof d === 'object' && typeof d.sub === 'string' ? d.sub : null;
};
