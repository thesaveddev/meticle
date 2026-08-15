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
      statusCode: err.statusCode,
      message: err.message,
      ...(requestId && { requestId }),
    });
  }

  if (err instanceof ZodError) {
    const firstError = err.errors[0];
    return res.status(400).json({
      statusCode: 400,
      message: firstError?.message || 'Validation failed',
      errors: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
      ...(requestId && { requestId }),
    });
  }

  if (err instanceof multer.MulterError) {
    const statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(statusCode).json({ statusCode, message: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(statusCode).json({ statusCode, message: err.message });
  }

  if (err.message?.startsWith('File type') || err.message?.startsWith('File extension')) {
    return res.status(400).json({ statusCode: 400, message: err.message });
  }

  const httpErr = err as any;
  const isExposed4xx =
    httpErr.expose === true &&
    typeof httpErr.status === 'number' &&
    httpErr.status >= 400 &&
    httpErr.status < 500;
  if (isExposed4xx) {
    const message =
      httpErr.type === 'entity.parse.failed'
        ? 'Invalid JSON body'
        : httpErr.status === 413
          ? 'Request body too large'
          : err.message || 'Bad Request';
    return res.status(httpErr.status).json({
      statusCode: httpErr.status,
      message,
      ...(requestId && { requestId }),
    });
  }

  logger.error({ err, requestId, url: req.originalUrl, method: req.method }, 'Unhandled error');
  res.status(500).json({
    statusCode: 500,
    message: 'Internal Server Error',
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  addRequestId(req, res);
  res.status(404).json({
    statusCode: 404,
    message: process.env.NODE_ENV === 'production' ? 'Not Found' : `Route ${req.method} ${req.originalUrl} not found`,
  });
};
