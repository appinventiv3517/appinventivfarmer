import { isoDay, startOfDay } from './dates';

export interface AttendanceDay {
  date: string;
  /** ISO times; absent days have none. */
  in?: string;
  out?: string;
  place?: string;
  /** Selfie and location captured with the check-in and check-out (small JPEG data URLs). */
  inProof?: CheckProof;
  outProof?: CheckProof;
}

export interface CheckProof {
  selfie: string;
  lat: number;
  lng: number;
  /** True when the demo's sample location stood in for the phone's (prototype only). */
  sampleLocation?: boolean;
}

const PLACES = ['Ratanpur', 'Dhad', 'Chikhli', 'Mehkar', 'Sakharkherda', 'Lonar'];

/**
 * Sample attendance for the last 60 days (Sundays off, a few absences),
 * generated from the date so it is the same on every load. Today is not
 * included: it comes from the store when the Didi checks in.
 */
export function sampleAttendance(now = new Date()): AttendanceDay[] {
  const today = startOfDay(now);
  const days: AttendanceDay[] = [];
  for (let n = 60; n >= 1; n--) {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    if (d.getDay() === 0) continue;
    const seed = d.getDate() * 7 + d.getMonth() * 13;
    const date = isoDay(d);
    if (seed % 17 === 3) {
      days.push({ date });
      continue;
    }
    const inAt = new Date(d);
    inAt.setHours(9, (seed * 7) % 40, 0, 0);
    const outAt = new Date(d);
    outAt.setHours(17, 10 + ((seed * 11) % 45), 0, 0);
    days.push({ date, in: inAt.toISOString(), out: outAt.toISOString(), place: PLACES[seed % PLACES.length] });
  }
  return days;
}

export function workedMinutes(d: AttendanceDay, now = new Date()): number {
  if (!d.in) return 0;
  const end = d.out ? new Date(d.out) : now;
  return Math.max(0, Math.round((end.getTime() - new Date(d.in).getTime()) / 60000));
}

export function hoursLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}
