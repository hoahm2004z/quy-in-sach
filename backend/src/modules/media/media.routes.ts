import { Router, raw } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { authenticate, authorizeAdmin } from '../auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { paramId } from '../../utils/params';
import { AppError } from '../../utils/AppError';
import {
  confirmMediaSchema,
  idParamSchema,
  softDeleteMediaSchema,
  uploadUrlSchema,
} from './media.schemas';
import * as mediaService from './media.service';
import {
  localObjectAbsolutePath,
  verifyLocalDownloadToken,
  verifyLocalUploadToken,
  writeLocalUpload,
} from './storage.local';
import { isSupabaseStorageConfigured } from './storage';
import { MAX_UPLOAD_BYTES } from './storage';

export const adminMediaRouter = Router();

/**
 * Local signed upload — auth is the one-time JWT in the URL (not Bearer).
 * Only used when Supabase Storage is not configured.
 */
adminMediaRouter.put(
  '/local-upload/:token',
  raw({ type: '*/*', limit: MAX_UPLOAD_BYTES }),
  asyncHandler(async (req, res) => {
    if (isSupabaseStorageConfigured()) {
      throw AppError.badRequest('Local upload chỉ dùng khi chưa cấu hình Supabase Storage');
    }
    const token = String(req.params.token ?? '');
    const payload = verifyLocalUploadToken(token);
    const body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.body ? String(req.body) : '');

    if (!body.length) {
      throw AppError.badRequest('Nội dung file trống');
    }
    if (body.length > MAX_UPLOAD_BYTES) {
      throw AppError.badRequest('File vượt quá 10MB');
    }

    await writeLocalUpload(payload.bucket, payload.storagePath, body);
    sendSuccess(res, {
      mediaId: payload.mediaId,
      bytes: body.length,
    });
  }),
);

/**
 * Local signed download for private documents.
 * Auth via download JWT (admin obtained URL from access-url endpoint).
 */
adminMediaRouter.get(
  '/local-download/:token',
  asyncHandler(async (req, res) => {
    if (isSupabaseStorageConfigured()) {
      throw AppError.badRequest('Local download chỉ dùng khi chưa cấu hình Supabase Storage');
    }
    const token = String(req.params.token ?? '');
    const payload = verifyLocalDownloadToken(token);
    const full = localObjectAbsolutePath(payload.bucket, payload.storagePath);
    if (!fs.existsSync(full)) {
      throw AppError.notFound('Không tìm thấy file');
    }
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(full)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(fs.readFileSync(full));
  }),
);

adminMediaRouter.use(authenticate, authorizeAdmin);

adminMediaRouter.post(
  '/upload-url',
  validate(uploadUrlSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await mediaService.createUploadUrl(req.body, req.authUser!.id, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
      201,
    );
  }),
);

adminMediaRouter.post(
  '/:id/confirm',
  validate(idParamSchema, 'params'),
  validate(confirmMediaSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await mediaService.confirmUpload(paramId(req), req.authUser!.id, req.body, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  }),
);

adminMediaRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await mediaService.getMediaById(paramId(req)));
  }),
);

adminMediaRouter.get(
  '/:id/access-url',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await mediaService.getAccessUrl(paramId(req), req.authUser!.id));
  }),
);

adminMediaRouter.post(
  '/:id/delete',
  validate(idParamSchema, 'params'),
  validate(softDeleteMediaSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await mediaService.softDeleteMedia(
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

adminMediaRouter.post(
  '/:id/restore',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    sendSuccess(
      res,
      await mediaService.restoreMedia(paramId(req), req.authUser!.id, {
        ip: req.clientIp,
        userAgent: req.get('user-agent') ?? undefined,
      }),
    );
  }),
);
