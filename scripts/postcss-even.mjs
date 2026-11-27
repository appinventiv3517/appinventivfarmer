/**
 * PostCSS plugin for the Kisani Didi build: every font size, line height,
 * padding, margin, gap and corner radius becomes an even whole number of
 * pixels at the default text size (16px root). Values written in rem stay in
 * rem (as multiples of 0.125rem = 2px), so the Text size setting still scales
 * them. Unitless line heights in `font` shorthands become an even length.
 * The Farmer App build does not use this plugin.
 */
const ROOT = 16;
const PROPS = /^(font-size|line-height|padding(-(top|right|bottom|left|inline|block)(-(start|end))?)?|margin(-(top|right|bottom|left|inline|block)(-(start|end))?)?|gap|row-gap|column-gap|grid-gap|border(-(top|bottom)-(left|right))?-radius|border-(start|end)-(start|end)-radius)$/;
const LEN = /(-?\d*\.?\d+)(px|rem)\b/g;
const FONT = /^(\s*(?:italic\s+)?\d{3}\s+)(\d*\.?\d+)(px|rem)(\s*\/\s*)(\d*\.?\d+)(px|rem)?(.*)$/s;

const even = (px) => Math.round(px / 2) * 2;
const fmt = (px, unit) => (unit === 'rem' ? `${+(px / ROOT).toFixed(4)}rem` : `${px}px`);
const toPx = (n, unit) => (unit === 'rem' ? n * ROOT : n);

export function evenLengths(value) {
  if (/url\(/.test(value)) return value;
  return value.replace(LEN, (_, n, unit) => fmt(even(toPx(parseFloat(n), unit)), unit));
}

/** `650 0.9375rem/1.25 var(--font)` → `650 1rem/1.25rem var(--font)` */
export function evenFont(value) {
  const m = value.match(FONT);
  if (!m) return null;
  const [, pre, n, unit, slash, lh, lhUnit, rest] = m;
  const size = even(toPx(parseFloat(n), unit));
  const line = lhUnit ? even(toPx(parseFloat(lh), lhUnit)) : even(size * parseFloat(lh));
  return `${pre}${fmt(size, unit)}${slash}${fmt(line, unit === 'rem' ? 'rem' : 'px')}${rest}`;
}

export default function postcssEven() {
  return {
    postcssPlugin: 'didi-even-lengths',
    Declaration(decl) {
      if (decl.__even) return;
      decl.__even = true;
      const { prop, value } = decl;
      if (prop === 'font' || prop.startsWith('--')) {
        const f = evenFont(value);
        if (f) return void (decl.value = f);
        if (prop.startsWith('--') && /^\s*-?\d*\.?\d+(px|rem)(\s+-?\d*\.?\d+(px|rem))*\s*$/.test(value)) decl.value = evenLengths(value);
        return;
      }
      if (!PROPS.test(prop)) return;
      if (prop === 'line-height' && /^\s*\d*\.?\d+\s*$/.test(value)) {
        // Unitless: needs the font size from the same rule.
        const fsDecl = decl.parent?.nodes?.find((d) => d.type === 'decl' && d.prop === 'font-size' && LEN.test(d.value));
        LEN.lastIndex = 0;
        if (!fsDecl) return;
        const [, n, unit] = /(-?\d*\.?\d+)(px|rem)/.exec(fsDecl.value);
        const size = even(toPx(parseFloat(n), unit));
        decl.value = fmt(even(size * parseFloat(value)), unit);
        return;
      }
      decl.value = evenLengths(value);
    },
  };
}
postcssEven.postcss = true;
