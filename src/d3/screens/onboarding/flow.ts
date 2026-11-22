import { readSession, writeSession } from '@/lib/storage';

/** Why an OTP is being asked for; decides where a verified code leads. */
export type OtpPurpose = 'signup' | 'login' | 'forgot-password' | 'forgot-user-id';

interface Flow {
  purpose: OtpPurpose;
  phone: string;
  /** User ID chosen on the Create User ID screen, until the password is set. */
  userId?: string;
  /** Set once the OTP for this flow has been verified. */
  verified?: boolean;
}

const KEY = 'kisani-urjaa:v3-auth-flow';

/** The sign-up / log-in flow in progress (this tab only; survives a reload). */
export function readFlow(): Flow | null {
  try {
    const raw = readSession(KEY);
    return raw ? (JSON.parse(raw) as Flow) : null;
  } catch {
    return null;
  }
}

export function startFlow(purpose: OtpPurpose, phone: string) {
  writeSession(KEY, JSON.stringify({ purpose, phone } satisfies Flow));
}

export function updateFlow(patch: Partial<Flow>) {
  const f = readFlow();
  if (f) writeSession(KEY, JSON.stringify({ ...f, ...patch }));
}

export function endFlow() {
  writeSession(KEY, '');
}
