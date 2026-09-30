import { Prisma, ProductStatus, ProductType, ExpenseStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/AppError';
import { writeAuditLog } from '../audit/audit.service';
import { invalidatePublicCache } from '../transparency/public.service';
import { resolvePublicUrl, resolvePublicUrlMap } from '../media/media.urls';
import { assertUsableMedia } from '../media/media.service';

export type ProductListFilters = {
  page: number;
  pageSize: number;
  type?: ProductType;
  status?: ProductStatus;
  search?: string;
  includeDeleted?: boolean;
};

function decimalToNumber(value: Prisma.Decimal | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

async function getActualCostMap(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();

  const rows = await prisma.expense.groupBy({
    by: ['productId'],
    where: {
      productId: { in: productIds },
      status: ExpenseStatus.CONFIRMED,
      deletedAt: null,
    },
    _sum: { amount: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.productId) {
      map.set(row.productId, decimalToNumber(row._sum.amount));
    }
  }
  return map;
}

export function toAdminProductDto(
  product: {
    id: string;
    name: string;
    description: string | null;
    productType: ProductType;
    status: ProductStatus;
    budgetEstimate: Prisma.Decimal;
    plannedQuantity: number;
    printedQuantity: number;
    stockQuantity: number;
    plannedDate: Date | null;
    completedDate: Date | null;
    coverMediaId: string | null;
    isPublic: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    deleteReason: string | null;
  },
  actualCost: number,
  coverUrl: string | null = null,
) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    productType: product.productType,
    status: product.status,
    budgetEstimate: decimalToNumber(product.budgetEstimate),
    actualCost,
    plannedQuantity: product.plannedQuantity,
    printedQuantity: product.printedQuantity,
    stockQuantity: product.stockQuantity,
    plannedDate: product.plannedDate,
    completedDate: product.completedDate,
    coverMediaId: product.coverMediaId,
    coverUrl,
    isPublic: product.isPublic,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    deletedAt: product.deletedAt,
    deleteReason: product.deleteReason,
  };
}

export async function listProducts(filters: ProductListFilters) {
  const where: Prisma.ProductWhereInput = {};

  if (!filters.includeDeleted) {
    where.deletedAt = null;
  }
  if (filters.type) where.productType = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' };
  }

  const skip = (filters.page - 1) * filters.pageSize;

  const [total, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.pageSize,
    }),
  ]);

  const costMap = await getActualCostMap(items.map((p) => p.id));
  const coverMap = await resolvePublicUrlMap(items.map((p) => p.coverMediaId));

  return {
    items: items.map((p) =>
      toAdminProductDto(p, costMap.get(p.id) ?? 0, coverMap.get(p.coverMediaId ?? '') ?? null),
    ),
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize) || 1,
    },
  };
}

export async function getProductById(id: string) {
  const product = await prisma.product.findFirst({ where: { id } });
  if (!product) {
    throw AppError.notFound('Không tìm thấy sản phẩm');
  }
  const costMap = await getActualCostMap([id]);
  const coverUrl = await resolvePublicUrl(product.coverMediaId);
  return toAdminProductDto(product, costMap.get(id) ?? 0, coverUrl);
}

type CreateInput = {
  name: string;
  description?: string | null;
  productType: ProductType;
  status: ProductStatus;
  budgetEstimate: string;
  plannedQuantity: number;
  printedQuantity: number;
  stockQuantity: number;
  plannedDate?: string | null;
  completedDate?: string | null;
  coverMediaId?: string | null;
  isPublic: boolean;
};

export async function createProduct(
  input: CreateInput,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  await assertUsableMedia(input.coverMediaId, 'cover');

  const product = await prisma.product.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      productType: input.productType,
      status: input.status,
      budgetEstimate: input.budgetEstimate,
      plannedQuantity: input.plannedQuantity,
      printedQuantity: input.printedQuantity,
      stockQuantity: input.stockQuantity,
      plannedDate: input.plannedDate ? new Date(input.plannedDate) : null,
      completedDate: input.completedDate ? new Date(input.completedDate) : null,
      coverMediaId: input.coverMediaId ?? null,
      isPublic: input.isPublic,
      createdById: userId,
      updatedById: userId,
    },
  });

  const coverUrl = await resolvePublicUrl(product.coverMediaId);
  const dto = toAdminProductDto(product, 0, coverUrl);

  await writeAuditLog({
    userId,
    action: 'CREATE',
    entity: 'product',
    entityId: product.id,
    newValue: dto,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  invalidatePublicCache();
  return dto;
}

type UpdateInput = Partial<CreateInput>;

export async function updateProduct(
  id: string,
  input: UpdateInput,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.product.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw AppError.notFound('Không tìm thấy sản phẩm');
  }

  const nextStatus = input.status ?? existing.status;
  const nextCompleted =
    input.completedDate !== undefined
      ? input.completedDate
      : existing.completedDate
        ? existing.completedDate.toISOString().slice(0, 10)
        : null;
  const nextPrinted = input.printedQuantity ?? existing.printedQuantity;

  if (nextStatus === ProductStatus.PRINTED) {
    if (!nextCompleted) {
      throw AppError.validation('Khi chuyển sang Đã in cần ngày hoàn thành');
    }
    if (nextPrinted <= 0) {
      throw AppError.validation('Khi chuyển sang Đã in cần số lượng đã in > 0');
    }
  }

  if (input.coverMediaId !== undefined) {
    await assertUsableMedia(input.coverMediaId, 'cover');
  }

  // Reject mass-assignment of financial derived fields / ownership
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.productType !== undefined ? { productType: input.productType } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.budgetEstimate !== undefined ? { budgetEstimate: input.budgetEstimate } : {}),
      ...(input.plannedQuantity !== undefined ? { plannedQuantity: input.plannedQuantity } : {}),
      ...(input.printedQuantity !== undefined ? { printedQuantity: input.printedQuantity } : {}),
      ...(input.stockQuantity !== undefined ? { stockQuantity: input.stockQuantity } : {}),
      ...(input.plannedDate !== undefined
        ? { plannedDate: input.plannedDate ? new Date(input.plannedDate) : null }
        : {}),
      ...(input.completedDate !== undefined
        ? { completedDate: input.completedDate ? new Date(input.completedDate) : null }
        : {}),
      ...(input.coverMediaId !== undefined ? { coverMediaId: input.coverMediaId } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      updatedById: userId,
    },
  });

  const costMap = await getActualCostMap([id]);
  const coverUrl = await resolvePublicUrl(product.coverMediaId);
  const dto = toAdminProductDto(product, costMap.get(id) ?? 0, coverUrl);
  const oldCoverUrl = await resolvePublicUrl(existing.coverMediaId);

  await writeAuditLog({
    userId,
    action: 'UPDATE',
    entity: 'product',
    entityId: id,
    oldValue: toAdminProductDto(existing, costMap.get(id) ?? 0, oldCoverUrl),
    newValue: dto,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  invalidatePublicCache();
  return dto;
}

export async function archiveProduct(
  id: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.product.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw AppError.notFound('Không tìm thấy sản phẩm');
  }
  if (existing.status === ProductStatus.ARCHIVED) {
    throw AppError.conflict('Sản phẩm đã được archive');
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      status: ProductStatus.ARCHIVED,
      updatedById: userId,
    },
  });

  const costMap = await getActualCostMap([id]);
  const dto = toAdminProductDto(product, costMap.get(id) ?? 0);

  await writeAuditLog({
    userId,
    action: 'ARCHIVE',
    entity: 'product',
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { status: ProductStatus.ARCHIVED },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  invalidatePublicCache();
  return dto;
}

export async function softDeleteProduct(
  id: string,
  deleteReason: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.product.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) {
    throw AppError.notFound('Không tìm thấy sản phẩm');
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: userId,
      deleteReason,
      updatedById: userId,
    },
  });

  await writeAuditLog({
    userId,
    action: 'SOFT_DELETE',
    entity: 'product',
    entityId: id,
    oldValue: { deletedAt: null },
    newValue: { deletedAt: product.deletedAt, deleteReason },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  const costMap = await getActualCostMap([id]);
  invalidatePublicCache();
  return toAdminProductDto(product, costMap.get(id) ?? 0);
}

export async function restoreProduct(
  id: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.product.findFirst({
    where: { id, deletedAt: { not: null } },
  });
  if (!existing) {
    throw AppError.notFound('Không tìm thấy sản phẩm trong thùng rác');
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      deletedAt: null,
      deletedById: null,
      deleteReason: null,
      updatedById: userId,
    },
  });

  await writeAuditLog({
    userId,
    action: 'RESTORE',
    entity: 'product',
    entityId: id,
    oldValue: {
      deletedAt: existing.deletedAt,
      deleteReason: existing.deleteReason,
    },
    newValue: { deletedAt: null },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });

  const costMap = await getActualCostMap([id]);
  invalidatePublicCache();
  return toAdminProductDto(product, costMap.get(id) ?? 0);
}
