import { Router } from 'express';
import { authenticate, authorizeAdmin } from '../auth';
import { validate, validatedQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { paramId } from '../../utils/params';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
  softDeleteSchema,
  voidSchema,
  idParamSchema,
} from './expense.schemas';
import * as expenseService from './expense.service';

export const adminExpensesRouter = Router();
adminExpensesRouter.use(authenticate, authorizeAdmin);

adminExpensesRouter.get(
  '/',
  validate(listExpensesQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await expenseService.listExpenses(validatedQuery(req));
    sendSuccess(res, result.items, 200, result.meta);
  }),
);

adminExpensesRouter.post(
  '/',
  validate(createExpenseSchema),
  asyncHandler(async (req, res) => {
    const item = await expenseService.createExpense(req.body, req.authUser!.id, {
      ip: req.clientIp,
      userAgent: req.get('user-agent') ?? undefined,
    });
    sendSuccess(res, item, 201);
  }),
);

adminExpensesRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await expenseService.getExpenseById(paramId(req)));
  }),
);

adminExpensesRouter.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateExpenseSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await expenseService.updateExpense(paramId(req), req.body, req.authUser!.id, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  }),
);

adminExpensesRouter.post(
  '/:id/confirm',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await expenseService.confirmExpense(paramId(req), req.authUser!.id, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  }),
);

adminExpensesRouter.post(
  '/:id/void',
  validate(idParamSchema, 'params'),
  validate(voidSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await expenseService.voidExpense(paramId(req), req.authUser!.id, req.body.reason, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  }),
);

adminExpensesRouter.post(
  '/:id/delete',
  validate(idParamSchema, 'params'),
  validate(softDeleteSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await expenseService.softDeleteExpense(
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

adminExpensesRouter.post(
  '/:id/restore',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await expenseService.restoreExpense(paramId(req), req.authUser!.id, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  }),
);
