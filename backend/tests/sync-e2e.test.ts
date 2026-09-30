/**
 * System sync E2E: Admin API → PostgreSQL → cache → Public API
 * Covers business flows corresponding to Admin UI buttons (no Playwright in project).
 */
import request from 'supertest';
import { DonationStatus, ExpenseStatus, ProductStatus, ProductType } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/utils/prisma';
import { publicCache } from '../src/utils/cache';
import { resetStorageProviderForTests } from '../src/modules/media/storage';
import {
  adminGet,
  adminPost,
  adminPut,
  authHeader,
  getAdminUserId,
  latestAudit,
  publicGet,
  uploadCover,
  uploadPrivate,
  adminToken,
} from './helpers/sync';

const app = createApp();
const tag = () => `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describe('System sync E2E (Admin → DB → Public)', () => {
  beforeAll(async () => {
    resetStorageProviderForTests();
    await getAdminUserId();
  });

  beforeEach(() => {
    publicCache.clear();
  });

  // ─────────────────────────────────────────
  // SCENARIO 1–2, PRODUCT matrix
  // ─────────────────────────────────────────
  describe('Product lifecycle sync', () => {
    it('SCENARIO 1: create product → DB + Public list', async () => {
      const name = `Sách sync create ${tag()}`;
      const res = await adminPost(app, '/api/admin/products', {
        name,
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
        budgetEstimate: 5_000_000,
        plannedQuantity: 100,
        printedQuantity: 0,
        stockQuantity: 0,
        plannedDate: '2026-11-01',
        isPublic: true,
      });
      expect(res.status).toBe(201);
      const id = res.body.data.id as string;

      const db = await prisma.product.findUniqueOrThrow({ where: { id } });
      expect(db.name).toBe(name);
      expect(db.deletedAt).toBeNull();

      const audit = await latestAudit('product', id, 'CREATE');
      expect(audit).toBeTruthy();
      expect(audit!.userId).toBe(await getAdminUserId());

      const pub = await publicGet(app, '/api/public/products', {
        type: 'BOOK',
        status: 'UPCOMING',
        pageSize: '100',
      });
      expect(pub.status).toBe(200);
      expect(pub.body.data.some((p: { id: string }) => p.id === id)).toBe(true);
    });

    it('SCENARIO 2: UPCOMING → PRINTED moves Public filters', async () => {
      const name = `Sách sync status ${tag()}`;
      const create = await adminPost(app, '/api/admin/products', {
        name,
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
        budgetEstimate: 1,
        plannedQuantity: 10,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
      });
      const id = create.body.data.id as string;

      // Warm public cache for UPCOMING
      await publicGet(app, '/api/public/products', {
        type: 'BOOK',
        status: 'UPCOMING',
        pageSize: '100',
      });

      const update = await adminPut(app, `/api/admin/products/${id}`, {
        status: ProductStatus.PRINTED,
        completedDate: '2026-09-01',
        printedQuantity: 10,
        stockQuantity: 8,
      });
      expect(update.status).toBe(200);
      expect(update.body.data.status).toBe('PRINTED');

      const db = await prisma.product.findUniqueOrThrow({ where: { id } });
      expect(db.status).toBe(ProductStatus.PRINTED);

      const upcoming = await publicGet(app, '/api/public/products', {
        type: 'BOOK',
        status: 'UPCOMING',
        pageSize: '100',
      });
      expect(upcoming.body.data.some((p: { id: string }) => p.id === id)).toBe(false);

      const printed = await publicGet(app, '/api/public/products', {
        type: 'BOOK',
        status: 'PRINTED',
        pageSize: '100',
      });
      expect(printed.body.data.some((p: { id: string }) => p.id === id)).toBe(true);

      const audit = await latestAudit('product', id, 'UPDATE');
      expect(audit).toBeTruthy();
      expect(audit!.oldValue).toBeTruthy();
      expect(audit!.newValue).toBeTruthy();
    });

    it('updates fields: name, type, budget, qty, dates, isPublic + Public reflects', async () => {
      const create = await adminPost(app, '/api/admin/products', {
        name: `Sách field ${tag()}`,
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
        budgetEstimate: 1000,
        plannedQuantity: 1,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
      });
      const id = create.body.data.id as string;

      const newName = `Loa renamed ${tag()}`;
      const update = await adminPut(app, `/api/admin/products/${id}`, {
        name: newName,
        productType: ProductType.SPEAKER,
        budgetEstimate: 9999,
        plannedQuantity: 50,
        printedQuantity: 40,
        stockQuantity: 30,
        plannedDate: '2026-10-10',
        completedDate: '2026-10-11',
        status: ProductStatus.PRINTED,
        isPublic: true,
      });
      expect(update.status).toBe(200);

      const db = await prisma.product.findUniqueOrThrow({ where: { id } });
      expect(db.name).toBe(newName);
      expect(db.productType).toBe(ProductType.SPEAKER);
      expect(Number(db.budgetEstimate)).toBe(9999);
      expect(db.plannedQuantity).toBe(50);
      expect(db.printedQuantity).toBe(40);
      expect(db.stockQuantity).toBe(30);

      const speakers = await publicGet(app, '/api/public/products', {
        type: 'SPEAKER',
        pageSize: '100',
      });
      expect(speakers.body.data.some((p: { id: string; name: string }) => p.id === id && p.name === newName)).toBe(
        true,
      );

      // Hide from public
      await adminPut(app, `/api/admin/products/${id}`, { isPublic: false });
      const afterHide = await publicGet(app, `/api/public/products/${id}`);
      expect(afterHide.status).toBe(404);
    });

    it('SCENARIO 6–7: soft delete → gone Public; restore → back; trash API', async () => {
      const create = await adminPost(app, '/api/admin/products', {
        name: `Sách trash ${tag()}`,
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
        budgetEstimate: 1,
        plannedQuantity: 1,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
      });
      const id = create.body.data.id as string;

      await publicGet(app, '/api/public/products', { pageSize: '100' });

      const del = await adminPost(app, `/api/admin/products/${id}/delete`, {
        deleteReason: 'sync test delete',
      });
      expect(del.status).toBe(200);

      const dbDel = await prisma.product.findUniqueOrThrow({ where: { id } });
      expect(dbDel.deletedAt).not.toBeNull();

      const pubGone = await publicGet(app, `/api/public/products/${id}`);
      expect(pubGone.status).toBe(404);

      const trash = await adminGet(app, '/api/admin/trash');
      expect(trash.status).toBe(200);
      expect(
        trash.body.data.some(
          (t: { id: string; entity?: string }) => t.id === id || (t as { entityType?: string }).entityType === 'product',
        ) ||
          JSON.stringify(trash.body.data).includes(id),
      ).toBe(true);

      const restore = await adminPost(app, `/api/admin/trash/${id}/restore`, {
        entity: 'product',
      });
      expect(restore.status).toBe(200);

      const dbRest = await prisma.product.findUniqueOrThrow({ where: { id } });
      expect(dbRest.deletedAt).toBeNull();

      const pubBack = await publicGet(app, `/api/public/products/${id}`);
      expect(pubBack.status).toBe(200);

      expect(await latestAudit('product', id, 'SOFT_DELETE')).toBeTruthy();
      expect(await latestAudit('product', id, 'RESTORE')).toBeTruthy();
    });

    it('archive removes from public non-archived lists', async () => {
      const create = await adminPost(app, '/api/admin/products', {
        name: `Sách archive ${tag()}`,
        productType: ProductType.BOOK,
        status: ProductStatus.PRINTED,
        budgetEstimate: 1,
        plannedQuantity: 1,
        printedQuantity: 1,
        stockQuantity: 1,
        completedDate: '2026-01-01',
        isPublic: true,
      });
      const id = create.body.data.id as string;

      await publicGet(app, '/api/public/products', {
        type: 'BOOK',
        status: 'PRINTED',
        pageSize: '100',
      });

      const arch = await adminPost(app, `/api/admin/products/${id}/archive`);
      expect(arch.status).toBe(200);

      const db = await prisma.product.findUniqueOrThrow({ where: { id } });
      expect(db.status).toBe(ProductStatus.ARCHIVED);

      const printed = await publicGet(app, '/api/public/products', {
        type: 'BOOK',
        status: 'PRINTED',
        pageSize: '100',
      });
      expect(printed.body.data.some((p: { id: string }) => p.id === id)).toBe(false);
      expect(await latestAudit('product', id, 'ARCHIVE')).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────
  // DONATION + DASHBOARD + PRIVACY
  // ─────────────────────────────────────────
  describe('Donation financial + public privacy sync', () => {
    it('SCENARIO 3–4: PENDING no income; CONFIRM increases; privacy on public', async () => {
      const before = await publicGet(app, '/api/public/statistics');
      const incomeBefore = before.body.data.totalIncome as number;

      const dashBefore = await adminGet(app, '/api/admin/dashboard');
      const dashIncomeBefore = dashBefore.body.data.summary?.totalIncome ??
        dashBefore.body.data.totalIncome;

      const create = await adminPost(app, '/api/admin/donations', {
        donorName: 'Người thật bí mật',
        displayName: 'Bạn ẩn danh công khai',
        isAnonymous: false,
        amount: 123_000,
        donatedAt: new Date().toISOString(),
        content: 'sync donation',
        isPublic: true,
      });
      expect(create.status).toBe(201);
      const id = create.body.data.id as string;

      const dbPend = await prisma.donation.findUniqueOrThrow({ where: { id } });
      expect(dbPend.status).toBe(DonationStatus.PENDING);

      const mid = await publicGet(app, '/api/public/statistics');
      expect(mid.body.data.totalIncome).toBe(incomeBefore);

      const pubListMid = await publicGet(app, '/api/public/donations', { pageSize: '100' });
      expect(pubListMid.body.data.some((d: { id: string }) => d.id === id)).toBe(false);

      // Warm statistics cache then confirm
      await publicGet(app, '/api/public/statistics');

      const confirm = await adminPost(app, `/api/admin/donations/${id}/confirm`);
      expect(confirm.status).toBe(200);

      const dbConf = await prisma.donation.findUniqueOrThrow({ where: { id } });
      expect(dbConf.status).toBe(DonationStatus.CONFIRMED);

      const after = await publicGet(app, '/api/public/statistics');
      expect(after.body.data.totalIncome).toBe(incomeBefore + 123_000);

      const dashAfter = await adminGet(app, '/api/admin/dashboard');
      const dashIncomeAfter =
        dashAfter.body.data.summary?.totalIncome ?? dashAfter.body.data.totalIncome;
      expect(dashIncomeAfter).toBe(dashIncomeBefore + 123_000);
      expect(after.body.data.balance).toBe(
        after.body.data.totalIncome - after.body.data.totalExpense,
      );

      const pubList = await publicGet(app, '/api/public/donations', { pageSize: '100' });
      const row = pubList.body.data.find((d: { id: string }) => d.id === id);
      expect(row).toBeTruthy();
      expect(row).not.toHaveProperty('donorName');
      expect(JSON.stringify(row)).not.toContain('Người thật bí mật');

      // Anonymous display
      const createAnon = await adminPost(app, '/api/admin/donations', {
        donorName: 'Tên thật ẩn',
        displayName: 'Sẽ bị ẩn',
        isAnonymous: true,
        amount: 50_000,
        donatedAt: new Date().toISOString(),
        isPublic: true,
      });
      const anonId = createAnon.body.data.id as string;
      await adminPost(app, `/api/admin/donations/${anonId}/confirm`);
      const anonList = await publicGet(app, '/api/public/donations', { pageSize: '100' });
      const anonRow = anonList.body.data.find((d: { id: string }) => d.id === anonId);
      expect(anonRow.displayName).toBe('Người đóng góp ẩn danh');
      expect(JSON.stringify(anonRow)).not.toContain('Tên thật ẩn');
    });

    it('void after confirm rolls back income; soft-delete PENDING works', async () => {
      const before = await publicGet(app, '/api/public/statistics');
      const incomeBefore = before.body.data.totalIncome as number;

      const create = await adminPost(app, '/api/admin/donations', {
        donorName: 'Void test',
        amount: 77_000,
        donatedAt: new Date().toISOString(),
        isPublic: true,
        isAnonymous: false,
      });
      const id = create.body.data.id as string;
      await adminPost(app, `/api/admin/donations/${id}/confirm`);

      const voidRes = await adminPost(app, `/api/admin/donations/${id}/void`, {
        reason: 'sync void',
      });
      expect(voidRes.status).toBe(200);
      expect((await prisma.donation.findUniqueOrThrow({ where: { id } })).status).toBe(
        DonationStatus.VOIDED,
      );

      const after = await publicGet(app, '/api/public/statistics');
      expect(after.body.data.totalIncome).toBe(incomeBefore);

      const pend = await adminPost(app, '/api/admin/donations', {
        donorName: 'Delete me',
        amount: 10,
        donatedAt: new Date().toISOString(),
        isPublic: false,
        isAnonymous: false,
      });
      const pendId = pend.body.data.id as string;
      const del = await adminPost(app, `/api/admin/donations/${pendId}/delete`, {
        deleteReason: 'sync',
      });
      expect(del.status).toBe(200);
      expect(
        (await prisma.donation.findUniqueOrThrow({ where: { id: pendId } })).deletedAt,
      ).not.toBeNull();

      await adminPost(app, `/api/admin/trash/${pendId}/restore`, { entity: 'donation' });
      expect(
        (await prisma.donation.findUniqueOrThrow({ where: { id: pendId } })).deletedAt,
      ).toBeNull();
    });

    it('concurrency: double confirm → one 200, one 409; income +once', async () => {
      const before = await publicGet(app, '/api/public/statistics');
      const incomeBefore = before.body.data.totalIncome as number;

      const create = await adminPost(app, '/api/admin/donations', {
        donorName: 'Race',
        amount: 88_000,
        donatedAt: new Date().toISOString(),
        isPublic: false,
        isAnonymous: false,
      });
      const id = create.body.data.id as string;

      const [a, b] = await Promise.all([
        adminPost(app, `/api/admin/donations/${id}/confirm`),
        adminPost(app, `/api/admin/donations/${id}/confirm`),
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([200, 409]);

      const after = await publicGet(app, '/api/public/statistics');
      expect(after.body.data.totalIncome).toBe(incomeBefore + 88_000);
    });
  });

  // ─────────────────────────────────────────
  // EXPENSE + actualCost
  // ─────────────────────────────────────────
  describe('Expense sync + derived actualCost', () => {
    it('SCENARIO 5: confirm expense → actualCost + totalExpense + balance', async () => {
      const product = await adminPost(app, '/api/admin/products', {
        name: `Sách cost ${tag()}`,
        productType: ProductType.BOOK,
        status: ProductStatus.PRINTED,
        budgetEstimate: 1_000_000,
        plannedQuantity: 10,
        printedQuantity: 10,
        stockQuantity: 10,
        completedDate: '2026-01-01',
        isPublic: true,
      });
      const productId = product.body.data.id as string;
      expect(product.body.data.actualCost).toBe(0);

      const statsBefore = await publicGet(app, '/api/public/statistics');
      const expenseBefore = statsBefore.body.data.totalExpense as number;
      const income = statsBefore.body.data.totalIncome as number;

      const create = await adminPost(app, '/api/admin/expenses', {
        productId,
        category: 'In ấn',
        amount: 40_000,
        expenseDate: '2026-09-01',
        description: `Chi sync ${tag()}`,
        isPublic: true,
      });
      const expenseId = create.body.data.id as string;

      const midProd = await adminGet(app, `/api/admin/products/${productId}`);
      expect(midProd.body.data.actualCost).toBe(0);

      await publicGet(app, '/api/public/statistics');
      const confirm = await adminPost(app, `/api/admin/expenses/${expenseId}/confirm`);
      expect(confirm.status).toBe(200);

      const dbProd = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      expect(dbProd).not.toHaveProperty('actualCost');

      const afterProd = await adminGet(app, `/api/admin/products/${productId}`);
      expect(afterProd.body.data.actualCost).toBe(40_000);

      const pubProd = await publicGet(app, `/api/public/products/${productId}`);
      expect(pubProd.body.data.actualCost).toBe(40_000);

      const sum = await prisma.expense.aggregate({
        where: {
          productId,
          status: ExpenseStatus.CONFIRMED,
          deletedAt: null,
        },
        _sum: { amount: true },
      });
      expect(Number(sum._sum.amount)).toBe(40_000);

      const statsAfter = await publicGet(app, '/api/public/statistics');
      expect(statsAfter.body.data.totalExpense).toBe(expenseBefore + 40_000);
      expect(statsAfter.body.data.balance).toBe(income - (expenseBefore + 40_000));

      // Void rolls back
      await adminPost(app, `/api/admin/expenses/${expenseId}/void`, { reason: 'sync' });
      const afterVoid = await adminGet(app, `/api/admin/products/${productId}`);
      expect(afterVoid.body.data.actualCost).toBe(0);
    });

    it('concurrency expense confirm', async () => {
      const create = await adminPost(app, '/api/admin/expenses', {
        category: 'Khác',
        amount: 11_000,
        expenseDate: '2026-09-01',
        description: `Race expense ${tag()}`,
        isPublic: false,
      });
      const id = create.body.data.id as string;
      const [a, b] = await Promise.all([
        adminPost(app, `/api/admin/expenses/${id}/confirm`),
        adminPost(app, `/api/admin/expenses/${id}/confirm`),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
    });
  });

  // ─────────────────────────────────────────
  // COMPANIONS
  // ─────────────────────────────────────────
  describe('Companions sync', () => {
    it('create/update/hide/delete/restore sync Public', async () => {
      const name = `Bạn đồng hành ${tag()}`;
      const create = await adminPost(app, '/api/admin/companions', {
        displayName: name,
        note: 'ghi chú',
        sortOrder: 99,
        isPublic: true,
      });
      expect(create.status).toBe(201);
      const id = create.body.data.id as string;

      let list = await publicGet(app, '/api/public/companions');
      expect(list.body.data.some((c: { id: string }) => c.id === id)).toBe(true);

      await adminPut(app, `/api/admin/companions/${id}`, {
        displayName: `${name} sửa`,
        sortOrder: 1,
        isPublic: false,
      });
      list = await publicGet(app, '/api/public/companions');
      expect(list.body.data.some((c: { id: string }) => c.id === id)).toBe(false);

      await adminPut(app, `/api/admin/companions/${id}`, { isPublic: true });
      await adminPost(app, `/api/admin/companions/${id}/delete`, {
        deleteReason: 'sync del',
      });
      expect(
        (await prisma.companion.findUniqueOrThrow({ where: { id } })).deletedAt,
      ).not.toBeNull();
      list = await publicGet(app, '/api/public/companions');
      expect(list.body.data.some((c: { id: string }) => c.id === id)).toBe(false);

      await adminPost(app, `/api/admin/trash/${id}/restore`, { entity: 'companion' });
      list = await publicGet(app, '/api/public/companions');
      expect(list.body.data.some((c: { id: string; displayName: string }) => c.id === id)).toBe(
        true,
      );
    });
  });

  // ─────────────────────────────────────────
  // MEDIA
  // ─────────────────────────────────────────
  describe('Media sync', () => {
    it('SCENARIO 8: cover upload → Storage + media + product + Public URL', async () => {
      const { mediaId, publicUrl } = await uploadCover(app);
      const media = await prisma.media.findUniqueOrThrow({ where: { id: mediaId } });
      expect(media.bucket).toBe('public-media');
      expect(media.deletedAt).toBeNull();

      const fileRes = await request(app).get(new URL(publicUrl).pathname);
      expect(fileRes.status).toBe(200);

      const product = await adminPost(app, '/api/admin/products', {
        name: `Sách cover ${tag()}`,
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
        budgetEstimate: 1,
        plannedQuantity: 1,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
        coverMediaId: mediaId,
      });
      expect(product.body.data.coverMediaId).toBe(mediaId);
      expect(product.body.data.coverUrl).toContain('/storage/public-media/');

      const pub = await publicGet(app, `/api/public/products/${product.body.data.id}`);
      expect(pub.body.data.coverUrl).toContain('/storage/public-media/');

      // Replace cover
      const { mediaId: media2 } = await uploadCover(app);
      await adminPut(app, `/api/admin/products/${product.body.data.id}`, {
        coverMediaId: media2,
      });
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.body.data.id } }))
          .coverMediaId,
      ).toBe(media2);

      // Soft-delete media detaches
      await adminPost(app, `/api/admin/media/${media2}/delete`, {
        deleteReason: 'sync media del',
      });
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.body.data.id } }))
          .coverMediaId,
      ).toBeNull();

      await adminPost(app, `/api/admin/media/${media2}/restore`);
      expect(
        (await prisma.media.findUniqueOrThrow({ where: { id: media2 } })).deletedAt,
      ).toBeNull();
    });

    it('private proof/invoice: admin access ok, public static blocked', async () => {
      const proofId = await uploadPrivate(app, 'proof');
      const media = await prisma.media.findUniqueOrThrow({ where: { id: proofId } });
      expect(media.bucket).toBe('private-documents');

      const blocked = await request(app).get(
        `/storage/${media.bucket}/${media.storagePath.split('/').map(encodeURIComponent).join('/')}`,
      );
      expect(blocked.status).toBe(404);

      const noAuth = await request(app).get(`/api/admin/media/${proofId}/access-url`);
      expect(noAuth.status).toBe(401);

      const access = await request(app)
        .get(`/api/admin/media/${proofId}/access-url`)
        .set(authHeader());
      expect(access.status).toBe(200);

      const don = await adminPost(app, '/api/admin/donations', {
        donorName: 'Proof donor',
        amount: 1000,
        donatedAt: new Date().toISOString(),
        isPublic: false,
        isAnonymous: false,
        proofMediaId: proofId,
      });
      expect(don.body.data.proofMediaId).toBe(proofId);

      const invoiceId = await uploadPrivate(app, 'invoice');
      const book = await adminPost(app, '/api/admin/products', {
        name: `Invoice book ${tag()}`,
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
        budgetEstimate: 1,
        plannedQuantity: 1,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
      });
      const exp = await adminPost(app, '/api/admin/expenses', {
        category: 'In ấn',
        productId: book.body.data.id,
        amount: 1000,
        expenseDate: '2026-09-01',
        description: `Invoice ${tag()}`,
        isPublic: false,
        invoiceMediaId: invoiceId,
      });
      expect(exp.body.data.invoiceMediaId).toBe(invoiceId);
    });
  });

  // ─────────────────────────────────────────
  // CACHE
  // ─────────────────────────────────────────
  describe('Public cache invalidation', () => {
    it('product create invalidates list cache so next request is fresh', async () => {
      const first = await publicGet(app, '/api/public/products', {
        type: 'BOOK',
        status: 'UPCOMING',
        pageSize: '100',
      });
      expect(first.status).toBe(200);

      const name = `Cache product ${tag()}`;
      const create = await adminPost(app, '/api/admin/products', {
        name,
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
        budgetEstimate: 1,
        plannedQuantity: 1,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
      });
      const id = create.body.data.id as string;

      const second = await publicGet(app, '/api/public/products', {
        type: 'BOOK',
        status: 'UPCOMING',
        pageSize: '100',
      });
      expect(second.body.data.some((p: { id: string }) => p.id === id)).toBe(true);
    });
  });

  // ─────────────────────────────────────────
  // SECURITY / mass assignment
  // ─────────────────────────────────────────
  describe('Security sync checks', () => {
    it('rejects unauthenticated admin mutations', async () => {
      const res = await request(app).post('/api/admin/products').send({
        name: 'Hack',
        productType: 'BOOK',
        status: 'UPCOMING',
      });
      expect(res.status).toBe(401);
    });

    it('rejects invalid token', async () => {
      const res = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', 'Bearer invalid');
      expect(res.status).toBe(401);
    });

    it('rejects mass-assignment of createdBy / role via product body (ignored or fail)', async () => {
      const create = await adminPost(app, '/api/admin/products', {
        name: `Mass ${tag()}`,
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
        budgetEstimate: 1,
        plannedQuantity: 1,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
        createdById: '00000000-0000-4000-8000-000000000099',
        actualCost: 999999,
      } as Record<string, unknown>);
      expect(create.status).toBe(201);
      expect(create.body.data.actualCost).toBe(0);
      expect(create.body.data).not.toHaveProperty('createdById');
      const db = await prisma.product.findUniqueOrThrow({
        where: { id: create.body.data.id },
      });
      expect(db.createdById).toBe(await getAdminUserId());
    });

    it('rejects wrong mime for cover', async () => {
      const res = await adminPost(app, '/api/admin/media/upload-url', {
        purpose: 'cover',
        fileName: 'x.exe',
        mimeType: 'application/x-msdownload',
        fileSize: 100,
      });
      expect(res.status).toBe(400);
    });

    it('rejects oversized upload-url', async () => {
      const res = await adminPost(app, '/api/admin/media/upload-url', {
        purpose: 'cover',
        fileName: 'big.png',
        mimeType: 'image/png',
        fileSize: 20 * 1024 * 1024,
      });
      expect(res.status).toBe(400);
    });

    it('unknown supabase user cannot call admin', async () => {
      const res = await request(app)
        .get('/api/admin/auth/me')
        .set(authHeader(adminToken('not-a-db-user')));
      expect(res.status).toBe(403);
    });
  });

  // ─────────────────────────────────────────
  // AUDIT coverage sample
  // ─────────────────────────────────────────
  describe('Audit log presence', () => {
    it('SCENARIO 9: update writes old/new audit values', async () => {
      const create = await adminPost(app, '/api/admin/products', {
        name: `Audit ${tag()}`,
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
        budgetEstimate: 10,
        plannedQuantity: 1,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
      });
      const id = create.body.data.id as string;
      await adminPut(app, `/api/admin/products/${id}`, { name: `Audit renamed ${tag()}` });
      const log = await latestAudit('product', id, 'UPDATE');
      expect(log).toBeTruthy();
      expect(log!.oldValue).toBeTruthy();
      expect(log!.newValue).toBeTruthy();
      expect(log!.createdAt).toBeTruthy();
      expect(log!.userId).toBe(await getAdminUserId());
    });
  });

  // ─────────────────────────────────────────
  // Dashboard balance identity
  // ─────────────────────────────────────────
  describe('Dashboard numbers match DB aggregates', () => {
    it('dashboard totals equal CONFIRMED aggregates', async () => {
      const dash = await adminGet(app, '/api/admin/dashboard');
      expect(dash.status).toBe(200);
      const summary = dash.body.data.summary ?? dash.body.data;
      const incomeAgg = await prisma.donation.aggregate({
        where: { status: DonationStatus.CONFIRMED, deletedAt: null },
        _sum: { amount: true },
      });
      const expenseAgg = await prisma.expense.aggregate({
        where: { status: ExpenseStatus.CONFIRMED, deletedAt: null },
        _sum: { amount: true },
      });
      const income = Number(incomeAgg._sum.amount ?? 0);
      const expense = Number(expenseAgg._sum.amount ?? 0);
      expect(summary.totalIncome).toBe(income);
      expect(summary.totalExpense).toBe(expense);
      expect(summary.balance).toBe(income - expense);

      const pub = await publicGet(app, '/api/public/statistics');
      expect(pub.body.data.totalIncome).toBe(income);
      expect(pub.body.data.totalExpense).toBe(expense);
      expect(pub.body.data.balance).toBe(income - expense);
    });
  });
});
