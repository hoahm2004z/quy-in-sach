import { z } from 'zod';
import { ExpenseStatus } from '@prisma/client';

/** Category that requires linking to a product (printing costs). */
export const PRINT_EXPENSE_CATEGORY = 'In ấn';

const positiveAmount = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
    message: 'Số tiền phải > 0',
  });

export const createExpenseSchema = z
  .object({
    productId: z.string().uuid().optional().nullable(),
    category: z.string().trim().min(1).max(100),
    amount: positiveAmount,
    expenseDate: z.string().date(),
    description: z.string().trim().min(1).max(2000),
    invoiceMediaId: z.string().uuid().optional().nullable(),
    isPublic: z.boolean().optional().default(false),
    note: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.category === PRINT_EXPENSE_CATEGORY && !data.productId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productId'],
        message: 'Danh mục In ấn bắt buộc chọn Sách/Loa liên quan',
      });
    }
  });

export const updateExpenseSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  category: z.string().trim().min(1).max(100).optional(),
  amount: positiveAmount.optional(),
  expenseDate: z.string().date().optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  invoiceMediaId: z.string().uuid().optional().nullable(),
  isPublic: z.boolean().optional(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const listExpensesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.nativeEnum(ExpenseStatus).optional(),
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
