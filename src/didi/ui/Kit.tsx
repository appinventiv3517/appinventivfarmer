import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ApiError } from '@/services/api';
import { getDidi, useDidi } from '../store';
import { EASE } from '@/d3/motion/tokens';
import s from './Kit.module.css';

/**
 * Simulated loading for sample data, so every screen has real loading and
 * error states. Profile → Prototype controls can slow it down or make it fail.
 */
export function useLoad(key: string) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(() => (seen.has(key) && !getDidi().demo.slow && !getDidi().demo.fail ? 'ready' : 'loading'));
  const [attempt, setAttempt] = useState(0);
  const slow = useDidi((st) => st.demo.slow);
  const fail = useDidi((st) => st.demo.fail);
  useEffect(() => {
    if (status === 'ready' && attempt === 0) return;
    setStatus('loading');
    const t = setTimeout(() => {
      if (fail) setStatus('error');
      else {
        seen.add(key);
        setStatus('ready');
      }
    }, slow ? 2200 : 520);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, slow, fail, key]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const error = new ApiError('server', 'We couldn’t load this. Check your connection and try again.');
  return { status, retry, error };
}
const seen = new Set<string>();

/** Circular progress with the value in the middle. */
export function Ring({ value, size = 56, stroke = 6, label, children, tone = 'clay' }: { value: number; size?: number; stroke?: number; label: string; children?: ReactNode; tone?: 'clay' | 'green' | 'light' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={`${s.ring} ${s[`ring_${tone}`]}`} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} className={s.ringTrack} strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} className={s.ringFill} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(100, value) / 100) }} transition={{ duration: 0.9, ease: EASE, delay: 0.1 }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span className={s.ringValue}>{children ?? `${Math.round(value)}%`}</span>
    </span>
  );
}

/** Linear progress bar. */
export function Bar({ value, label, tone = 'clay' }: { value: number; label: string; tone?: 'clay' | 'green' | 'warn' }) {
  return (
    <div className={s.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}>
      <motion.span className={`${s.barFill} ${s[`bar_${tone}`]}`} initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(100, value) / 100 }} transition={{ duration: 0.8, ease: EASE }} />
    </div>
  );
}

/** Kicker + body section on a page. */
export function Section({ title, aside, children, id }: { title?: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className={s.section} aria-labelledby={title ? id : undefined}>
      {title && (
        <div className={s.sectionHead}>
          <h2 className={s.sectionTitle} id={id}>
            {title}
          </h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label / value pairs in a card. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className={s.facts}>
      {items.map((i) => (
        <div key={i.label} className={s.fact}>
          <dt>{i.label}</dt>
          <dd>{i.value || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export const kit = s;
