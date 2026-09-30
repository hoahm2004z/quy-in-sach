/**
 * Copy business data Local → Supabase (metadata only, no image files).
 * Uses DIRECT_URL for remote writes. Does not touch local DB contents.
 *
 *   $env:DIRECT_URL="..."
 *   node scripts/copy-local-to-supabase.mjs
 */
import { PrismaClient } from '@prisma/client';

const LOCAL_URL =
  process.env.LOCAL_DATABASE_URL ||
  'postgresql://quyinsach:quyinsach@localhost:5433/quy_in_sach?schema=public';

const remoteUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!remoteUrl) {
  console.error('Missing DIRECT_URL / DATABASE_URL for Supabase');
  process.exit(1);
}
if (/localhost|127\.0\.0\.1/.test(remoteUrl)) {
  console.error('Refusing to write: remote URL looks local');
  process.exit(1);
}

function redact(u) {
  return String(u).replace(/:([^:@/]+)@/, ':***@');
}

const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });
const remote = new PrismaClient({ datasources: { db: { url: remoteUrl } } });

function serializeRows(rows) {
  return rows.map((row) => {
    const out = { ...row };
    for (const [k, v] of Object.entries(out)) {
      if (v !== null && typeof v === 'object' && typeof v.toFixed === 'function') {
        out[k] = v.toString();
      }
    }
    return out;
  });
}

async function copyTable(name, readFn, writeFn) {
  const rows = await readFn();
  if (!rows.length) {
    console.log(`[${name}] 0 rows — skip`);
    return { name, local: 0, inserted: 0 };
  }
  const payload = serializeRows(rows);
  const result = await writeFn(payload);
  const inserted = result?.count ?? payload.length;
  console.log(`[${name}] local=${rows.length} inserted=${inserted}`);
  return { name, local: rows.length, inserted };
}

async function main() {
  console.log('LOCAL ', redact(LOCAL_URL));
  console.log('REMOTE', redact(remoteUrl));

  const summary = [];

  summary.push(
    await copyTable(
      'users',
      () => local.user.findMany(),
      (data) => remote.user.createMany({ data, skipDuplicates: true }),
    ),
  );
  summary.push(
    await copyTable(
      'media',
      () => local.media.findMany(),
      (data) => remote.media.createMany({ data, skipDuplicates: true }),
    ),
  );
  summary.push(
    await copyTable(
      'products',
      () => local.product.findMany(),
      (data) => remote.product.createMany({ data, skipDuplicates: true }),
    ),
  );
  summary.push(
    await copyTable(
      'donations',
      () => local.donation.findMany(),
      (data) => remote.donation.createMany({ data, skipDuplicates: true }),
    ),
  );
  summary.push(
    await copyTable(
      'expenses',
      () => local.expense.findMany(),
      (data) => remote.expense.createMany({ data, skipDuplicates: true }),
    ),
  );
  summary.push(
    await copyTable(
      'companions',
      () => local.companion.findMany(),
      (data) => remote.companion.createMany({ data, skipDuplicates: true }),
    ),
  );
  summary.push(
    await copyTable(
      'settings',
      () => local.setting.findMany(),
      (data) => remote.setting.createMany({ data, skipDuplicates: true }),
    ),
  );
  summary.push(
    await copyTable(
      'audit_logs',
      () => local.auditLog.findMany(),
      (data) => remote.auditLog.createMany({ data, skipDuplicates: true }),
    ),
  );

  console.log('DONE', summary);
}

main()
  .catch((err) => {
    console.error('COPY FAILED', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await local.$disconnect();
    await remote.$disconnect();
  });
