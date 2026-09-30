import { DonationStatus, ExpenseStatus, ProductStatus, ProductType, Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

function money(value: Prisma.Decimal | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

export async function getFinancialSummary() {
  const [incomeAgg, expenseAgg, budgetAgg] = await Promise.all([
    prisma.donation.aggregate({
      where: { status: DonationStatus.CONFIRMED, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { status: ExpenseStatus.CONFIRMED, deletedAt: null },
      _sum: { amount: true },
    }),
    prisma.product.aggregate({
      where: { status: ProductStatus.UPCOMING, deletedAt: null },
      _sum: { budgetEstimate: true },
    }),
  ]);

  const totalIncome = money(incomeAgg._sum.amount);
  const totalExpense = money(expenseAgg._sum.amount);

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    upcomingBudget: money(budgetAgg._sum.budgetEstimate),
  };
}

export async function getAdminDashboard() {
  const summary = await getFinancialSummary();

  const [
    pendingDonations,
    pendingExpenses,
    incompleteProducts,
    upcomingBooks,
    recentPrinted,
    recentDonations,
    recentExpenses,
  ] = await Promise.all([
    prisma.donation.count({
      where: { status: DonationStatus.PENDING, deletedAt: null },
    }),
    prisma.expense.count({
      where: { status: ExpenseStatus.PENDING, deletedAt: null },
    }),
    prisma.product.count({
      where: {
        deletedAt: null,
        status: ProductStatus.UPCOMING,
        OR: [{ description: null }, { plannedQuantity: 0 }, { budgetEstimate: 0 }],
      },
    }),
    prisma.product.findMany({
      where: {
        deletedAt: null,
        productType: ProductType.BOOK,
        status: ProductStatus.UPCOMING,
      },
      orderBy: { plannedDate: 'asc' },
      take: 5,
      select: {
        id: true,
        name: true,
        budgetEstimate: true,
        plannedQuantity: true,
        plannedDate: true,
      },
    }),
    prisma.product.findMany({
      where: {
        deletedAt: null,
        productType: ProductType.BOOK,
        status: ProductStatus.PRINTED,
      },
      orderBy: { completedDate: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        printedQuantity: true,
        completedDate: true,
      },
    }),
    prisma.donation.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        donorName: true,
        displayName: true,
        isAnonymous: true,
        amount: true,
        status: true,
        donatedAt: true,
      },
    }),
    prisma.expense.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        description: true,
        amount: true,
        status: true,
        expenseDate: true,
      },
    }),
  ]);

  return {
    summary,
    todos: {
      pendingDonations,
      pendingExpenses,
      incompleteProducts,
    },
    upcomingBooks: upcomingBooks.map((p) => ({
      ...p,
      budgetEstimate: money(p.budgetEstimate),
    })),
    recentPrinted,
    recentDonations: recentDonations.map((d) => ({
      ...d,
      amount: money(d.amount),
    })),
    recentExpenses: recentExpenses.map((e) => ({
      ...e,
      amount: money(e.amount),
    })),
  };
}
