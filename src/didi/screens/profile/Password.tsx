import { useState, type FormEvent } from 'react';
import { checkPassword, hashPassword } from '@/lib/password';
import { validateConfirmPassword, validatePassword } from '@/lib/validation';
import { PasswordField } from '@/d3/screens/onboarding/fields';
import { useToast } from '@/d3/ui/Toast';
import { Screen, PageTitle } from '../../layout/Screen';
import { Button } from '../../ui/Button';
import { didi, getDidi } from '../../store';
import { DIDI_DEMO } from '../../data/didi';
import { useNav } from '../../nav';
import s from './Profile.module.css';

export default function Password() {
  const nav = useNav();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<{ cur?: string | null; pw?: string | null; confirm?: string | null }>({});
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const hash = getDidi().passwordHash;
    const curOk = cur && (hash ? await checkPassword(DIDI_DEMO.partnerId, cur, hash) : cur === DIDI_DEMO.password);
    const next = { cur: !cur ? 'Enter your current password.' : curOk ? null : 'That isn’t your current password.', pw: validatePassword(pw) ?? (pw === cur ? 'Choose a password you haven’t used here.' : null), confirm: validateConfirmPassword(pw, confirm) };
    setErr(next);
    if (next.cur || next.pw || next.confirm) return;
    setBusy(true);
    didi.setPasswordHash(await hashPassword(DIDI_DEMO.partnerId, pw));
    await new Promise((r) => setTimeout(r, 500));
    setBusy(false);
    toast({ message: 'Password changed', tone: 'success' });
    nav(-1);
  };
  return (
    <Screen title="Change password" backTo="/profile">
      <PageTitle title="Change password" deck="8–20 characters, with at least one letter and one number." />
      <form className={s.form} onSubmit={submit} noValidate>
        <PasswordField label="Current password" placeholder="Enter current password" autoComplete="current-password" value={cur} onChange={(v) => (setCur(v), setErr((x) => ({ ...x, cur: null })))} error={err.cur} hint={getDidi().passwordHash ? undefined : `Demo: ${DIDI_DEMO.password}`} />
        <PasswordField label="New password" placeholder="Enter new password" autoComplete="new-password" value={pw} onChange={(v) => (setPw(v), setErr((x) => ({ ...x, pw: null })))} error={err.pw} />
        <PasswordField label="Confirm new password" placeholder="Enter it again" autoComplete="new-password" value={confirm} onChange={(v) => (setConfirm(v), setErr((x) => ({ ...x, confirm: null })))} error={err.confirm} />
        <Button type="submit" size="lg" block loading={busy}>
          Change password
        </Button>
      </form>
    </Screen>
  );
}
