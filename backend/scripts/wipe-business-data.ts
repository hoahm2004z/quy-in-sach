import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

async function main() {
  const donations = await prisma.donation.deleteMany({});
  const expenses = await prisma.expense.deleteMany({});
  const products = await prisma.product.deleteMany({});
  const companions = await prisma.companion.deleteMany({});
  const media = await prisma.media.deleteMany({});
  const audits = await prisma.auditLog.deleteMany({});
  const settings = await prisma.setting.deleteMany({});
  const users = await prisma.user.count();

  const storage = path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || '.local-storage');
  if (fs.existsSync(storage)) {
    fs.rmSync(storage, { recursive: true, force: true });
    fs.mkdirSync(path.join(storage, 'public-media'), { recursive: true });
    fs.mkdirSync(path.join(storage, 'private-documents'), { recursive: true });
  }

  console.log(
    JSON.stringify(
      {
        deleted: {
          donations: donations.count,
          expenses: expenses.count,
          products: products.count,
          companions: companions.count,
          media: media.count,
          auditLogs: audits.count,
          settings: settings.count,
        },
        keptUsers: users,
        clearedLocalStorage: true,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
