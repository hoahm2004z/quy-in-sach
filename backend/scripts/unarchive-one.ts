import { PrismaClient, ProductStatus } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const updated = await prisma.product.update({
    where: { id: 'f70d1164-d146-430b-8d35-283e40f9ffea' },
    data: { status: ProductStatus.UPCOMING },
    select: { name: true, status: true, isPublic: true },
  });
  console.log(JSON.stringify(updated));
}
main().finally(() => prisma.$disconnect());
