import axios from 'axios';
import type { ApiSuccess } from '@/types/public';
import { getAdminToken } from '@/features/auth/tokenStorage';

export const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 20_000,
});

adminApi.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function adminGet<T>(
  url: string,
  params?: Record<string, string | number | boolean | undefined>,
) {
  const res = await adminApi.get<ApiSuccess<T>>(url, { params });
  if (!res.data.success) throw new Error('Phản hồi API không hợp lệ');
  return { data: res.data.data, meta: res.data.meta };
}

export async function adminMutate<T>(
  method: 'post' | 'put',
  url: string,
  body?: unknown,
) {
  const res = await adminApi.request<ApiSuccess<T>>({ method, url, data: body });
  if (!res.data.success) throw new Error('Thao tác thất bại');
  return res.data.data;
}
