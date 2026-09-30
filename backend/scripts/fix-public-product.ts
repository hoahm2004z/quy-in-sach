import jwt from 'jsonwebtoken';
import { env } from '../src/config';

async function main() {
  const token = jwt.sign({ role: 'authenticated' }, env.SUPABASE_JWT_SECRET, {
    algorithm: 'HS256',
    subject: 'seed-admin-supabase-id',
    expiresIn: '5m',
  });

  const id = 'f70d1164-d146-430b-8d35-283e40f9ffea';
  const res = await fetch(`http://localhost:3000/api/admin/products/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'UPCOMING', isPublic: true }),
  });
  const body = (await res.json()) as {
    data?: { status?: string; name?: string };
  };
  console.log('update', res.status, body.data?.status, body.data?.name);

  const pub = await fetch(
    'http://localhost:3000/api/public/products?type=BOOK&status=UPCOMING&page=1&pageSize=12',
  );
  const pubBody = (await pub.json()) as {
    meta?: { total?: number };
    data?: Array<{ name: string }>;
  };
  console.log(
    'public',
    pub.status,
    'total',
    pubBody.meta?.total,
    'names',
    pubBody.data?.map((p) => p.name),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
