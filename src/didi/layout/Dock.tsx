import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useDidi } from '../store';
import { isTabRoot, to } from '../paths';
import { SPRING } from '@/d3/motion/tokens';
import s from '@/d3/layout/Dock.module.css';

type GlyphName = 'home' | 'tasks' | 'farmers' | 'attendance' | 'profile';

/* Same drawing rules as the Farmer App dock: one outline at rest and when
   selected; selection only adds the apricot fill and the darker ink. */
function Glyph({ name, active }: { name: GlyphName; active: boolean }) {
  const fill = active ? 'var(--fj3-apricot)' : 'none';
  const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
          <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" {...line} fill={fill} />
          <path d="M9.5 20.5v-5.5h5v5.5" {...line} />
        </svg>
      );
    case 'tasks':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
          <rect x="4.5" y="4.5" width="15" height="16.5" rx="3" {...line} fill={fill} />
          <path d="M9 4.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v.5" {...line} />
          <path d="M8.6 13.2 11 15.6l4.6-4.8" {...line} />
        </svg>
      );
    case 'farmers':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
          <circle cx="9" cy="8.5" r="3.5" {...line} fill={fill} />
          <path d="M2.8 19.5c.9-3.2 3.3-5 6.2-5s5.3 1.8 6.2 5" {...line} />
          <path d="M15.5 5.3a3.3 3.3 0 0 1 0 6.4M17.6 14.8c1.7.6 3 2.2 3.6 4.7" {...line} />
        </svg>
      );
    case 'attendance':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" {...line} fill={fill} />
          <path d="M8 3v4M16 3v4M3.5 10h17" {...line} />
          <path d="m9 15 2 2 4-4" {...line} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
          <circle cx="12" cy="8.5" r="4" {...line} fill={fill} />
          <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" {...line} />
        </svg>
      );
  }
}

const TABS: { path: string; label: string; glyph: GlyphName }[] = [
  { path: '/home', label: 'Home', glyph: 'home' },
  { path: '/tasks', label: 'Tasks', glyph: 'tasks' },
  { path: '/farmers', label: 'Farmers', glyph: 'farmers' },
  { path: '/attendance', label: 'Attendance', glyph: 'attendance' },
  { path: '/profile', label: 'Profile', glyph: 'profile' },
];

/**
 * Kisani Didi navigation: the Farmer App's floating dock with five labelled
 * destinations. Scan QR, Transactions, Leaderboard and Notifications open from
 * Home, so the dock stays calm.
 */
export function Dock() {
  const { pathname } = useLocation();
  const pendingReview = useDidi((st) => st.tasks.filter((t) => t.status === 'rejected').length);
  const visible = isTabRoot(pathname);
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.nav className={s.dock} aria-label="Main" initial={{ y: '110%' }} animate={{ y: 0 }} exit={{ y: '110%', transition: { duration: 0.22, ease: [0.65, 0, 0.35, 1] } }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
          <div className={s.tabs}>
            {TABS.map((t) => {
              const href = to(t.path);
              const active = pathname === href;
              return (
                <Link key={t.path} to={href} replace className={`${s.tab} ${active ? s.active : ''}`} aria-current={active ? 'page' : undefined}>
                  <span className={s.glyph}>
                    {active && <motion.span layoutId="didi-dock-bar" className={s.bar} transition={SPRING} />}
                    <Glyph name={t.glyph} active={active} />
                    {t.path === '/tasks' && pendingReview > 0 && <span className={s.dot} aria-hidden />}
                  </span>
                  <span className={s.label}>{t.label}</span>
                </Link>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
