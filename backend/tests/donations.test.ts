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

describe('Admin donations', () => {
  let donationId: string;

  it('rejects invalid amount', async () => {
    const res = await request(app)
      .post('/api/admin/donations')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        donorName: 'Test',
        amount: -1,
        donatedAt: new Date().toISOString(),
      });
    expect(res.status).toBe(400);
  });

  it('creates donation as PENDING', async () => {
    const res = await request(app)
      .post('/api/admin/donations')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        donorName: 'Nguyễn Test',
        displayName: 'Anh Test',
        isAnonymous: false,
        amount: 1_500_000,
        donatedAt: new Date().toISOString(),
        content: 'Ủng hộ test',
        isPublic: true,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
    donationId = res.body.data.id;
  });

  it('confirms donation once; second confirm is 409', async () => {
    const first = await request(app)
      .post(`/api/admin/donations/${donationId}/confirm`)
      .set('Authorization', `Bearer ${token()}`);
    expect(first.status).toBe(200);
    expect(first.body.data.status).toBe('CONFIRMED');

    const second = await request(app)
      .post(`/api/admin/donations/${donationId}/confirm`)
      .set('Authorization', `Bearer ${token()}`);
    expect(second.status).toBe(409);
  });

  it('handles concurrent confirm with only one success', async () => {
    const created = await request(app)
      .post('/api/admin/donations')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        donorName: 'Concurrent',
        amount: 100_000,
        donatedAt: new Date().toISOString(),
      });
    const id = created.body.data.id;

    const results = await Promise.all([
      request(app).post(`/api/admin/donations/${id}/confirm`).set('Authorization', `Bearer ${token()}`),
      request(app).post(`/api/admin/donations/${id}/confirm`).set('Authorization', `Bearer ${token()}`),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);

    const row = await prisma.donation.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('CONFIRMED');
  });

  it('voids confirmed donation', async () => {
    const res = await request(app)
      .post(`/api/admin/donations/${donationId}/void`)
      .set('Authorization', `Bearer ${token()}`)
      .send({ reason: 'Nhập sai' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('VOIDED');
  });

  it('protects donor privacy fields exist for admin', async () => {
    const res = await request(app)
      .get(`/api/admin/donations/${donationId}`)
      .set('Authorization', `Bearer ${token()}`);
    expect(res.body.data.donorName).toBeTruthy();
  });
});
