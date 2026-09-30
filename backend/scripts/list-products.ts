import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      productType: true,
      status: true,
      isPublic: true,
      deletedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  console.log('total', products.length);
  console.log(JSON.stringify(products, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
