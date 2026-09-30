import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { prisma } from '../src/utils/prisma';
import { env } from '../src/config';
import { resetStorageProviderForTests } from '../src/modules/media/storage';

const app = createApp();

function signAccessToken(sub: string) {
  return jwt.sign(
    { email: 'admin@quyinsach.local', role: 'authenticated' },
    env.SUPABASE_JWT_SECRET,
    { algorithm: 'HS256', subject: sub, expiresIn: '1h' },
  );
}

/** Minimal 1x1 PNG */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Media / Storage (local provider)', () => {
  let adminToken = '';
  let adminId = '';

  beforeAll(async () => {
    resetStorageProviderForTests();
    const admin = await prisma.user.findUniqueOrThrow({
      where: { supabaseUserId: 'seed-admin-supabase-id' },
    });
    adminId = admin.id;
    adminToken = signAccessToken(admin.supabaseUserId);
  });

  afterAll(() => {
    const root = path.resolve(process.cwd(), '.local-storage');
    if (fs.existsSync(root)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects unauthenticated upload-url', async () => {
    const res = await request(app).post('/api/admin/media/upload-url').send({
      purpose: 'cover',
      fileName: 'cover.png',
      mimeType: 'image/png',
      fileSize: PNG_1X1.length,
    });
    expect(res.status).toBe(401);
  });

  it('uploads cover via signed local URL, confirms, and exposes public URL', async () => {
    const urlRes = await request(app)
      .post('/api/admin/media/upload-url')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        purpose: 'cover',
        fileName: 'cover.png',
        mimeType: 'image/png',
        fileSize: PNG_1X1.length,
      });

    expect(urlRes.status).toBe(201);
    expect(urlRes.body.data.provider).toBe('local');
    expect(urlRes.body.data.bucket).toBe('public-media');
    expect(urlRes.body.data.uploadUrl).toContain('/api/admin/media/local-upload/');

    const mediaId = urlRes.body.data.mediaId as string;
    const uploadPath = new URL(urlRes.body.data.uploadUrl).pathname;

    const putRes = await request(app)
      .put(uploadPath)
      .set('Content-Type', 'image/png')
      .send(PNG_1X1);
    expect(putRes.status).toBe(200);

    const confirmRes = await request(app)
      .post(`/api/admin/media/${mediaId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.data.publicUrl).toContain('/storage/public-media/');

    const publicUrlPath = new URL(confirmRes.body.data.publicUrl).pathname;
    const fileRes = await request(app).get(publicUrlPath);
    expect(fileRes.status).toBe(200);
    expect(Buffer.compare(fileRes.body as Buffer, PNG_1X1)).toBe(0);

    // Attach to a known-public product created for this test
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Media cover test ${Date.now()}`,
        productType: 'BOOK',
        status: 'UPCOMING',
        budgetEstimate: 1000,
        plannedQuantity: 10,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
        coverMediaId: mediaId,
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.coverMediaId).toBe(mediaId);
    expect(createRes.body.data.coverUrl).toContain('/storage/public-media/');

    const productId = createRes.body.data.id as string;
    const pubRes = await request(app).get(`/api/public/products/${productId}`);
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.coverUrl).toContain('/storage/public-media/');
  });

  it('stores proof in private bucket and blocks anonymous access', async () => {
    const urlRes = await request(app)
      .post('/api/admin/media/upload-url')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        purpose: 'proof',
        fileName: 'proof.png',
        mimeType: 'image/png',
        fileSize: PNG_1X1.length,
      });
    expect(urlRes.status).toBe(201);
    expect(urlRes.body.data.bucket).toBe('private-documents');

    const mediaId = urlRes.body.data.mediaId as string;
    const uploadPath = new URL(urlRes.body.data.uploadUrl).pathname;
    await request(app).put(uploadPath).set('Content-Type', 'image/png').send(PNG_1X1);
    await request(app)
      .post(`/api/admin/media/${mediaId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // Public static path must NOT serve private documents
    const media = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } });
    const privateStatic = `/storage/${media.bucket}/${media.storagePath
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    const blocked = await request(app).get(privateStatic);
    expect(blocked.status).toBe(404);

    const noAuth = await request(app).get(`/api/admin/media/${mediaId}/access-url`);
    expect(noAuth.status).toBe(401);

    const access = await request(app)
      .get(`/api/admin/media/${mediaId}/access-url`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(access.status).toBe(200);
    expect(access.body.data.url).toContain('/api/admin/media/local-download/');

    const downloadPath = new URL(access.body.data.url).pathname;
    const dl = await request(app).get(downloadPath);
    expect(dl.status).toBe(200);
  });

  it('soft-deletes and restores media', async () => {
    const urlRes = await request(app)
      .post('/api/admin/media/upload-url')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        purpose: 'cover',
        fileName: 'temp.png',
        mimeType: 'image/png',
        fileSize: PNG_1X1.length,
      });
    const mediaId = urlRes.body.data.mediaId as string;
    const uploadPath = new URL(urlRes.body.data.uploadUrl).pathname;
    await request(app).put(uploadPath).set('Content-Type', 'image/png').send(PNG_1X1);
    await request(app)
      .post(`/api/admin/media/${mediaId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const del = await request(app)
      .post(`/api/admin/media/${mediaId}/delete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ deleteReason: 'test delete' });
    expect(del.status).toBe(200);
    expect(del.body.data.deletedAt).toBeTruthy();

    const restored = await request(app)
      .post(`/api/admin/media/${mediaId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(restored.status).toBe(200);
    expect(restored.body.data.deletedAt).toBeNull();
  });
});
