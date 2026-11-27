import { Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import '@/d3/styles/tokens.css';
import '@/d3/styles/base.css';
import './styles/didi.css';
import { DidiFrame, frameStyles } from './frame/Frame';
import { Splash } from './frame/Splash';
import { Dock } from './layout/Dock';
import { ToastProvider } from '@/d3/ui/Toast';
import { DidiRoutes, prefetchDidi } from './routes';
import { isTabRoot } from './paths';

type Dir = 'forward' | 'back' | 'fade';
const EXPO = [0.16, 1, 0.3, 1] as const;
const INOUT = [0.65, 0, 0.35, 1] as const;

/* The Farmer App's page motion: a new page rises over the current one; tabs cross-fade. */
const variants: Variants = {
  enter: (d: Dir) => (d === 'forward' ? { y: '100%', scale: 1, opacity: 1, zIndex: 2, borderRadius: 28 } : d === 'back' ? { y: 0, scale: 0.94, opacity: 0.6, zIndex: 1, borderRadius: 28 } : { y: 14, scale: 1, opacity: 0, zIndex: 2, borderRadius: 0 }),
  center: (d: Dir) => ({ y: 0, scale: 1, opacity: 1, borderRadius: 0, transition: { duration: d === 'fade' ? 0.34 : 0.52, ease: EXPO } }),
  exit: (d: Dir) =>
    d === 'forward'
      ? { y: 0, scale: 0.94, opacity: 0.6, zIndex: 1, borderRadius: 28, transition: { duration: 0.52, ease: EXPO } }
      : d === 'back'
        ? { y: '100%', zIndex: 2, borderRadius: 28, transition: { duration: 0.42, ease: INOUT } }
        : { opacity: 0, zIndex: 1, transition: { duration: 0.16 } },
};

function Pages() {
  const location = useLocation();
  const navType = useNavigationType();
  const prev = useRef(location.pathname);
  const from = prev.current;
  const toPath = location.pathname;
  const dir: Dir = from === toPath ? 'fade' : isTabRoot(from) && isTabRoot(toPath) ? 'fade' : navType === 'POP' ? 'back' : navType === 'REPLACE' ? 'fade' : 'forward';
  useLayoutEffect(() => {
    prev.current = location.pathname;
  }, [location]);
  useEffect(() => {
    document.getElementById('fj3-frame')?.style.setProperty('--fj3-toast-offset', isTabRoot(toPath) ? 'calc(var(--fj3-dock-clearance) + 4px)' : 'calc(16px + var(--safe-bottom))');
  }, [toPath]);
  return (
    <div className={frameStyles.pages}>
      <AnimatePresence initial={false} custom={dir}>
        <motion.div key={location.pathname} className={frameStyles.page} custom={dir} variants={variants} initial="enter" animate="center" exit="exit" style={{ overflow: 'hidden' }}>
          <Suspense fallback={null}>
            <DidiRoutes location={location} />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Kisani Urjaa · Kisani Didi App. Mounted for every path under /didi. */
export default function DidiApp() {
  useEffect(() => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => prefetchDidi());
    document.title = 'Kisani Urjaa – Kisani Didi App';
  }, []);
  return (
    <DidiFrame>
      <ToastProvider>
        <Pages />
        <Dock />
        <Splash />
      </ToastProvider>
    </DidiFrame>
  );
}
