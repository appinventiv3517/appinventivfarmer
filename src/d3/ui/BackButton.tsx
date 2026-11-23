import { motion } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import { TAP } from '../motion/tokens';
import s from './BackButton.module.css';

/**
 * The one Back control in Ver 3: a labelled pill, same size and place on
 * every screen. `tone` only changes its colours for the surface below it
 * (page, night panel, or a photo). `close` swaps the arrow for ×, for flows
 * that end rather than go back.
 */
export function BackButton({ onClick, tone = 'surface', close, className }: { onClick: () => void; tone?: 'surface' | 'night' | 'image'; close?: boolean; className?: string }) {
  return (
    <motion.button type="button" whileTap={TAP} className={`${s.back} ${s[tone]} ${className ?? ''}`} onClick={onClick}>
      {close ? <X aria-hidden strokeWidth={2.4} /> : <ArrowLeft aria-hidden strokeWidth={2.4} />}
      <span>{close ? 'Close' : 'Back'}</span>
    </motion.button>
  );
}
