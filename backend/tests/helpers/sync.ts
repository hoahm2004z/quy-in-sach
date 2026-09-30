import jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Express } from 'express';
import { env } from '../../src/config';
import { prisma } from '../../src/utils/prisma';

export const SEED_ADMIN_SUB = 'seed-admin-supabase-id';

export function adminToken(sub = SEED_ADMIN_SUB) {
  return jwt.sign({ role: 'authenticated', email: 'admin@quyinsach.local' }, env.SUPABASE_JWT_SECRET, {
    algorithm: 'HS256',
    subject: sub,
    expiresIn: '1h',
  });
}

export function authHeader(token = adminToken()) {
  return { Authorization: `Bearer ${token}` };
}

export async function getAdminUserId() {
  const admin = await prisma.user.findUniqueOrThrow({
    where: { supabaseUserId: SEED_ADMIN_SUB },
  });
  return admin.id;
}

export async function latestAudit(entity: string, entityId: string, action?: string) {
  return prisma.auditLog.findFirst({
    where: {
      entity,
      entityId,
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function adminPost(app: Express, path: string, body?: unknown) {
  return request(app).post(path).set(authHeader()).send(body ?? {});
}

export async function adminPut(app: Express, path: string, body?: unknown) {
  return request(app).put(path).set(authHeader()).send(body ?? {});
}

export async function adminGet(app: Express, path: string, query?: Record<string, string>) {
  const req = request(app).get(path).set(authHeader());
  return query ? req.query(query) : req;
}

export async function publicGet(app: Express, path: string, query?: Record<string, string>) {
  const req = request(app).get(path);
  return query ? req.query(query) : req;
}

/** Minimal 1x1 PNG */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export async function uploadCover(app: Express) {
  const urlRes = await adminPost(app, '/api/admin/media/upload-url', {
    purpose: 'cover',
    fileName: `sync-cover-${Date.now()}.png`,
    mimeType: 'image/png',
    fileSize: PNG_1X1.length,
  });
  expect(urlRes.status).toBe(201);
  const mediaId = urlRes.body.data.mediaId as string;
  const putPath = new URL(urlRes.body.data.uploadUrl).pathname;
  await request(app).put(putPath).set('Content-Type', 'image/png').send(PNG_1X1);
  const conf = await adminPost(app, `/api/admin/media/${mediaId}/confirm`, {});
  expect(conf.status).toBe(200);
  return { mediaId, publicUrl: conf.body.data.publicUrl as string };
}

export async function uploadPrivate(
  app: Express,
  purpose: 'proof' | 'invoice',
) {
  const urlRes = await adminPost(app, '/api/admin/media/upload-url', {
    purpose,
    fileName: `sync-${purpose}-${Date.now()}.png`,
    mimeType: 'image/png',
    fileSize: PNG_1X1.length,
  });
  expect(urlRes.status).toBe(201);
  const mediaId = urlRes.body.data.mediaId as string;
  const putPath = new URL(urlRes.body.data.uploadUrl).pathname;
  await request(app).put(putPath).set('Content-Type', 'image/png').send(PNG_1X1);
  await adminPost(app, `/api/admin/media/${mediaId}/confirm`, {});
  return mediaId;
}
