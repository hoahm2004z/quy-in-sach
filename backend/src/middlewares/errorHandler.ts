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

  logUnexpectedError(err);

  sendFailure(
    res,
    500,
    'Lỗi hệ thống',
    'INTERNAL_ERROR',
    env.NODE_ENV === 'production' ? undefined : serializeUnknown(err),
  );
}

/** Log unexpected errors for Render/ops without leaking secrets in stdout. */
function logUnexpectedError(err: unknown): void {
  if (err instanceof Error) {
    const maybeCode = (err as Error & { code?: unknown }).code;
    const code = typeof maybeCode === 'string' ? maybeCode : undefined;
    console.error('[unhandled]', {
      name: err.name,
      message: redactSecrets(err.message),
      code,
      stack: err.stack ? redactSecrets(err.stack) : undefined,
    });
    return;
  }
  console.error('[unhandled]', { value: redactSecrets(String(err)) });
}

function redactSecrets(text: string): string {
  return text
    .replace(/postgresql:\/\/[^\s"'`]+/gi, 'postgresql://***')
    .replace(/postgres:\/\/[^\s"'`]+/gi, 'postgres://***')
    .replace(/\b(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b/g, '[REDACTED_JWT]')
    .replace(
      /\b(SERVICE_ROLE|service_role|JWT_SECRET|PASSWORD|password|secret)=([^\s&]+)/gi,
      '$1=[REDACTED]',
    );
}

function serializeUnknown(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return err;
}
