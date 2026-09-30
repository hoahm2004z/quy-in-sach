import { prisma } from '../../utils/prisma';
import { ensureStorageReady, isPublicBucket } from './storage';

export async function resolvePublicUrl(
  mediaId: string | null | undefined,
): Promise<string | null> {
  if (!mediaId) return null;
  const media = await prisma.media.findFirst({
    where: { id: mediaId, deletedAt: null },
  });
  if (!media || !isPublicBucket(media.bucket)) return null;
  const storage = await ensureStorageReady();
  return storage.getPublicUrl(media.bucket, media.storagePath);
}

export async function resolvePublicUrlMap(
  mediaIds: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [...new Set(mediaIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;

  const rows = await prisma.media.findMany({
    where: { id: { in: ids }, deletedAt: null },
  });
  const storage = await ensureStorageReady();
  for (const row of rows) {
    if (isPublicBucket(row.bucket)) {
      map.set(row.id, storage.getPublicUrl(row.bucket, row.storagePath));
    }
  }
  return map;
}
