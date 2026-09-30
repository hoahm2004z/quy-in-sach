import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/AppError';
import { writeAuditLog } from '../audit/audit.service';
import { invalidatePublicCache } from '../transparency/public.service';

export function toAdminCompanionDto(c: {
  id: string;
  displayName: string;
  note: string | null;
  isPublic: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deleteReason: string | null;
}) {
  return {
    id: c.id,
    displayName: c.displayName,
    note: c.note,
    isPublic: c.isPublic,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    deletedAt: c.deletedAt,
    deleteReason: c.deleteReason,
  };
}

export async function listCompanions() {
  const items = await prisma.companion.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
  });
  return items.map(toAdminCompanionDto);
}

export async function createCompanion(
  input: {
    displayName: string;
    note?: string | null;
    isPublic: boolean;
    sortOrder: number;
  },
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const companion = await prisma.companion.create({
    data: {
      displayName: input.displayName,
      note: input.note ?? null,
      isPublic: input.isPublic,
      sortOrder: input.sortOrder,
    },
  });
  const dto = toAdminCompanionDto(companion);
  await writeAuditLog({
    userId,
    action: 'CREATE',
    entity: 'companion',
    entityId: companion.id,
    newValue: dto,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return dto;
}

export async function updateCompanion(
  id: string,
  input: Partial<{
    displayName: string;
    note: string | null;
    isPublic: boolean;
    sortOrder: number;
  }>,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.companion.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw AppError.notFound('Không tìm thấy người đồng hành');

  const companion = await prisma.companion.update({
    where: { id },
    data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });

  const dto = toAdminCompanionDto(companion);
  await writeAuditLog({
    userId,
    action: 'UPDATE',
    entity: 'companion',
    entityId: id,
    oldValue: toAdminCompanionDto(existing),
    newValue: dto,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return dto;
}

export async function softDeleteCompanion(
  id: string,
  deleteReason: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.companion.findFirst({
    where: { id, deletedAt: null },
  });
  if (!existing) throw AppError.notFound('Không tìm thấy người đồng hành');

  const companion = await prisma.companion.update({
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
    entity: 'companion',
    entityId: id,
    newValue: { deletedAt: companion.deletedAt, deleteReason },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return toAdminCompanionDto(companion);
}

export async function restoreCompanion(
  id: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.companion.findFirst({
    where: { id, deletedAt: { not: null } },
  });
  if (!existing) throw AppError.notFound('Không tìm thấy trong thùng rác');

  const companion = await prisma.companion.update({
    where: { id },
    data: { deletedAt: null, deletedById: null, deleteReason: null },
  });

  await writeAuditLog({
    userId,
    action: 'RESTORE',
    entity: 'companion',
    entityId: id,
    oldValue: { deletedAt: existing.deletedAt },
    newValue: { deletedAt: null },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return toAdminCompanionDto(companion);
}

export async function listAuditLogs(filters: { page: number; pageSize: number }) {
  const skip = (filters.page - 1) * filters.pageSize;
  const [total, items] = await prisma.$transaction([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: filters.pageSize,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        user: { select: { fullName: true, email: true } },
      },
    }),
  ]);

  return {
    items: items.map((l) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      createdAt: l.createdAt,
      userName: l.user?.fullName ?? null,
      userEmail: l.user?.email ?? null,
    })),
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize) || 1,
    },
  };
}

export async function listTrash() {
  const [products, donations, expenses, companions] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        name: true,
        deletedAt: true,
        deleteReason: true,
        deletedBy: { select: { fullName: true } },
      },
    }),
    prisma.donation.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        donorName: true,
        amount: true,
        deletedAt: true,
        deleteReason: true,
        deletedBy: { select: { fullName: true } },
      },
    }),
    prisma.expense.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        description: true,
        amount: true,
        deletedAt: true,
        deleteReason: true,
        deletedBy: { select: { fullName: true } },
      },
    }),
    prisma.companion.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        displayName: true,
        deletedAt: true,
        deleteReason: true,
        deletedBy: { select: { fullName: true } },
      },
    }),
  ]);

  const items = [
    ...products.map((p) => ({
      id: p.id,
      entity: 'product' as const,
      name: p.name,
      deletedAt: p.deletedAt,
      deleteReason: p.deleteReason,
      deletedByName: p.deletedBy?.fullName ?? null,
    })),
    ...donations.map((d) => ({
      id: d.id,
      entity: 'donation' as const,
      name: `${d.donorName} — ${Number(d.amount).toLocaleString('vi-VN')}₫`,
      deletedAt: d.deletedAt,
      deleteReason: d.deleteReason,
      deletedByName: d.deletedBy?.fullName ?? null,
    })),
    ...expenses.map((e) => ({
      id: e.id,
      entity: 'expense' as const,
      name: e.description,
      deletedAt: e.deletedAt,
      deleteReason: e.deleteReason,
      deletedByName: e.deletedBy?.fullName ?? null,
    })),
    ...companions.map((c) => ({
      id: c.id,
      entity: 'companion' as const,
      name: c.displayName,
      deletedAt: c.deletedAt,
      deleteReason: c.deleteReason,
      deletedByName: c.deletedBy?.fullName ?? null,
    })),
  ].sort((a, b) => {
    const ta = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
    const tb = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
    return tb - ta;
  });

  return items;
}
