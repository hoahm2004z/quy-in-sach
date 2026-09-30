import { DonationStatus, Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/AppError';
import { writeAuditLog } from '../audit/audit.service';
import { invalidatePublicCache } from '../transparency/public.service';
import { assertUsableMedia } from '../media/media.service';

function money(value: Prisma.Decimal): number {
  return Number(value.toString());
}

export function toAdminDonationDto(d: {
  id: string;
  donorName: string;
  displayName: string | null;
  isAnonymous: boolean;
  amount: Prisma.Decimal;
  donatedAt: Date;
  content: string | null;
  productId: string | null;
  status: DonationStatus;
  isPublic: boolean;
  proofMediaId: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deleteReason: string | null;
}) {
  return {
    id: d.id,
    donorName: d.donorName,
    displayName: d.displayName,
    isAnonymous: d.isAnonymous,
    amount: money(d.amount),
    donatedAt: d.donatedAt,
    content: d.content,
    productId: d.productId,
    status: d.status,
    isPublic: d.isPublic,
    proofMediaId: d.proofMediaId,
    note: d.note,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    deletedAt: d.deletedAt,
    deleteReason: d.deleteReason,
  };
}

export async function listDonations(filters: {
  page: number;
  pageSize: number;
  status?: DonationStatus;
  search?: string;
  productId?: string;
}) {
  const where: Prisma.DonationWhereInput = { deletedAt: null };
  if (filters.status) where.status = filters.status;
  if (filters.productId) where.productId = filters.productId;
  if (filters.search) {
    where.OR = [
      { donorName: { contains: filters.search, mode: 'insensitive' } },
      { displayName: { contains: filters.search, mode: 'insensitive' } },
      { content: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const skip = (filters.page - 1) * filters.pageSize;
  const [total, items] = await prisma.$transaction([
    prisma.donation.count({ where }),
    prisma.donation.findMany({
      where,
      orderBy: { donatedAt: 'desc' },
      skip,
      take: filters.pageSize,
    }),
  ]);

  return {
    items: items.map(toAdminDonationDto),
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages: Math.ceil(total / filters.pageSize) || 1,
    },
  };
}

export async function getDonationById(id: string) {
  const donation = await prisma.donation.findFirst({ where: { id, deletedAt: null } });
  if (!donation) throw AppError.notFound('Không tìm thấy khoản thu');
  return toAdminDonationDto(donation);
}

type CreateInput = {
  donorName: string;
  displayName?: string | null;
  isAnonymous: boolean;
  amount: string;
  donatedAt: string;
  content?: string | null;
  productId?: string | null;
  isPublic: boolean;
  proofMediaId?: string | null;
  note?: string | null;
};

export async function createDonation(
  input: CreateInput,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  if (input.productId) {
    const product = await prisma.product.findFirst({
      where: { id: input.productId, deletedAt: null },
    });
    if (!product) throw AppError.badRequest('Sản phẩm không tồn tại');
  }

  await assertUsableMedia(input.proofMediaId, 'proof');

  const donation = await prisma.donation.create({
    data: {
      donorName: input.donorName,
      displayName: input.displayName ?? null,
      isAnonymous: input.isAnonymous,
      amount: input.amount,
      donatedAt: new Date(input.donatedAt),
      content: input.content ?? null,
      productId: input.productId ?? null,
      status: DonationStatus.PENDING,
      isPublic: input.isPublic,
      proofMediaId: input.proofMediaId ?? null,
      note: input.note ?? null,
      createdById: userId,
    },
  });

  const dto = toAdminDonationDto(donation);
  await writeAuditLog({
    userId,
    action: 'CREATE',
    entity: 'donation',
    entityId: donation.id,
    newValue: dto,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return dto;
}

export async function updateDonation(
  id: string,
  input: Partial<CreateInput>,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.donation.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw AppError.notFound('Không tìm thấy khoản thu');
  if (existing.status !== DonationStatus.PENDING) {
    throw AppError.conflict('Chỉ sửa được khoản thu đang chờ xác nhận');
  }

  if (input.proofMediaId !== undefined) {
    await assertUsableMedia(input.proofMediaId, 'proof');
  }

  const donation = await prisma.donation.update({
    where: { id },
    data: {
      ...(input.donorName !== undefined ? { donorName: input.donorName } : {}),
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.isAnonymous !== undefined ? { isAnonymous: input.isAnonymous } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.donatedAt !== undefined ? { donatedAt: new Date(input.donatedAt) } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.productId !== undefined ? { productId: input.productId } : {}),
      ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
      ...(input.proofMediaId !== undefined ? { proofMediaId: input.proofMediaId } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
    },
  });

  const dto = toAdminDonationDto(donation);
  await writeAuditLog({
    userId,
    action: 'UPDATE',
    entity: 'donation',
    entityId: id,
    oldValue: toAdminDonationDto(existing),
    newValue: dto,
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return dto;
}

/** Atomic PENDING -> CONFIRMED. Concurrent second call => 409. */
export async function confirmDonation(
  id: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const result = await prisma.donation.updateMany({
    where: { id, status: DonationStatus.PENDING, deletedAt: null },
    data: { status: DonationStatus.CONFIRMED },
  });

  if (result.count === 0) {
    const existing = await prisma.donation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw AppError.notFound('Không tìm thấy khoản thu');
    throw AppError.conflict('Khoản thu không đang chờ xác nhận hoặc đã được xác nhận');
  }

  const donation = await prisma.donation.findUniqueOrThrow({ where: { id } });
  const dto = toAdminDonationDto(donation);
  await writeAuditLog({
    userId,
    action: 'CONFIRM',
    entity: 'donation',
    entityId: id,
    oldValue: { status: DonationStatus.PENDING },
    newValue: { status: DonationStatus.CONFIRMED },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return dto;
}

/** Atomic CONFIRMED/PENDING -> VOIDED */
export async function voidDonation(
  id: string,
  userId: string,
  reason?: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.donation.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw AppError.notFound('Không tìm thấy khoản thu');
  if (existing.status === DonationStatus.VOIDED) {
    throw AppError.conflict('Khoản thu đã bị hủy');
  }

  const result = await prisma.donation.updateMany({
    where: {
      id,
      status: { in: [DonationStatus.PENDING, DonationStatus.CONFIRMED] },
      deletedAt: null,
    },
    data: {
      status: DonationStatus.VOIDED,
      note: reason
        ? [existing.note, `VOID: ${reason}`].filter(Boolean).join('\n')
        : existing.note,
    },
  });

  if (result.count === 0) {
    throw AppError.conflict('Không thể hủy khoản thu này');
  }

  const donation = await prisma.donation.findUniqueOrThrow({ where: { id } });
  const dto = toAdminDonationDto(donation);
  await writeAuditLog({
    userId,
    action: 'VOID',
    entity: 'donation',
    entityId: id,
    oldValue: { status: existing.status },
    newValue: { status: DonationStatus.VOIDED, reason: reason ?? null },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return dto;
}

export async function softDeleteDonation(
  id: string,
  deleteReason: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.donation.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw AppError.notFound('Không tìm thấy khoản thu');
  if (existing.status === DonationStatus.CONFIRMED) {
    throw AppError.conflict('Không xóa được khoản thu đã xác nhận — hãy hủy giao dịch trước');
  }

  const donation = await prisma.donation.update({
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
    entity: 'donation',
    entityId: id,
    newValue: { deletedAt: donation.deletedAt, deleteReason },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return toAdminDonationDto(donation);
}

export async function restoreDonation(
  id: string,
  userId: string,
  meta?: { ip?: string; userAgent?: string },
) {
  const existing = await prisma.donation.findFirst({
    where: { id, deletedAt: { not: null } },
  });
  if (!existing) throw AppError.notFound('Không tìm thấy khoản thu trong thùng rác');

  const donation = await prisma.donation.update({
    where: { id },
    data: { deletedAt: null, deletedById: null, deleteReason: null },
  });

  await writeAuditLog({
    userId,
    action: 'RESTORE',
    entity: 'donation',
    entityId: id,
    oldValue: { deletedAt: existing.deletedAt },
    newValue: { deletedAt: null },
    ip: meta?.ip,
    userAgent: meta?.userAgent,
  });
  invalidatePublicCache();
  return toAdminDonationDto(donation);
}
