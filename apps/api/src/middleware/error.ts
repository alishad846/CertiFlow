import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError('Route not found', 404));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  const isFileTooLarge = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'LIMIT_FILE_SIZE';
  const appError =
    error instanceof AppError
      ? error
      : isFileTooLarge
        ? new AppError('Uploaded file is too large', 400)
        : new AppError('Internal server error', 500);
  const message = error instanceof Error && !(error instanceof AppError) ? error.message : appError.message;

  if (appError.statusCode >= 500) {
    console.error(error);
  }

  res.status(appError.statusCode).json({
    message,
    statusCode: appError.statusCode,
    ...(appError.code ? { code: appError.code } : {})
  });
}
