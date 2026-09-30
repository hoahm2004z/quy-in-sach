import { Router } from 'express';
import { authenticate, authorizeAdmin } from '../auth';
import { validate, validatedQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { paramId } from '../../utils/params';
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  softDeleteSchema,
  productIdParamSchema,
} from './product.schemas';
import * as productService from './product.service';
import type { ProductListFilters } from './product.service';

export const adminProductsRouter = Router();

adminProductsRouter.use(authenticate, authorizeAdmin);

adminProductsRouter.get(
  '/',
  validate(listProductsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await productService.listProducts(
      validatedQuery<ProductListFilters>(req),
    );
    sendSuccess(res, result.items, 200, result.meta);
  }),
);

adminProductsRouter.post(
  '/',
  validate(createProductSchema),
  asyncHandler(async (req, res) => {
    const product = await productService.createProduct(req.body, req.authUser!.id, {
      ip: req.clientIp,
      userAgent: req.get('user-agent') ?? undefined,
    });
    sendSuccess(res, product, 201);
  }),
);

adminProductsRouter.get(
  '/:id',
  validate(productIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const product = await productService.getProductById(paramId(req));
    sendSuccess(res, product);
  }),
);

adminProductsRouter.put(
  '/:id',
  validate(productIdParamSchema, 'params'),
  validate(updateProductSchema),
  asyncHandler(async (req, res) => {
    const product = await productService.updateProduct(
      paramId(req),
      req.body,
      req.authUser!.id,
      {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      },
    );
    sendSuccess(res, product);
  }),
);

adminProductsRouter.post(
  '/:id/archive',
  validate(productIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const product = await productService.archiveProduct(paramId(req), req.authUser!.id, {
      ip: req.clientIp,
      userAgent: req.get('user-agent') ?? undefined,
    });
    sendSuccess(res, product);
  }),
);

adminProductsRouter.post(
  '/:id/delete',
  validate(productIdParamSchema, 'params'),
  validate(softDeleteSchema),
  asyncHandler(async (req, res) => {
    const product = await productService.softDeleteProduct(
      paramId(req),
      req.body.deleteReason,
      req.authUser!.id,
      {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      },
    );
    sendSuccess(res, product);
  }),
);

adminProductsRouter.post(
  '/:id/restore',
  validate(productIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const product = await productService.restoreProduct(paramId(req), req.authUser!.id, {
      ip: req.clientIp,
      userAgent: req.get('user-agent') ?? undefined,
    });
    sendSuccess(res, product);
  }),
);
