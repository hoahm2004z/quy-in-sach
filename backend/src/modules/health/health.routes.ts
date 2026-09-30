import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { prisma } from '../../utils/prisma';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    // Spec: plain health payload (not API envelope)
    res.status(200).json({ status: 'ok' });
  }),
);
