import type { Media } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { AppError } from '../../utils/AppError';
import { writeAuditLog } from '../audit/audit.service';
import { invalidatePublicCache } from '../transparency/public.service';
import type { MediaPurpose } from './storage.types';
import {
  assertAllowedMime,
  bucketForPurpose,
  buildStoragePath,
  ensureStorageReady,
  isPublicBucket,
  MAX_UPLOAD_BYTES,
} from './storage';
import { resolvePublicUrl, resolvePublicUrlMap } from './media.urls';

export type MediaDto = {
  id: string;
  bucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  altText: string | null;
  isPublic: boolean;
  /** Direct public Storage URL when bucket is public; otherwise null. */
  publicUrl: string | null;
  createdAt: Date;
  deletedAt: Date | null;
  deleteReason: string | null;
};

type AuditMeta = { ip?: string; userAgent?: string };

export { resolvePublicUrl, resolvePublicUrlMap };

export async function toMediaDto(media: Media): Promise<MediaDto> {
  const storage = await ensureStorageReady();
  const isPublic = isPublicBucket(media.bucket) && !media.deletedAt;
  return {
    id: media.id,
    bucket: media.bucket,
    storagePath: media.storagePath,
    fileName: media.fileName,
    mimeType: media.mimeType,
    fileSize: media.fileSize,
    altText: media.altText,
    isPublic: isPublicBucket(media.bucket),
    publicUrl: isPublic ? storage.getPublicUrl(media.bucket, media.storagePath) : null,
    createdAt: media.createdAt,
    deletedAt: media.deletedAt,
    deleteReason: media.deleteReason,
  };
}

export async function assertUsableMedia(
  mediaId: string | null | undefined,
  expectedPurpose?: MediaPurpose,
): Promise<void> {
  if (!mediaId) return;
  const media = await prisma.media.findFirst({
    where: { id: mediaId, deletedAt: null },
  });
  if (!media) throw AppError.badRequest('File media không tồn tại hoặc đã xóa');

  if (expectedPurpose === 'cover' && !isPublicBucket(media.bucket)) {
    throw AppError.badRequest('Ảnh bìa phải nằm trong bucket công khai');
  }
  if (
    (expectedPurpose === 'proof' || expectedPurpose === 'invoice') &&
    isPublicBucket(media.bucket)
  ) {
    throw AppError.badRequest('Chứng từ phải nằm trong bucket riêng tư');
  }
}

export async function createUploadUrl(
  input: {
    purpose: MediaPurpose;
    fileName: string;
    mimeType: string;
    fileSize: number;
    altText?: string | null;
  },
  userId: string,
  meta: AuditMeta = {},
) {
  try {
    assertAllowedMime(input.purpose, input.mimeType);
  } catch (e) {
    throw AppError.validation(e instanceof Error ? e.message : 'Loại file không hợp lệ');
  }
  if (input.fileSize > MAX_UPLOAD_BYTES) {
    throw AppError.validation('File vượt quá 10MB');
  }

  const storage = await ensureStorageReady();
  const bucket = bucketForPurpose(input.purpose);
  const storagePath = buildStoragePath(input.purpose, input.fileName);

  const media = await prisma.media.create({
    data: {
      bucket,
      storagePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      altText: input.altText ?? null,
      createdById: userId,
    },
  });

  const upload = await storage.createUploadUrl({
    bucket,
    storagePath,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    mediaId: media.id,
  });

  const dto = await toMediaDto(media);

  await writeAuditLog({
    userId,
    action: 'MEDIA_UPLOAD_URL',
    entity: 'media',
    entityId: media.id,
    newValue: {
      purpose: input.purpose,
      bucket,
      storagePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      provider: storage.name,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    mediaId: media.id,
    uploadUrl: upload.uploadUrl,
    method: upload.method,
    headers: upload.headers,
    bucket,
    storagePath,
    provider: storage.name,
    media: dto,
  };
}

export async function confirmUpload(
  mediaId: string,
  userId: string,
  input: { fileSize?: number } = {},
  meta: AuditMeta = {},
) {
  const media = await prisma.media.findFirst({ where: { id: mediaId, deletedAt: null } });
  if (!media) throw AppError.notFound('Không tìm thấy media');

  const storage = await ensureStorageReady();
  const info = await storage.objectExists(media.bucket, media.storagePath);
  if (!info.exists) {
    throw AppError.badRequest('Chưa upload file lên Storage hoặc file không tồn tại');
  }

  const updated = await prisma.media.update({
    where: { id: mediaId },
    data: {
      fileSize: input.fileSize ?? info.size ?? media.fileSize,
    },
  });

  const dto = await toMediaDto(updated);
  await writeAuditLog({
    userId,
    action: 'MEDIA_CONFIRM',
    entity: 'media',
    entityId: mediaId,
    newValue: dto,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  invalidatePublicCache();
  return dto;
}

export async function getMediaById(mediaId: string) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw AppError.notFound('Không tìm thấy media');
  return toMediaDto(media);
}

export async function getAccessUrl(mediaId: string, userId: string) {
  const media = await prisma.media.findFirst({
    where: { id: mediaId, deletedAt: null },
  });
  if (!media) throw AppError.notFound('Không tìm thấy media');

  const storage = await ensureStorageReady();
  if (isPublicBucket(media.bucket)) {
    return {
      url: storage.getPublicUrl(media.bucket, media.storagePath),
      expiresIn: null as number | null,
    };
  }

  const url = await storage.createSignedDownloadUrl(media.bucket, media.storagePath, 600);
  await writeAuditLog({
    userId,
    action: 'MEDIA_ACCESS_URL',
    entity: 'media',
    entityId: mediaId,
    newValue: { expiresIn: 600 },
  });
  return { url, expiresIn: 600 };
}

export async function softDeleteMedia(
  mediaId: string,
  deleteReason: string,
  userId: string,
  meta: AuditMeta = {},
) {
  const media = await prisma.media.findFirst({
    where: { id: mediaId, deletedAt: null },
  });
  if (!media) throw AppError.notFound('Không tìm thấy media');

  const updated = await prisma.media.update({
    where: { id: mediaId },
    data: {
      deletedAt: new Date(),
      deletedById: userId,
      deleteReason,
    },
  });

  // Detach references so soft-deleted media is not shown
  await prisma.$transaction([
    prisma.product.updateMany({
      where: { coverMediaId: mediaId },
      data: { coverMediaId: null },
    }),
    prisma.donation.updateMany({
      where: { proofMediaId: mediaId },
      data: { proofMediaId: null },
    }),
    prisma.expense.updateMany({
      where: { invoiceMediaId: mediaId },
      data: { invoiceMediaId: null },
    }),
  ]);

  const dto = await toMediaDto(updated);
  await writeAuditLog({
    userId,
    action: 'SOFT_DELETE',
    entity: 'media',
    entityId: mediaId,
    oldValue: await toMediaDto(media),
    newValue: dto,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  invalidatePublicCache();
  return dto;
}

export async function restoreMedia(
  mediaId: string,
  userId: string,
  meta: AuditMeta = {},
) {
  const media = await prisma.media.findFirst({
    where: { id: mediaId, deletedAt: { not: null } },
  });
  if (!media) throw AppError.notFound('Không tìm thấy media đã xóa');

  const updated = await prisma.media.update({
    where: { id: mediaId },
    data: {
      deletedAt: null,
      deletedById: null,
      deleteReason: null,
    },
  });

  const dto = await toMediaDto(updated);
  await writeAuditLog({
    userId,
    action: 'RESTORE',
    entity: 'media',
    entityId: mediaId,
    newValue: dto,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  invalidatePublicCache();
  return dto;
}
