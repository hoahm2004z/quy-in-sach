import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app';
import { prisma } from '../src/utils/prisma';
import { env } from '../src/config';

const app = createApp();

function signAccessToken(sub: string, extra: Record<string, unknown> = {}) {
  return jwt.sign(
    {
      email: 'admin@quyinsach.local',
      role: 'authenticated',
      ...extra,
    },
    env.SUPABASE_JWT_SECRET,
    {
      algorithm: 'HS256',
      subject: sub,
      expiresIn: '1h',
    },
  );
}

describe('Admin auth', () => {
  const seedSupabaseId = 'seed-admin-supabase-id';

  it('rejects request without token', async () => {
    const res = await request(app).get('/api/admin/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/admin/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('rejects valid token for unknown supabase user', async () => {
    const token = signAccessToken('unknown-supabase-user');
    const res = await request(app)
      .get('/api/admin/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('allows seeded ADMIN with valid token', async () => {
    const admin = await prisma.user.findUniqueOrThrow({
      where: { supabaseUserId: seedSupabaseId },
    });
    const token = signAccessToken(admin.supabaseUserId);
    const res = await request(app)
      .get('/api/admin/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(admin.email);
    expect(res.body.data.role).toBe('ADMIN');
    expect(res.body.data).not.toHaveProperty('supabaseUserId');
  });

  it('does not trust role claim from JWT for authorization', async () => {
    const token = signAccessToken('jwt-claims-admin-but-no-db-row', {
      app_metadata: { role: 'ADMIN' },
    });
    const res = await request(app)
      .get('/api/admin/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
