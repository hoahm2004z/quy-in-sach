export type ProductType = 'BOOK' | 'SPEAKER';
export type ProductStatus = 'UPCOMING' | 'PRINTED' | 'ARCHIVED';

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
};

export type FundStatistics = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  upcomingBudget: number;
};

export type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  productType: ProductType;
  status: ProductStatus;
  budgetEstimate: number;
  actualCost: number;
  plannedQuantity: number;
  printedQuantity: number;
  stockQuantity: number;
  plannedDate: string | null;
  completedDate: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
};

export type PublicProductDetail = PublicProduct & {
  relatedExpenses: Array<{
    id: string;
    category: string;
    amount: number;
    expenseDate: string;
    description: string;
  }>;
};

export type PublicDonation = {
  id: string;
  displayName: string;
  amount: number;
  donatedAt: string;
  content: string | null;
  productId: string | null;
};

export type PublicExpense = {
  id: string;
  description: string;
  amount: number;
  expenseDate: string;
  category: string;
  product: { id: string; name: string } | null;
};

export type PublicCompanion = {
  id: string;
  displayName: string;
  note: string | null;
  sortOrder: number;
};

export type ProductFilterKey = 'ALL' | 'BOOK_UPCOMING' | 'BOOK_PRINTED' | 'SPEAKER';
