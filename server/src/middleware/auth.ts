import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { verifyAccess } from '../utils/jwt';
import { HttpError } from '../utils/http';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in required');
  try {
    const p = verifyAccess(header.slice(7));
    req.user = { id: p.sub, role: p.role };
  } catch {
    throw new HttpError(401, 'Your session has expired. Sign in again.');
  }
  next();
}

// For public pages such as the catalog: attaches the user when a valid token is present.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const p = verifyAccess(header.slice(7));
      req.user = { id: p.sub, role: p.role };
    } catch { /* treat as signed out */ }
  }
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, 'Sign in required');
    if (!roles.includes(req.user.role)) throw new HttpError(403, 'You do not have permission to do this');
    next();
  };
