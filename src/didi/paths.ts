/**
 * Kisani Didi app routes live under /didi. Paths inside the app are written
 * without the prefix ('/tasks') and `to()` adds it, the same pattern as Ver 3.
 */
export const DIDI = '/didi';

export function isDidiPath(pathname: string): boolean {
  return pathname === DIDI || pathname.startsWith(`${DIDI}/`);
}

export function to(path: string): string {
  if (/^https?:|^tel:|^mailto:/.test(path) || isDidiPath(path)) return path;
  if (path === '/' || path === '') return DIDI;
  return `${DIDI}${path.startsWith('/') ? path : `/${path}`}`;
}

export const TAB_ROOTS = ['/home', '/tasks', '/farmers', '/attendance', '/profile'].map(to);

export function isTabRoot(pathname: string): boolean {
  return TAB_ROOTS.includes(pathname);
}
