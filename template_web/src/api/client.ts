import type { ApiResponse } from '../types/api';
import { clearClientGateAccess, redirectToGate } from '../gate';

const API_BASE = normalizeApiBase(
  import.meta.env.VITE_API_BASE_URL || '/api/v1'
);

interface RequestOptions extends Omit<RequestInit, 'body'> {
  appKey?: string;
  body?: unknown;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { appKey = '', body, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);

  if (body !== undefined && body !== null) {
    finalHeaders.set('Content-Type', 'application/json');
  }

  if (appKey.trim()) {
    finalHeaders.set('X-App-Key', appKey.trim());
  }

  const url = buildApiUrl(path);
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      credentials: rest.credentials ?? 'same-origin',
      headers: finalHeaders,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '网络请求失败';
    throw new Error(`请求失败: ${message} (URL: ${url})`);
  }

  if (response.status === 401) {
    clearClientGateAccess();
    window.sessionStorage.clear();
    redirectToGate();
    throw new Error('访问口令已失效');
  }

  if (response.redirected) {
    const redirectedUrl = new URL(response.url);
    if (redirectedUrl.pathname.startsWith('/gate')) {
      clearClientGateAccess();
      window.sessionStorage.clear();
      window.location.replace(redirectedUrl.toString());
      throw new Error('访问口令已失效');
    }
  }

  const rawText = await response.text();
  let payload: ApiResponse<T> | null = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText) as ApiResponse<T>;
    } catch {
      if (!response.ok) {
        throw new Error(resolveRequestFailureMessage(response, rawText));
      }
      throw new Error('接口返回了非 JSON 响应');
    }
  }

  if (!response.ok || !payload || payload.code !== 200) {
    const message = payload?.msg || resolveRequestFailureMessage(response, rawText);
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

function resolveRequestFailureMessage(response: Response, rawText: string): string {
  const text = rawText.trim();

  if (text) {
    return `HTTP ${response.status}: ${text}`;
  }

  if (import.meta.env.DEV && (response.status === 404 || response.status === 500) && API_BASE.startsWith('/api')) {
    return '本地开发未配置可用后端，请通过 BMS_PROXY_TARGET / VITE_API_BASE_URL 指向已部署服务器环境';
  }

  return `Request failed with status ${response.status}`;
}
