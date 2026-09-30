import {
  DonationStatus,
  ExpenseStatus,
  Prisma,
  ProductStatus,
  ProductType,
} from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/AppError';
import { getFinancialSummary } from '../dashboard/dashboard.service';
import { publicCache, PUBLIC_CACHE_TTL_MS } from '../../utils/cache';
import { resolvePublicUrl, resolvePublicUrlMap } from '../media/media.urls';

function money(value: Prisma.Decimal | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

async function actualCost(productId: string): Promise<number> {
  const agg = await prisma.expense.aggregate({
    where: {
      productId,
      status: ExpenseStatus.CONFIRMED,
      deletedAt: null,
    },
    _sum: { amount: true },
  });
  return money(agg._sum.amount);
}

export async function getPublicStatistics() {
  const cacheKey = 'public:statistics';
  const cached = publicCache.get<Awaited<ReturnType<typeof getFinancialSummary>>>(cacheKey);
  if (cached) return cached;

  const summary = await getFinancialSummary();
  publicCache.set(cacheKey, summary, PUBLIC_CACHE_TTL_MS);
  return summary;
}

export async function listPublicProducts(filters: {
  page: number;
  pageSize: number;
  type?: ProductType;
  status?: ProductStatus;
}) {
  const cacheKey = `public:products:${filters.type ?? 'all'}:${filters.status ?? 'all'}:${filters.page}:${filters.pageSize}`;
  const cached = publicCache.get<{
    items: unknown[];
    meta: Record<string, number>;
  }>(cacheKey);
  if (cached) return cached;

  const where: Prisma.ProductWhereInput = {
    isPublic: true,
    deletedAt: null,
    status: { not: ProductStatus.ARCHIVED },
  };

  if (filters.type) where.productType = filters.type;
  if (filters.status) where.status = filters.status;

  // SPEAKER filter: type only (any non-archived public)
  if (filters.type === ProductType.SPEAKER && !filters.status) {
    delete (where as { status?: unknown }).status;
    where.status = { not: ProductStatus.ARCHIVED };
  }

  const skip = (filters.page - 1) * filters.pageSize;
  const [total, items] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.pageSize,
      select: {
        id: true,
        name: true,
        description: true,
        productType: true,
        status: true,
        budgetEstimate: true,
        plannedQuantity: true,
        printedQuantity: true,
        stockQuantity: true,
        plannedDate: true,
        completedDate: true,
        coverMediaId: true,
      },
    }),
  ]);

  const coverMap = await resolvePublicUrlMap(items.map((p) => p.coverMediaId));

  const withCost = await Promise.all(
    items.map(async (p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      productType: p.productType,
      status: p.status,
      budgetEstimate: money(p.budgetEstimate),
      actualCost: await actualCost(p.id),
      plannedQuantity: p.plannedQuantity,
      printedQuantity: p.printedQuantity,
      stockQuantity: p.stockQuantity,
      plannedDate: p.plannedDate,
      completedDate: p.completedDate,
      coverMediaId: p.coverMediaId,
      coverUrl: coverMap.get(p.coverMediaId ?? '') ?? null,
    })),
  );

  const result = {
    items: withCost,
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize) || 1,
    },
  };
  publicCache.set(cacheKey, result, PUBLIC_CACHE_TTL_MS);
  return result;
}

export async function getPublicProductById(id: string) {
  const product = await prisma.product.findFirst({
    where: {
      id,
      isPublic: true,
      deletedAt: null,
      status: { not: ProductStatus.ARCHIVED },
    },
    select: {
      id: true,
      name: true,
      description: true,
      productType: true,
      status: true,
      budgetEstimate: true,
      plannedQuantity: true,
      printedQuantity: true,
      stockQuantity: true,
      plannedDate: true,
      completedDate: true,
      coverMediaId: true,
    },
  });

  if (!product) throw AppError.notFound('Không tìm thấy sản phẩm');

  const relatedExpenses = await prisma.expense.findMany({
    where: {
      productId: id,
      status: ExpenseStatus.CONFIRMED,
      isPublic: true,
      deletedAt: null,
    },
    orderBy: { expenseDate: 'desc' },
    select: {
      id: true,
      category: true,
      amount: true,
      expenseDate: true,
      description: true,
    },
  });

  return {
    ...product,
    budgetEstimate: money(product.budgetEstimate),
    actualCost: await actualCost(id),
    coverUrl: await resolvePublicUrl(product.coverMediaId),
    relatedExpenses: relatedExpenses.map((e) => ({
      ...e,
      amount: money(e.amount),
    })),
  };
}

export async function listPublicDonations(filters: { page: number; pageSize: number }) {
  const where: Prisma.DonationWhereInput = {
    status: DonationStatus.CONFIRMED,
    isPublic: true,
    deletedAt: null,
  };

  const skip = (filters.page - 1) * filters.pageSize;
  const [total, items] = await prisma.$transaction([
    prisma.donation.count({ where }),
    prisma.donation.findMany({
      where,
      orderBy: { donatedAt: 'desc' },
      skip,
      take: filters.pageSize,
      select: {
        id: true,
        displayName: true,
        isAnonymous: true,
        amount: true,
        donatedAt: true,
        content: true,
        productId: true,
      },
    }),
  ]);

  return {
    items: items.map((d) => ({
      id: d.id,
      // Privacy: never expose donorName on public API
      displayName: d.isAnonymous ? 'Người đóng góp ẩn danh' : d.displayName || 'Người đóng góp ẩn danh',
      amount: money(d.amount),
      donatedAt: d.donatedAt,
      content: d.content,
      productId: d.productId,
    })),
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize) || 1,
    },
  };
}

export async function listPublicExpenses(filters: { page: number; pageSize: number }) {
  const where: Prisma.ExpenseWhereInput = {
    status: ExpenseStatus.CONFIRMED,
    isPublic: true,
    deletedAt: null,
  };

  const skip = (filters.page - 1) * filters.pageSize;
  const [total, items] = await prisma.$transaction([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: { expenseDate: 'desc' },
      skip,
      take: filters.pageSize,
      select: {
        id: true,
        description: true,
        amount: true,
        expenseDate: true,
        category: true,
        productId: true,
        product: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    items: items.map((e) => ({
      id: e.id,
      description: e.description,
      amount: money(e.amount),
      expenseDate: e.expenseDate,
      category: e.category,
      product: e.product,
    })),
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize) || 1,
    },
  };
}

export async function listPublicCompanions() {
  const items = await prisma.companion.findMany({
    where: { isPublic: true, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
    select: {
      id: true,
      displayName: true,
      note: true,
      sortOrder: true,
    },
  });
  return items;
}

/** Call after admin mutations that affect public data. */
export function invalidatePublicCache(): void {
  publicCache.invalidate('public:');
}
