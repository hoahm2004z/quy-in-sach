/**
 * Truncate Supabase business tables (keeps _prisma_migrations).
 *   $env:DIRECT_URL=... ; node scripts/truncate-supabase-data.mjs
 */
import { PrismaClient } from '@prisma/client';

const remoteUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!remoteUrl || /localhost|127\.0\.0\.1/.test(remoteUrl)) {
  console.error('Refusing: DIRECT_URL must point to Supabase (non-local)');
  process.exit(1);
}

const remote = new PrismaClient({ datasources: { db: { url: remoteUrl } } });

await remote.$executeRawUnsafe(`
  TRUNCATE TABLE
    audit_logs,
    donations,
    expenses,
    companions,
    products,
    media,
    settings,
    users
  RESTART IDENTITY CASCADE
`);

console.log('Truncated Supabase business tables (schema + migrations kept)');
await remote.$disconnect();
