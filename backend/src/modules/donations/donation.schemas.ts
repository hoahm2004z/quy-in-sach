import { z } from 'zod';
import { DonationStatus } from '@prisma/client';

const positiveAmount = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
    message: 'Số tiền phải > 0',
  });

export const createDonationSchema = z.object({
  donorName: z.string().trim().min(1).max(200),
  displayName: z.string().trim().max(200).optional().nullable(),
  isAnonymous: z.boolean().optional().default(false),
  amount: positiveAmount,
  donatedAt: z.string().datetime({ offset: true }).or(z.string().datetime()),
  content: z.string().trim().max(2000).optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  isPublic: z.boolean().optional().default(false),
  proofMediaId: z.string().uuid().optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const updateDonationSchema = createDonationSchema.partial();

export const listDonationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.nativeEnum(DonationStatus).optional(),
  search: z.string().trim().max(200).optional(),
  productId: z.string().uuid().optional(),
});

export const softDeleteSchema = z.object({
  deleteReason: z.string().trim().min(1).max(500),
});

export const voidSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
