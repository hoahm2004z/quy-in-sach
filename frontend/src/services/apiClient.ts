import axios from 'axios';
import type { ApiSuccess } from '@/types/public';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 20_000,
  headers: {
    Accept: 'application/json',
  },
});

export async function getPublicData<T>(
  url: string,
  params?: Record<string, string | number | undefined>,
): Promise<{ data: T; meta?: ApiSuccess<T>['meta'] }> {
  const response = await api.get<ApiSuccess<T>>(url, { params });
  if (!response.data.success) {
    throw new Error('Phản hồi API không hợp lệ');
  }
  return { data: response.data.data, meta: response.data.meta };
}
