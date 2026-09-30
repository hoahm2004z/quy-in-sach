import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorizeAdmin } from '../auth';
import { validate, validatedQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { paramId } from '../../utils/params';
import {
  createCompanionSchema,
  updateCompanionSchema,
  softDeleteSchema,
  idParamSchema,
} from './companion.schemas';
import * as companionService from './companion.service';
import * as productService from '../products/product.service';
import * as donationService from '../donations/donation.service';
import * as expenseService from '../expenses/expense.service';
import { AppError } from '../../utils/AppError';

export const adminCompanionsRouter = Router();
adminCompanionsRouter.use(authenticate, authorizeAdmin);

adminCompanionsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await companionService.listCompanions());
  }),
);

adminCompanionsRouter.post(
  '/',
  validate(createCompanionSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await companionService.createCompanion(req.body, req.authUser!.id, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
      201,
    );
  }),
);

adminCompanionsRouter.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateCompanionSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await companionService.updateCompanion(paramId(req), req.body, req.authUser!.id, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  }),
);

adminCompanionsRouter.post(
  '/:id/delete',
  validate(idParamSchema, 'params'),
  validate(softDeleteSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await companionService.softDeleteCompanion(
        paramId(req),
        req.body.deleteReason,
        req.authUser!.id,
        {
          ip: req.clientIp,
          userAgent: req.get('user-agent') ?? undefined,
        },
      ),
    );
  }),
);

adminCompanionsRouter.post(
  '/:id/restore',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await companionService.restoreCompanion(paramId(req), req.authUser!.id, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  }),
);

export const adminAuditRouter = Router();
adminAuditRouter.use(authenticate, authorizeAdmin);

const auditQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

adminAuditRouter.get(
  '/',
  validate(auditQuery, 'query'),
  asyncHandler(async (req, res) => {
    const result = await companionService.listAuditLogs(validatedQuery(req));
    sendSuccess(res, result.items, 200, result.meta);
  }),
);

export const adminTrashRouter = Router();
adminTrashRouter.use(authenticate, authorizeAdmin);

adminTrashRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await companionService.listTrash());
  }),
);

const restoreBody = z.object({
  entity: z.enum(['product', 'donation', 'expense', 'companion']),
});

adminTrashRouter.post(
  '/:id/restore',
  validate(idParamSchema, 'params'),
  validate(restoreBody),
  asyncHandler(async (req, res) => {
    const id = paramId(req);
    const meta = {
      ip: req.clientIp,
      userAgent: req.get('user-agent') ?? undefined,
    };
    const userId = req.authUser!.id;
    switch (req.body.entity as string) {
      case 'product':
        sendSuccess(res, await productService.restoreProduct(id, userId, meta));
        return;
      case 'donation':
        sendSuccess(res, await donationService.restoreDonation(id, userId, meta));
        return;
      case 'expense':
        sendSuccess(res, await expenseService.restoreExpense(id, userId, meta));
        return;
      case 'companion':
        sendSuccess(res, await companionService.restoreCompanion(id, userId, meta));
        return;
      default:
        throw AppError.badRequest('Loại dữ liệu không hợp lệ');
    }
  }),
);
