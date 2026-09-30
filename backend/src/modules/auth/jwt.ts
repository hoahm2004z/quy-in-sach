import jwt from 'jsonwebtoken';
import { env } from '../../config';
import { AppError } from '../../utils/AppError';

export type SupabaseJwtPayload = {
  sub: string;
  email?: string;
  role?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  iat?: number;
  exp?: number;
};

/**
 * Verify Supabase access token (HS256 with JWT secret).
 * Application role is NEVER taken from this payload — only from PostgreSQL users.
 */
export function verifySupabaseAccessToken(token: string): SupabaseJwtPayload {
  if (!env.SUPABASE_JWT_SECRET) {
    throw AppError.internal('SUPABASE_JWT_SECRET chưa được cấu hình');
  }

  try {
    const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload;

    if (!payload.sub || typeof payload.sub !== 'string') {
      throw AppError.unauthenticated('Token thiếu subject');
    }

    return payload as SupabaseJwtPayload;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw AppError.unauthenticated('Token không hợp lệ hoặc đã hết hạn');
  }
}

export function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader) {
    throw AppError.unauthenticated('Thiếu Authorization header');
  }

  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw AppError.unauthenticated('Authorization phải dạng Bearer <token>');
  }

  return token;
}
