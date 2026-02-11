export interface ApiResponse<T> {
  code: number;
  timestamp: number;
  msg: string;
  data: T;
}

export interface PaginationResponse<T> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  data: T[];
}

export interface AdminUsersPaginationResponse extends PaginationResponse<User> {
  subscriberTotal: number;
}

export interface PlanetItem {
  id: string;
  name: string;
  userId: number;
  imageUrl: string;
  dateKey: string;
  planetNo: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  userId: number;
  username: string;
  email: string;
  role: string;
  accessToken: string;
  refreshToken: string;
  token: string;
}

export interface AdminProfile {
  userId: number;
  username: string;
  email: string;
  role: string;
}

export interface User {
  id: number;
  username: string;
  phone: string;
  avatar: string;
  role: 'admin' | 'user' | 'guest';
  status: 'active' | 'disabled';
  isSubscriber: boolean;
  subscriptionExpiresAt: string | null;
  createdAt: string;
}

export interface AdminUserUpdateRequest {
  username?: string;
  avatar?: string;
  role?: 'admin' | 'user' | 'guest';
  status?: 'active' | 'disabled';
  isSubscriber?: boolean;
  subscriptionExpiresAt?: string;
}

export interface AppConfig {
  id: number;
  configKey: string;
  alias: string;
  configValue: string;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppConfigUpsertRequest {
  alias: string;
  configValue: string;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  description: string;
}
