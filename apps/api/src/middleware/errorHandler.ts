import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  public statusCode: number;
  public code?: string;
  public details?: any;

  constructor(message: string, statusCode = 400, details?: any, code?: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code || (statusCode === 429 ? 'RATE_LIMIT_EXCEEDED' : 'APPLICATION_ERROR');
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError | ZodError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  const timestamp = new Date().toISOString();

  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
        timestamp,
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code || (err.statusCode === 429 ? 'RATE_LIMIT_EXCEEDED' : 'APPLICATION_ERROR'),
        message: err.message,
        details: err.details,
        timestamp,
      },
    });
    return;
  }

  console.error('[UNHANDLED_ERROR]', err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
      timestamp,
    },
  });
};
