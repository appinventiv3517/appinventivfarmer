import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { HashRouter, MemoryRouter, Navigate, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useDidi } from '@/didi/store';
import { useReducedMotion } from '@/lib/theme';
import { readSession, writeSession } from '@/lib/storage';
import { isDidiPath, DIDI } from '@/didi/paths';
import DidiApp from '@/didi/DidiApp';

/*
 * App shell for the Kisani Didi builds (build:didi, build:standalone-didi,
 * build:mobile-didi). Only the Kisani Didi app is bundled; the Farmer App is
 * not part of these files. Any other path opens the Kisani Didi app.
 */
const IS_DEMO = import.meta.env.MODE.startsWith('demo');
const IS_MOBILE = import.meta.env.VITE_MOBILE === '1';
const START = DIDI;
const ROUTE_KEY = 'kisani-urjaa:didi-route';

function usePreferenceAttributes() {
  const prefs = useDidi((st) => st.prefs);
  useEffect(() => {
    const el = document.documentElement;
    if (IS_DEMO && !IS_MOBILE) el.setAttribute('data-host', 'artifact');
    el.removeAttribute('data-theme');
    el.removeAttribute('data-theme-owner');
    if (prefs.text !== 'default') el.setAttribute('data-text', prefs.text);
    else el.removeAttribute('data-text');
  }, [prefs]);
}

if (IS_MOBILE && typeof window !== 'undefined' && !isDidiPath(window.location.hash.replace(/^#/, '').split('?')[0])) {
  window.history.replaceState(null, '', `#${START}`);
}

function Router({ children }: { children: ReactNode }) {
  const future = { v7_startTransition: true, v7_relativeSplatPath: true };
  if (IS_DEMO && !IS_MOBILE) {
    const saved = readSession(ROUTE_KEY);
    return (
      <MemoryRouter initialEntries={[saved && isDidiPath(saved.split('?')[0]) ? saved : START]} future={future}>
        {children}
      </MemoryRouter>
    );
  }
  return <HashRouter future={future}>{children}</HashRouter>;
}

function Didi() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    if (IS_DEMO && isDidiPath(pathname)) writeSession(ROUTE_KEY, pathname);
  }, [pathname]);
  if (!isDidiPath(pathname)) return <Navigate to={START} replace />;
  return <DidiApp />;
}

export function App() {
  usePreferenceAttributes();
  const reduced = useReducedMotion();
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <Router>
        <Didi />
      </Router>
    </MotionConfig>
  );
}
