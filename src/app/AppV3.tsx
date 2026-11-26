import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { HashRouter, MemoryRouter, Navigate, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useStore } from '@/services/store';
import { useReducedMotion } from '@/lib/theme';
import { readSession, writeSession } from '@/lib/storage';
import { isD3Path } from '@/d3/paths';
import D3App from '@/d3/D3App';

/*
 * App shell for the Ver 3-only builds (build:standalone3, build:mobile3).
 * Only Ver 3 is bundled: Directions 01 and 02 and the direction switcher are
 * not part of these files. Any other path opens Ver 3.
 */
const IS_DEMO = import.meta.env.MODE.startsWith('demo');
const IS_MOBILE = import.meta.env.VITE_MOBILE === '1';
const START = '/d3';
const ROUTE_KEY = 'kisani-urjaa:route';

function usePreferenceAttributes() {
  const prefs = useStore((st) => st.prefs);
  useEffect(() => {
    const el = document.documentElement;
    if (IS_DEMO && !IS_MOBILE) el.setAttribute('data-host', 'artifact');
    el.removeAttribute('data-theme');
    el.removeAttribute('data-theme-owner');
    if (prefs.text === 'large') el.setAttribute('data-text', 'large');
    else el.removeAttribute('data-text');
    if (prefs.motion === 'reduce') el.setAttribute('data-motion', 'reduce');
    else el.removeAttribute('data-motion');
  }, [prefs]);
}

if (IS_MOBILE && typeof window !== 'undefined' && !isD3Path(window.location.hash.replace(/^#/, '').split('?')[0])) {
  window.history.replaceState(null, '', `#${START}`);
}

function Router({ children }: { children: ReactNode }) {
  const future = { v7_startTransition: true, v7_relativeSplatPath: true };
  if (IS_DEMO && !IS_MOBILE) {
    const saved = readSession(ROUTE_KEY);
    return (
      <MemoryRouter initialEntries={[saved && isD3Path(saved.split('?')[0]) ? saved : START]} future={future}>
        {children}
      </MemoryRouter>
    );
  }
  return <HashRouter future={future}>{children}</HashRouter>;
}

function Ver3() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    if (IS_DEMO && isD3Path(pathname)) writeSession(ROUTE_KEY, pathname);
  }, [pathname]);
  if (!isD3Path(pathname)) return <Navigate to={START} replace />;
  return <D3App />;
}

export function App() {
  usePreferenceAttributes();
  const reduced = useReducedMotion();
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <Router>
        <Ver3 />
      </Router>
    </MotionConfig>
  );
}
