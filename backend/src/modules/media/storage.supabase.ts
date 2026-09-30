import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config';
import { AppError } from '../../utils/AppError';
import type { CreateUploadResult, StorageObjectInfo, StorageProvider } from './storage.types';

export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase' as const;
  private client: SupabaseClient;

  constructor() {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw AppError.internal('Supabase Storage chưa được cấu hình');
    }
    this.client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async ensureBuckets(): Promise<void> {
    const buckets = [
      { id: env.SUPABASE_PUBLIC_MEDIA_BUCKET, public: true },
      { id: env.SUPABASE_PRIVATE_DOCS_BUCKET, public: false },
    ];

    const { data: existing, error: listError } = await this.client.storage.listBuckets();
    if (listError) {
      throw AppError.internal(`Không liệt kê được bucket: ${listError.message}`);
    }
    const names = new Set((existing ?? []).map((b) => b.name));

    for (const bucket of buckets) {
      if (names.has(bucket.id)) continue;
      const { error } = await this.client.storage.createBucket(bucket.id, {
        public: bucket.public,
        fileSizeLimit: 10 * 1024 * 1024,
      });
      if (error && !/already exists/i.test(error.message)) {
        throw AppError.internal(`Không tạo được bucket ${bucket.id}: ${error.message}`);
      }
    }
  }

  async createUploadUrl(input: {
    bucket: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
    mediaId: string;
  }): Promise<CreateUploadResult> {
    void input.mediaId;
    void input.fileSize;
    const { data, error } = await this.client.storage
      .from(input.bucket)
      .createSignedUploadUrl(input.storagePath);

    if (error || !data?.signedUrl) {
      throw AppError.internal(
        `Không tạo được URL upload: ${error?.message ?? 'không có signedUrl'}`,
      );
    }

    return {
      uploadUrl: data.signedUrl,
      method: 'PUT',
      headers: {
        'Content-Type': input.mimeType,
      },
    };
  }

  async objectExists(bucket: string, storagePath: string): Promise<StorageObjectInfo> {
    const dir = storagePath.includes('/')
      ? storagePath.slice(0, storagePath.lastIndexOf('/'))
      : '';
    const fileName = storagePath.includes('/')
      ? storagePath.slice(storagePath.lastIndexOf('/') + 1)
      : storagePath;

    const { data, error } = await this.client.storage.from(bucket).list(dir || undefined, {
      search: fileName,
      limit: 100,
    });
    if (error) {
      return { exists: false };
    }
    const found = (data ?? []).find((f) => f.name === fileName);
    if (!found) return { exists: false };
    const size =
      typeof found.metadata?.size === 'number'
        ? found.metadata.size
        : typeof (found as { size?: number }).size === 'number'
          ? (found as { size?: number }).size
          : undefined;
    return { exists: true, size };
  }

  getPublicUrl(bucket: string, storagePath: string): string {
    const { data } = this.client.storage.from(bucket).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  async createSignedDownloadUrl(
    bucket: string,
    storagePath: string,
    expiresInSeconds = 600,
  ): Promise<string> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw AppError.internal(
        `Không tạo được URL tải file: ${error?.message ?? 'không có signedUrl'}`,
      );
    }
    return data.signedUrl;
  }

  async removeObject(bucket: string, storagePath: string): Promise<void> {
    await this.client.storage.from(bucket).remove([storagePath]);
  }
}
