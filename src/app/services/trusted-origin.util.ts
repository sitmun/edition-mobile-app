export function exactOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** True when `url` is same-origin as `base` and under its path prefix. */
export function matchesTrustedBase(url: string, base: string | null): boolean {
  if (!base) {
    return false;
  }
  try {
    const target = new URL(url);
    const trusted = new URL(base);
    if (target.origin !== trusted.origin) {
      return false;
    }
    const trustedPath = trusted.pathname.replace(/\/+$/, '') || '';
    const targetPath = target.pathname;
    return targetPath === trustedPath || targetPath.startsWith(`${trustedPath}/`);
  } catch {
    return false;
  }
}

/**
 * Attach Bearer tokens only for configured backend/middleware bases.
 * Middleware is checked first so same-origin gateways (`/backend` + `/middleware`)
 * still send `proxy_token` to middleware routes.
 */
export function authHeadersForUrl(
  url: string,
  backendBase: string | null,
  middlewareBase: string | null,
  accessToken: string,
  proxyToken: string
): Record<string, string> {
  if (matchesTrustedBase(url, middlewareBase) && proxyToken) {
    return { Authorization: `Bearer ${proxyToken}` };
  }
  if (matchesTrustedBase(url, backendBase) && accessToken) {
    return { Authorization: `Bearer ${accessToken}` };
  }
  return {};
}
