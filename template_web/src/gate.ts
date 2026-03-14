import { buildAppboxUrl, isAppboxSameOrigin } from './runtime';

const GATE_STORAGE_KEY = 'appbox_gate_access';
const GATE_COOKIE_NAME = 'appbox_gate_access';
const GATE_ACCESS_VALUE = 'granted';
const LEGACY_STORAGE_KEYS = ['stellar_bms_token'];

function sanitizeNextPath(nextPath: string): string {
  const normalized = String(nextPath || '').trim();
  if (!normalized.startsWith('/')) {
    return '/';
  }
  if (normalized.startsWith('/gate')) {
    return '/';
  }
  return normalized;
}

function clearCookie(name: string): void {
  const expiredCookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0`;
  document.cookie = `${expiredCookie}; path=/`;
  document.cookie = `${expiredCookie}; path=/gate`;
}

function getCurrentNextPath(): string {
  if (typeof window === 'undefined') {
    return '/';
  }
  return sanitizeNextPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}

export function clearLegacyAuthState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  for (const key of LEGACY_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
}

export function hasClientGateAccess(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  if (!isAppboxSameOrigin()) {
    return true;
  }

  const hasLocalAccess = window.localStorage.getItem(GATE_STORAGE_KEY) === GATE_ACCESS_VALUE;
  const hasCookieAccess = document.cookie
    .split(';')
    .map((item) => item.trim())
    .some((item) => item === `${GATE_COOKIE_NAME}=${GATE_ACCESS_VALUE}`);

  return hasLocalAccess || hasCookieAccess;
}

export function clearClientGateAccess(): void {
  if (typeof window === 'undefined') {
    return;
  }

  clearLegacyAuthState();
  window.localStorage.removeItem(GATE_STORAGE_KEY);
  clearCookie(GATE_COOKIE_NAME);
}

export function requiresClientGateCheck(): boolean {
  return isAppboxSameOrigin();
}

export function getGateApiUrl(path: string): string {
  return buildAppboxUrl(path);
}

export function redirectToGate(nextPath = getCurrentNextPath()): void {
  if (typeof window === 'undefined') {
    return;
  }

  const gateUrl = new URL('/gate/index.html', buildAppboxUrl('/'));
  gateUrl.searchParams.set('next', sanitizeNextPath(nextPath));

  if (isAppboxSameOrigin()) {
    window.location.replace(gateUrl.toString());
    return;
  }

  const popup = window.open(gateUrl.toString(), '_blank', 'noopener,noreferrer');
  if (!popup) {
    window.location.assign(gateUrl.toString());
  }
}
