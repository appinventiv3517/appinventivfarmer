import { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Clock, Info } from 'lucide-react';
import { api, ApiError, DEMO_OTP } from '@/services/api';
import { Button } from '../../ui/Button';
import { Note } from '../../ui/Blocks';
import { useToast } from '../../ui/Toast';
import s from './Onboarding.module.css';

const LENGTH = 6;
const WAIT = 60;
const ATTEMPTS = 3;

/**
 * Six digit boxes backed by one real input (paste, SMS autofill, screen
 * readers). Three tries per code: each wrong try says how many are left;
 * after the last one the code must be resent. Resend unlocks after 60 s.
 */
export function OtpForm({ phone, action = 'Verify', onVerified }: { phone: string; action?: string; onVerified: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(ATTEMPTS);
  const [pending, setPending] = useState(false);
  const [focused, setFocused] = useState(true);
  const [wait, setWait] = useState(WAIT);
  const input = useRef<HTMLInputElement>(null);
  const shake = useAnimationControls();
  const toast = useToast();
  const refocus = useRef(false);
  const locked = left <= 0;

  useEffect(() => {
    if (!pending && refocus.current) {
      refocus.current = false;
      input.current?.focus();
    }
  }, [pending]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (value: string) => {
    if (locked || value.length < LENGTH) return;
    setPending(true);
    setError(null);
    try {
      await api.verifyOtp(phone, value);
      onVerified();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'invalid_otp') {
        const remaining = left - 1;
        setLeft(remaining);
        const msg = remaining > 0 ? `Incorrect OTP, ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Incorrect OTP. No attempts left — tap Resend for a new code.';
        setError(msg);
        toast({ message: msg, tone: 'error' });
      } else {
        setError(e instanceof ApiError ? e.message : 'Could not verify. Try again.');
      }
      shake.start({ x: [0, -12, 12, -6, 6, 0], transition: { duration: 0.4 } });
      refocus.current = true;
    } finally {
      setPending(false);
    }
  };

  const onChange = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, LENGTH);
    setCode(d);
    if (error && !locked) setError(null);
    if (d.length === LENGTH) submit(d);
  };

  const resend = async () => {
    try {
      await api.sendOtp(phone);
      setWait(WAIT);
      setLeft(ATTEMPTS);
      setCode('');
      setError(null);
      input.current?.focus();
      toast({ message: 'A new OTP has been sent', tone: 'success' });
    } catch (e) {
      toast({ message: e instanceof ApiError ? e.message : 'Could not send the code.', tone: 'error' });
    }
  };

  return (
    <>
      <div className="fj3-stack" style={{ ['--gap' as string]: '12px' }}>
        <motion.div animate={shake} className={`${s.otp} ${s.otpBoxes} ${error ? s.otpError : ''}`} onClick={() => input.current?.focus()}>
          {Array.from({ length: LENGTH }, (_, n) => {
            const active = focused && !pending && !locked && n === Math.min(code.length, LENGTH - 1);
            return (
              <div key={n} className={`${s.slot} ${code[n] ? s.slotFilled : ''} ${active ? s.slotActive : ''}`} aria-hidden>
                {code[n] ?? ''}
                {active && !code[n] && <span className={s.caret} />}
              </div>
            );
          })}
          <input
            ref={input}
            className={s.otpInput}
            value={code}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={LENGTH}
            autoFocus
            aria-label={`OTP, ${LENGTH} digits`}
            aria-invalid={!!error || undefined}
            aria-describedby="fj3-otp-error"
            disabled={pending || locked}
          />
        </motion.div>
        {error && (
          <p id="fj3-otp-error" role="alert" className={s.otpErr}>
            {error}
          </p>
        )}
        <div className={`${s.resend} ${s.resendEnd}`}>
          {wait > 0 && !locked ? (
            <span aria-live="off">
              Resend OTP in{' '}
              <span className={s.timer}>
                <Clock aria-hidden /> 00:{String(wait).padStart(2, '0')}
              </span>
            </span>
          ) : (
            <>
              <span>Didn’t get the code?</span>
              <button type="button" onClick={resend} className={s.linkBtn}>
                Resend
              </button>
            </>
          )}
        </div>
      </div>
      <Button size="lg" block loading={pending} disabled={code.length < LENGTH || locked} onClick={() => submit(code)}>
        {pending ? 'Checking…' : action}
      </Button>
      <Note tone="info" icon={<Info aria-hidden />} title="Prototype">
        No SMS is sent. Use the code {DEMO_OTP}.
      </Note>
    </>
  );
}
