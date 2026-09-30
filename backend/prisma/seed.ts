import { PrismaClient, ProductType, ProductStatus, DonationStatus, ExpenseStatus, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed admin user (local placeholder — real auth linked via supabase_user_id later)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@quyinsach.local' },
    update: {},
    create: {
      supabaseUserId: 'seed-admin-supabase-id',
      email: 'admin@quyinsach.local',
      fullName: 'Quản trị viên',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  // Clear soft-deletable seed data in dependency-safe order for re-seed friendliness
  await prisma.donation.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.companion.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.setting.deleteMany({});

  // Products: sách sắp in
  const upcomingBook = await prisma.product.create({
    data: {
      name: 'Đạo Đức Làm Người – Tập 1',
      description: 'Tuyển tập bài giảng về đạo đức làm người, dành cho mọi lứa tuổi.',
      productType: ProductType.BOOK,
      status: ProductStatus.UPCOMING,
      budgetEstimate: 50_000_000,
      plannedQuantity: 5000,
      printedQuantity: 0,
      stockQuantity: 0,
      plannedDate: new Date('2026-12-01'),
      isPublic: true,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  // Products: sách đã in
  const printedBook = await prisma.product.create({
    data: {
      name: 'Hạnh Phúc Viên Mãn',
      description: 'Sách đã phát hành, đang lan tỏa trong cộng đồng.',
      productType: ProductType.BOOK,
      status: ProductStatus.PRINTED,
      budgetEstimate: 30_000_000,
      plannedQuantity: 3000,
      printedQuantity: 3000,
      stockQuantity: 450,
      plannedDate: new Date('2025-06-01'),
      completedDate: new Date('2025-08-15'),
      isPublic: true,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  // Products: loa pháp thoại
  const speaker = await prisma.product.create({
    data: {
      name: 'Loa Pháp Thoại Mini',
      description: 'Loa nghe pháp thoại tiện mang theo, pin lâu.',
      productType: ProductType.SPEAKER,
      status: ProductStatus.PRINTED,
      budgetEstimate: 20_000_000,
      plannedQuantity: 500,
      printedQuantity: 500,
      stockQuantity: 120,
      plannedDate: new Date('2025-03-01'),
      completedDate: new Date('2025-05-20'),
      isPublic: true,
      createdById: admin.id,
      updatedById: admin.id,
    },
  });

  // Donations
  await prisma.donation.createMany({
    data: [
      {
        donorName: 'Nguyễn Văn A',
        displayName: 'Anh A',
        isAnonymous: false,
        amount: 5_000_000,
        donatedAt: new Date('2026-01-10T09:00:00+07:00'),
        content: 'Ủng hộ in sách Tập 1',
        productId: upcomingBook.id,
        status: DonationStatus.CONFIRMED,
        isPublic: true,
        createdById: admin.id,
      },
      {
        donorName: 'Trần Thị B',
        displayName: null,
        isAnonymous: true,
        amount: 2_000_000,
        donatedAt: new Date('2026-02-05T14:30:00+07:00'),
        content: 'Công đức ẩn danh',
        productId: null,
        status: DonationStatus.CONFIRMED,
        isPublic: true,
        createdById: admin.id,
      },
      {
        donorName: 'Lê Văn C',
        displayName: 'Gia đình C',
        isAnonymous: false,
        amount: 10_000_000,
        donatedAt: new Date('2026-03-01T10:00:00+07:00'),
        content: 'Ủng hộ loa pháp thoại',
        productId: speaker.id,
        status: DonationStatus.PENDING,
        isPublic: false,
        createdById: admin.id,
      },
      {
        donorName: 'Phạm D',
        displayName: 'Chị D',
        isAnonymous: false,
        amount: 1_000_000,
        donatedAt: new Date('2025-07-01T08:00:00+07:00'),
        content: 'Ủng hộ sách Hạnh Phúc Viên Mãn',
        productId: printedBook.id,
        status: DonationStatus.CONFIRMED,
        isPublic: true,
        createdById: admin.id,
      },
    ],
  });

  // Expenses (CONFIRMED contribute to actual_cost of linked products)
  await prisma.expense.createMany({
    data: [
      {
        productId: printedBook.id,
        category: 'IN_ẤN',
        amount: 25_000_000,
        expenseDate: new Date('2025-08-01'),
        description: 'Chi phí in sách Hạnh Phúc Viên Mãn',
        status: ExpenseStatus.CONFIRMED,
        isPublic: true,
        createdById: admin.id,
      },
      {
        productId: printedBook.id,
        category: 'VẬN_CHUYỂN',
        amount: 1_500_000,
        expenseDate: new Date('2025-08-10'),
        description: 'Vận chuyển sách về kho',
        status: ExpenseStatus.CONFIRMED,
        isPublic: true,
        createdById: admin.id,
      },
      {
        productId: speaker.id,
        category: 'SẢN_XUẤT',
        amount: 18_000_000,
        expenseDate: new Date('2025-05-01'),
        description: 'Gia công loa pháp thoại',
        status: ExpenseStatus.CONFIRMED,
        isPublic: true,
        createdById: admin.id,
      },
      {
        productId: upcomingBook.id,
        category: 'THIẾT_KẾ',
        amount: 3_000_000,
        expenseDate: new Date('2026-01-20'),
        description: 'Thiết kế bìa sách Tập 1',
        status: ExpenseStatus.PENDING,
        isPublic: false,
        createdById: admin.id,
      },
      {
        productId: null,
        category: 'VĂN_PHÒNG',
        amount: 500_000,
        expenseDate: new Date('2026-02-15'),
        description: 'Chi phí văn phòng phẩm quỹ',
        status: ExpenseStatus.VOIDED,
        isPublic: false,
        note: 'Nhập sai — đã void',
        createdById: admin.id,
      },
    ],
  });

  // Companions
  await prisma.companion.createMany({
    data: [
      {
        displayName: 'Chùa Từ Ân',
        note: 'Đồng hành lan tỏa sách',
        isPublic: true,
        sortOrder: 1,
      },
      {
        displayName: 'Nhóm thiện nguyện Ánh Sáng',
        note: null,
        isPublic: true,
        sortOrder: 2,
      },
      {
        displayName: 'Đối tác nội bộ (ẩn)',
        note: 'Chưa công khai',
        isPublic: false,
        sortOrder: 99,
      },
    ],
  });

  // Settings
  await prisma.setting.createMany({
    data: [
      {
        key: 'fund_name',
        value: { vi: 'Quỹ In Sách – Lan Tỏa Đạo Đức Làm Người' },
        updatedById: admin.id,
      },
      {
        key: 'fund_tagline',
        value: { vi: 'Minh bạch – Lan tỏa – Phụng sự cộng đồng' },
        updatedById: admin.id,
      },
      {
        key: 'contact',
        value: { email: 'lienhe@quyinsach.local', phone: '' },
        updatedById: admin.id,
      },
    ],
  });

  // Sample audit log
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SEED',
      entity: 'system',
      entityId: 'seed',
      newValue: {
        message: 'Initial seed completed',
        products: 3,
        donations: 4,
        expenses: 5,
        companions: 3,
      },
    },
  });

  console.log('Seed completed successfully.');
  console.log({
    admin: admin.email,
    products: { upcomingBook: upcomingBook.name, printedBook: printedBook.name, speaker: speaker.name },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
