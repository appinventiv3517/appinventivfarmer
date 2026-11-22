import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../../ui/Button';
import { useClearToasts } from '../../ui/Toast';
import s from './Onboarding.module.css';

/**
 * A short confirmation between steps ("Verified successfully", "Thanks for
 * joining us!"). Moves on by itself after a moment; the button lets anyone who
 * needs more time, or uses a screen reader, continue when ready.
 */
export function Done({ icon, title, text, action = 'Continue', onContinue, auto = 2200 }: { icon: ReactNode; title: string; text?: ReactNode; action?: string; onContinue: () => void; auto?: number | false }) {
  const clearToasts = useClearToasts();
  useEffect(clearToasts, [clearToasts]);
  useEffect(() => {
    if (auto === false) return;
    const t = setTimeout(onContinue, auto);
    return () => clearTimeout(t);
  }, [auto, onContinue]);
  return (
    <div className={s.done}>
      <motion.div className={s.doneCard} role="status" aria-live="polite" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
        <motion.span className={s.doneIcon} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 16, delay: 0.12 }} aria-hidden>
          {icon}
        </motion.span>
        <h1 className={s.doneTitle}>{title}</h1>
        {text && <p className={s.doneText}>{text}</p>}
        <Button block onClick={onContinue} data-autofocus>
          {action}
        </Button>
      </motion.div>
    </div>
  );
}
