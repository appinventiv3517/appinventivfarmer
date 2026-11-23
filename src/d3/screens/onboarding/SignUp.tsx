import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '@/services/api';
import { getState } from '@/services/store';
import { validatePhone } from '@/lib/validation';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { AuthShell } from './AuthShell';
import { PhoneField } from './fields';
import { startFlow } from './flow';
import s from './Onboarding.module.css';

/** Sign up, step 1: mobile number, then an OTP. */
export default function SignUp() {
  const nav = useNav();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const digits = phone.replace(/\D/g, '');

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const err = validatePhone(digits);
    setError(err);
    setTouched(true);
    if (err) {
      toast({ message: 'Invalid mobile number', tone: 'error' });
      return;
    }
    if (getState().account?.phone === digits) {
      setError('This number already has an account. Log in instead.');
      return;
    }
    setSending(true);
    try {
      await api.sendOtp(digits);
      startFlow('signup', digits);
      nav('/auth/otp');
    } catch (err2) {
      toast({ message: err2 instanceof ApiError ? err2.message : 'Could not send the OTP.', tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell title="Set up account" text="Enter your mobile number and we’ll send you a one-time verification code." back="/start" onSubmit={send}>
      <PhoneField
        label="Mobile number"
        required
        value={phone}
        onChange={(v) => {
          setPhone(v);
          if (touched) setError(validatePhone(v));
        }}
        onBlur={() => digits && (setTouched(true), setError(validatePhone(digits)))}
        error={error}
        hint="10 digits, without 0 or +91"
      />
      <Button type="submit" size="lg" block loading={sending}>
        {sending ? 'Sending OTP…' : 'Get OTP'}
      </Button>
      <p className={s.switchLine}>
        Already have an account?<Link to={to('/login')}>Log in</Link>
      </p>
      <p className={s.legal}>
        By continuing you accept the <Link to={to('/account/legal/terms')}>Terms</Link> and <Link to={to('/account/legal/privacy')}>Privacy policy</Link>.
      </p>
    </AuthShell>
  );
}
