import { getPublicData } from './apiClient';
import type {
  FundStatistics,
  PublicCompanion,
  PublicDonation,
  PublicExpense,
  PublicProduct,
  PublicProductDetail,
  ProductStatus,
  ProductType,
} from '@/types/public';

export async function fetchStatistics() {
  const { data } = await getPublicData<FundStatistics>('/api/public/statistics');
  return data;
}

export async function fetchProducts(params: {
  page?: number;
  pageSize?: number;
  type?: ProductType;
  status?: ProductStatus;
}) {
  return getPublicData<PublicProduct[]>('/api/public/products', params);
}

export async function fetchProductById(id: string) {
  const { data } = await getPublicData<PublicProductDetail>(`/api/public/products/${id}`);
  return data;
}

export async function fetchDonations(page = 1, pageSize = 20) {
  return getPublicData<PublicDonation[]>('/api/public/donations', { page, pageSize });
}

export async function fetchExpenses(page = 1, pageSize = 20) {
  return getPublicData<PublicExpense[]>('/api/public/expenses', { page, pageSize });
}

export async function fetchCompanions() {
  const { data } = await getPublicData<PublicCompanion[]>('/api/public/companions');
  return data;
}
