import { motion, useReducedMotion } from 'framer-motion';
import s from './Kit.module.css';

/** A green circle with a tick that draws itself in. Replaces the "success" Lottie, which rendered distorted. */
export function SuccessMark({ size = 96, label = 'Done' }: { size?: number; label?: string }) {
  const still = useReducedMotion();
  const draw = (delay: number) => (still ? { initial: false } : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] } });
  return (
    <motion.span className={s.success} style={{ width: size, height: size }} role="img" aria-label={label} initial={still ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 22 }}>
      <svg viewBox="0 0 48 48" fill="none" aria-hidden>
        <motion.circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...draw(0)} />
        <motion.path d="M15 24.5l6.5 6.5L33.5 18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" {...draw(0.3)} />
      </svg>
    </motion.span>
  );
}
