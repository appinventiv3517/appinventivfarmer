import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { actions, getState } from '@/services/store';
import { checkPassword, maskPhone } from '@/lib/password';
import { Button } from '../../ui/Button';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { AuthShell } from './AuthShell';
import { PasswordField } from './fields';
import { endFlow, readFlow } from './flow';
import s from './Onboarding.module.css';

/** Forgot User ID, after the OTP: shows the User ID and logs in with the password. */
export default function EnterPassword() {
  const nav = useNav();
  const [flow] = useState(readFlow);
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const account = getState().account;
  if (!flow?.verified || flow.purpose !== 'forgot-user-id' || !account) return <Navigate to={to('/login')} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw) return setError('Enter your password.');
    setBusy(true);
    const ok = await checkPassword(account.userId, pw, account.passwordHash);
    setBusy(false);
    if (!ok) return setError('Incorrect password. Try again, or reset it.');
    actions.signIn(account.phone, true);
    endFlow();
    nav(getState().profileDetails.completed < 3 ? '/profile/setup/1' : '/home', { replace: true });
  };

  return (
    <AuthShell title="Enter password" text={<>Enter the password for <strong>{maskPhone(account.phone)}</strong>.</>} back="/login?with=password" onSubmit={submit}>
      <p className={s.userIdNote}>
        Your User ID is <strong>{account.userId}</strong>
      </p>
      <div>
        <PasswordField label="Password" placeholder="Enter password" autoComplete="current-password" autoFocus value={pw} onChange={(v) => (setPw(v), error && setError(null))} error={error} />
        <div className={s.linkEnd}>
          <Link to={to('/auth/forgot-password')}>Forgot Password?</Link>
        </div>
      </div>
      <Button type="submit" size="lg" block loading={busy}>
        Continue
      </Button>
      <p className={s.switchLine}>
        Don’t have an account?<Link to={to('/auth')}>Sign up</Link>
      </p>
    </AuthShell>
  );
}
