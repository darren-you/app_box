import type { ApiResponse } from '../types/api';
import { clearClientGateAccess, redirectToGate } from '../gate';
import { API_BASE, isAppboxSameOrigin } from '../runtime';

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
      credentials: rest.credentials ?? 'include',
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
      redirectToGate();
      throw new Error('访问口令已失效');
    }
  }

  const rawText = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const trimmedRawText = rawText.trim();

  if (isHtmlLikeResponse(contentType, trimmedRawText)) {
    if (isGateHtmlResponse(response, trimmedRawText)) {
      clearClientGateAccess();
      window.sessionStorage.clear();
      redirectToGate();
      throw new Error('访问口令已失效');
    }

    throw new Error(resolveHtmlResponseMessage(response, url));
  }

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

function resolveRequestFailureMessage(response: Response, rawText: string): string {
  const text = rawText.trim();

  if (text) {
    return `HTTP ${response.status}: ${text}`;
  }

  if (import.meta.env.DEV && (response.status === 401 || response.status === 404 || response.status === 500)) {
    return isAppboxSameOrigin()
      ? '请确认当前域名已通过 Gate 校验，且请求已命中 appbox_server'
      : '请确认当前浏览器已完成线上 appbox Gate 校验，并且 VITE_API_BASE_URL 指向已部署服务器环境';
  }

  return `Request failed with status ${response.status}`;
}

function isHtmlLikeResponse(contentType: string, rawText: string): boolean {
  const normalizedContentType = contentType.toLowerCase();
  if (normalizedContentType.includes('text/html')) {
    return true;
  }

  return /^<!doctype html>/i.test(rawText) || /^<html[\s>]/i.test(rawText);
}

function isGateHtmlResponse(response: Response, rawText: string): boolean {
  const normalizedText = rawText.toLowerCase();
  const redirectedToGate = safeResolvePathname(response.url).startsWith('/gate');

  return redirectedToGate
    || normalizedText.includes('id="gate-form"')
    || normalizedText.includes("id='gate-form'")
    || normalizedText.includes('/gate/api/login')
    || normalizedText.includes('appbox_gate_access');
}

function resolveHtmlResponseMessage(response: Response, requestUrl: string): string {
  if (import.meta.env.DEV) {
    return isAppboxSameOrigin()
      ? `接口返回了 HTML 页面，请确认当前域名已通过 Gate 校验（URL: ${requestUrl}）`
      : `接口返回了 HTML 页面，请先完成线上 appbox Gate 校验后再刷新当前开发页面（URL: ${requestUrl}）`;
  }

  return `接口返回了 HTML 页面，当前请求可能没有命中 appbox_server，而是落到了静态站点或网关页（URL: ${requestUrl}）`;
}

function safeResolvePathname(rawUrl: string): string {
  try {
    return new URL(rawUrl, window.location.origin).pathname;
  } catch {
    return '';
  }
}
