import type { Transition, Variants } from 'framer-motion';

/*
 * Ver 3 motion tokens. Every animation in Ver 3 uses these, so the same
 * kind of movement always feels the same.
 *
 *   EASE        entrances and settles (strong ease-out)
 *   EASE_IN_OUT things leaving the screen
 *   DUR         quick: feedback · base: content changes · slow: page moves
 *   SPRING      indicators and chips that slide between options
 *   SPRING_SOFT cards and dialogs that pop in
 *   TAP / TAP_ICON  press feedback for cards and buttons / small icons
 *   SWAP        content replaced in place (tabs, segmented choices)
 *   stepMotion  wizard steps inside one screen: slide in the direction of travel
 */
export const EASE = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
export const DUR = { quick: 0.2, base: 0.32, slow: 0.52 } as const;

export const SPRING: Transition = { type: 'spring', stiffness: 480, damping: 38 };
export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 300, damping: 26 };

export const TAP = { scale: 0.97 } as const;
export const TAP_ICON = { scale: 0.92 } as const;

export const SWAP: { variants: Variants; initial: string; animate: string; exit: string; transition: Transition } = {
  variants: { out: { opacity: 0, y: 8 }, in: { opacity: 1, y: 0 }, gone: { opacity: 0, y: -6 } },
  initial: 'out',
  animate: 'in',
  exit: 'gone',
  transition: { duration: DUR.base, ease: EASE },
};

/** Wizard step change within one screen; dir 1 = forward, -1 = back. */
export function stepMotion(dir: number) {
  return { initial: { opacity: 0, x: dir * 40 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: dir * -30 }, transition: { duration: DUR.base, ease: EASE } };
}
