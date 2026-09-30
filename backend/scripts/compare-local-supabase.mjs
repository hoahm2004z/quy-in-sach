/**
 * Compare LOCAL vs SUPABASE: counts, enums, indexes, FKs, tables.
 *   $env:DIRECT_URL=... ; $env:LOCAL_DATABASE_URL=... ; node scripts/compare-local-supabase.mjs
 */
import { PrismaClient } from '@prisma/client';

const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL ||
  'postgresql://quyinsach:quyinsach@localhost:5433/quy_in_sach?schema=public';
const remoteUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });
const remote = new PrismaClient({ datasources: { db: { url: remoteUrl } } });

async function meta(prisma) {
  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`;
  const enums = await prisma.$queryRaw`
    SELECT t.typname AS enum_name, e.enumlabel AS enum_value
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder`;
  const indexes = await prisma.$queryRaw`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY indexname`;
  const fks = await prisma.$queryRaw`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name`;
  const counts = {};
  for (const t of [
    'users',
    'products',
    'donations',
    'expenses',
    'companions',
    'settings',
    'media',
    'audit_logs',
    '_prisma_migrations',
  ]) {
    const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM "${t}"`);
    counts[t] = rows[0].c;
  }
  return { tables, enums, indexes, fks, counts };
}

function names(rows, key) {
  return rows.map((r) => r[key]).sort();
}

function setEq(a, b) {
  const A = [...new Set(a)].sort();
  const B = [...new Set(b)].sort();
  return JSON.stringify(A) === JSON.stringify(B);
}

const L = await meta(local);
const R = await meta(remote);

const report = {
  tables: {
    local: names(L.tables, 'table_name'),
    supabase: names(R.tables, 'table_name'),
    match: setEq(names(L.tables, 'table_name'), names(R.tables, 'table_name')),
  },
  enums: {
    local: L.enums.map((e) => `${e.enum_name}.${e.enum_value}`),
    supabase: R.enums.map((e) => `${e.enum_name}.${e.enum_value}`),
    match: JSON.stringify(L.enums) === JSON.stringify(R.enums),
  },
  indexes: {
    localCount: L.indexes.length,
    supabaseCount: R.indexes.length,
    local: names(L.indexes, 'indexname'),
    supabase: names(R.indexes, 'indexname'),
    match: setEq(names(L.indexes, 'indexname'), names(R.indexes, 'indexname')),
  },
  foreignKeys: {
    localCount: L.fks.length,
    supabaseCount: R.fks.length,
    local: L.fks.map(
      (f) => `${f.table_name}.${f.column_name}->${f.foreign_table}.${f.foreign_column}`,
    ),
    supabase: R.fks.map(
      (f) => `${f.table_name}.${f.column_name}->${f.foreign_table}.${f.foreign_column}`,
    ),
    match: setEq(
      L.fks.map((f) => `${f.table_name}.${f.column_name}->${f.foreign_table}.${f.foreign_column}`),
      R.fks.map((f) => `${f.table_name}.${f.column_name}->${f.foreign_table}.${f.foreign_column}`),
    ),
  },
  counts: {
    local: L.counts,
    supabase: R.counts,
    match: JSON.stringify(L.counts) === JSON.stringify(R.counts),
  },
};

console.log(JSON.stringify(report, null, 2));

await local.$disconnect();
await remote.$disconnect();

if (
  !report.tables.match ||
  !report.enums.match ||
  !report.indexes.match ||
  !report.foreignKeys.match ||
  !report.counts.match
) {
  process.exitCode = 1;
}
