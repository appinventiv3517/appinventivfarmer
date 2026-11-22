import { describe, expect, it } from 'vitest';
import { validateConfirmPassword, validateDob, validateEmail, validateIdNumber, validatePassword, validateUserId } from '@/lib/validation';
import { hashPassword, checkPassword, maskPhone } from '@/lib/password';
import { DISTRICTS, MANDALS, STATES, stateForPincode } from '@/data/places';
import { completion } from '../screens/profile-setup/ProfileSetup';
import { EMPTY_PROFILE_DETAILS } from '@/services/store';

describe('Ver 3 sign-up rules', () => {
  it('User ID: English letters and numbers, 4–20, starts with a letter', () => {
    expect(validateUserId('RamPrasad')).toBeNull();
    expect(validateUserId('ram.prasad_7')).toBeNull();
    expect(validateUserId('')).toMatch(/Enter/);
    expect(validateUserId('राम123')).toMatch(/English/);
    expect(validateUserId('7ram')).toMatch(/start with a letter/);
    expect(validateUserId('ram prasad')).toMatch(/spaces/);
    expect(validateUserId('abc')).toMatch(/at least 4/);
    expect(validateUserId('a'.repeat(21))).toMatch(/at most 20/);
    expect(validateUserId('ram_')).toMatch(/cannot end/);
  });
  it('password: 8–20 with a letter and a number; confirmation must match', () => {
    expect(validatePassword('abcd@12345')).toBeNull();
    expect(validatePassword('abc123')).toMatch(/at least 8/);
    expect(validatePassword('abcdefghij')).toMatch(/number/);
    expect(validatePassword('1234567890')).toMatch(/letter/);
    expect(validatePassword('a1'.repeat(11))).toMatch(/at most 20/);
    expect(validateConfirmPassword('abcd@12345', 'abcd@1234')).toMatch(/do not match/);
    expect(validateConfirmPassword('abcd@12345', 'abcd@12345')).toBeNull();
  });
  it('stores a hash, never the password', async () => {
    const h = await hashPassword('RamPrasad', 'abcd@12345');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('abcd');
    expect(await checkPassword('rampRASAD', 'abcd@12345', h)).toBe(true);
    expect(await checkPassword('RamPrasad', 'abcd@12346', h)).toBe(false);
    expect(maskPhone('9876543210')).toBe('+91 XXXXXX3210');
  });
});

describe('Ver 3 profile setup rules', () => {
  it('ID numbers per document', () => {
    expect(validateIdNumber('voter-id', 'ABC1234567')).toBeNull();
    expect(validateIdNumber('voter-id', 'AB1234567')).toMatch(/3 letters/);
    expect(validateIdNumber('driving-licence', 'MH28 20210006753')).toBeNull();
    expect(validateIdNumber('driving-licence', '12345')).toMatch(/state code/);
    expect(validateIdNumber('kisan-card', '')).toMatch(/Enter/);
  });
  it('date of birth: optional, past, 18+', () => {
    const today = new Date('2026-11-22T12:00:00');
    expect(validateDob('', today)).toBeNull();
    expect(validateDob('1980-05-01', today)).toBeNull();
    expect(validateDob('2027-01-01', today)).toMatch(/future/);
    expect(validateDob('2010-01-01', today)).toMatch(/18/);
  });
  it('email is optional but checked', () => {
    expect(validateEmail('')).toBeNull();
    expect(validateEmail('p.sharma@gmail.com')).toBeNull();
    expect(validateEmail('p.sharma@gmail')).toMatch(/email/);
  });
  it('PIN code fills the state only when the prefix is unambiguous', () => {
    expect(stateForPincode('443303')).toBe('Maharashtra');
    expect(stateForPincode('400001')).toBe('Maharashtra');
    expect(stateForPincode('403001')).toBe('Goa');
    expect(stateForPincode('110001')).toBe('Delhi');
    expect(stateForPincode('560001')).toBe('Karnataka');
    expect(stateForPincode('800001')).toBeNull();
    expect(stateForPincode('44330')).toBeNull();
  });
  it('reference lists are complete and consistent', () => {
    expect(STATES).toHaveLength(36);
    expect(DISTRICTS.Maharashtra).toHaveLength(36);
    expect(MANDALS.Buldhana).toHaveLength(13);
    expect(DISTRICTS.Maharashtra).toContain('Buldhana');
  });
  it('completion: 20 → 40 → 70, then +6 per extra up to 100', () => {
    expect(completion(EMPTY_PROFILE_DETAILS, 1)).toBe(20);
    expect(completion(EMPTY_PROFILE_DETAILS, 2)).toBe(40);
    expect(completion(EMPTY_PROFILE_DETAILS, 3)).toBe(70);
    expect(completion({ ...EMPTY_PROFILE_DETAILS, photo: 'x', relationName: 'Paresh', altPhone: '9876543210', email: 'a@b.co', education: 'High school' }, 3)).toBe(100);
  });
});
