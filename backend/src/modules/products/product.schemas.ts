import { z } from 'zod';
import { ProductStatus, ProductType } from '@prisma/client';

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, {
    message: 'Số tiền phải >= 0',
  });

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Tên bắt buộc').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  productType: z.nativeEnum(ProductType),
  status: z.nativeEnum(ProductStatus),
  budgetEstimate: decimalString.optional().default('0'),
  plannedQuantity: z.number().int().min(0).optional().default(0),
  printedQuantity: z.number().int().min(0).optional().default(0),
  stockQuantity: z.number().int().min(0).optional().default(0),
  plannedDate: z.string().date().optional().nullable(),
  completedDate: z.string().date().optional().nullable(),
  coverMediaId: z.string().uuid().optional().nullable(),
  isPublic: z.boolean().optional().default(true),
}).superRefine((data, ctx) => {
  if (data.status === ProductStatus.PRINTED) {
    if (!data.completedDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completedDate'],
        message: 'Sách/loa đã in cần ngày hoàn thành',
      });
    }
    if ((data.printedQuantity ?? 0) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['printedQuantity'],
        message: 'Sách/loa đã in cần số lượng đã in > 0',
      });
    }
  }
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  productType: z.nativeEnum(ProductType).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  budgetEstimate: decimalString.optional(),
  plannedQuantity: z.number().int().min(0).optional(),
  printedQuantity: z.number().int().min(0).optional(),
  stockQuantity: z.number().int().min(0).optional(),
  plannedDate: z.string().date().optional().nullable(),
  completedDate: z.string().date().optional().nullable(),
  coverMediaId: z.string().uuid().optional().nullable(),
  isPublic: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.status === ProductStatus.PRINTED) {
    if (data.completedDate === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['completedDate'],
        message: 'Khi chuyển sang Đã in cần ngày hoàn thành',
      });
    }
    if (data.printedQuantity !== undefined && data.printedQuantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['printedQuantity'],
        message: 'Khi chuyển sang Đã in cần số lượng đã in > 0',
      });
    }
  }
});

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  type: z.nativeEnum(ProductType).optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  search: z.string().trim().max(200).optional(),
  includeDeleted: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .default('false')
    .transform((v) => v === 'true'),
});

export const softDeleteSchema = z.object({
  deleteReason: z.string().trim().min(1, 'Cần lý do xóa').max(500),
});

export const productIdParamSchema = z.object({
  id: z.string().uuid(),
});
