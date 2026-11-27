import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useStatusTone } from '@/lib/statusTone';
import markUrl from '@/assets/brand/kisani-urjaa-mark.webp';
import { Photo } from '@/d3/photo/Photo';
import { RevealText } from '@/d3/motion/Reveal';
import { useNav } from '../../nav';
import s from '@/d3/screens/onboarding/Onboarding.module.css';
import { Button } from '../../ui/Button';
import { DUR, EASE } from '@/d3/motion/tokens';

const SLIDES: { photo: string; section: string; title: string; text: string }[] = [
  { photo: 'kisani-didi-meeting', section: 'Your farmers', title: 'Every farmer you serve, in one place', text: 'Profiles, land and crops for each farmer in your cluster, ready before your next visit.' },
  { photo: 'kisani-straw-field', section: 'Your day', title: 'Tasks, proof and check-in from your phone', text: 'See what Kisani Urjaa needs from you, upload photos as proof and mark your attendance in the field.' },
  { photo: 'kisani-team-award', section: 'Your growth', title: 'See your payouts and where you rank', text: 'Follow every payment and see how you compare with Kisani Didis in your state and across India.' },
];

export default function Welcome() {
  const nav = useNav();
  const [i, setI] = useState(0);
  useStatusTone('light');
  const last = i === SLIDES.length - 1;
  const finish = useCallback(() => {
        nav('/welcome/language');
  }, [nav]);
  const go = useCallback((n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n))), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, go]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -400) go(i + 1);
    else if (info.offset.x > 60 || info.velocity.x > 400) go(i - 1);
  };
  const slide = SLIDES[i];

  return (
    <div className={s.cover}>
      <div className={s.coverTop}>
        <span className={s.coverPlate}>
          <img src={markUrl} alt="Kisani Urjaa" />
        </span>
        <span className={s.issue}>
          {String(i + 1).padStart(2, '0')} <span>/ {String(SLIDES.length).padStart(2, '0')}</span>
        </span>
        {!last ? (
          <button type="button" className={s.skip} onClick={finish}>
            Skip
          </button>
        ) : (
          <span className={s.skipSpacer} />
        )}
      </div>

      {/* Full-screen photo; a dark fade at the bottom carries the text. */}
      <div className={s.coverStage}>
        <AnimatePresence initial={false}>
          <motion.div key={i} className={s.coverPhoto} initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR.slow, ease: EASE }}>
            <Photo id={slide.photo} ratio="fill" shade="top" priority label="hero" />
          </motion.div>
        </AnimatePresence>
        <motion.div className={s.drag} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.1} onDragEnd={onDragEnd} aria-hidden />
      </div>

      <div className={s.coverBottom}>
        <div className={s.dots} role="tablist" aria-label="Introduction pages">
          {SLIDES.map((_, n) => (
            <button key={n} type="button" role="tab" aria-selected={n === i} aria-label={`Page ${n + 1} of ${SLIDES.length}`} className={`${s.dot} ${n === i ? s.dotOn : ''}`} onClick={() => go(n)} />
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={i} className={s.coverCopy} exit={{ opacity: 0, y: -8, transition: { duration: DUR.quick } }} aria-live="polite">
            <motion.p className={s.section} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              {slide.section}
            </motion.p>
            <RevealText text={slide.title} className={`${s.coverTitle} didi-reveal`} delay={0.15} />
            <motion.p className={s.coverLede} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: DUR.base, ease: EASE }}>
              {slide.text}
            </motion.p>
          </motion.div>
        </AnimatePresence>
        <Button size="lg" block iconRight={<ArrowRight aria-hidden />} onClick={() => (last ? finish() : go(i + 1))}>
          {last ? 'Get started' : 'Next'}
        </Button>
      </div>
    </div>
  );
}
