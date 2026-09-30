import type { Request } from 'express';
import { AppError } from './AppError';

export function paramId(req: Request, name = 'id'): string {
  const value = req.params[name];
  if (typeof value !== 'string' || !value) {
    throw AppError.badRequest(`Thiếu tham số ${name}`);
  }
  return value;
}
