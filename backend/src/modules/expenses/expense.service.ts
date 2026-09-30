import { ExpenseStatus, Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/AppError';
import { writeAuditLog } from '../audit/audit.service';
import { invalidatePublicCache } from '../transparency/public.service';
import { assertUsableMedia } from '../media/media.service';
import { PRINT_EXPENSE_CATEGORY } from './expense.schemas';

function money(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function assertPrintCategoryHasProduct(
  category: string,
  productId: string | null | undefined,
): void {
  if (category.trim() === PRINT_EXPENSE_CATEGORY && !productId) {
    throw AppError.validation('Danh mục In ấn bắt buộc chọn Sách/Loa liên quan');
  }
}

async function assertProductExists(productId: string | null | undefined): Promise<void> {
  if (!productId) return;
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
  });
  if (!product) throw AppError.badRequest('Sản phẩm không tồn tại');
}

export function toAdminExpenseDto(e: {
  id: string;
  productId: string | null;
  category: string;
  amount: Prisma.Decimal;
  expenseDate: Date;
  description: string;
  invoiceMediaId: string | null;
  status: ExpenseStatus;
  isPublic: boolean;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deleteReason: string | null;
}) {
  return {
    id: e.id,
    productId: e.productId,
    category: e.category,
    amount: money(e.amount),
    expenseDate: e.expenseDate,
    description: e.description,
    invoiceMediaId: e.invoiceMediaId,
    status: e.status,
    isPublic: e.isPublic,
    note: e.note,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    deletedAt: e.deletedAt,
    deleteReason: e.deleteReason,
  };
}

export async function listExpenses(filters: {
  page: number;
  pageSize: number;
  status?: ExpenseStatus;
  search?: string;
  productId?: string;
}) {
  const where: Prisma.ExpenseWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.productId) where.productId = filters.productId;
  if (filters.search) {
    where.OR = [
      { description: { contains: filters.search, mode: 'insensitive' } },
      { category: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const skip = (filters.page - 1) * filters.pageSize;
  const [total, items] = await prisma.$transaction([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      skip,
      take: filters.pageSize,
    }),
  ]);

  return {
    items: items.map(toAdminExpenseDto),
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize) || 1,
    },
  };
}

export async function getExpenseById(id: string) {
  const expense = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
  if (!expense) throw AppError.notFound('Không tìm thấy khoản chi');
  return toAdminExpenseDto(expense);
}

type CreateInput = {
  productId?: string | null;
  category: string;
  amount: string;
  expenseDate: string;
  description: string;
  invoiceMediaId?: string | null;
  isPublic: boolean;
  note?: string | null;
};

export async function createExpense(
  input: CreateInput,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  assertPrintCategoryHasProduct(input.category, input.productId);
  await assertProductExists(input.productId);
  await assertUsableMedia(input.invoiceMediaId, 'invoice');

  const expense = await prisma.expense.create({
    data: {
      productId: input.productId ?? null,
      category: input.category,
      amount: input.amount,
      expenseDate: new Date(input.expenseDate),
      description: input.description,
      invoiceMediaId: input.invoiceMediaId ?? null,
      status: ExpenseStatus.PENDING,
      isPublic: input.isPublic,
      note: input.note ?? null,
      createdById: userId,
    },
  });

  const dto = toAdminExpenseDto(expense);
  await writeAuditLog({
    userId,
    action: 'CREATE',
    entity: 'expense',
    entityId: expense.id,
    newValue: dto,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return dto;
}

export async function updateExpense(
  id: string,
  input: Partial<CreateInput>,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw AppError.notFound('Không tìm thấy khoản chi');
  if (existing.status !== ExpenseStatus.PENDING) {
    throw AppError.conflict('Chỉ sửa được khoản chi đang chờ xác nhận');
  }

  const nextCategory = input.category ?? existing.category;
  const nextProductId =
    input.productId !== undefined ? input.productId : existing.productId;

  assertPrintCategoryHasProduct(nextCategory, nextProductId);
  await assertProductExists(nextProductId);

  if (input.invoiceMediaId !== undefined) {
    await assertUsableMedia(input.invoiceMediaId, 'invoice');
  }

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...(input.productId !== undefined ? { productId: input.productId } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.expenseDate !== undefined
        ? { expenseDate: new Date(input.expenseDate) }
        : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.invoiceMediaId !== undefined ? { invoiceMediaId: input.invoiceMediaId } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  });

  const dto = toAdminExpenseDto(expense);
  await writeAuditLog({
    userId,
    action: 'UPDATE',
    entity: 'expense',
    entityId: id,
    oldValue: toAdminExpenseDto(existing),
    newValue: dto,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return dto;
}

export async function confirmExpense(
  id: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const result = await prisma.expense.updateMany({
    where: { id, status: ExpenseStatus.PENDING, deletedAt: null },
    data: { status: ExpenseStatus.CONFIRMED },
  });

  if (result.count === 0) {
    const existing = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Không tìm thấy khoản chi');
    throw AppError.conflict('Khoản chi không đang chờ xác nhận hoặc đã được xác nhận');
  }

  const expense = await prisma.expense.findUniqueOrThrow({ where: { id } });
  const dto = toAdminExpenseDto(expense);
  await writeAuditLog({
    userId,
    action: 'CONFIRM',
    entity: 'expense',
    entityId: id,
    oldValue: { status: ExpenseStatus.PENDING },
    newValue: { status: ExpenseStatus.CONFIRMED },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return dto;
}

export async function voidExpense(
  id: string,
  userId: string,
  reason?: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw AppError.notFound('Không tìm thấy khoản chi');
  if (existing.status === ExpenseStatus.VOIDED) {
    throw AppError.conflict('Khoản chi đã bị hủy');
  }

  const result = await prisma.expense.updateMany({
    where: {
      id,
      status: { in: [ExpenseStatus.PENDING, ExpenseStatus.CONFIRMED] },
      deletedAt: null,
    },
    data: {
      status: ExpenseStatus.VOIDED,
      note: reason
        ? [existing.note, `VOID: ${reason}`].filter(Boolean).join('\n')
        : existing.note,
    },
  });

  if (result.count === 0) {
    throw AppError.conflict('Không thể hủy khoản chi này');
  }

  const expense = await prisma.expense.findUniqueOrThrow({ where: { id } });
  await writeAuditLog({
    userId,
    action: 'VOID',
    entity: 'expense',
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { status: ExpenseStatus.VOIDED, reason: reason ?? null },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return toAdminExpenseDto(expense);
}

export async function softDeleteExpense(
  id: string,
  deleteReason: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.expense.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw AppError.notFound('Không tìm thấy khoản chi');
  if (existing.status === ExpenseStatus.CONFIRMED) {
    throw AppError.conflict('Không xóa được khoản chi đã xác nhận — hãy hủy giao dịch trước');
  }

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: userId,
      deleteReason,
    },
  });

  await writeAuditLog({
    userId,
    action: 'SOFT_DELETE',
    entity: 'expense',
    entityId: id,
    newValue: { deletedAt: expense.deletedAt, deleteReason },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return toAdminExpenseDto(expense);
}

export async function restoreExpense(
  id: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.expense.findFirst({
    where: { id, deletedAt: { not: null } },
  });
  if (!existing) throw AppError.notFound('Không tìm thấy khoản chi trong thùng rác');

  const expense = await prisma.expense.update({
    where: { id },
    data: { deletedAt: null, deletedById: null, deleteReason: null },
  });

  await writeAuditLog({
    userId,
    action: 'RESTORE',
    entity: 'expense',
    entityId: id,
    oldValue: { deletedAt: existing.deletedAt },
    newValue: { deletedAt: null },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return toAdminExpenseDto(expense);
}
