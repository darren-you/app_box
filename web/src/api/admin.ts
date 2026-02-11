import { request } from './client';
import type {
  AdminUsersPaginationResponse,
  AdminProfile,
  AppConfig,
  AppConfigUpsertRequest,
  LoginRequest,
  LoginResponse,
  PaginationResponse,
  PlanetItem,
  User,
  AdminUserUpdateRequest
} from '../types/api';

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/admin/login', {
    method: 'POST',
    auth: false,
    body: payload
  });
}

export async function getAdminMe(): Promise<AdminProfile> {
  return request<AdminProfile>('/admin/auth/me', { method: 'GET' });
}

export async function listUsers(page: number, pageSize: number, keyword = ''): Promise<AdminUsersPaginationResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  if (keyword.trim()) {
    params.set('keyword', keyword.trim());
  }

  return request<AdminUsersPaginationResponse>(`/admin/users?${params.toString()}`, {
    method: 'GET'
  });
}

export async function updateUser(userId: number, payload: AdminUserUpdateRequest): Promise<User> {
  return request<User>(`/admin/users/${userId}`, {
    method: 'PUT',
    body: payload
  });
}

export async function deleteUser(userId: number): Promise<void> {
  await request<void>(`/admin/users/${userId}`, {
    method: 'DELETE'
  });
}

export async function listUserPlanets(
  userId: number,
  page: number,
  pageSize: number
): Promise<PaginationResponse<PlanetItem>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  return request<PaginationResponse<PlanetItem>>(`/admin/users/${userId}/planets?${params.toString()}`, {
    method: 'GET'
  });
}

export async function listConfigs(): Promise<AppConfig[]> {
  return request<AppConfig[]>('/admin/configs', { method: 'GET' });
}

export async function upsertConfig(key: string, payload: AppConfigUpsertRequest): Promise<AppConfig> {
  return request<AppConfig>(`/admin/configs/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: payload
  });
}

export async function deleteConfig(key: string): Promise<void> {
  await request<void>(`/admin/configs/${encodeURIComponent(key)}`, {
    method: 'DELETE'
  });
}
