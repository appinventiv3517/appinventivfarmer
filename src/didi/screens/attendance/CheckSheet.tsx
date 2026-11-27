import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { Camera, LogIn, LogOut, MapPin, MapPinOff, RefreshCw, RotateCcw } from 'lucide-react';
import { formatTime } from '@/lib/format';
import { Sheet } from '@/d3/ui/Sheet';
import { FjLottie } from '@/d3/lottie/Lottie';
import { Button } from '../../ui/Button';
import { didi, getDidi } from '../../store';
import { hoursLabel, workedMinutes, type CheckProof } from '../../data/attendance';
import { isoDay } from '../../data/dates';
import s from './Attendance.module.css';

const IS_DEMO = import.meta.env.MODE.startsWith('demo');
/** Prototype only: stands in when the browser can't share a location (e.g. inside a preview frame). Buldhana district. */
const SAMPLE_LOCATION = { lat: 20.5293, lng: 76.1842 };

type Loc = { state: 'finding' } | { state: 'found'; lat: number; lng: number; sample?: boolean } | { state: 'none'; reason: string };

function useLocation(active: boolean) {
  const [loc, setLoc] = useState<Loc>({ state: 'finding' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return;
    setLoc({ state: 'finding' });
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLoc({ state: 'none', reason: 'This device can’t share location.' });
      return;
    }
    let done = false;
    const timer = setTimeout(() => !done && setLoc({ state: 'none', reason: 'Location is taking too long.' }), 8000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        done = true;
        clearTimeout(timer);
        setLoc({ state: 'found', lat: p.coords.latitude, lng: p.coords.longitude });
      },
      (e) => {
        done = true;
        clearTimeout(timer);
        setLoc({ state: 'none', reason: e.code === 1 ? 'Location permission is off. Turn it on in your phone’s settings.' : 'Location isn’t available right now.' });
      },
      { enableHighAccuracy: true, timeout: 7500, maximumAge: 60_000 },
    );
    return () => clearTimeout(timer);
  }, [active, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const useSample = useCallback(() => setLoc({ state: 'found', ...SAMPLE_LOCATION, sample: true }), []);
  return { loc, retry, useSample };
}

/** Square-crops and shrinks a camera photo to a small JPEG, so it fits in the record on this device. */
async function shrinkSelfie(file: File, px = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    c.getContext('2d')!.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, px, px);
    return c.toDataURL('image/jpeg', 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Check in / Check out: the Didi takes a selfie and the app captures her
 * location. Both are needed before she can confirm, and both are saved with
 * the record. Used on Home and Attendance.
 */
export function CheckSheet({ kind, open, onClose }: { kind: 'in' | 'out'; open: boolean; onClose: () => void }) {
  const { loc, retry, useSample } = useLocation(open);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [selfieErr, setSelfieErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const input = useRef<HTMLInputElement>(null);
  const action = kind === 'in' ? 'check-in' : 'check-out';

  useEffect(() => {
    if (!open) return;
    setDone(null);
    setSelfie(null);
    setSelfieErr(null);
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, [open]);

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setSelfieErr('That isn’t a photo. Take a selfie with the camera.');
    try {
      setSelfie(await shrinkSelfie(file));
      setSelfieErr(null);
    } catch {
      setSelfieErr('The photo couldn’t be read. Take it again.');
    }
  };

  const ready = !!selfie && loc.state === 'found';
  const confirm = () => {
    if (!selfie || loc.state !== 'found') return;
    const proof: CheckProof = { selfie, lat: loc.lat, lng: loc.lng, ...(loc.sample ? { sampleLocation: true } : {}) };
    if (kind === 'in') didi.checkIn(getDidi().profile.village, proof);
    else didi.checkOut(proof);
    // The sheet itself confirms (no separate toast, which would land on top of the closing sheet).
    const today = getDidi().attendance.find((d) => d.date === isoDay(new Date()));
    const at = formatTime(new Date());
    setDone(kind === 'in' ? `Checked in at ${at}` : `Checked out at ${at} · ${hoursLabel(today ? workedMinutes(today) : 0)} worked today`);
    setTimeout(onClose, 1800);
  };

  const hint = !selfie ? 'Take a selfie to continue.' : loc.state === 'finding' ? 'Waiting for your location…' : loc.state === 'none' ? 'Your location is needed to continue.' : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker="Attendance"
      title={done ? (kind === 'in' ? 'You’re checked in' : 'You’re checked out') : kind === 'in' ? 'Check in for today' : 'Check out for today'}
      footer={
        !done && (
          <div className="fj3-stack" style={{ ['--gap' as string]: '8px' }}>
            <Button size="lg" block icon={kind === 'in' ? <LogIn aria-hidden /> : <LogOut aria-hidden />} onClick={confirm} disabled={!ready}>
              {kind === 'in' ? `Check in at ${formatTime(now)}` : `Check out at ${formatTime(now)}`}
            </Button>
            {hint && (
              <p className={s.sheetHint} aria-live="polite">
                {hint}
              </p>
            )}
            <Button size="lg" block variant="ghost" onClick={onClose}>
              Not now
            </Button>
          </div>
        )
      }
    >
      {done ? (
        <motion.div className={s.done} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <FjLottie name="success" size={120} loop={false} label="Done" />
          <p className={s.doneText}>{done}</p>
        </motion.div>
      ) : (
        <div className={s.proof}>
          <input ref={input} type="file" accept="image/*" capture="user" hidden onChange={onPhoto} />

          <div className={s.proofRow}>
            <span className={s.proofStep}>1</span>
            {selfie ? (
              <img className={s.selfie} src={selfie} alt={`Your ${action} selfie`} />
            ) : (
              <span className={`${s.selfie} ${s.selfieEmpty}`} aria-hidden>
                <Camera />
              </span>
            )}
            <span className={s.proofText}>
              <strong>{selfie ? 'Selfie taken' : 'Take a selfie'}</strong>
              <small>{selfieErr ?? (selfie ? 'Saved with this ' + action + '.' : 'Your face should be clear and in good light.')}</small>
            </span>
          </div>
          <Button variant={selfie ? 'secondary' : 'primary'} block icon={selfie ? <RotateCcw aria-hidden /> : <Camera aria-hidden />} onClick={() => input.current?.click()}>
            {selfie ? 'Retake selfie' : 'Open camera'}
          </Button>

          <div className={s.proofRow} aria-live="polite">
            <span className={s.proofStep}>2</span>
            <span className={`${s.locIcon} ${loc.state === 'finding' ? s.locPulse : loc.state === 'found' ? s.locOk : s.locOff}`}>{loc.state === 'none' ? <MapPinOff aria-hidden /> : <MapPin aria-hidden />}</span>
            <span className={s.proofText}>
              {loc.state === 'finding' ? (
                <>
                  <strong>Capturing your location…</strong>
                  <small>Saved with this {action}.</small>
                </>
              ) : loc.state === 'found' ? (
                <>
                  <strong>{loc.sample ? 'Sample location (demo)' : 'Location captured'}</strong>
                  <small className="didi-num">
                    {loc.lat.toFixed(4)}° N, {loc.lng.toFixed(4)}° E
                  </small>
                </>
              ) : (
                <>
                  <strong>No location</strong>
                  <small>{loc.reason}</small>
                </>
              )}
            </span>
          </div>
          {loc.state === 'none' && (
            <div className={s.proofActions}>
              <Button variant="secondary" block icon={<RefreshCw aria-hidden />} onClick={retry}>
                Try again
              </Button>
              {IS_DEMO && (
                <Button variant="ghost" block onClick={useSample}>
                  Use sample location (demo)
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
