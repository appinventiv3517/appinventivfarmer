import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Camera, CheckCircle2, CameraOff, Keyboard, QrCode, RotateCcw, ScanLine, UserRound, XCircle } from 'lucide-react';
import { useStatusTone } from '@/lib/statusTone';
import { TextField } from '@/d3/ui/Field';
import { Sheet } from '@/d3/ui/Sheet';
import { SPRING_SOFT, SWAP } from '@/d3/motion/tokens';
import { BackButton } from '@/d3/ui/BackButton';
import { Button } from '../../ui/Button';
import { completion, farmerById, FARMERS, type Farmer } from '../../data/farmers';
import { Ring } from '../../ui/Kit';
import { useNav } from '../../nav';
import s from './Scan.module.css';

type State = { k: 'intro' } | { k: 'starting' } | { k: 'scanning'; live: boolean } | { k: 'denied' } | { k: 'error'; message: string } | { k: 'found'; farmer: Farmer } | { k: 'invalid'; raw: string };

/** A Kisani Urjaa farmer card QR holds the farmer ID, e.g. "KU-F-10231" or "kisaniurjaa:farmer:KU-F-10231". */
export function parseFarmerQr(raw: string): Farmer | null {
  const m = raw.toUpperCase().match(/KU-F-\d{5}/);
  return m ? farmerById(m[0]) ?? null : null;
}

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

export default function Scan() {
  useStatusTone('light');
  const nav = useNav();
  const [st, setSt] = useState<State>({ k: 'intro' });
  const [manual, setManual] = useState(false);
  const [manualId, setManualId] = useState('');
  const [manualErr, setManualErr] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const result = useCallback(
    (raw: string) => {
      stop();
      const f = parseFarmerQr(raw);
      if (navigator.vibrate) navigator.vibrate(f ? 40 : [30, 60, 30]);
      setSt(f ? { k: 'found', farmer: f } : { k: 'invalid', raw });
    },
    [stop],
  );

  const start = async () => {
    setSt({ k: 'starting' });
    if (!navigator.mediaDevices?.getUserMedia) {
      setSt({ k: 'error', message: 'This browser can’t open the camera. Enter the farmer ID instead, or try the demo scan.' });
      return;
    }
    try {
      const m = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      stream.current = m;
      setSt({ k: 'scanning', live: true });
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') setSt({ k: 'denied' });
      else setSt({ k: 'error', message: name === 'NotFoundError' ? 'No camera was found on this device.' : 'The camera couldn’t start. Close other apps using it and try again.' });
    }
  };

  // Attach the stream and read QR codes where the browser supports it.
  useEffect(() => {
    if (st.k !== 'scanning' || !st.live || !video.current || !stream.current) return;
    const v = video.current;
    v.srcObject = stream.current;
    v.play().catch(() => undefined);
    const W = window as Window & { BarcodeDetector?: new (o: { formats: string[] }) => Detector };
    if (!W.BarcodeDetector) return;
    const det = new W.BarcodeDetector({ formats: ['qr_code'] });
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const codes = v.readyState >= 2 ? await det.detect(v) : [];
        if (codes[0]?.rawValue) return result(codes[0].rawValue);
      } catch {
        /* keep trying */
      }
      setTimeout(tick, 280);
    };
    tick();
    return () => {
      alive = false;
    };
  }, [st, result]);

  const simulate = (ok: boolean) => {
    stop();
    setSt({ k: 'scanning', live: false });
    setTimeout(() => result(ok ? `kisaniurjaa:farmer:${FARMERS[1].id}` : 'upi://pay?pa=shop@upi'), 1400);
  };

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    const f = parseFarmerQr(manualId) ?? farmerById(manualId.trim());
    if (!f) return setManualErr('No farmer with this ID in your cluster. IDs look like KU-F-10231.');
    setManual(false);
    setSt({ k: 'found', farmer: f });
  };

  const scanning = st.k === 'scanning' || st.k === 'starting';

  return (
    <div className={s.scan}>
      <div className={s.viewport}>
        {st.k === 'scanning' && st.live && <video ref={video} className={s.video} playsInline muted />}
        <div className={s.dim} aria-hidden />
        <div className={`${s.frame} ${scanning ? s.frameOn : ''} ${st.k === 'found' ? s.frameOk : ''} ${st.k === 'invalid' || st.k === 'error' || st.k === 'denied' ? s.frameBad : ''}`} aria-hidden>
          <i />
          <i />
          <i />
          <i />
          {scanning && <motion.span className={s.line} animate={{ top: ['8%', '88%', '8%'] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />}
          {!scanning && st.k !== 'found' && <QrCode className={s.ghost} />}
        </div>
      </div>

      <div className={s.top}>
        <BackButton tone="image" onClick={() => (stop(), nav(-1))} />
        <span className={s.title}>Scan farmer QR</span>
        <button type="button" className={s.manualBtn} onClick={() => (stop(), setManual(true))} aria-label="Enter farmer ID">
          <Keyboard aria-hidden />
        </button>
      </div>

      <div className={s.panel}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={st.k} className={s.panelBody} {...SWAP}>
            {st.k === 'intro' && (
              <>
                <span className={s.icon}>
                  <Camera aria-hidden />
                </span>
                <h1 className={s.h}>Allow the camera to scan</h1>
                <p className={s.p}>Point it at the QR code on a farmer’s Kisani Urjaa card to open their profile. The camera is only used while this screen is open.</p>
                <Button size="lg" block icon={<Camera aria-hidden />} onClick={start}>
                  Allow camera
                </Button>
                <DemoRow onScan={simulate} />
              </>
            )}
            {scanning && (
              <>
                <h1 className={s.h}>{st.k === 'starting' ? 'Opening the camera…' : 'Hold the QR inside the frame'}</h1>
                <p className={s.p}>Keep the phone steady, about a hand’s length away. Good light helps.</p>
                <DemoRow onScan={simulate} />
              </>
            )}
            {st.k === 'denied' && (
              <>
                <span className={`${s.icon} ${s.iconBad}`}>
                  <CameraOff aria-hidden />
                </span>
                <h1 className={s.h}>Camera permission is off</h1>
                <p className={s.p}>Allow camera access for this app in your phone’s settings, then try again. You can also enter the farmer ID.</p>
                <div className={s.row}>
                  <Button block icon={<RotateCcw aria-hidden />} onClick={start}>
                    Try again
                  </Button>
                  <Button block variant="secondary" icon={<Keyboard aria-hidden />} onClick={() => setManual(true)}>
                    Enter ID
                  </Button>
                </div>
                <DemoRow onScan={simulate} />
              </>
            )}
            {st.k === 'error' && (
              <>
                <span className={`${s.icon} ${s.iconBad}`}>
                  <AlertTriangle aria-hidden />
                </span>
                <h1 className={s.h}>Couldn’t scan</h1>
                <p className={s.p}>{st.message}</p>
                <div className={s.row}>
                  <Button block icon={<RotateCcw aria-hidden />} onClick={start}>
                    Try again
                  </Button>
                  <Button block variant="secondary" icon={<Keyboard aria-hidden />} onClick={() => setManual(true)}>
                    Enter ID
                  </Button>
                </div>
                <DemoRow onScan={simulate} />
              </>
            )}
            {st.k === 'invalid' && (
              <>
                <span className={`${s.icon} ${s.iconBad}`}>
                  <XCircle aria-hidden />
                </span>
                <h1 className={s.h}>Not a Kisani Urjaa farmer QR</h1>
                <p className={s.p}>This code doesn’t belong to a farmer in your cluster. Scan the QR on the farmer’s Kisani Urjaa card.</p>
                <Button size="lg" block icon={<ScanLine aria-hidden />} onClick={start}>
                  Scan again
                </Button>
              </>
            )}
            {st.k === 'found' && (
              <>
                <motion.div className={s.found} initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING_SOFT}>
                  <span className={s.foundIcon}>
                    <CheckCircle2 aria-hidden />
                  </span>
                  <div className={s.foundText}>
                    <span className={s.kicker}>Farmer found</span>
                    <strong>{st.farmer.name}</strong>
                    <span>
                      {st.farmer.id} · {st.farmer.village}, {st.farmer.mandal}
                    </span>
                  </div>
                  <Ring value={completion(st.farmer)} size={48} stroke={5} label={`Profile ${completion(st.farmer)}% complete`} />
                </motion.div>
                <Button size="lg" block icon={<UserRound aria-hidden />} onClick={() => nav(`/farmers/${st.farmer.id}`, { replace: true })}>
                  Open profile
                </Button>
                <Button size="lg" block variant="ghost" icon={<ScanLine aria-hidden />} onClick={start}>
                  Scan another
                </Button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Sheet open={manual} onClose={() => setManual(false)} kicker="No QR?" title="Enter the farmer ID">
        <form onSubmit={submitManual} className="fj3-stack" style={{ ['--gap' as string]: '16px' }} noValidate>
          <TextField label="Farmer ID" placeholder="KU-F-10231" autoCapitalize="characters" value={manualId} onChange={(e) => (setManualId(e.target.value), setManualErr(null))} error={manualErr} hint="It’s printed under the QR on the farmer’s card." data-autofocus />
          <Button type="submit" size="lg" block>
            Find farmer
          </Button>
        </form>
      </Sheet>
    </div>
  );
}

function DemoRow({ onScan }: { onScan: (ok: boolean) => void }) {
  return (
    <div className={s.demo}>
      <span>Demo</span>
      <button type="button" onClick={() => onScan(true)}>
        Scan a farmer card
      </button>
      <button type="button" onClick={() => onScan(false)}>
        Scan a wrong QR
      </button>
    </div>
  );
}
