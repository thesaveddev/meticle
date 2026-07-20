import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import logger from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

function addRequestId(req: Request, res: Response) {
  const requestId = (req as any).requestId;
  if (requestId) res.setHeader('X-Request-ID', requestId);
  return requestId;
}

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const requestId = addRequestId(req, res);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      ...(requestId && { requestId }),
    });
  }

  if (err instanceof ZodError) {
    const firstError = err.errors[0];
    return res.status(400).json({
      message: firstError?.message || 'Validation failed',
      errors: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
      ...(requestId && { requestId }),
    });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ message: err.message });
  }

  if (err.message?.startsWith('File type') || err.message?.startsWith('File extension')) {
    return res.status(400).json({ message: err.message });
  }

  logger.error({ err, requestId, url: req.originalUrl, method: req.method }, 'Unhandled error');
  res.status(500).json({
    message: 'Internal Server Error',
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  addRequestId(req, res);
  res.status(404).json({
    message: process.env.NODE_ENV === 'production' ? 'Not Found' : `Route ${req.method} ${req.originalUrl} not found`,
  });
};
