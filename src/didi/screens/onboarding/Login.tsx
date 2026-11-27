import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FlaskConical } from 'lucide-react';
import { checkPassword } from '@/lib/password';
import { validatePhone } from '@/lib/validation';
import { api } from '@/services/api';
import { PasswordField, PhoneField, UserIdField } from '@/d3/screens/onboarding/fields';
import { SectionTabs } from '@/d3/ui/Controls';
import { useToast } from '@/d3/ui/Toast';
import { SWAP } from '@/d3/motion/tokens';
import s from '@/d3/screens/onboarding/Onboarding.module.css';
import { Button } from '../../ui/Button';
import { Note } from '../../ui/Blocks';
import { didi, getDidi } from '../../store';
import { DIDI_DEMO } from '../../data/didi';
import { useNav } from '../../nav';
import { to } from '../../paths';
import { AuthShell } from './AuthShell';
import { setLoginPhone } from './flow';

type Mode = 'password' | 'otp';

/**
 * Kisani Didis are set up by Kisani Urjaa, so there is no sign-up: log in
 * with the Partner ID and password, or with an OTP to the registered number.
 */
export default function Login() {
  const nav = useNav();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const mode: Mode = params.get('with') === 'otp' ? 'otp' : 'password';
  const [partnerId, setPartnerId] = useState('');
  const [pw, setPw] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ id?: string | null; pw?: string | null; phone?: string | null }>({});
  const [busy, setBusy] = useState(false);
  const digits = phone.replace(/\D/g, '');

  const enter = () => {
    didi.signIn();
    nav('/home', { replace: true });
  };

  const withPassword = async () => {
    const next = { id: partnerId.trim() ? null : 'Enter your Partner ID.', pw: pw ? null : 'Enter your password.' };
    setErrors(next);
    if (next.id || next.pw) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    const hash = getDidi().passwordHash;
    const idOk = partnerId.trim().toUpperCase() === DIDI_DEMO.partnerId;
    const pwOk = hash ? await checkPassword(DIDI_DEMO.partnerId, pw, hash) : pw === DIDI_DEMO.password;
    setBusy(false);
    if (!idOk || !pwOk) return setErrors({ pw: 'Partner ID or password is incorrect.' });
    enter();
  };

  const sendOtp = async () => {
    const err = validatePhone(digits);
    if (err) return setErrors({ phone: err });
    if (digits !== DIDI_DEMO.phone) return setErrors({ phone: 'This number isn’t registered as a Kisani Didi. Check it, or contact support.' });
    setBusy(true);
    try {
      await api.sendOtp(digits);
      setLoginPhone(digits, 'login');
      nav('/login/otp');
    } catch {
      toast({ message: 'Could not send the OTP. Try again.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'otp') sendOtp();
    else withPassword();
  };

  return (
    <AuthShell title="Welcome, Didi" text="Log in with the details Kisani Urjaa gave you." back="/welcome/language" onSubmit={submit}>
      <SectionTabs
        label="Log in with"
        size="md"
        value={mode}
        onChange={(m) => {
          setParams(m === 'otp' ? { with: 'otp' } : {}, { replace: true });
          setErrors({});
        }}
        items={[
          { value: 'password', label: 'Partner ID' },
          { value: 'otp', label: 'Mobile OTP' },
        ]}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={mode} className="fj3-stack" style={{ ['--gap' as string]: '16px' }} {...SWAP}>
          {mode === 'password' ? (
            <>
              <UserIdField label="Partner ID" placeholder="e.g. KD00001" value={partnerId} onChange={(v) => (setPartnerId(v), errors.id && setErrors((x) => ({ ...x, id: null })))} error={errors.id} autoComplete="username" />
              <div>
                <PasswordField label="Password" placeholder="Enter password" autoComplete="current-password" value={pw} onChange={(v) => (setPw(v), errors.pw && setErrors((x) => ({ ...x, pw: null })))} error={errors.pw} />
                <div className={s.linkEnd}>
                  <Link to={to('/login/forgot')}>Forgot password?</Link>
                </div>
              </div>
              <Button type="submit" size="lg" block loading={busy}>
                Log in
              </Button>
            </>
          ) : (
            <>
              <PhoneField label="Registered mobile number" required value={phone} onChange={(v) => (setPhone(v), errors.phone && setErrors({}))} error={errors.phone} />
              <Button type="submit" size="lg" block loading={busy}>
                Get OTP
              </Button>
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <Note tone="info" icon={<FlaskConical aria-hidden />} title="Demo account" action={<Button size="sm" variant="secondary" onClick={enter}>Log in as demo Didi</Button>}>
        Partner ID <strong>{DIDI_DEMO.partnerId}</strong> · password <strong>{DIDI_DEMO.password}</strong>, or mobile <strong>{DIDI_DEMO.phone.slice(0, 5)} {DIDI_DEMO.phone.slice(5)}</strong> with OTP {DIDI_DEMO.otp}.
      </Note>
    </AuthShell>
  );
}
