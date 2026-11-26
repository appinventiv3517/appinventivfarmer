/*
 * Kisani Urjaa · Ver 3 importer.
 * Reads kisani-urjaa-ver3.figma.json (made by scripts/figma/capture.cjs) and
 * builds, in the current Figma file:
 *   Cover · Style guide · Components · one page per area of the app
 * Every frame uses Auto Layout; colours, text and shadows are linked to local
 * styles; colours, radii and spacing are also published as variables.
 */
figma.showUI(__html__, { width: 420, height: 320 });

const PJS = { 100: ['ExtraLight', 'Extra Light'], 200: ['ExtraLight', 'Extra Light'], 300: ['Light'], 400: ['Regular'], 500: ['Medium'], 600: ['SemiBold', 'Semi Bold'], 700: ['Bold'], 800: ['ExtraBold', 'Extra Bold'], 900: ['ExtraBold', 'Extra Bold', 'Black'] };
const INTER = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };
const SCRIPTS = [
  [/[ऀ-ॿ]+/g, 'Noto Sans Devanagari'],
  [/[਀-੿]+/g, 'Noto Sans Gurmukhi'],
  [/[઀-૿]+/g, 'Noto Sans Gujarati'],
  [/[଀-୿]+/g, 'Noto Sans Oriya'],
  [/[ఀ-౿]+/g, 'Noto Sans Telugu'],
];
const BLEND = new Set(['NORMAL', 'DARKEN', 'MULTIPLY', 'LINEAR_BURN', 'COLOR_BURN', 'LIGHTEN', 'SCREEN', 'LINEAR_DODGE', 'COLOR_DODGE', 'OVERLAY', 'SOFT_LIGHT', 'HARD_LIGHT', 'DIFFERENCE', 'EXCLUSION', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY']);

let data, stats = { nodes: 0, failed: 0, fontsMissing: new Set() };
const fontCache = new Map();
const imageCache = new Map();
const paintStyleIds = new Map();
const textStyleIds = new Map();
const effectStyleIds = new Map();
let done = 0, total = 1;

const progress = (message) => figma.ui.postMessage({ type: 'progress', message, ratio: Math.min(0.99, done / total) });
const tick = () => new Promise((r) => setTimeout(r, 0));

/* ---------- fonts ---------- */
async function loadFont(family, weight, italic) {
  const key = family + weight + (italic ? 'i' : '');
  if (fontCache.has(key)) return fontCache.get(key);
  const w = Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
  const tries = [];
  if (/Plus Jakarta/i.test(family)) for (const s of PJS[w]) tries.push({ family: 'Plus Jakarta Sans', style: italic ? s + ' Italic' : s });
  else tries.push({ family, style: INTER[w] });
  tries.push({ family: 'Inter', style: INTER[w] }, { family: 'Inter', style: 'Regular' });
  for (const f of tries) {
    try {
      await figma.loadFontAsync(f);
      if (f.family !== 'Plus Jakarta Sans' && /Plus Jakarta/i.test(family)) stats.fontsMissing.add('Plus Jakarta Sans ' + PJS[w][0]);
      fontCache.set(key, f);
      return f;
    } catch (e) {}
  }
  throw new Error('No usable font for ' + family);
}
async function scriptFont(family, weight) {
  const key = 'script:' + family + weight;
  if (fontCache.has(key)) return fontCache.get(key);
  let found = null;
  for (const style of [weight >= 600 ? 'Bold' : 'Regular', 'Regular']) {
    try {
      await figma.loadFontAsync({ family, style });
      found = { family, style };
      break;
    } catch (e) {}
  }
  fontCache.set(key, found);
  return found;
}

/* ---------- paints ---------- */
const rgb = (c) => ({ r: c.r, g: c.g, b: c.b });
function linearTransform(deg) {
  const rad = ((deg - 90) * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
  return [[c, s, 0.5 - c * 0.5 - s * 0.5], [-s, c, 0.5 + s * 0.5 - c * 0.5]];
}
function imageHash(ref) {
  if (imageCache.has(ref)) return imageCache.get(ref);
  const img = data.images[ref];
  let hash = null;
  if (img) {
    try { hash = figma.createImage(figma.base64Decode(img.base64)).hash; } catch (e) {}
  }
  imageCache.set(ref, hash);
  return hash;
}
function paint(f) {
  if (f.type === 'SOLID') return { type: 'SOLID', color: rgb(f.color), opacity: f.color.a };
  if (f.type === 'GRADIENT_LINEAR' || f.type === 'GRADIENT_RADIAL') {
    let t;
    if (f.type === 'GRADIENT_LINEAR') t = linearTransform(f.angle);
    else {
      const [cx, cy] = f.center, rx = Math.max(0.001, f.radius[0]), ry = Math.max(0.001, f.radius[1]);
      t = [[1 / (2 * rx), 0, 0.5 - cx / (2 * rx)], [0, 1 / (2 * ry), 0.5 - cy / (2 * ry)]];
    }
    return { type: f.type, gradientTransform: t, gradientStops: f.stops.map((s) => ({ position: s.position, color: { r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a } })) };
  }
  if (f.type === 'IMAGE') {
    const hash = imageHash(f.ref);
    if (!hash) return { type: 'SOLID', color: { r: 0.92, g: 0.87, b: 0.82 } };
    const p = { type: 'IMAGE', imageHash: hash, scaleMode: f.scaleMode === 'CROP' && f.transform ? 'CROP' : f.scaleMode === 'FIT' ? 'FIT' : 'FILL' };
    if (p.scaleMode === 'CROP') p.imageTransform = f.transform;
    if (f.filters) p.filters = f.filters;
    return p;
  }
  return null;
}
function effect(e) {
  if (e.type === 'BACKGROUND_BLUR' || e.type === 'LAYER_BLUR') return { type: e.type, radius: e.radius, visible: true };
  return { type: e.type, color: { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a }, offset: { x: e.x, y: e.y }, radius: e.blur, spread: e.spread || 0, visible: true, blendMode: 'NORMAL' };
}

/* ---------- node builders ---------- */
async function applyBox(node, n) {
  const fills = (n.fills || []).map(paint).filter(Boolean);
  node.fills = fills;
  if (n.fills && n.fills.length === 1 && n.fills[0].style && paintStyleIds.has(n.fills[0].style)) {
    try { await node.setFillStyleIdAsync(paintStyleIds.get(n.fills[0].style)); } catch (e) {}
  }
  if (n.strokes && n.strokes.length) {
    node.strokes = n.strokes.map(paint).filter(Boolean);
    node.strokeAlign = n.strokeAlign || 'INSIDE';
    const [t, r, b, l] = n.strokeWeights || [1, 1, 1, 1];
    if (t === r && r === b && b === l) node.strokeWeight = t;
    else {
      node.strokeTopWeight = t; node.strokeRightWeight = r; node.strokeBottomWeight = b; node.strokeLeftWeight = l;
    }
    if (n.dashPattern) node.dashPattern = n.dashPattern;
    if (n.strokes.length === 1 && n.strokes[0].style && paintStyleIds.has(n.strokes[0].style)) {
      try { await node.setStrokeStyleIdAsync(paintStyleIds.get(n.strokes[0].style)); } catch (e) {}
    }
  }
  if (n.radius) {
    const [a, b, c, d] = n.radius;
    if (a === b && b === c && c === d) node.cornerRadius = a;
    else { node.topLeftRadius = a; node.topRightRadius = b; node.bottomRightRadius = c; node.bottomLeftRadius = d; }
  }
  if (n.effects && n.effects.length) node.effects = n.effects.map(effect);
  if (n.opacity != null && n.opacity < 1) node.opacity = n.opacity;
  if (n.blendMode && BLEND.has(n.blendMode)) node.blendMode = n.blendMode;
  if ('clipsContent' in node) node.clipsContent = !!n.clip;
}

function applyLayout(node, n) {
  const L = n.layout || { mode: 'VERTICAL', spacing: 0, padding: [0, 0, 0, 0], primary: 'MIN', counter: 'MIN' };
  node.layoutMode = L.mode === 'HORIZONTAL' ? 'HORIZONTAL' : 'VERTICAL';
  node.primaryAxisSizingMode = 'FIXED';
  node.counterAxisSizingMode = 'FIXED';
  node.itemSpacing = Math.max(0, L.spacing || 0);
  const [t, r, b, l] = L.padding || [0, 0, 0, 0];
  node.paddingTop = Math.max(0, t); node.paddingRight = Math.max(0, r); node.paddingBottom = Math.max(0, b); node.paddingLeft = Math.max(0, l);
  node.primaryAxisAlignItems = ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'].includes(L.primary) ? L.primary : 'MIN';
  node.counterAxisAlignItems = ['MIN', 'CENTER', 'MAX'].includes(L.counter) ? L.counter : 'MIN';
}

async function buildText(n) {
  const t = figma.createText();
  const st = n.style;
  const font = await loadFont(st.fontFamily, st.fontWeight, st.fontStyle === 'italic');
  t.fontName = font;
  t.characters = n.characters || ' ';
  if (n.textStyle && textStyleIds.has(n.textStyle)) {
    try { await t.setTextStyleIdAsync(textStyleIds.get(n.textStyle)); } catch (e) {}
  }
  t.fontName = font;
  t.fontSize = Math.max(1, st.fontSize);
  t.lineHeight = st.lineHeight ? { unit: 'PIXELS', value: st.lineHeight } : { unit: 'AUTO' };
  t.letterSpacing = { unit: 'PIXELS', value: st.letterSpacing || 0 };
  t.textCase = st.textCase || 'ORIGINAL';
  t.textDecoration = st.decoration || 'NONE';
  t.fills = st.color ? [{ type: 'SOLID', color: rgb(st.color), opacity: st.color.a }] : [];
  if (st.colorStyle && paintStyleIds.has(st.colorStyle)) {
    try { await t.setFillStyleIdAsync(paintStyleIds.get(st.colorStyle)); } catch (e) {}
  }
  t.textAlignHorizontal = n.align || 'LEFT';
  for (const r of n.ranges || []) {
    try {
      const rs = r.style;
      t.setRangeFontName(r.start, r.end, await loadFont(rs.fontFamily, rs.fontWeight, rs.fontStyle === 'italic'));
      t.setRangeFontSize(r.start, r.end, rs.fontSize);
      if (rs.color) t.setRangeFills(r.start, r.end, [{ type: 'SOLID', color: rgb(rs.color), opacity: rs.color.a }]);
      t.setRangeTextDecoration(r.start, r.end, rs.decoration || 'NONE');
      t.setRangeTextCase(r.start, r.end, rs.textCase || 'ORIGINAL');
    } catch (e) {}
  }
  // Indian scripts: use a Noto face for those characters when it is installed.
  for (const [re, fam] of SCRIPTS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t.characters))) {
      const f = await scriptFont(fam, st.fontWeight);
      if (!f) break;
      try { t.setRangeFontName(m.index, m.index + m[0].length, f); } catch (e) {}
    }
  }
  if (n.effects && n.effects.length) t.effects = n.effects.map(effect);
  if (n.opacity != null && n.opacity < 1) t.opacity = n.opacity;
  if (n.autoResize === 'WIDTH_AND_HEIGHT') t.textAutoResize = 'WIDTH_AND_HEIGHT';
  else if (n.autoResize === 'NONE') {
    t.textAutoResize = 'NONE';
    t.resize(Math.max(1, n.width), Math.max(1, n.height));
  } else {
    t.textAutoResize = 'HEIGHT';
    t.resize(Math.max(1, n.width), Math.max(1, n.height));
  }
  if (n.truncate) {
    try { t.textTruncation = 'ENDING'; } catch (e) {}
  }
  return t;
}

async function build(n, parent, asComponent) {
  let node;
  try {
    if (n.type === 'TEXT') node = await buildText(n);
    else if (n.type === 'SVG') {
      try {
        node = figma.createNodeFromSvg(n.svg);
      } catch (e) {
        node = figma.createFrame();
        node.fills = [];
      }
    } else if (n.type === 'SPACER') {
      node = figma.createFrame();
      node.fills = [];
    } else node = asComponent ? figma.createComponent() : figma.createFrame();
    parent.appendChild(node);
    node.name = n.name || (n.type === 'TEXT' ? n.characters.slice(0, 30) : 'frame');
    const auto = 'layoutMode' in parent && parent.layoutMode !== 'NONE';
    if (n.positioning === 'ABSOLUTE' && auto) {
      node.layoutPositioning = 'ABSOLUTE';
      node.x = n.x; node.y = n.y;
    } else if (!auto) {
      node.x = n.x || 0; node.y = n.y || 0;
    }
    if (n.type === 'SVG') {
      node.resize(Math.max(0.01, n.width), Math.max(0.01, n.height));
      if (n.opacity != null && n.opacity < 1) node.opacity = n.opacity;
      if ('layoutMode' in node && node.layoutMode === 'NONE') {
        // keep SVG internals as drawn; the icon frame itself is a fixed box
      }
    } else if (n.type !== 'TEXT') {
      node.resize(Math.max(0.01, n.width), Math.max(0.01, n.height));
      if (n.type !== 'SPACER') await applyBox(node, n);
      applyLayout(node, n);
      node.resize(Math.max(0.01, n.width), Math.max(0.01, n.height));
      for (const c of n.children || []) await build(c, node, false);
    }
    if (auto && n.positioning !== 'ABSOLUTE') {
      try {
        node.layoutSizingHorizontal = n.type === 'TEXT' && n.autoResize === 'WIDTH_AND_HEIGHT' ? 'HUG' : 'FIXED';
        node.layoutSizingVertical = n.type === 'TEXT' ? 'HUG' : 'FIXED';
      } catch (e) {}
    }
    stats.nodes++;
    if (++done % 250 === 0) { progress(`Building… ${done} of ${total} layers`); await tick(); }
  } catch (e) {
    stats.failed++;
    if (stats.failed < 5) console.error('Layer failed', n.name, e);
  }
  return node;
}

/* ---------- styles and variables ---------- */
async function makeStyles() {
  const S = data.styles;
  const existingPaint = await figma.getLocalPaintStylesAsync();
  const existingText = await figma.getLocalTextStylesAsync();
  const existingEffect = await figma.getLocalEffectStylesAsync();
  let collection = null, mode = null;
  try {
    collection = (await figma.variables.getLocalVariableCollectionsAsync()).find((c) => c.name === 'Ver 3 tokens') || figma.variables.createVariableCollection('Ver 3 tokens');
    mode = collection.modes[0].modeId;
  } catch (e) {}
  const existingVars = collection ? (await figma.variables.getLocalVariablesAsync()).filter((v) => v.variableCollectionId === collection.id) : [];
  const variable = (name, type, value) => {
    if (!collection) return null;
    try {
      const v = existingVars.find((x) => x.name === name) || figma.variables.createVariable(name, collection, type);
      v.setValueForMode(mode, value);
      return v;
    } catch (e) { return null; }
  };
  for (const c of S.colors) {
    const st = existingPaint.find((s) => s.name === c.name) || figma.createPaintStyle();
    st.name = c.name;
    st.description = `${c.description ? c.description + ' · ' : ''}${c.token}`;
    let p = { type: 'SOLID', color: rgb(c.color), opacity: c.color.a };
    const v = variable('color/' + c.name.toLowerCase(), 'COLOR', { r: c.color.r, g: c.color.g, b: c.color.b, a: c.color.a });
    if (v) { try { p = figma.variables.setBoundVariableForPaint(p, 'color', v); } catch (e) {} }
    st.paints = [p];
    paintStyleIds.set(c.name, st.id);
  }
  for (const t of S.text) {
    const st = existingText.find((s) => s.name === t.name) || figma.createTextStyle();
    st.name = t.name;
    st.fontName = await loadFont(t.fontFamily, t.fontWeight);
    st.fontSize = t.fontSize;
    st.lineHeight = { unit: 'PIXELS', value: t.lineHeight };
    st.letterSpacing = { unit: 'PIXELS', value: t.letterSpacing };
    st.textCase = t.textCase;
    st.description = `${t.token} · CSS weight ${t.cssWeight}`;
    textStyleIds.set(t.name, st.id);
  }
  for (const e of S.effects) {
    const st = existingEffect.find((s) => s.name === e.name) || figma.createEffectStyle();
    st.name = e.name;
    st.effects = e.effects.map(effect);
    st.description = e.token;
    effectStyleIds.set(e.name, st.id);
  }
  for (const r of S.radii) variable(r.name.toLowerCase(), 'FLOAT', r.value);
  for (const s of S.spacing) variable(s.name.toLowerCase(), 'FLOAT', s.value);
}

/* ---------- layout helpers for boards ---------- */
function autoFrame(name, dir, opts = {}) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = dir;
  f.primaryAxisSizingMode = opts.fixedWidth && dir === 'HORIZONTAL' ? 'FIXED' : 'AUTO';
  f.counterAxisSizingMode = opts.fixedWidth && dir === 'VERTICAL' ? 'FIXED' : 'AUTO';
  if (opts.fixedWidth) f.resize(opts.fixedWidth, 100);
  f.itemSpacing = opts.gap ?? 16;
  if (opts.wrap) { f.layoutWrap = 'WRAP'; f.counterAxisSpacing = opts.gap ?? 16; }
  const p = opts.pad ?? 0;
  f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = p;
  f.fills = opts.fill ? [{ type: 'SOLID', color: opts.fill }] : [];
  if (opts.radius) f.cornerRadius = opts.radius;
  return f;
}
async function label(text, styleName, colorStyle, opts = {}) {
  const t = figma.createText();
  t.fontName = await loadFont('Plus Jakarta Sans', opts.weight || 500);
  t.characters = text;
  if (styleName && textStyleIds.has(styleName)) { try { await t.setTextStyleIdAsync(textStyleIds.get(styleName)); } catch (e) {} }
  else t.fontSize = opts.size || 13;
  if (colorStyle && paintStyleIds.has(colorStyle)) { try { await t.setFillStyleIdAsync(paintStyleIds.get(colorStyle)); } catch (e) {} }
  if (opts.width) { t.textAutoResize = 'HEIGHT'; t.resize(opts.width, t.height); }
  return t;
}
const IVORY = { r: 0.984, g: 0.969, b: 0.945 };

async function styleGuide(page) {
  const S = data.styles;
  const board = autoFrame('Style guide', 'VERTICAL', { gap: 56, pad: 64, fill: IVORY, fixedWidth: 1440 });
  page.appendChild(board);
  board.appendChild(await label('Kisani Urjaa · Ver 3 style guide', 'Ver 3/Display', 'Text/fg'));
  board.appendChild(await label('Field Journal v3: warm ivory pages, espresso ink, clay actions and apricot highlights. Typeface Plus Jakarta Sans. Every colour, type and shadow below is a local style; colours, radii and spacing are also variables.', 'Ver 3/Lede', 'Text/fg-2', { width: 960 }));
  const section = async (title, deck) => {
    const s = autoFrame(title, 'VERTICAL', { gap: 20 });
    s.appendChild(await label(title, 'Ver 3/Title', 'Text/fg'));
    if (deck) s.appendChild(await label(deck, 'Ver 3/Body', 'Text/fg-2', { width: 900 }));
    board.appendChild(s);
    s.layoutSizingHorizontal = 'FILL';
    return s;
  };
  // Colours
  const groups = {};
  for (const c of S.colors) (groups[c.name.split('/')[0]] = groups[c.name.split('/')[0]] || []).push(c);
  const colours = await section('Colour', 'Semantic colours first; the raw palette is listed last. Contrast pairs meet WCAG 2.2 AA.');
  for (const [g, list] of Object.entries(groups)) {
    colours.appendChild(await label(g, 'Ver 3/Kicker', 'Text/hl-ink'));
    const row = autoFrame(g + ' swatches', 'HORIZONTAL', { gap: 16, wrap: true, fixedWidth: 1312 });
    colours.appendChild(row);
    for (const c of list) {
      const card = autoFrame(c.name, 'VERTICAL', { gap: 0, fill: { r: 1, g: 1, b: 1 }, radius: 16 });
      card.counterAxisSizingMode = 'FIXED';
      card.resize(200, 100);
      card.clipsContent = true;
      card.strokes = [{ type: 'SOLID', color: { r: 0.227, g: 0.18, b: 0.157 }, opacity: 0.1 }];
      const sw = figma.createRectangle();
      sw.resize(200, 88);
      try { await sw.setFillStyleIdAsync(paintStyleIds.get(c.name)); } catch (e) {}
      card.appendChild(sw);
      sw.layoutSizingHorizontal = 'FILL';
      const meta = autoFrame('meta', 'VERTICAL', { gap: 2, pad: 12 });
      card.appendChild(meta);
      meta.layoutSizingHorizontal = 'FILL';
      meta.appendChild(await label(c.name.split('/')[1], 'Ver 3/Label', 'Text/fg'));
      const hex = '#' + [c.color.r, c.color.g, c.color.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase() + (c.color.a < 1 ? ` · ${Math.round(c.color.a * 100)}%` : '');
      meta.appendChild(await label(hex + ' · ' + c.token, 'Ver 3/Caption', 'Text/fg-2'));
      if (c.description) meta.appendChild(await label(c.description, 'Ver 3/Caption', 'Text/fg-3', { width: 176 }));
      row.appendChild(card);
    }
  }
  // Type
  const type = await section('Typography', 'Plus Jakarta Sans. Weights from the CSS variable font are rounded to the nearest static weight in Figma (shown in each style description).');
  for (const t of S.text) {
    const row = autoFrame(t.name, 'HORIZONTAL', { gap: 32 });
    row.counterAxisAlignItems = 'CENTER';
    const meta = await label(`${t.name.split('/')[1]}\n${t.fontSize}/${t.lineHeight} · ${t.fontWeight}${t.letterSpacing ? ' · ' + t.letterSpacing + ' px' : ''}`, 'Ver 3/Caption', 'Text/fg-3', { width: 200 });
    row.appendChild(meta);
    row.appendChild(await label(t.name.endsWith('Numeral') ? '21°' : 'Clear your straw, don’t burn it', t.name, 'Text/fg', { width: 1000 }));
    type.appendChild(row);
  }
  // Radii
  const rad = await section('Corner radius', 'By role: panels 28, tiles 22, controls 16, icon chips 12, tags 8, navigation and pills fully round.');
  const rrow = autoFrame('radii', 'HORIZONTAL', { gap: 24, wrap: true, fixedWidth: 1312 });
  rad.appendChild(rrow);
  for (const r of S.radii) {
    const col = autoFrame(r.name, 'VERTICAL', { gap: 8 });
    const box = figma.createRectangle();
    box.resize(120, 88);
    box.cornerRadius = Math.min(r.value, 44);
    try { await box.setFillStyleIdAsync(paintStyleIds.get('Brand/tonal')); } catch (e) {}
    col.appendChild(box);
    col.appendChild(await label(`${r.name.split('/')[1]} · ${r.value >= 999 ? 'full' : r.value + ' px'}`, 'Ver 3/Label', 'Text/fg'));
    col.appendChild(await label(r.description || '', 'Ver 3/Caption', 'Text/fg-3', { width: 140 }));
    rrow.appendChild(col);
  }
  // Spacing
  const sp = await section('Spacing', 'Page gutter 20; sections 32 apart; groups and cards 24; form fields 16.');
  for (const s of S.spacing) {
    const row = autoFrame(s.name, 'HORIZONTAL', { gap: 24 });
    row.counterAxisAlignItems = 'CENTER';
    const bar = figma.createRectangle();
    bar.resize(Math.max(4, s.value * 4), 24);
    bar.cornerRadius = 4;
    try { await bar.setFillStyleIdAsync(paintStyleIds.get('Brand/primary')); } catch (e) {}
    row.appendChild(await label(`${s.name.split('/')[1]} · ${s.value} px`, 'Ver 3/Label', 'Text/fg', { width: 180 }));
    row.appendChild(bar);
    row.appendChild(await label(s.description, 'Ver 3/Small', 'Text/fg-2'));
    sp.appendChild(row);
  }
  // Elevation
  const el = await section('Elevation and glass');
  const erow = autoFrame('effects', 'HORIZONTAL', { gap: 32, pad: 24 });
  el.appendChild(erow);
  for (const e of S.effects) {
    const card = autoFrame(e.name, 'VERTICAL', { gap: 4, pad: 20, fill: { r: 1, g: 1, b: 1 }, radius: 28 });
    card.counterAxisSizingMode = 'FIXED';
    card.resize(220, 120);
    try { await card.setEffectStyleIdAsync(effectStyleIds.get(e.name)); } catch (e2) {}
    card.appendChild(await label(e.name, 'Ver 3/Label', 'Text/fg'));
    card.appendChild(await label(e.token, 'Ver 3/Caption', 'Text/fg-3'));
    erow.appendChild(card);
  }
  // Motion and photography
  const mo = await section('Motion', 'Used by every Ver 3 animation (src/d3/motion/tokens.ts).');
  for (const m of S.motion) mo.appendChild(await label(`${m.name} — ${m.value}`, 'Ver 3/Body', 'Text/fg'));
  const ph = await section('Photography', 'Every photo and video gets the same warm brand grade. In Figma this is applied as image filters on each photo fill (temperature +0.33, saturation +0.12, contrast +0.04) plus an apricot-to-clay wash layer in Soft light.');
  ph.appendChild(await label(`CSS: filter ${S.photo.grade}; wash ${S.photo.wash}`, 'Ver 3/Small', 'Text/fg-2', { width: 1100 }));
}

/* ---------- components ---------- */
async function components(page) {
  const board = autoFrame('Components', 'VERTICAL', { gap: 48, pad: 64, fill: IVORY });
  page.appendChild(board);
  board.appendChild(await label('Components', 'Ver 3/Display', 'Text/fg'));
  board.appendChild(await label('Every Ver 3 component, with variants as Figma component properties. All layers use Auto Layout.', 'Ver 3/Lede', 'Text/fg-2', { width: 900 }));
  const byGroup = {};
  for (const c of data.components) (byGroup[c.group] = byGroup[c.group] || []).push(c);
  for (const [group, list] of Object.entries(byGroup)) {
    const sec = autoFrame(group, 'VERTICAL', { gap: 24 });
    board.appendChild(sec);
    sec.appendChild(await label(group, 'Ver 3/Title', 'Text/fg'));
    const sets = {};
    for (const c of list) {
      const i = c.name.indexOf('/');
      const set = i < 0 ? c.name : c.name.slice(0, i);
      (sets[set] = sets[set] || []).push(c);
    }
    const row = autoFrame(group + ' sets', 'HORIZONTAL', { gap: 40, wrap: true, fixedWidth: 1600 });
    sec.appendChild(row);
    for (const [setName, items] of Object.entries(sets)) {
      const holder = autoFrame(setName, 'VERTICAL', { gap: 12 });
      row.appendChild(holder);
      holder.appendChild(await label(setName, 'Ver 3/Heading', 'Text/fg'));
      const comps = [];
      for (const c of items) {
        const comp = await build({ ...c.node, positioning: undefined }, holder, true);
        if (!comp) continue;
        const i = c.name.indexOf('/');
        comp.name = i < 0 ? c.name : c.name.slice(i + 1);
        comps.push(comp);
      }
      if (comps.length > 1) {
        try {
          const set = figma.combineAsVariants(comps, holder);
          set.name = setName;
          set.layoutMode = 'HORIZONTAL';
          set.layoutWrap = 'WRAP';
          set.primaryAxisSizingMode = 'FIXED';
          set.counterAxisSizingMode = 'AUTO';
          set.itemSpacing = 24;
          set.counterAxisSpacing = 24;
          set.paddingTop = set.paddingBottom = set.paddingLeft = set.paddingRight = 24;
          set.resize(Math.min(1520, Math.max(...comps.map((c) => c.width)) * Math.min(comps.length, 4) + 24 * 5), set.height);
        } catch (e) {
          comps.forEach((c) => (c.name = setName + ' / ' + c.name));
        }
      } else if (comps[0]) comps[0].name = setName;
    }
  }
}

/* ---------- run ---------- */
async function run() {
  const count = (n) => 1 + (n.children || []).reduce((a, c) => a + count(c), 0);
  total = data.pages.reduce((a, p) => a + p.frames.reduce((b, f) => b + count(f), 0), 0) + data.components.reduce((a, c) => a + count(c.node), 0);
  progress('Loading fonts…');
  await loadFont('Plus Jakarta Sans', 500);
  progress('Creating styles and variables…');
  await makeStyles();

  const newPage = async (name) => {
    const p = figma.root.children.find((x) => x.name === name) || figma.createPage();
    p.name = name;
    await figma.setCurrentPageAsync(p);
    return p;
  };
  // Cover
  const cover = await newPage('Cover');
  const cf = autoFrame('Cover', 'VERTICAL', { gap: 16, pad: 96, fill: IVORY });
  cf.primaryAxisSizingMode = 'FIXED'; cf.counterAxisSizingMode = 'FIXED'; cf.resize(1920, 1080); cf.primaryAxisAlignItems = 'CENTER';
  cover.appendChild(cf);
  cf.appendChild(await label('KISANI URJAA', 'Ver 3/Kicker', 'Text/hl-ink'));
  cf.appendChild(await label('Farmer app · Ver 3 “Field Journal v3”', 'Ver 3/Display', 'Text/fg'));
  cf.appendChild(await label(`${data.meta.screens} screens and states · ${data.meta.components} components · style guide · generated ${data.meta.generated.slice(0, 10)}\n${data.meta.notes}`, 'Ver 3/Lede', 'Text/fg-2', { width: 1200 }));

  progress('Style guide…');
  await styleGuide(await newPage('Style guide'));
  progress('Components…');
  await components(await newPage('Components'));

  for (const pg of data.pages) {
    const page = await newPage('Screens · ' + pg.name);
    progress(`Screens · ${pg.name}…`);
    const title = await label(pg.name, 'Ver 3/Display', 'Text/fg');
    page.appendChild(title);
    title.x = 0; title.y = -140;
    const COLS = 6, GAP = 80, W = 393;
    let rowY = 0, rowH = 0;
    for (let i = 0; i < pg.frames.length; i++) {
      const f = pg.frames[i];
      if (i && i % COLS === 0) { rowY += rowH + 160; rowH = 0; }
      const node = await build({ ...f, positioning: undefined, x: (i % COLS) * (W + GAP), y: rowY }, page, false);
      if (node) {
        node.x = (i % COLS) * (W + GAP);
        node.y = rowY;
        rowH = Math.max(rowH, f.height);
      }
    }
  }
  await figma.setCurrentPageAsync(figma.root.children.find((p) => p.name === 'Cover'));
  const missing = [...stats.fontsMissing];
  const msg = `Done: ${stats.nodes} layers${stats.failed ? `, ${stats.failed} skipped` : ''}.${missing.length ? ' Install Plus Jakarta Sans for exact type (Inter used instead).' : ''}`;
  figma.ui.postMessage({ type: 'done', message: msg });
  figma.notify(msg, { timeout: 8000 });
}

figma.ui.onmessage = async (msg) => {
  if (msg.type !== 'import') return;
  try {
    data = JSON.parse(msg.json);
    if (data.schema !== 'kisani-urjaa.figma/1') throw new Error('This is not a Kisani Urjaa Ver 3 export.');
    await run();
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: String((e && e.message) || e) });
  }
};
