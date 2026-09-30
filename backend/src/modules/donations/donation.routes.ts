import { Router } from 'express';
import { authenticate, authorizeAdmin } from '../auth';
import { validate, validatedQuery } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { paramId } from '../../utils/params';
import {
  createDonationSchema,
  updateDonationSchema,
  listDonationsQuerySchema,
  softDeleteSchema,
  voidSchema,
  idParamSchema,
} from './donation.schemas';
import * as donationService from './donation.service';

export const adminDonationsRouter = Router();
adminDonationsRouter.use(authenticate, authorizeAdmin);

adminDonationsRouter.get(
  '/',
  validate(listDonationsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await donationService.listDonations(validatedQuery(req));
    sendSuccess(res, result.items, 200, result.meta);
  }),
);

adminDonationsRouter.post(
  '/',
  validate(createDonationSchema),
  asyncHandler(async (req, res) => {
    const item = await donationService.createDonation(req.body, req.authUser!.id, {
      ip: req.clientIp,
      userAgent: req.get('user-agent') ?? undefined,
    });
    sendSuccess(res, item, 201);
  }),
);

adminDonationsRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await donationService.getDonationById(paramId(req)));
  }),
);

adminDonationsRouter.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateDonationSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await donationService.updateDonation(paramId(req), req.body, req.authUser!.id, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  }),
);

adminDonationsRouter.post(
  '/:id/confirm',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await donationService.confirmDonation(paramId(req), req.authUser!.id, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  }),
);

adminDonationsRouter.post(
  '/:id/void',
  validate(idParamSchema, 'params'),
  validate(voidSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await donationService.voidDonation(
        paramId(req),
        req.authUser!.id,
        req.body.reason,
        {
          ip: req.clientIp,
          userAgent: req.get('user-agent') ?? undefined,
        },
      ),
    );
  }),
);

adminDonationsRouter.post(
  '/:id/delete',
  validate(idParamSchema, 'params'),
  validate(softDeleteSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await donationService.softDeleteDonation(
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

adminDonationsRouter.post(
  '/:id/restore',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await donationService.restoreDonation(paramId(req), req.authUser!.id, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  }),
);
