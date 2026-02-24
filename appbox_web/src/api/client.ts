import type { ApiResponse } from '../types/api';

const TOKEN_KEY = 'stellar_bms_token';
const API_BASE = normalizeApiBase(
  import.meta.env.VITE_API_BASE_URL || 'https://stellar.xdarren.com/api/v1'
);

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  auth?: boolean;
  body?: unknown;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, body, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);

  if (body !== undefined && body !== null) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const token = getToken();
    if (token) {
      finalHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const url = buildApiUrl(path);
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '网络请求失败';
    throw new Error(`请求失败: ${message} (URL: ${url})`);
  }

  const rawText = await response.text();
  let payload: ApiResponse<T> | null = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText) as ApiResponse<T>;
    } catch {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${rawText}`);
      }
      throw new Error('接口返回了非 JSON 响应');
    }
  }

  if (!response.ok || !payload || payload.code !== 200) {
    const message = payload?.msg || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload.data;
}

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

function normalizeApiBase(base: string): string {
  const value = String(base || '')
    .trim()
    .replace(/\/+$/, '');

  if (!value) {
    return '/api/v1';
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.startsWith('/')) {
    return value;
  }
  return `/${value}`;
}
