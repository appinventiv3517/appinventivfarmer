import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useStore } from '@/services/store';
import { isTabRoot, to } from '../paths';
import { useUI } from '../providers';
import s from './Dock.module.css';
import { SPRING, SPRING_SOFT, TAP_ICON } from '../motion/tokens';

/*
 * Tab glyphs. The outline is identical at rest and when selected, so the icon
 * never changes size or position; selection only adds a soft fill and the
 * darker ink colour.
 */
function Glyph({ name, active }: { name: 'today' | 'journal' | 'orders' | 'me'; active: boolean }) {
  const fill = active ? 'var(--fj3-apricot)' : 'none';
  const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'today':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
          <circle cx="12" cy="10" r="4.2" {...line} fill={fill} />
          <path d="M3 19h18M6 15.5h12" {...line} />
        </svg>
      );
    case 'journal':
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
          <rect x="4" y="3.5" width="16" height="17" rx="3" {...line} fill={fill} />
          <path d="M8 8.5h8M8 12h8M8 15.5h5" {...line} />
        </svg>
      );
    case 'orders':
      // Requests: a clipboard with a tick.
      return (
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
          <rect x="4.5" y="4.5" width="15" height="16.5" rx="3" {...line} fill={fill} />
          <path d="M9 4.5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v.5" {...line} />
          <path d="M8.6 13.2 11 15.6l4.6-4.8" {...line} />
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

const TABS = [
  { path: '/home', label: 'Home', glyph: 'today' as const },
  { path: '/learn', label: 'Learn', glyph: 'journal' as const },
  { path: '/orders', label: 'Requests', glyph: 'orders' as const },
  { path: '/account', label: 'Me', glyph: 'me' as const },
];

/**
 * Direction 02 navigation: a dock fixed to the bottom edge. Four labelled
 * destinations sit left; the create action is anchored right, where a
 * right thumb rests, as its own lime key.
 */
export function Dock() {
  const { pathname } = useLocation();
  const { openCreate, createOpen } = useUI();
  const unread = useStore((st) => st.unreadNotifications.length);
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
                    {active && <motion.span layoutId="fj3-dock-bar" className={s.bar} transition={SPRING} />}
                    <Glyph name={t.glyph} active={active} />
                    {t.path === '/account' && unread > 0 && <span className={s.dot} aria-hidden />}
                  </span>
                  <span className={s.label}>{t.label}</span>
                </Link>
              );
            })}
          </div>
          <span className={s.divider} aria-hidden />
          <motion.button type="button" className={`${s.create} ${createOpen ? s.createOpen : ''}`} whileTap={TAP_ICON} onClick={openCreate} aria-haspopup="dialog" aria-expanded={createOpen} aria-label="New: order FOM, book a service or add a field">
            <motion.span animate={{ rotate: createOpen ? 45 : 0 }} transition={SPRING_SOFT} style={{ display: 'grid' }}>
              <Plus aria-hidden strokeWidth={2.6} />
            </motion.span>
            <span className={s.createLabel}>New</span>
          </motion.button>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
