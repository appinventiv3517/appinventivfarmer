import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff, Info, Lock, User } from 'lucide-react';
import { TextField } from '../../ui/Field';
import s from './Onboarding.module.css';

/** "9876543210" → "98765 43210" while typing. */
export function formatMobile(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'onChange' | 'value'> & { label: string; value: string; onChange: (v: string) => void; error?: string | null; hint?: string; aside?: ReactNode };

export function PhoneField({ label, value, onChange, error, hint, ...rest }: Base) {
  return (
    <TextField
      big
      label={label}
      prefix="+91"
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      placeholder="Enter mobile number"
      value={value}
      onChange={(e) => onChange(formatMobile(e.target.value))}
      error={error}
      hint={hint}
      {...rest}
    />
  );
}

export function PasswordField({ label, value, onChange, error, hint, ...rest }: Base) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      label={label}
      type={shown ? 'text' : 'password'}
      prefix={
        <span className={s.fieldIcon}>
          <Lock aria-hidden />
        </span>
      }
      suffix={
        <button type="button" className={s.reveal} onClick={() => setShown((v) => !v)} aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
          {shown ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </button>
      }
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={hint}
      maxLength={20}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      {...rest}
    />
  );
}

export function UserIdField({ label = 'User ID', value, onChange, error, hint, ...rest }: Omit<Base, 'label'> & { label?: string }) {
  return (
    <TextField
      label={label}
      prefix={
        <span className={s.fieldIcon}>
          <User aria-hidden />
        </span>
      }
      placeholder="Enter User ID"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={hint}
      maxLength={20}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      lang="en"
      {...rest}
    />
  );
}

/** A small (i) beside a field label that shows a one-line tip. */
export function InfoTip({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 4000);
    const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', off);
    document.addEventListener('keydown', esc);
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', off);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <span ref={ref} className={s.infoWrap}>
      <button type="button" className={s.infoBtn} aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined} onClick={() => setOpen((v) => !v)}>
        <Info aria-hidden />
      </button>
      {open && (
        <span id={id} role="tooltip" className={s.tip}>
          {text}
        </span>
      )}
    </span>
  );
}
