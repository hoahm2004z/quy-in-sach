/**
 * Smoke-test Supabase Postgres connectivity (no schema changes).
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true&schema=public"
 *   $env:DIRECT_URL="postgresql://...:5432/postgres?schema=public"
 *   node scripts/supabase-db-smoke.mjs
 *
 * Never commit real passwords.
 */
import { PrismaClient } from '@prisma/client';

function redact(url) {
  return String(url || '').replace(/:([^:@/]+)@/, ':***@');
}

async function ping(label, url) {
  if (!url) {
    console.error(`[${label}] missing URL`);
    return false;
  }
  console.log(`[${label}] ${redact(url)}`);
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });
  try {
    const rows = await prisma.$queryRaw`SELECT current_database() AS db, current_user AS usr, version() AS version`;
    console.log(`[${label}] OK`, rows?.[0] ?? rows);
    return true;
  } catch (err) {
    console.error(`[${label}] FAIL`, err?.message || err);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL || databaseUrl;

const okPool = await ping('DATABASE_URL (runtime/pooler)', databaseUrl);
const okDirect = await ping('DIRECT_URL (migrate/session)', directUrl);

if (!okPool || !okDirect) {
  process.exitCode = 1;
  console.error('Connection smoke test FAILED — do not migrate yet.');
} else {
  console.log('Connection smoke test PASSED — safe to run migrate deploy next.');
}
