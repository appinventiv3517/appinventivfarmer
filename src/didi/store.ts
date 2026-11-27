import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON, removeKey } from '@/lib/storage';
import { DIDI_PROFILE, type DidiProfile } from './data/didi';
import { SAMPLE_TASKS, type Proof, type Task } from './data/tasks';
import { INITIALLY_UNREAD } from './data/notifications';
import { isoDay } from './data/dates';
import type { AttendanceDay, CheckProof } from './data/attendance';

/*
 * Kisani Didi app state. Kept on this device only (localStorage), separate
 * from the Farmer App's store so the two prototypes never touch each other.
 */

export type TextSize = 'xsmall' | 'small' | 'default' | 'large';
export const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: 'xsmall', label: 'Smaller' },
  { value: 'small', label: 'Small' },
  { value: 'default', label: 'Default' },
  { value: 'large', label: 'Large' },
];

export interface Verification {
  status: 'none' | 'submitted' | 'verified';
  docType: string;
  idNumber: string;
  fullName: string;
  gender: string;
  dob: string;
  docFile?: string;
  submittedAt?: string;
}

export interface DidiState {
  session: { onboarded: boolean; signedIn: boolean; language: string };
  profile: DidiProfile;
  passwordHash: string | null;
  tasks: Task[];
  /** Today's attendance and the days recorded on this device. */
  attendance: AttendanceDay[];
  unread: string[];
  verification: Verification;
  prefs: { text: TextSize };
  /** Prototype controls: show loading and error states on demand. */
  demo: { slow: boolean; fail: boolean };
}

const KEY = 'kisani-urjaa:didi';

function initial(): DidiState {
  return {
    session: { onboarded: false, signedIn: false, language: 'en' },
    profile: DIDI_PROFILE,
    passwordHash: null,
    tasks: SAMPLE_TASKS,
    attendance: [],
    unread: INITIALLY_UNREAD,
    verification: { status: 'none', docType: '', idNumber: '', fullName: '', gender: '', dob: '' },
    prefs: { text: 'default' },
    demo: { slow: false, fail: false },
  };
}

function load(): DidiState {
  const base = initial();
  const saved = readJSON<Partial<DidiState>>(KEY);
  if (!saved) return base;
  return { ...base, ...saved, session: { ...base.session, ...saved.session }, profile: { ...base.profile, ...saved.profile }, prefs: { ...base.prefs, ...saved.prefs }, demo: { ...base.demo, ...saved.demo }, verification: { ...base.verification, ...saved.verification } };
}

let state: DidiState = typeof window === 'undefined' ? initial() : load();
const listeners = new Set<() => void>();
let queued = false;

function set(update: (s: DidiState) => DidiState) {
  const next = update(state);
  if (next === state) return;
  state = next;
  if (!queued) {
    queued = true;
    queueMicrotask(() => {
      queued = false;
      writeJSON(KEY, state);
    });
  }
  listeners.forEach((l) => l());
}

export const getDidi = () => state;

export function useDidi<T>(selector: (s: DidiState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state),
    () => selector(state),
  );
}

const updateTask = (id: string, fn: (t: Task) => Task) => set((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? fn(t) : t)) }));
const stamp = () => Math.random().toString(36).slice(2, 8);

export const didi = {
  finishOnboarding: (language: string) => set((s) => ({ ...s, session: { ...s.session, onboarded: true, language } })),
  setLanguage: (language: string) => set((s) => ({ ...s, session: { ...s.session, language } })),
  signIn: () => set((s) => ({ ...s, session: { ...s.session, onboarded: true, signedIn: true } })),
  signOut: () => set((s) => ({ ...s, session: { ...s.session, signedIn: false } })),
  setPasswordHash: (passwordHash: string) => set((s) => ({ ...s, passwordHash })),
  saveProfile: (p: Partial<DidiProfile>) => set((s) => ({ ...s, profile: { ...s.profile, ...p } })),
  setText: (text: TextSize) => set((s) => ({ ...s, prefs: { ...s.prefs, text } })),
  setDemo: (demo: Partial<DidiState['demo']>) => set((s) => ({ ...s, demo: { ...s.demo, ...demo } })),

  /* ---------- Tasks ---------- */
  startTask: (id: string) => updateTask(id, (t) => (t.status === 'pending' ? { ...t, status: 'in_progress' } : t)),
  saveDraftNote: (id: string, draftNote: string) => updateTask(id, (t) => ({ ...t, draftNote })),
  /** Save progress: records what was done so far, with the note and proofs. */
  saveProgress: (id: string, done: number, note: string, proofs: Proof[]) =>
    updateTask(id, (t) => ({ ...t, done, draftNote: '', status: t.status === 'pending' || t.status === 'rejected' ? 'in_progress' : t.status, submissions: [...t.submissions, { id: stamp(), at: new Date().toISOString(), count: done, note, proofs, kind: 'progress' }] })),
  submitForReview: (id: string, done: number, note: string, proofs: Proof[]) =>
    updateTask(id, (t) => ({ ...t, done, draftNote: '', status: 'in_review', submissions: [...t.submissions, { id: stamp(), at: new Date().toISOString(), count: done, note, proofs, kind: 'review' }] })),

  /* ---------- Attendance ---------- */
  checkIn: (place: string, proof: CheckProof) =>
    set((s) => {
      const date = isoDay(new Date());
      if (s.attendance.some((d) => d.date === date && d.in)) return s;
      return { ...s, attendance: [...s.attendance.filter((d) => d.date !== date), { date, in: new Date().toISOString(), place, inProof: proof }] };
    }),
  checkOut: (proof: CheckProof) =>
    set((s) => {
      const date = isoDay(new Date());
      return { ...s, attendance: s.attendance.map((d) => (d.date === date && d.in && !d.out ? { ...d, out: new Date().toISOString(), outProof: proof } : d)) };
    }),

  /* ---------- Notifications ---------- */
  markRead: (id: string) => set((s) => (s.unread.includes(id) ? { ...s, unread: s.unread.filter((x) => x !== id) } : s)),
  markUnread: (id: string) => set((s) => (s.unread.includes(id) ? s : { ...s, unread: [...s.unread, id] })),
  markAllRead: () => set((s) => ({ ...s, unread: [] })),

  /* ---------- Verification ---------- */
  submitVerification: (v: Omit<Verification, 'status' | 'submittedAt'>) => set((s) => ({ ...s, verification: { ...v, status: 'submitted', submittedAt: new Date().toISOString() } })),

  verifyNow: () => set((s) => (s.verification.status === 'submitted' ? { ...s, verification: { ...s.verification, status: 'verified' } } : s)),

  resetAll: () => {
    removeKey(KEY);
    set(() => initial());
  },
};

/** Today's attendance record, if any. */
export function useToday(): AttendanceDay | undefined {
  const date = isoDay(new Date());
  return useDidi((s) => s.attendance.find((d) => d.date === date));
}
