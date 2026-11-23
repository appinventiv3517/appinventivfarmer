import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api, ApiError } from '@/services/api';
import { actions, getState } from '@/services/store';
import { checkPassword } from '@/lib/password';
import { validatePhone } from '@/lib/validation';
import { Button } from '../../ui/Button';
import { SectionTabs } from '../../ui/Controls';
import { useToast } from '../../ui/Toast';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { AuthShell } from './AuthShell';
import { PasswordField, PhoneField, UserIdField } from './fields';
import { startFlow } from './flow';
import { SWAP } from '../../motion/tokens';
import s from './Onboarding.module.css';

type Mode = 'otp' | 'password';

/** Log in with an OTP to the registered number, or with User ID and password. */
export default function Login() {
  const nav = useNav();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('with') === 'password' ? 'password' : 'otp';
  const [phone, setPhone] = useState('');
  const [userId, setUserId] = useState('');
  const [pw, setPw] = useState('');
  const [errors, setErrors] = useState<{ phone?: string | null; userId?: string | null; pw?: string | null }>({});
  const [busy, setBusy] = useState(false);
  const digits = phone.replace(/\D/g, '');

  const sendOtp = async () => {
    const err = validatePhone(digits);
    if (err) return setErrors({ phone: err });
    if (getState().account?.phone !== digits) return setErrors({ phone: 'No account found for this number. Check it, or sign up.' });
    setBusy(true);
    try {
      await api.sendOtp(digits);
      startFlow('login', digits);
      nav('/auth/otp');
    } catch (e) {
      toast({ message: e instanceof ApiError ? e.message : 'Could not send the OTP.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const withPassword = async () => {
    const next = { userId: userId.trim() ? null : 'Enter your User ID.', pw: pw ? null : 'Enter your password.' };
    setErrors(next);
    if (next.userId || next.pw) return;
    setBusy(true);
    const account = getState().account;
    const ok = !!account && account.userId.toLowerCase() === userId.trim().toLowerCase() && (await checkPassword(account.userId, pw, account.passwordHash));
    setBusy(false);
    if (!ok) {
      setErrors({ pw: 'User ID or password is incorrect.' });
      return;
    }
    actions.signIn(account!.phone, true);
    nav(getState().profileDetails.completed < 3 ? '/profile/setup/1' : '/home', { replace: true });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'otp') sendOtp();
    else withPassword();
  };

  return (
    <AuthShell title="Welcome back" text="Log in to your Kisani Urjaa account." back="/start" onSubmit={submit}>
      <SectionTabs
        label="Log in with"
        size="md"
        value={mode}
        onChange={(m) => {
          setParams(m === 'password' ? { with: 'password' } : {}, { replace: true });
          setErrors({});
        }}
        items={[
          { value: 'otp', label: 'With OTP' },
          { value: 'password', label: 'User ID & Password' },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={mode} className="fj3-stack" style={{ ['--gap' as string]: '16px' }} {...SWAP}>
          {mode === 'otp' ? (
            <>
              <PhoneField label="Registered mobile number" required value={phone} onChange={(v) => (setPhone(v), errors.phone && setErrors({}))} error={errors.phone} />
              <Button type="submit" size="lg" block loading={busy}>
                Get OTP
              </Button>
            </>
          ) : (
            <>
              <div>
                <UserIdField value={userId} onChange={(v) => (setUserId(v), errors.userId && setErrors((x) => ({ ...x, userId: null })))} error={errors.userId} autoComplete="username" />
                <div className={s.linkEnd}>
                  <Link to={to('/auth/forgot-user-id')}>Forgot User ID?</Link>
                </div>
              </div>
              <div>
                <PasswordField label="Password" placeholder="Enter password" autoComplete="current-password" value={pw} onChange={(v) => (setPw(v), errors.pw && setErrors((x) => ({ ...x, pw: null })))} error={errors.pw} />
                <div className={s.linkEnd}>
                  <Link to={to('/auth/forgot-password')}>Forgot Password?</Link>
                </div>
              </div>
              <Button type="submit" size="lg" block loading={busy}>
                Continue
              </Button>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <p className={s.switchLine}>
        Don’t have an account?<Link to={to('/auth')}>Sign up</Link>
      </p>
    </AuthShell>
  );
}
