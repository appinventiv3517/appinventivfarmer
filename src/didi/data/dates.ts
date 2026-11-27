/** Sample data is dated relative to today so the prototype always looks current. */
const DAY = 86_400_000;

export function startOfDay(d = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** ISO date (YYYY-MM-DD) in local time. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today ± n days, as a local date-time ISO string at the given hour. */
export function daysFromNow(n: number, hour = 10, minute = 0, now = new Date()): string {
  const d = new Date(startOfDay(now).getTime() + n * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function dayDiff(iso: string, now = new Date()): number {
  return Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / DAY);
}
