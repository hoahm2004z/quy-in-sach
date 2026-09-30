import { z } from 'zod';

export const mediaPurposeSchema = z.enum(['cover', 'proof', 'invoice']);

export const uploadUrlSchema = z.object({
  purpose: mediaPurposeSchema,
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(3).max(100),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
  altText: z.string().trim().max(500).optional().nullable(),
});

export const confirmMediaSchema = z.object({
  fileSize: z.number().int().positive().max(10 * 1024 * 1024).optional(),
});

export const softDeleteMediaSchema = z.object({
  deleteReason: z.string().trim().min(1, 'Cần lý do xóa').max(500),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
