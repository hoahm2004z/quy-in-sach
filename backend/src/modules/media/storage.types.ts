export type MediaPurpose = 'cover' | 'proof' | 'invoice';

export type StorageProviderName = 'supabase' | 'local';

export type CreateUploadResult = {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  /** Present for local provider; client may ignore. */
  token?: string;
};

export type StorageObjectInfo = {
  exists: boolean;
  size?: number;
};

export interface StorageProvider {
  readonly name: StorageProviderName;
  ensureBuckets(): Promise<void>;
  createUploadUrl(input: {
    bucket: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
    mediaId: string;
  }): Promise<CreateUploadResult>;
  objectExists(bucket: string, storagePath: string): Promise<StorageObjectInfo>;
  getPublicUrl(bucket: string, storagePath: string): string;
  createSignedDownloadUrl(
    bucket: string,
    storagePath: string,
    expiresInSeconds?: number,
  ): Promise<string>;
  removeObject(bucket: string, storagePath: string): Promise<void>;
}
