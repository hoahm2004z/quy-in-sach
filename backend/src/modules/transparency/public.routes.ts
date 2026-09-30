import { Router } from 'express';
import { z } from 'zod';
import { ProductStatus, ProductType } from '@prisma/client';
import { validate, validatedQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { paramId } from '../../utils/params';
import * as publicService from './public.service';

const listProductsQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.nativeEnum(ProductType).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
});

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const idParam = z.object({ id: z.string().uuid() });

export const publicRouter = Router();

publicRouter.get(
  '/statistics',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await publicService.getPublicStatistics());
  }),
);

publicRouter.get(
  '/products',
  validate(listProductsQuery, 'query'),
  asyncHandler(async (req, res) => {
    const result = await publicService.listPublicProducts(validatedQuery(req));
    sendSuccess(res, result.items, 200, result.meta);
  }),
);

publicRouter.get(
  '/products/:id',
  validate(idParam, 'params'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await publicService.getPublicProductById(paramId(req)));
  }),
);

publicRouter.get(
  '/donations',
  validate(paginationQuery, 'query'),
  asyncHandler(async (req, res) => {
    const result = await publicService.listPublicDonations(validatedQuery(req));
    sendSuccess(res, result.items, 200, result.meta);
  }),
);

publicRouter.get(
  '/expenses',
  validate(paginationQuery, 'query'),
  asyncHandler(async (req, res) => {
    const result = await publicService.listPublicExpenses(validatedQuery(req));
    sendSuccess(res, result.items, 200, result.meta);
  }),
);

publicRouter.get(
  '/companions',
  asyncHandler(async (_req, res) => {
    sendSuccess(res, await publicService.listPublicCompanions());
  }),
);
