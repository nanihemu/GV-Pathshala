import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { HttpError } from '../utils/http';

const dir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(dir, { recursive: true });

const ALLOWED = ['.pdf', '.zip', '.docx', '.txt', '.md'];

export const upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (_req, file, cb) => cb(null, randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.includes(ext)) return cb(new HttpError(400, 'Upload a .pdf, .zip, .docx, .txt or .md file'));
    cb(null, true);
  },
});

export const uploadDir = dir;
