import { readSession, writeSession } from '@/lib/storage';

const KEY = 'kisani-urjaa:didi-login';
export const setLoginPhone = (phone: string, purpose: 'login' | 'reset') => writeSession(KEY, JSON.stringify({ phone, purpose }));
export function getLoginPhone(): { phone: string; purpose: 'login' | 'reset' } | null {
  try {
    return JSON.parse(readSession(KEY) ?? 'null');
  } catch {
    return null;
  }
}
