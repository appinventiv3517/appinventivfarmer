import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/services/api';
import { getState } from '@/services/store';
import { validatePhone } from '@/lib/validation';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';
import { useNav } from '../../nav';
import { AuthShell } from './AuthShell';
import { PhoneField } from './fields';
import { startFlow } from './flow';
import { DEMO_ACCOUNT } from '@/data/people';

/** Forgot password / forgot User ID: registered mobile number, then an OTP. */
export function ForgotMobile({ kind }: { kind: 'password' | 'user-id' }) {
  const nav = useNav();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const digits = phone.replace(/\D/g, '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validatePhone(digits) ?? (digits === DEMO_ACCOUNT.phone && getState().account?.phone !== digits ? `This is the demo account: User ID ${DEMO_ACCOUNT.userId}, password ${DEMO_ACCOUNT.password}.` : null) ?? (getState().account?.phone !== digits ? 'No account found for this number. Check it, or sign up.' : null);
    setError(err);
    if (err) return;
    setBusy(true);
    try {
      await api.sendOtp(digits);
      startFlow(kind === 'password' ? 'forgot-password' : 'forgot-user-id', digits);
      nav('/auth/otp');
    } catch (e2) {
      toast({ message: e2 instanceof ApiError ? e2.message : 'Could not send the OTP.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title={kind === 'password' ? 'Forgot password' : 'Forgot User ID'} text="Enter your registered mobile number. We will send you an OTP." back={kind === 'password' ? '/login?with=password' : '/login?with=password'} onSubmit={submit}>
      <PhoneField label="Registered mobile number" required autoFocus value={phone} onChange={(v) => (setPhone(v), error && setError(null))} error={error} />
      <Button type="submit" size="lg" block loading={busy}>
        Get OTP
      </Button>
    </AuthShell>
  );
}

export function ForgotPassword() {
  return <ForgotMobile kind="password" />;
}
export function ForgotUserId() {
  return <ForgotMobile kind="user-id" />;
}
