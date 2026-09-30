import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';

type RequestPart = 'body' | 'query' | 'params';

declare module 'express-serve-static-core' {
  interface Request {
    validated?: {
      body?: unknown;
      query?: unknown;
      params?: unknown;
    };
  }
}

export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      next(AppError.validation('Dữ liệu không hợp lệ', result.error.flatten()));
      return;
    }

    req.validated = req.validated ?? {};
    req.validated[part] = result.data;

    // body is mutable; query/params may be getters in Express 5
    if (part === 'body') {
      req.body = result.data;
    }

    next();
  };
}

export function validatedQuery<T>(req: Request): T {
  return (req.validated?.query ?? req.query) as T;
}

export function validatedParams<T>(req: Request): T {
  return (req.validated?.params ?? req.params) as T;
}
