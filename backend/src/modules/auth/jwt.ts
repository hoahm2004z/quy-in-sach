import jwt from 'jsonwebtoken';
import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
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

let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getRemoteJwks() {
  if (!env.SUPABASE_URL) {
    throw AppError.internal('SUPABASE_URL chưa được cấu hình để verify JWT (JWKS)');
  }
  if (!remoteJwks) {
    const base = env.SUPABASE_URL.replace(/\/$/, '');
    remoteJwks = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`));
  }
  return remoteJwks;
}

function assertPayload(payload: jwt.JwtPayload | Record<string, unknown>): SupabaseJwtPayload {
  const sub = payload.sub;
  if (!sub || typeof sub !== 'string') {
    throw AppError.unauthenticated('Token thiếu subject');
  }
  return payload as SupabaseJwtPayload;
}

function verifyHs256(token: string): SupabaseJwtPayload {
  if (!env.SUPABASE_JWT_SECRET) {
    throw AppError.internal('SUPABASE_JWT_SECRET chưa được cấu hình');
  }
  try {
    const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload;
    return assertPayload(payload);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw AppError.unauthenticated('Token không hợp lệ hoặc đã hết hạn');
  }
}

/**
 * Verify Supabase access token.
 * - New projects: ES256/RS256 via JWKS (asymmetric signing keys)
 * - Legacy / local tests: HS256 with SUPABASE_JWT_SECRET
 * Application role is NEVER taken from this payload — only from PostgreSQL users.
 */
export async function verifySupabaseAccessToken(token: string): Promise<SupabaseJwtPayload> {
  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    throw AppError.unauthenticated('Token không hợp lệ hoặc đã hết hạn');
  }

  if (alg === 'HS256') {
    return verifyHs256(token);
  }

  try {
    const issuer = `${env.SUPABASE_URL?.replace(/\/$/, '')}/auth/v1`;
    const { payload } = await jwtVerify(token, getRemoteJwks(), {
      algorithms: ['ES256', 'RS256'],
      issuer,
    });
    return assertPayload(payload as Record<string, unknown>);
  } catch (err) {
    if (err instanceof AppError) throw err;
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
