import type { QuantityUnit } from '@/types';
import { toKg } from './pricing';

/** Indian mobile numbers: 10 digits starting 6–9. */
export function validatePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (!d) return 'Enter your 10-digit mobile number.';
  if (d.length < 10) return `Mobile number is too short — ${10 - d.length} more digit${10 - d.length === 1 ? '' : 's'} needed.`;
  if (d.length > 10) return 'Mobile number should be 10 digits.';
  if (!/^[6-9]/.test(d)) return 'Indian mobile numbers start with 6, 7, 8 or 9.';
  return null;
}

export function validatePincode(raw: string): string | null {
  const d = raw.trim();
  if (!d) return 'Enter the 6-digit PIN code.';
  if (!/^\d+$/.test(d)) return 'PIN code can only contain digits.';
  if (d.length !== 6) return 'PIN code should be 6 digits.';
  if (d.startsWith('0')) return 'PIN codes do not start with 0.';
  return null;
}

export const ORDER_MIN_KG = 50;
export const ORDER_MAX_KG = 20_000;

export function validateQuantity(raw: string, unit: QuantityUnit): string | null {
  if (!raw.trim()) return 'Enter how much FOM you need.';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 'Enter a quantity greater than zero.';
  const decimals = (raw.split('.')[1] ?? '').length;
  if (unit === 'kg' && decimals > 0) return 'Use whole kilograms (for example 250).';
  if (unit === 'MT' && decimals > 2) return 'Use up to 2 decimal places for tonnes.';
  const kg = toKg(n, unit);
  if (kg < ORDER_MIN_KG) return `Minimum order is ${ORDER_MIN_KG} kg.`;
  if (kg > ORDER_MAX_KG) return `Maximum order is ${ORDER_MAX_KG / 1000} MT. For more, contact your Kisani Didi.`;
  return null;
}

export function validateAcres(raw: string, maxAcres?: number): string | null {
  if (!raw.trim()) return 'Enter the area in acres.';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 'Area must be more than 0 acres.';
  if (maxAcres !== undefined && n > maxAcres) return `This field is ${maxAcres} acres — enter ${maxAcres} or less.`;
  return null;
}

export function validateRequired(raw: string, label: string): string | null {
  return raw.trim() ? null : `Enter ${label}.`;
}

/** User IDs: English letters and numbers (dot or underscore allowed inside), 4–20 characters, starting with a letter. */
export function validateUserId(raw: string): string | null {
  const v = raw.trim();
  if (!v) return 'Enter a User ID.';
  if (/[^\x00-\x7F]/.test(v)) return 'User ID can only use English letters and numbers.';
  if (/\s/.test(v)) return 'User ID cannot contain spaces.';
  if (!/^[A-Za-z]/.test(v)) return 'User ID should start with a letter.';
  if (!/^[A-Za-z][A-Za-z0-9._]*$/.test(v)) return 'Use letters, numbers, dot (.) or underscore (_) only.';
  if (/[._]$/.test(v)) return 'User ID cannot end with a dot or underscore.';
  if (v.length < 4) return 'User ID should be at least 4 characters.';
  if (v.length > 20) return 'User ID can be at most 20 characters.';
  return null;
}

/** Passwords: 8–20 characters with at least one letter and one number. */
export function validatePassword(raw: string): string | null {
  if (!raw) return 'Enter a password.';
  if (raw.length < 8) return 'Password should be at least 8 characters.';
  if (raw.length > 20) return 'Password can be at most 20 characters.';
  if (!/[A-Za-z]/.test(raw)) return 'Add at least 1 letter.';
  if (!/\d/.test(raw)) return 'Add at least 1 number.';
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return 'Re-enter the password.';
  if (confirm !== password) return 'Passwords do not match.';
  return null;
}

/** Optional email: checked only when something is typed. */
export function validateEmail(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return 'Enter an email like name@example.com.';
  return null;
}

/** ID number for the chosen identity document. */
export function validateIdNumber(docType: string, raw: string): string | null {
  const v = raw.replace(/[\s-]/g, '').toUpperCase();
  if (!v) return 'Enter the ID number.';
  if (docType === 'voter-id' && !/^[A-Z]{3}\d{7}$/.test(v)) return 'Voter ID (EPIC) numbers have 3 letters and 7 digits, like ABC1234567.';
  if (docType === 'driving-licence' && !/^[A-Z]{2}\d{2}[A-Z0-9]{8,12}$/.test(v)) return 'Driving licence numbers start with the state code, like MH28 20210006753.';
  if (!/^[A-Z0-9/]{4,20}$/.test(v)) return 'Check the ID number: 4–20 letters and numbers.';
  return null;
}

/** Date of birth (yyyy-mm-dd): optional, but must be a past date and age 18 or older. */
export function validateDob(iso: string, today = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'Enter a valid date.';
  if (d > today) return 'Date of birth cannot be in the future.';
  const adult = new Date(d);
  adult.setFullYear(d.getFullYear() + 18);
  if (adult > today) return 'You need to be 18 or older to register.';
  if (today.getFullYear() - d.getFullYear() > 110) return 'Check the year of birth.';
  return null;
}
