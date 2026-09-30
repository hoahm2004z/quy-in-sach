/**
 * One-off Phase 11 verification (local storage provider).
 * Run: npx tsx scripts/verify-media.ts
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { prisma } from '../src/utils/prisma';
import { env } from '../src/config';
import { resetStorageProviderForTests } from '../src/modules/media/storage';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function main() {
  resetStorageProviderForTests();
  const app = createApp();
  const admin = await prisma.user.findUniqueOrThrow({
    where: { supabaseUserId: 'seed-admin-supabase-id' },
  });
  const token = jwt.sign(
    { email: admin.email, role: 'authenticated' },
    env.SUPABASE_JWT_SECRET,
    { algorithm: 'HS256', subject: admin.supabaseUserId, expiresIn: '1h' },
  );

  const urlRes = await request(app)
    .post('/api/admin/media/upload-url')
    .set('Authorization', `Bearer ${token}`)
    .send({
      purpose: 'cover',
      fileName: 'live.png',
      mimeType: 'image/png',
      fileSize: PNG.length,
    });
  const mediaId = urlRes.body.data.mediaId as string;
  await request(app)
    .put(new URL(urlRes.body.data.uploadUrl).pathname)
    .set('Content-Type', 'image/png')
    .send(PNG);
  const conf = await request(app)
    .post(`/api/admin/media/${mediaId}/confirm`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
  const publicUrl = conf.body.data.publicUrl as string;
  const fileGet = await request(app).get(new URL(publicUrl).pathname);
  console.log('COVER_UPLOAD', {
    upload: urlRes.status,
    confirm: conf.status,
    file: fileGet.status,
    publicUrl,
  });

  const pUrl = await request(app)
    .post('/api/admin/media/upload-url')
    .set('Authorization', `Bearer ${token}`)
    .send({
      purpose: 'proof',
      fileName: 'proof.png',
      mimeType: 'image/png',
      fileSize: PNG.length,
    });
  const pId = pUrl.body.data.mediaId as string;
  await request(app)
    .put(new URL(pUrl.body.data.uploadUrl).pathname)
    .set('Content-Type', 'image/png')
    .send(PNG);
  await request(app)
    .post(`/api/admin/media/${pId}/confirm`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
  const media = await prisma.media.findUniqueOrThrow({ where: { id: pId } });
  const anonStatic = await request(app).get(
    `/storage/${media.bucket}/${media.storagePath}`,
  );
  const anonAccess = await request(app).get(`/api/admin/media/${pId}/access-url`);
  const adminAccess = await request(app)
    .get(`/api/admin/media/${pId}/access-url`)
    .set('Authorization', `Bearer ${token}`);
  const dl = await request(app).get(new URL(adminAccess.body.data.url).pathname);
  console.log('PRIVATE', {
    static: anonStatic.status,
    anonAccess: anonAccess.status,
    adminAccess: adminAccess.status,
    download: dl.status,
  });

  const prod = await request(app)
    .post('/api/admin/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Live cover ${Date.now()}`,
      productType: 'BOOK',
      status: 'UPCOMING',
      budgetEstimate: 1,
      plannedQuantity: 1,
      printedQuantity: 0,
      stockQuantity: 0,
      isPublic: true,
      coverMediaId: mediaId,
    });
  const pub = await request(app).get(`/api/public/products/${prod.body.data.id}`);
  console.log('PUBLIC_COVER', {
    create: prod.status,
    public: pub.status,
    coverUrl: pub.body.data.coverUrl,
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
