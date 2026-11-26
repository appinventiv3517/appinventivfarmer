/** Turns resolved Ver 3 CSS tokens into Figma styles and variables. */
function hex(v) {
  v = v.trim();
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) return { r: parseInt(m[1].slice(0, 2), 16) / 255, g: parseInt(m[1].slice(2, 4), 16) / 255, b: parseInt(m[1].slice(4, 6), 16) / 255, a: 1 };
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (m) return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a: m[4] === undefined ? 1 : +m[4] };
  return null;
}
const GROUPS = [
  ['Surface', ['bg', 'surface', 'surface-2', 'surface-3', 'desk', 'scrim']],
  ['Text', ['fg', 'fg-2', 'fg-3', 'hl-ink', 'link', 'disabled-fg']],
  ['Brand', ['primary', 'primary-pressed', 'on-primary', 'accent', 'accent-pressed', 'on-accent', 'tonal', 'on-tonal', 'focus']],
  ['Line', ['line', 'line-strong']],
  ['Status', ['success-fg', 'success-bg', 'success-solid', 'warning-fg', 'warning-bg', 'warning-solid', 'danger-fg', 'danger-bg', 'danger-solid', 'info-fg', 'info-bg', 'info-solid', 'live', 'unread']],
  ['Glass', ['glass', 'glass-strong', 'glass-line']],
  ['State', ['disabled-bg']],
  ['Palette', ['espresso', 'clay-700', 'clay-600', 'clay-100', 'apricot', 'apricot-300', 'sage', 'ivory', 'sand-100', 'sand-200', 'sand-300', 'white', 'sky-300']],
];
const ROLES = {
  bg: 'Page background (warm ivory)', surface: 'Cards, inputs', 'surface-2': 'Sand panels', 'surface-3': 'Pressed panels', desk: 'Desktop backdrop', scrim: 'Behind sheets',
  fg: 'Primary text', 'fg-2': 'Secondary text', 'fg-3': 'Tertiary text, icons', 'hl-ink': 'Kicker and highlight text', link: 'Links', 'disabled-fg': 'Disabled text',
  primary: 'Primary buttons (clay)', 'primary-pressed': 'Pressed primary', 'on-primary': 'Text on primary', accent: 'Apricot accent', 'on-accent': 'Text on accent', tonal: 'Tonal buttons, selected chips', 'on-tonal': 'Text on tonal', focus: 'Focus ring',
  line: 'Hairlines', 'line-strong': 'Input borders', live: 'Live now', unread: 'Unread markers',
};
const TEXT = [
  ['Display', 'display', 'track-display'], ['Title', 'title', 'track-title'], ['Headline', 'headline'], ['Heading', 'heading'], ['Sub', 'sub'], ['Lede', 'lede'],
  ['Read', 'read'], ['Body', 'body'], ['Label', 'label'], ['Small', 'small'], ['Caption', 'caption'], ['Kicker', 'kicker', 'track-kicker', 'UPPER'], ['Numeral', 'numeral'],
];

function buildStyles(t) {
  const get = (n) => t['--fj3-' + n] || t['--' + n];
  const colors = [];
  for (const [group, names] of GROUPS) for (const n of names) {
    const c = get(n) && hex(get(n));
    if (c) colors.push({ name: `${group}/${n}`, color: c, token: `--fj3-${n}`, description: ROLES[n] || '' });
  }
  const text = [];
  for (const [label, key, track, textCase] of TEXT) {
    const v = get(key);
    const m = v && v.match(/^(\d+)\s+([\d.]+)(rem|px)\/([\d.]+)(px)?/);
    if (!m) continue;
    const size = +m[2] * (m[3] === 'rem' ? 16 : 1);
    const lh = m[5] ? +m[4] : +m[4] * size;
    const ls = track ? parseFloat(get(track)) * size : 0;
    text.push({ name: `Ver 3/${label}`, token: `--fj3-${key}`, fontFamily: 'Plus Jakarta Sans', fontWeight: Math.round(+m[1] / 100) * 100, cssWeight: +m[1], fontSize: size, lineHeight: Math.round(lh * 100) / 100, letterSpacing: Math.round(ls * 100) / 100, textCase: textCase || 'ORIGINAL' });
  }
  const effects = [];
  for (const n of ['shadow-1', 'shadow-2', 'shadow-3']) {
    const v = get(n);
    if (!v) continue;
    const parts = v.split(/,(?![^(]*\))/).map((s) => s.trim());
    effects.push({
      name: `Elevation/${n.replace('shadow-', 'Level ')}`,
      token: `--fj3-${n}`,
      effects: parts.map((p) => {
        const col = p.match(/rgba?\([^)]*\)/)[0];
        const nums = p.replace(col, '').trim().split(/\s+/).map(parseFloat);
        return { type: 'DROP_SHADOW', x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0, spread: nums[3] || 0, color: hex(col) };
      }),
    });
  }
  effects.push({ name: 'Glass/Background blur', token: '--fj3-glass-blur', effects: [{ type: 'BACKGROUND_BLUR', radius: 16 }] });
  const radii = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'pill'].map((k) => ({ name: `Radius/${k}`, token: `--r-${k}`, value: parseFloat(t['--r-' + k]) }));
  const ROLE_R = { xs: 'Tags', sm: 'Icon chips', md: 'Inputs, buttons, OTP boxes', lg: 'Tiles and option cards', xl: 'Cards and panels', '2xl': 'Splash plate', pill: 'Navigation, back, chips, tabs' };
  radii.forEach((r) => (r.description = ROLE_R[r.name.split('/')[1]]));
  const spacing = [
    ['Gutter', 'gutter', 'Page side margin'], ['Section', 'section', 'Between page sections'], ['Group', 'group', 'Between groups and cards'], ['Field gap', 'field-gap', 'Between form fields'], ['Header height', 'header-h', 'Top bar'], ['Dock height', 'dock-h', 'Bottom navigation tabs'],
  ].map(([label, k, d]) => ({ name: `Spacing/${label}`, token: `--fj3-${k}`, value: parseFloat(get(k)), description: d }));
  const motion = [
    { name: 'Ease out', value: get('ease-out') }, { name: 'Ease in-out', value: get('ease') }, { name: 'Quick', value: get('dur-1') }, { name: 'Base', value: get('dur-2') }, { name: 'Slow', value: get('dur-3') },
    { name: 'Spring', value: 'stiffness 480, damping 38 (tabs, indicators)' }, { name: 'Soft spring', value: 'stiffness 300, damping 26 (cards, dialogs)' }, { name: 'Tap', value: 'scale 0.97 (icons 0.92)' },
  ];
  const photo = { grade: get('photo-grade'), wash: get('photo-wash'), figma: { temperature: 0.33, saturation: 0.12, contrast: 0.04, washBlend: 'SOFT_LIGHT' } };
  return { fontFamily: 'Plus Jakarta Sans', colors, text, effects, radii, spacing, motion, photo };
}
module.exports = { buildStyles };
