import request from 'supertest';
import jwt from 'jsonwebtoken';
import { ProductStatus, ProductType } from '@prisma/client';
import { createApp } from '../src/app';
import { prisma } from '../src/utils/prisma';
import { env } from '../src/config';

const app = createApp();

function adminToken(sub = 'seed-admin-supabase-id') {
  return jwt.sign({ role: 'authenticated' }, env.SUPABASE_JWT_SECRET, {
    algorithm: 'HS256',
    subject: sub,
    expiresIn: '1h',
  });
}

describe('Admin products', () => {
  let createdId: string;

  it('rejects unauthenticated create', async () => {
    const res = await request(app).post('/api/admin/products').send({
      name: 'X',
      productType: ProductType.BOOK,
      status: ProductStatus.UPCOMING,
    });
    expect(res.status).toBe(401);
  });

  it('creates a product', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        name: 'Sách Test Phase 4',
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
        budgetEstimate: 12_000_000,
        plannedQuantity: 1000,
        isPublic: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Sách Test Phase 4');
    expect(res.body.data.actualCost).toBe(0);
    expect(res.body.data).not.toHaveProperty('createdById');
    createdId = res.body.data.id;
  });

  it('filters BOOK + UPCOMING', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .query({ type: ProductType.BOOK, status: ProductStatus.UPCOMING })
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((p: { productType: string; status: string }) =>
      p.productType === 'BOOK' && p.status === 'UPCOMING',
    )).toBe(true);
  });

  it('updates UPCOMING -> PRINTED with required fields', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${createdId}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        status: ProductStatus.PRINTED,
        completedDate: '2026-09-01',
        printedQuantity: 1000,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PRINTED');
    expect(res.body.data.printedQuantity).toBe(1000);
  });

  it('rejects PRINTED without completedDate', async () => {
    const create = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({
        name: 'Thiếu ngày',
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
      });

    const res = await request(app)
      .put(`/api/admin/products/${create.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ status: ProductStatus.PRINTED, printedQuantity: 10 });

    expect(res.status).toBe(400);
  });

  it('archives product', async () => {
    const res = await request(app)
      .post(`/api/admin/products/${createdId}/archive`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ARCHIVED');
  });

  it('soft deletes and restores product', async () => {
    const del = await request(app)
      .post(`/api/admin/products/${createdId}/delete`)
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ deleteReason: 'Test soft delete' });
    expect(del.status).toBe(200);
    expect(del.body.data.deletedAt).toBeTruthy();

    const list = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(list.body.data.find((p: { id: string }) => p.id === createdId)).toBeUndefined();

    const restore = await request(app)
      .post(`/api/admin/products/${createdId}/restore`)
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(restore.status).toBe(200);
    expect(restore.body.data.deletedAt).toBeNull();
  });

  it('derives actualCost from confirmed expenses', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { supabaseUserId: 'seed-admin-supabase-id' },
    });

    const product = await prisma.product.create({
      data: {
        name: `Sách tính chi phí ${Date.now()}`,
        productType: 'BOOK',
        status: 'PRINTED',
        budgetEstimate: 10_000_000,
        plannedQuantity: 100,
        printedQuantity: 100,
        stockQuantity: 10,
        completedDate: new Date('2026-01-01'),
        isPublic: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    await prisma.expense.createMany({
      data: [
        {
          productId: product.id,
          category: 'IN_ẤN',
          amount: 4_000_000,
          expenseDate: new Date('2026-01-02'),
          description: 'In test A',
          status: 'CONFIRMED',
          isPublic: true,
          createdById: admin.id,
        },
        {
          productId: product.id,
          category: 'VẬN_CHUYỂN',
          amount: 500_000,
          expenseDate: new Date('2026-01-03'),
          description: 'Ship test B',
          status: 'CONFIRMED',
          isPublic: true,
          createdById: admin.id,
        },
        {
          productId: product.id,
          category: 'KHÁC',
          amount: 999_000,
          expenseDate: new Date('2026-01-04'),
          description: 'Pending không tính',
          status: 'PENDING',
          isPublic: false,
          createdById: admin.id,
        },
      ],
    });

    const res = await request(app)
      .get(`/api/admin/products/${product.id}`)
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.actualCost).toBe(4_500_000);
  });

  it('writes audit logs for create/update', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { entity: 'product', entityId: createdId },
      orderBy: { createdAt: 'asc' },
    });
    const actions = logs.map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATE', 'UPDATE', 'ARCHIVE', 'SOFT_DELETE', 'RESTORE']));
  });
});
