import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { scanFile } from '../virus-scan';
import { Request, Response, NextFunction } from 'express';

const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv', 'text/html', 'text/markdown',
  'application/json', 'application/xml',
  'application/rtf',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.tif',
  '.pdf',
  '.doc', '.docx',
  '.xls', '.xlsx',
  '.ppt', '.pptx',
  '.txt', '.csv', '.html', '.md',
  '.json', '.xml',
  '.rtf',
]);

const uploadsDir = path.resolve('private', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function fileFilter(_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIMES.has(file.mimetype)) {
    return cb(new Error(`File type ${file.mimetype} is not allowed`));
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`File extension ${ext} is not allowed`));
  }
  cb(null, true);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = crypto.randomUUID();
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const multerUpload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });

/** Multer upload + virus scan. Scans the saved file and removes it if unsafe. */
/** Multer upload (multiple files) + virus scan. */
export function uploadMultipleWithScan(fieldName: string, maxCount: number = 10) {
  return [
    multerUpload.array(fieldName, maxCount),
    (req: Request, res: Response, next: NextFunction) => {
      if (!req.files || !(req.files as Express.Multer.File[]).length) return next();
      for (const file of req.files as Express.Multer.File[]) {
        const result = scanFile(file.path);
        if (!result.safe) {
          fs.unlink(file.path, () => {});
          return res.status(400).json({ error: { message: `File rejected: ${result.reason}` } });
        }
      }
      next();
    },
  ];
}

export function uploadWithScan(fieldName: string) {
  return [
    multerUpload.single(fieldName),
    (req: Request, res: Response, next: NextFunction) => {
      if (!req.file) return next();
      const result = scanFile(req.file.path);
      if (!result.safe) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ error: { message: `File rejected: ${result.reason}` } });
      }
      next();
    },
  ];
}

export const upload = multerUpload;
export const uploadDir = uploadsDir;
