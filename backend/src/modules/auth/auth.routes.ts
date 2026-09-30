import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { authenticate, authorizeAdmin } from './auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { validate } from '../../middlewares/validate';
import { env } from '../../config';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/AppError';

export const authRouter = Router();

authRouter.get(
  '/me',
  authenticate,
  authorizeAdmin,
  asyncHandler(async (req, res) => {
    sendSuccess(res, {
      id: req.authUser!.id,
      email: req.authUser!.email,
      fullName: req.authUser!.fullName,
      role: req.authUser!.role,
    });
  }),
);

/**
 * Development-only login for local admin UI testing
 * when Supabase project is not yet connected.
 * Disabled unless ALLOW_DEV_LOGIN=true and NODE_ENV !== production.
 */
const devLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/dev-login',
  validate(devLoginSchema),
  asyncHandler(async (req, res) => {
    if (env.NODE_ENV === 'production' || process.env.ALLOW_DEV_LOGIN !== 'true') {
      throw AppError.notFound('Không tìm thấy đường dẫn');
    }

    const expectedPassword = process.env.DEV_ADMIN_PASSWORD || 'admin123';
    const user = await prisma.user.findFirst({
      where: {
        email: req.body.email,
        role: 'ADMIN',
        isActive: true,
      },
    });

    if (!user || req.body.password !== expectedPassword) {
      throw AppError.unauthenticated('Email hoặc mật khẩu không đúng');
    }

    if (!env.SUPABASE_JWT_SECRET) {
      throw AppError.internal('SUPABASE_JWT_SECRET chưa cấu hình');
    }

    const accessToken = jwt.sign(
      {
        email: user.email,
        role: 'authenticated',
      },
      env.SUPABASE_JWT_SECRET,
      {
        algorithm: 'HS256',
        subject: user.supabaseUserId,
        expiresIn: '8h',
      },
    );

    sendSuccess(res, {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    });
  }),
);
