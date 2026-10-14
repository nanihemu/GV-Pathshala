import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http';
import { AiUnavailableError } from '../modules/ai/llm/client';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err instanceof ZodError)
    return res.status(400).json({ error: 'Check the highlighted fields', details: err.flatten().fieldErrors });
  if (err instanceof AiUnavailableError) return res.status(503).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
}
