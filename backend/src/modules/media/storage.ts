import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { env } from '../../config';
import type { MediaPurpose, StorageProvider } from './storage.types';
import { LocalStorageProvider } from './storage.local';
import { SupabaseStorageProvider } from './storage.supabase';

let provider: StorageProvider | null = null;
let bucketsReady: Promise<void> | null = null;

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    provider = isSupabaseStorageConfigured()
      ? new SupabaseStorageProvider()
      : new LocalStorageProvider();
  }
  return provider;
}

/** Test helper — reset singleton between suites if needed. */
export function resetStorageProviderForTests(): void {
  provider = null;
  bucketsReady = null;
}

export async function ensureStorageReady(): Promise<StorageProvider> {
  const p = getStorageProvider();
  if (!bucketsReady) {
    bucketsReady = p.ensureBuckets();
  }
  await bucketsReady;
  return p;
}

export function bucketForPurpose(purpose: MediaPurpose): string {
  if (purpose === 'cover') return env.SUPABASE_PUBLIC_MEDIA_BUCKET;
  return env.SUPABASE_PRIVATE_DOCS_BUCKET;
}

export function isPublicBucket(bucket: string): boolean {
  return bucket === env.SUPABASE_PUBLIC_MEDIA_BUCKET;
}

const IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const PRIVATE_MIME = new Set([
  ...IMAGE_MIME,
  'application/pdf',
]);

export function assertAllowedMime(purpose: MediaPurpose, mimeType: string): void {
  const allowed = purpose === 'cover' ? IMAGE_MIME : PRIVATE_MIME;
  if (!allowed.has(mimeType)) {
    throw new Error(
      purpose === 'cover'
        ? 'Ảnh bìa chỉ chấp nhận JPEG, PNG, WebP hoặc GIF'
        : 'Tài liệu chỉ chấp nhận ảnh (JPEG/PNG/WebP/GIF) hoặc PDF',
    );
  }
}

export function buildStoragePath(purpose: MediaPurpose, fileName: string): string {
  const ext = path.extname(fileName).toLowerCase().replace(/[^.a-z0-9]/g, '') || '';
  const safeExt = ext || guessExt(fileName);
  const folder = purpose === 'cover' ? 'covers' : purpose === 'proof' ? 'proofs' : 'invoices';
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${folder}/${yyyy}/${mm}/${randomUUID()}${safeExt}`;
}

function guessExt(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return '.jpg';
  if (lower.endsWith('.png')) return '.png';
  if (lower.endsWith('.webp')) return '.webp';
  if (lower.endsWith('.gif')) return '.gif';
  if (lower.endsWith('.pdf')) return '.pdf';
  return '';
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
