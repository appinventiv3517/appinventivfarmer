import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, LogOut, MapPin, MapPinOff } from 'lucide-react';
import { formatTime } from '@/lib/format';
import { Sheet } from '@/d3/ui/Sheet';
import { useToast } from '@/d3/ui/Toast';
import { FjLottie } from '@/d3/lottie/Lottie';
import { Button } from '../../ui/Button';
import { didi, getDidi } from '../../store';
import { hoursLabel, workedMinutes } from '../../data/attendance';
import { isoDay } from '../../data/dates';
import s from './Attendance.module.css';

type Loc = { state: 'finding' } | { state: 'found'; lat: number; lng: number } | { state: 'none'; reason: string };

function useLocation(active: boolean): Loc {
  const [loc, setLoc] = useState<Loc>({ state: 'finding' });
  useEffect(() => {
    if (!active) return;
    setLoc({ state: 'finding' });
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLoc({ state: 'none', reason: 'This device can’t share location.' });
      return;
    }
    let done = false;
    const timer = setTimeout(() => !done && setLoc({ state: 'none', reason: 'Location is taking too long.' }), 6000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        done = true;
        clearTimeout(timer);
        setLoc({ state: 'found', lat: p.coords.latitude, lng: p.coords.longitude });
      },
      (e) => {
        done = true;
        clearTimeout(timer);
        setLoc({ state: 'none', reason: e.code === 1 ? 'Location permission is off.' : 'Location isn’t available right now.' });
      },
      { enableHighAccuracy: true, timeout: 5500, maximumAge: 60_000 },
    );
    return () => clearTimeout(timer);
  }, [active]);
  return loc;
}

/**
 * Check in / Check out confirmation, used on Home and Attendance. It tries to
 * capture the phone's location for the record; if it can't, the Didi can
 * still continue (no rule about location is assumed).
 */
export function CheckSheet({ kind, open, onClose }: { kind: 'in' | 'out'; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const loc = useLocation(open);
  const [done, setDone] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!open) return;
    setDone(false);
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, [open]);

  const confirm = () => {
    const place = getDidi().profile.village;
    if (kind === 'in') didi.checkIn(place);
    else didi.checkOut();
    setDone(true);
    setTimeout(() => {
      onClose();
      const today = getDidi().attendance.find((d) => d.date === isoDay(new Date()));
      toast({ message: kind === 'in' ? `Checked in at ${formatTime(new Date())}` : `Checked out · ${hoursLabel(today ? workedMinutes(today) : 0)} today`, tone: 'success' });
    }, 1300);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      kicker="Attendance"
      title={done ? (kind === 'in' ? 'You’re checked in' : 'You’re checked out') : kind === 'in' ? 'Check in for today?' : 'Check out for today?'}
      footer={
        !done && (
          <div className="fj3-stack" style={{ ['--gap' as string]: '8px' }}>
            <Button size="lg" block icon={kind === 'in' ? <LogIn aria-hidden /> : <LogOut aria-hidden />} onClick={confirm} disabled={loc.state === 'finding'} loading={loc.state === 'finding'}>
              {loc.state === 'finding' ? 'Finding your location' : kind === 'in' ? `Check in at ${formatTime(now)}` : `Check out at ${formatTime(now)}`}
            </Button>
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
        </motion.div>
      ) : (
        <div className={s.locBox} aria-live="polite">
          {loc.state === 'finding' ? (
            <>
              <span className={`${s.locIcon} ${s.locPulse}`}>
                <MapPin aria-hidden />
              </span>
              <span>
                <strong>Capturing your location…</strong>
                <small>Your location is saved with this {kind === 'in' ? 'check-in' : 'check-out'}.</small>
              </span>
            </>
          ) : loc.state === 'found' ? (
            <>
              <span className={`${s.locIcon} ${s.locOk}`}>
                <MapPin aria-hidden />
              </span>
              <span>
                <strong>Location captured</strong>
                <small className="didi-num">
                  {loc.lat.toFixed(4)}° N, {loc.lng.toFixed(4)}° E
                </small>
              </span>
            </>
          ) : (
            <>
              <span className={`${s.locIcon} ${s.locOff}`}>
                <MapPinOff aria-hidden />
              </span>
              <span>
                <strong>No location</strong>
                <small>{loc.reason} You can still continue.</small>
              </span>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
