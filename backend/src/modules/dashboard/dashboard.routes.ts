import { Router } from 'express';
import { authenticate, authorizeAdmin } from '../auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { getAdminDashboard } from './dashboard.service';

export const adminDashboardRouter = Router();

adminDashboardRouter.get(
  '/',
  authenticate,
  authorizeAdmin,
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await getAdminDashboard());
  }),
);
