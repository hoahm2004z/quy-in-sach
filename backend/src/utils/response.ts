import type { Response } from 'express';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>,
): void {
  const body: ApiSuccess<T> = { success: true, data };
  if (meta) {
    body.meta = meta;
  }
  res.status(statusCode).json(body);
}

export function sendFailure(
  res: Response,
  statusCode: number,
  message: string,
  code: string,
  details?: unknown,
): void {
  const body: ApiFailure = { success: false, message, code };
  if (details !== undefined) {
    body.details = details;
  }
  res.status(statusCode).json(body);
}
