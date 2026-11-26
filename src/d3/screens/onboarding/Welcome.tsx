import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useStatusTone } from '@/lib/statusTone';
import markUrl from '@/assets/brand/kisani-urjaa-mark.webp';
import { Photo } from '../../photo/Photo';
import { RevealText } from '../../motion/Reveal';
import { useNav } from '../../nav';
import s from './Onboarding.module.css';
import { Button } from '../../ui/Button';
import { DUR, EASE } from '../../motion/tokens';

const SLIDES: { photo: string; section: string; title: string; text: string }[] = [
  { photo: 'kisani-paddy-green', section: 'Your farm', title: 'Your whole farm, in one journal', text: 'Fields, crops and season records in one place, kept up to date with your Kisani Didi.' },
  { photo: 'kisani-straw-field', section: 'From waste to wealth', title: 'Clear your straw, don’t burn it', text: 'Book straw clearing after harvest and order FOM manure for your soil. Follow every request until it’s done.' },
  { photo: 'kisani-didi-meeting', section: 'Your Kisani Didi', title: 'Help from someone in your village', text: 'Your Kisani Didi, spray advice from the local forecast, and workshops near you.' },
];

export default function Welcome() {
  const nav = useNav();
  const [i, setI] = useState(0);
  useStatusTone('dark');
  const last = i === SLIDES.length - 1;
  const finish = useCallback(() => {
    // Next: a dedicated page to choose the app language (it completes onboarding).
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
        <img src={markUrl} alt="Kisani Urjaa" className={s.coverMark} />
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

      {/* The photo card fills the space between the top bar and the text. */}
      <div className={s.coverStage}>
        <AnimatePresence initial={false}>
          <motion.div key={i} className={s.coverPhoto} initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: DUR.slow, ease: EASE }}>
            <Photo id={slide.photo} ratio="fill" priority label="hero" />
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
            <RevealText text={slide.title} className={s.coverTitle} delay={0.15} />
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
