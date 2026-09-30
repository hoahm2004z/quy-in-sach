import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { env } from '../src/config';
import { prisma } from '../src/utils/prisma';

const app = createApp();

function token() {
  return jwt.sign({ role: 'authenticated' }, env.SUPABASE_JWT_SECRET, {
    algorithm: 'HS256',
    subject: 'seed-admin-supabase-id',
    expiresIn: '1h',
  });
}

describe('Admin expenses', () => {
  let expenseId: string;

  it('rejects invalid amount', async () => {
    const res = await request(app)
      .post('/api/admin/expenses')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        category: 'TEST',
        amount: 0,
        expenseDate: '2026-09-01',
        description: 'Invalid',
      });
    expect(res.status).toBe(400);
  });

  it('creates expense as PENDING', async () => {
    const res = await request(app)
      .post('/api/admin/expenses')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        category: 'IN_ẤN',
        amount: 2_000_000,
        expenseDate: '2026-09-01',
        description: 'Chi test phase 6',
        isPublic: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    expenseId = res.body.data.id;
  });

  it('confirms once; duplicate confirm returns 409', async () => {
    const first = await request(app)
      .post(`/api/admin/expenses/${expenseId}/confirm`)
      .set('Authorization', `Bearer ${token()}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post(`/api/admin/expenses/${expenseId}/confirm`)
      .set('Authorization', `Bearer ${token()}`);
    expect(second.status).toBe(409);
  });

  it('voids confirmed expense', async () => {
    const res = await request(app)
      .post(`/api/admin/expenses/${expenseId}/void`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ reason: 'Sai số' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('VOIDED');

    const row = await prisma.expense.findUniqueOrThrow({ where: { id: expenseId } });
    expect(row.status).toBe('VOIDED');
  });

  it('rejects In ấn expense without productId', async () => {
    const res = await request(app)
      .post('/api/admin/expenses')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        category: 'In ấn',
        amount: 1_000_000,
        expenseDate: '2026-09-01',
        description: 'Thiếu product',
        isPublic: true,
      });
    expect(res.status).toBe(400);
  });

  it('creates In ấn with productId; confirm updates actualCost; void resets', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { supabaseUserId: 'seed-admin-supabase-id' },
    });
    const product = await prisma.product.create({
      data: {
        name: `Expense link ${Date.now()}`,
        productType: 'BOOK',
        status: 'UPCOMING',
        budgetEstimate: 0,
        plannedQuantity: 1,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const create = await request(app)
      .post('/api/admin/expenses')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        category: 'In ấn',
        productId: product.id,
        amount: 15_000_000,
        expenseDate: '2026-09-01',
        description: 'In ấn có product',
        isPublic: true,
      });
    expect(create.status).toBe(201);
    expect(create.body.data.productId).toBe(product.id);
    expect(create.body.data.status).toBe('PENDING');

    const before = await request(app)
      .get(`/api/admin/products/${product.id}`)
      .set('Authorization', `Bearer ${token()}`);
    expect(before.body.data.actualCost).toBe(0);

    const confirm = await request(app)
      .post(`/api/admin/expenses/${create.body.data.id}/confirm`)
      .set('Authorization', `Bearer ${token()}`);
    expect(confirm.status).toBe(200);

    const after = await request(app)
      .get(`/api/admin/products/${product.id}`)
      .set('Authorization', `Bearer ${token()}`);
    expect(after.body.data.actualCost).toBe(15_000_000);

    const pub = await request(app).get(`/api/public/products/${product.id}`);
    expect(pub.status).toBe(200);
    expect(pub.body.data.actualCost).toBe(15_000_000);

    await request(app)
      .post(`/api/admin/expenses/${create.body.data.id}/void`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ reason: 'test' });

    const afterVoid = await request(app)
      .get(`/api/admin/products/${product.id}`)
      .set('Authorization', `Bearer ${token()}`);
    expect(afterVoid.body.data.actualCost).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: create.body.data.id, action: 'CONFIRM' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
  });

  it('allows editing productId on PENDING expense', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { supabaseUserId: 'seed-admin-supabase-id' },
    });
    const p1 = await prisma.product.create({
      data: {
        name: `P1 ${Date.now()}`,
        productType: 'BOOK',
        status: 'UPCOMING',
        budgetEstimate: 0,
        plannedQuantity: 1,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });
    const p2 = await prisma.product.create({
      data: {
        name: `P2 ${Date.now()}`,
        productType: 'BOOK',
        status: 'UPCOMING',
        budgetEstimate: 0,
        plannedQuantity: 1,
        printedQuantity: 0,
        stockQuantity: 0,
        isPublic: true,
        createdById: admin.id,
        updatedById: admin.id,
      },
    });

    const create = await request(app)
      .post('/api/admin/expenses')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        category: 'In ấn',
        productId: p1.id,
        amount: 1000,
        expenseDate: '2026-09-01',
        description: 'edit product',
      });
    expect(create.status).toBe(201);

    const update = await request(app)
      .put(`/api/admin/expenses/${create.body.data.id}`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ productId: p2.id });
    expect(update.status).toBe(200);
    expect(update.body.data.productId).toBe(p2.id);
  });
});
