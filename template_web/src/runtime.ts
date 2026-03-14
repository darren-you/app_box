const DEFAULT_API_BASE_URL = 'https://appbox.xdarren.com/api/v1';

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL);

export const APPBOX_ORIGIN = resolveAppboxOrigin(API_BASE);

export function buildAppboxUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, `${APPBOX_ORIGIN}/`).toString();
}

export function isAppboxSameOrigin(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return APPBOX_ORIGIN === window.location.origin;
}

function resolveAppboxOrigin(apiBase: string): string {
  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    try {
      return new URL(apiBase).origin;
    } catch {
      return 'https://appbox.xdarren.com';
    }
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'https://appbox.xdarren.com';
}

function normalizeApiBase(base: string): string {
  const value = String(base || '')
    .trim()
    .replace(/\/+$/, '');

  if (!value) {
    return DEFAULT_API_BASE_URL;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.startsWith('/')) {
    return value;
  }
  return `/${value}`;
}
