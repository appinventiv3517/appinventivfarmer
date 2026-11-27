import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { didi } from '../store';
import { DIDI } from '../paths';
import s from '@/app/DeskBrand.module.css';

/** Beside the device on wide screens: the logo, the app name and a reset for reviewers. */
export function DidiDesk() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), 6000);
    return () => clearTimeout(t);
  }, [confirming]);
  const reset = () => {
    setConfirming(false);
    didi.resetAll();
    navigate(DIDI, { replace: true });
  };
  return (
    <aside className={s.aside} aria-label="Kisani Urjaa">
      <div className={s.bare}>
        <Logo height={120} />
      </div>
      <p className={s.name}>Kisani Didi App</p>
      {confirming ? (
        <div className={s.confirm} role="group" aria-label="Reset prototype">
          <p className={s.confirmText}>Clear every change and start again from the welcome screens?</p>
          <div className={s.confirmRow}>
            <button type="button" className={`${s.btn} ${s.btnDanger}`} onClick={reset} autoFocus>
              <RotateCcw aria-hidden /> Reset
            </button>
            <button type="button" className={s.btn} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={s.btn} onClick={() => setConfirming(true)}>
          <RotateCcw aria-hidden /> Reset prototype
        </button>
      )}
    </aside>
  );
}
