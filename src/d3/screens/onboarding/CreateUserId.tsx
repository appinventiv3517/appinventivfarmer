import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { validateUserId } from '@/lib/validation';
import { Button } from '../../ui/Button';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { AuthShell } from './AuthShell';
import { InfoTip, UserIdField } from './fields';
import { readFlow, updateFlow } from './flow';

/** Sign up, step 3: choose a User ID (English letters and numbers). */
export default function CreateUserId() {
  const nav = useNav();
  const [flow] = useState(readFlow);
  const [value, setValue] = useState(flow?.userId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  if (!flow?.verified || flow.purpose !== 'signup') return <Navigate to={to('/auth')} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = validateUserId(value);
    setError(err);
    setTouched(true);
    if (err) return;
    updateFlow({ userId: value.trim() });
    nav('/auth/password');
  };

  return (
    <AuthShell title="Create User ID" text="You’ll use this User ID and a password to log in to your account." onSubmit={submit}>
      <div>
        <UserIdField
          aside={<InfoTip label="About User IDs" text="User ID creation is restricted to English only" />}
          required
          value={value}
          autoFocus
          onChange={(v) => {
            setValue(v);
            if (touched) setError(validateUserId(v));
          }}
          error={error}
          hint="4–20 English letters or numbers, starting with a letter. Dot and underscore allowed."
          autoComplete="username"
        />
      </div>
      <Button type="submit" size="lg" block>
        Continue
      </Button>
    </AuthShell>
  );
}
