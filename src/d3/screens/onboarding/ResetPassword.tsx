import { useCallback, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { actions, getState } from '@/services/store';
import { hashPassword } from '@/lib/password';
import { validateConfirmPassword, validatePassword } from '@/lib/validation';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { AuthShell } from './AuthShell';
import { Done } from './Done';
import { PasswordField } from './fields';
import { PASSWORD_RULE } from './CreatePassword';
import { endFlow, readFlow } from './flow';

/** Forgot password, after the OTP: set a new password. */
export default function ResetPassword() {
  const nav = useNav();
  const toast = useToast();
  const [flow] = useState(readFlow);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ pw?: string | null; confirm?: string | null }>({});
  const [done, setDone] = useState(false);
  const next = useCallback(() => nav('/login?with=password', { replace: true }), [nav]);

  if (done) return <Done icon={<CheckCircle2 />} title="Password updated" text="Your password has been updated. Log in with your User ID and new password." action="Log in" onContinue={next} />;
  const account = getState().account;
  if (!flow?.verified || flow.purpose !== 'forgot-password' || !account) return <Navigate to={to('/login')} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = { pw: validatePassword(pw), confirm: validateConfirmPassword(pw, confirm) };
    setErrors(n);
    if (n.pw) return;
    if (n.confirm) {
      if (confirm) toast({ message: 'Passwords do not match', tone: 'error' });
      return;
    }
    actions.setPasswordHash(await hashPassword(account.userId, pw));
    endFlow();
    setDone(true);
  };

  return (
    <AuthShell title="Reset password" text="Enter a new password." close="/login?with=password" onSubmit={submit}>
      <PasswordField label="New password" placeholder="Enter password" autoComplete="new-password" autoFocus value={pw} onChange={(v) => (setPw(v), errors.pw !== undefined && setErrors((x) => ({ ...x, pw: validatePassword(v) })))} error={errors.pw} hint={PASSWORD_RULE} />
      <PasswordField label="Confirm password" placeholder="Confirm password" autoComplete="new-password" value={confirm} onChange={(v) => (setConfirm(v), errors.confirm !== undefined && setErrors((x) => ({ ...x, confirm: validateConfirmPassword(pw, v) })))} error={errors.confirm} />
      <Button type="submit" size="lg" block>
        Submit
      </Button>
    </AuthShell>
  );
}
