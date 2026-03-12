import { request } from './client';
import type {
  AdminUsersPaginationResponse,
  AppConfig,
  AppConfigUpsertRequest,
  PaginationResponse,
  PlanetItem,
  User,
  AdminUserUpdateRequest
} from '../types/api';

export async function listProviders(): Promise<string[]> {
  return request<string[]>('/admin/providers', { method: 'GET' });
}

export async function listUsers(
  page: number,
  pageSize: number,
  keyword = '',
  appKey = ''
): Promise<AdminUsersPaginationResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  if (keyword.trim()) {
    params.set('keyword', keyword.trim());
  }

  return request<AdminUsersPaginationResponse>(`/admin/users?${params.toString()}`, {
    method: 'GET',
    appKey
  });
}

export async function updateUser(userId: number, payload: AdminUserUpdateRequest, appKey = ''): Promise<User> {
  return request<User>(`/admin/users/${userId}`, {
    method: 'PUT',
    body: payload,
    appKey
  });
}

export async function deleteUser(userId: number, appKey = ''): Promise<void> {
  await request<void>(`/admin/users/${userId}`, {
    method: 'DELETE',
    appKey
  });
}

export async function listUserPlanets(
  userId: number,
  page: number,
  pageSize: number,
  appKey = ''
): Promise<PaginationResponse<PlanetItem>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  return request<PaginationResponse<PlanetItem>>(`/admin/users/${userId}/planets?${params.toString()}`, {
    method: 'GET',
    appKey
  });
}

export async function listConfigs(appKey = ''): Promise<AppConfig[]> {
  return request<AppConfig[]>('/admin/configs', { method: 'GET', appKey });
}

export async function upsertConfig(key: string, payload: AppConfigUpsertRequest, appKey = ''): Promise<AppConfig> {
  return request<AppConfig>(`/admin/configs/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: payload,
    appKey
  });
}

export async function deleteConfig(key: string, appKey = ''): Promise<void> {
  await request<void>(`/admin/configs/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    appKey
  });
}
