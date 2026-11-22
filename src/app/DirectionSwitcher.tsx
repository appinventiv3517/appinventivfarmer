import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fromD2, isD2Path, to as toD2 } from '@/d2/paths';
import { fromD3, isD3Path, to as toD3 } from '@/d3/paths';
import s from './DirectionSwitcher.module.css';

/** The design directions under review: 01 at /, 02 at /d2, Ver 3 at /d3. */
export type DirectionId = 'd1' | 'd2' | 'd3';

const DIRECTIONS: { id: DirectionId; label: string }[] = [
  { id: 'd1', label: '01 · Illustrated' },
  { id: 'd2', label: '02 · Field Journal' },
  { id: 'd3', label: '03 · Field Journal v3' },
];

/** Routes that only exist in the Field Journal directions, and where Direction 01 shows the same content. */
const D1_EQUIVALENT: Record<string, string> = { '/search': '/learn' };

export function directionOf(pathname: string): DirectionId {
  if (isD2Path(pathname)) return 'd2';
  if (isD3Path(pathname)) return 'd3';
  return 'd1';
}

/** The same screen in another direction. */
export function pathIn(target: DirectionId, pathname: string): string {
  const shared = isD2Path(pathname) ? fromD2(pathname) : isD3Path(pathname) ? fromD3(pathname) : pathname;
  if (target === 'd2') return toD2(shared);
  if (target === 'd3') return toD3(shared);
  return D1_EQUIVALENT[shared] ?? shared;
}

/** Direction 01 ↔ Direction 02; Ver 3 goes back to Direction 01. */
export function counterpartPath(pathname: string): string {
  return pathIn(directionOf(pathname) === 'd1' ? 'd2' : 'd1', pathname);
}

function useDesk() {
  const calc = () => typeof window !== 'undefined' && window.innerWidth >= 500 && window.innerHeight >= 520;
  const [on, setOn] = useState(calc);
  useEffect(() => {
    const f = () => setOn(calc());
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return on;
}

/**
 * Review control shown beside the device mock-up: opens the same screen in
 * another design direction. On phones the switch lives in Account / Me.
 */
export function DirectionSwitcher() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const desk = useDesk();
  if (!desk) return null;
  const current = directionOf(pathname);
  const go = (target: DirectionId) => {
    if (target === current) return;
    navigate(pathIn(target, pathname) + search);
  };
  return (
    <nav className={`${s.switcher} ${current !== 'd1' ? s.onD2 : ''}`} aria-label="Design direction">
      <span className={s.caption}>Design direction</span>
      <div className={s.track}>
        {DIRECTIONS.map((d) => (
          <button key={d.id} type="button" aria-pressed={current === d.id} className={current === d.id ? s.on : ''} onClick={() => go(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
