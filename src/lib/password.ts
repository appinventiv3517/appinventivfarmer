/**
 * Prototype-only password hashing for the account kept on this device.
 * Salted SHA-256 via Web Crypto, so the typed password is never stored.
 * A real backend must hash on the server with a slow KDF (bcrypt, scrypt, Argon2).
 */
export async function hashPassword(userId: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`kisani-urjaa:${userId.trim().toLowerCase()}:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function checkPassword(userId: string, password: string, hash: string): Promise<boolean> {
  return (await hashPassword(userId, password)) === hash;
}

/** "9876543210" → "+91 XXXXXX3210", as shown on OTP screens. */
export function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(-10);
  return `+91 XXXXXX${d.slice(-4)}`;
}
