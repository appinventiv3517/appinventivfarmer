import { useCallback, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { UserCheck } from 'lucide-react';
import { actions } from '@/services/store';
import { hashPassword } from '@/lib/password';
import { validateConfirmPassword, validatePassword } from '@/lib/validation';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { AuthShell } from './AuthShell';
import { Done } from './Done';
import { PasswordField } from './fields';
import { endFlow, readFlow } from './flow';

export const PASSWORD_RULE = 'Password must be 8–20 characters with at least 1 letter and 1 number.';

/** Sign up, step 4: password and confirmation; then the account exists. */
export default function CreatePassword() {
  const nav = useNav();
  const toast = useToast();
  const [flow] = useState(readFlow);
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ pw?: string | null; confirm?: string | null }>({});
  const [saving, setSaving] = useState(false);
  const [joined, setJoined] = useState(false);
  const next = useCallback(() => nav('/profile/setup/1', { replace: true }), [nav]);

  if (joined) return <Done icon={<UserCheck />} title="Thanks for joining us!" text="Your account is ready. Complete your profile to get started." action="Complete profile" onContinue={next} auto={false} />;
  if (!flow?.verified || flow.purpose !== 'signup' || !flow.userId) return <Navigate to={to('/auth')} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next2 = { pw: validatePassword(pw), confirm: validateConfirmPassword(pw, confirm) };
    setErrors(next2);
    if (next2.pw) return;
    if (next2.confirm) {
      if (confirm) toast({ message: 'Passwords do not match', tone: 'error' });
      return;
    }
    setSaving(true);
    actions.createAccount({ userId: flow.userId!, phone: flow.phone, passwordHash: await hashPassword(flow.userId!, pw) });
    endFlow();
    setSaving(false);
    setJoined(true);
  };

  return (
    <AuthShell title="Create password" text={<>Your User ID is <strong>{flow.userId}</strong>. Set a password to log in with it.</>} back="/auth/user-id" onSubmit={submit}>
      <PasswordField label="Password" placeholder="Create password" autoComplete="new-password" autoFocus value={pw} onChange={(v) => (setPw(v), errors.pw !== undefined && setErrors((x) => ({ ...x, pw: validatePassword(v) })))} error={errors.pw} hint={PASSWORD_RULE} />
      <PasswordField label="Confirm password" placeholder="Re-enter password" autoComplete="new-password" value={confirm} onChange={(v) => (setConfirm(v), errors.confirm !== undefined && setErrors((x) => ({ ...x, confirm: validateConfirmPassword(pw, v) })))} error={errors.confirm} />
      <Button type="submit" size="lg" block loading={saving}>
        Continue
      </Button>
    </AuthShell>
  );
}
