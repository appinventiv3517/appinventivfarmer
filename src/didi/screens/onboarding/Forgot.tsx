import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { validateConfirmPassword, validatePassword, validatePhone } from '@/lib/validation';
import { hashPassword } from '@/lib/password';
import { api } from '@/services/api';
import { PasswordField, PhoneField } from '@/d3/screens/onboarding/fields';
import { useToast } from '@/d3/ui/Toast';
import { Button } from '../../ui/Button';
import { didi } from '../../store';
import { DIDI_DEMO } from '../../data/didi';
import { useNav } from '../../nav';
import { AuthShell } from './AuthShell';
import { getLoginPhone, setLoginPhone } from './flow';

/** Forgot password: OTP to the registered number, then a new password. */
export default function Forgot() {
  const nav = useNav();
  const toast = useToast();
  const [params] = useSearchParams();
  const step = params.get('step') === 'new' && getLoginPhone()?.purpose === 'reset' ? 'new' : 'phone';
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ phone?: string | null; pw?: string | null; confirm?: string | null }>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (step === 'phone') {
      const d = phone.replace(/\D/g, '');
      const err = validatePhone(d) ?? (d !== DIDI_DEMO.phone ? 'This number isn’t registered as a Kisani Didi.' : null);
      if (err) return setErrors({ phone: err });
      setBusy(true);
      await api.sendOtp(d).catch(() => undefined);
      setBusy(false);
      setLoginPhone(d, 'reset');
      nav('/login/otp');
      return;
    }
    const next = { pw: validatePassword(pw), confirm: validateConfirmPassword(pw, confirm) };
    setErrors(next);
    if (next.pw || next.confirm) return;
    setBusy(true);
    didi.setPasswordHash(await hashPassword(DIDI_DEMO.partnerId, pw));
    setBusy(false);
    toast({ message: 'Password changed. Log in with your new password.', tone: 'success' });
    nav('/login', { replace: true });
  };

  return step === 'phone' ? (
    <AuthShell title="Forgot password" text="We’ll send an OTP to your registered mobile number." back="/login" onSubmit={submit}>
      <PhoneField label="Registered mobile number" required value={phone} onChange={(v) => (setPhone(v), setErrors({}))} error={errors.phone} />
      <Button type="submit" size="lg" block loading={busy}>
        Send OTP
      </Button>
    </AuthShell>
  ) : (
    <AuthShell title="Set a new password" text="At least 8 characters, with a letter and a number." back="/login" onSubmit={submit}>
      <PasswordField label="New password" placeholder="Enter new password" autoComplete="new-password" value={pw} onChange={(v) => (setPw(v), setErrors((x) => ({ ...x, pw: null })))} error={errors.pw} />
      <PasswordField label="Confirm new password" placeholder="Enter it again" autoComplete="new-password" value={confirm} onChange={(v) => (setConfirm(v), setErrors((x) => ({ ...x, confirm: null })))} error={errors.confirm} />
      <Button type="submit" size="lg" block loading={busy}>
        Save password
      </Button>
    </AuthShell>
  );
}
