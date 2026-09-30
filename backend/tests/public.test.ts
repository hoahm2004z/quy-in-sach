import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { env } from '../src/config';

const app = createApp();

function token() {
  return jwt.sign({ role: 'authenticated' }, env.SUPABASE_JWT_SECRET, {
    algorithm: 'HS256',
    subject: 'seed-admin-supabase-id',
    expiresIn: '1h',
  });
}

describe('Public API', () => {
  it('returns statistics without auth', async () => {
    const res = await request(app).get('/api/public/statistics');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalIncome');
    expect(res.body.data).toHaveProperty('totalExpense');
    expect(res.body.data).toHaveProperty('balance');
    expect(res.body.data).toHaveProperty('upcomingBudget');
    expect(res.body.data.balance).toBe(
      res.body.data.totalIncome - res.body.data.totalExpense,
    );
  });

  it('filters sách sắp in', async () => {
    const res = await request(app).get('/api/public/products').query({
      type: 'BOOK',
      status: 'UPCOMING',
    });
    expect(res.status).toBe(200);
    expect(
      res.body.data.every(
        (p: { productType: string; status: string }) =>
          p.productType === 'BOOK' && p.status === 'UPCOMING',
      ),
    ).toBe(true);
  });

  it('never exposes donorName on public donations', async () => {
    const res = await request(app).get('/api/public/donations');
    expect(res.status).toBe(200);
    for (const d of res.body.data) {
      expect(d).not.toHaveProperty('donorName');
      expect(d).not.toHaveProperty('note');
      expect(typeof d.displayName).toBe('string');
    }
  });

  it('lists public companions', async () => {
    const res = await request(app).get('/api/public/companions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.every((c: { displayName: string }) => c.displayName)).toBe(true);
  });
});

describe('Admin dashboard', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns summary and todos for admin', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.todos).toBeDefined();
  });
});
