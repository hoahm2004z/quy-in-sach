import fs from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { env } from '../../config';
import { AppError } from '../../utils/AppError';
import type { CreateUploadResult, StorageObjectInfo, StorageProvider } from './storage.types';

export type LocalUploadTokenPayload = {
  bucket: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  mediaId: string;
};

function storageRoot(): string {
  return path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || '.local-storage');
}

export function localObjectAbsolutePath(bucket: string, storagePath: string): string {
  const root = storageRoot();
  const full = path.resolve(root, bucket, storagePath);
  if (!full.startsWith(path.resolve(root))) {
    throw AppError.badRequest('Đường dẫn lưu trữ không hợp lệ');
  }
  return full;
}

export function getPublicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || `http://localhost:${env.PORT}`).replace(/\/$/, '');
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;

  async ensureBuckets(): Promise<void> {
    const root = storageRoot();
    await fs.mkdir(path.join(root, env.SUPABASE_PUBLIC_MEDIA_BUCKET), { recursive: true });
    await fs.mkdir(path.join(root, env.SUPABASE_PRIVATE_DOCS_BUCKET), { recursive: true });
  }

  async createUploadUrl(input: {
    bucket: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
    mediaId: string;
  }): Promise<CreateUploadResult> {
    if (!env.SUPABASE_JWT_SECRET) {
      throw AppError.internal('Thiếu secret để ký URL upload local');
    }
    const token = jwt.sign(
      {
        bucket: input.bucket,
        storagePath: input.storagePath,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        mediaId: input.mediaId,
      } satisfies LocalUploadTokenPayload,
      env.SUPABASE_JWT_SECRET,
      { expiresIn: '15m' },
    );
    return {
      uploadUrl: `${getPublicBaseUrl()}/api/admin/media/local-upload/${token}`,
      method: 'PUT',
      headers: {
        'Content-Type': input.mimeType,
      },
      token,
    };
  }

  async objectExists(bucket: string, storagePath: string): Promise<StorageObjectInfo> {
    try {
      const stat = await fs.stat(localObjectAbsolutePath(bucket, storagePath));
      return { exists: stat.isFile(), size: stat.size };
    } catch {
      return { exists: false };
    }
  }

  getPublicUrl(bucket: string, storagePath: string): string {
    const encoded = storagePath
      .split('/')
      .map((p) => encodeURIComponent(p))
      .join('/');
    return `${getPublicBaseUrl()}/storage/${bucket}/${encoded}`;
  }

  async createSignedDownloadUrl(
    bucket: string,
    storagePath: string,
    expiresInSeconds = 600,
  ): Promise<string> {
    if (!env.SUPABASE_JWT_SECRET) {
      throw AppError.internal('Thiếu secret để ký URL tải file');
    }
    const token = jwt.sign(
      { bucket, storagePath, purpose: 'download' },
      env.SUPABASE_JWT_SECRET,
      { expiresIn: expiresInSeconds },
    );
    return `${getPublicBaseUrl()}/api/admin/media/local-download/${token}`;
  }

  async removeObject(bucket: string, storagePath: string): Promise<void> {
    try {
      await fs.unlink(localObjectAbsolutePath(bucket, storagePath));
    } catch {
      // ignore missing file
    }
  }
}

export async function writeLocalUpload(
  bucket: string,
  storagePath: string,
  data: Buffer,
): Promise<void> {
  const full = localObjectAbsolutePath(bucket, storagePath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
}

export function verifyLocalUploadToken(token: string): LocalUploadTokenPayload {
  if (!env.SUPABASE_JWT_SECRET) {
    throw AppError.internal('Thiếu secret');
  }
  try {
    return jwt.verify(token, env.SUPABASE_JWT_SECRET) as LocalUploadTokenPayload;
  } catch {
    throw AppError.unauthenticated('URL upload hết hạn hoặc không hợp lệ');
  }
}

export function verifyLocalDownloadToken(token: string): {
  bucket: string;
  storagePath: string;
} {
  if (!env.SUPABASE_JWT_SECRET) {
    throw AppError.internal('Thiếu secret');
  }
  try {
    const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET) as {
      bucket: string;
      storagePath: string;
      purpose?: string;
    };
    if (payload.purpose !== 'download') {
      throw new Error('invalid');
    }
    return { bucket: payload.bucket, storagePath: payload.storagePath };
  } catch {
    throw AppError.unauthenticated('URL tải file hết hạn hoặc không hợp lệ');
  }
}
