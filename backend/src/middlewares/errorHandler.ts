import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { sendFailure } from '../utils/response';
import { env } from '../config';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound('Không tìm thấy đường dẫn'));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    sendFailure(res, err.statusCode, err.message, err.code, err.details);
    return;
  }

  if (err instanceof ZodError) {
    sendFailure(res, 400, 'Dữ liệu không hợp lệ', 'VALIDATION_ERROR', err.flatten());
    return;
  }

  if (env.NODE_ENV !== 'production') {
    console.error(err);
  } else {
    console.error('Unhandled error');
  }

  sendFailure(
    res,
    500,
    'Lỗi hệ thống',
    'INTERNAL_ERROR',
    env.NODE_ENV === 'production' ? undefined : serializeUnknown(err),
  );
}

function serializeUnknown(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return err;
}
