import type { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/AppError';
import { extractBearerToken, verifySupabaseAccessToken } from './jwt';
import type { AuthUser } from '../../types/auth';
import { asyncHandler } from '../../utils/asyncHandler';

function toAuthUser(user: {
  id: string;
  supabaseUserId: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}): AuthUser {
  return {
    id: user.id,
    supabaseUserId: user.supabaseUserId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
  };
}

/**
 * Verify JWT and attach local application user.
 * Does NOT trust role from frontend — role comes from PostgreSQL users table.
 */
export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractBearerToken(req.headers.authorization);
  const payload = await verifySupabaseAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { supabaseUserId: payload.sub },
  });

  if (!user) {
    throw AppError.forbidden('Tài khoản chưa được cấp quyền trong hệ thống');
  }

  if (!user.isActive) {
    throw AppError.forbidden('Tài khoản đã bị vô hiệu hóa');
  }

  req.authUser = toAuthUser(user);
  req.clientIp =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : undefined) || req.ip;

  next();
});

export function authorizeAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.authUser) {
    next(AppError.unauthenticated());
    return;
  }

  if (req.authUser.role !== UserRole.ADMIN) {
    next(AppError.forbidden('Chỉ ADMIN được phép truy cập'));
    return;
  }

  next();
}

export const requireAdmin = [authenticate, authorizeAdmin] as const;
