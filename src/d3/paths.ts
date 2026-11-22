/**
 * Ver 3 (a copy of Direction 02) lives under /d3 and mirrors every Direction 01 route, so the
 * same screen can be opened in either direction. Shared data (notification
 * links, content CTAs) stores Direction 01 paths; `to()` maps them.
 */
export const D3 = '/d3';

export function isD3Path(pathname: string): boolean {
  return pathname === D3 || pathname.startsWith(`${D3}/`);
}

/** '/orders' → '/d3/orders'. Already-prefixed paths and external URLs pass through. */
export function to(path: string): string {
  if (/^https?:/.test(path) || isD3Path(path)) return path;
  if (path === '/' || path === '') return D3;
  return `${D3}${path.startsWith('/') ? path : `/${path}`}`;
}

/** '/d3/orders' → '/orders'. */
export function fromD3(pathname: string): string {
  if (!isD3Path(pathname)) return pathname;
  const rest = pathname.slice(D3.length);
  return rest || '/';
}

export const TAB_ROOTS = ['/home', '/learn', '/orders', '/account'].map(to);

export function isTabRoot(pathname: string): boolean {
  return TAB_ROOTS.includes(pathname);
}
