/*
 * Strict stand-in for the Figma plugin API, to test figma-plugin/code.js
 * without Figma: validates enum values, sizes, paints and auto-layout rules
 * the way Figma does, and reports what would be created.
 *   node scripts/figma/mock-figma.cjs dist-figma/kisani-urjaa-ver3.figma.json
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENUM = {
  layoutMode: ['NONE', 'HORIZONTAL', 'VERTICAL'],
  primaryAxisSizingMode: ['FIXED', 'AUTO'],
  counterAxisSizingMode: ['FIXED', 'AUTO'],
  primaryAxisAlignItems: ['MIN', 'MAX', 'CENTER', 'SPACE_BETWEEN'],
  counterAxisAlignItems: ['MIN', 'MAX', 'CENTER', 'BASELINE'],
  layoutPositioning: ['AUTO', 'ABSOLUTE'],
  layoutWrap: ['NO_WRAP', 'WRAP'],
  layoutSizingHorizontal: ['FIXED', 'HUG', 'FILL'],
  layoutSizingVertical: ['FIXED', 'HUG', 'FILL'],
  textAutoResize: ['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE'],
  textAlignHorizontal: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'],
  textCase: ['ORIGINAL', 'UPPER', 'LOWER', 'TITLE', 'SMALL_CAPS', 'SMALL_CAPS_FORCED'],
  textDecoration: ['NONE', 'UNDERLINE', 'STRIKETHROUGH'],
  strokeAlign: ['CENTER', 'INSIDE', 'OUTSIDE'],
  textTruncation: ['DISABLED', 'ENDING'],
  blendMode: ['PASS_THROUGH', 'NORMAL', 'DARKEN', 'MULTIPLY', 'LINEAR_BURN', 'COLOR_BURN', 'LIGHTEN', 'SCREEN', 'LINEAR_DODGE', 'COLOR_DODGE', 'OVERLAY', 'SOFT_LIGHT', 'HARD_LIGHT', 'DIFFERENCE', 'EXCLUSION', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY'],
};
const issues = new Map();
const issue = (m) => issues.set(m, (issues.get(m) || 0) + 1);
const num = (v, name) => { if (typeof v !== 'number' || !isFinite(v)) issue(`${name} not a finite number: ${v}`); };
const unit = (v, name) => { num(v, name); if (v < 0 || v > 1) issue(`${name} out of 0..1: ${v}`); };
function checkPaint(p, where) {
  if (!p || typeof p !== 'object') return issue(`${where}: empty paint`);
  if (p.type === 'SOLID') { ['r', 'g', 'b'].forEach((k) => unit(p.color[k], `${where} color.${k}`)); if ('a' in p.color) issue(`${where}: SOLID color must not have "a"`); if (p.opacity !== undefined) unit(p.opacity, `${where} opacity`); }
  else if (p.type === 'GRADIENT_LINEAR' || p.type === 'GRADIENT_RADIAL') {
    if (!Array.isArray(p.gradientTransform) || p.gradientTransform.length !== 2 || p.gradientTransform.some((r) => r.length !== 3 || r.some((v) => !isFinite(v)))) issue(`${where}: bad gradientTransform`);
    if (!p.gradientStops?.length) issue(`${where}: no gradient stops`);
    for (const s of p.gradientStops || []) { unit(s.position, `${where} stop.position`); ['r', 'g', 'b', 'a'].forEach((k) => unit(s.color[k], `${where} stop.${k}`)); }
  } else if (p.type === 'IMAGE') {
    if (!p.imageHash) issue(`${where}: image without hash`);
    if (!['FILL', 'FIT', 'CROP', 'TILE'].includes(p.scaleMode)) issue(`${where}: scaleMode ${p.scaleMode}`);
    if (p.scaleMode === 'CROP' && (!p.imageTransform || p.imageTransform.flat().some((v) => !isFinite(v)))) issue(`${where}: bad imageTransform`);
    for (const [k, v] of Object.entries(p.filters || {})) { num(v, `filter ${k}`); if (v < -1 || v > 1) issue(`filter ${k} out of -1..1`); }
  } else issue(`${where}: paint type ${p.type}`);
}
function checkEffect(e) {
  if (e.type === 'BACKGROUND_BLUR' || e.type === 'LAYER_BLUR') return num(e.radius, 'blur radius');
  if (!['DROP_SHADOW', 'INNER_SHADOW'].includes(e.type)) return issue('effect type ' + e.type);
  ['r', 'g', 'b', 'a'].forEach((k) => unit(e.color[k], 'shadow color.' + k));
  num(e.offset.x, 'shadow x'); num(e.offset.y, 'shadow y'); num(e.radius, 'shadow radius');
  if (e.radius < 0) issue('negative shadow radius');
  if (e.blendMode !== 'NORMAL') issue('shadow blendMode');
}

let ids = 0;
const counts = {};
class Node {
  constructor(type) {
    this.type = type; this.id = String(++ids); this.children = []; this.parent = null; this.name = type;
    this._w = 100; this._h = 100; this.x = 0; this.y = 0; this._p = { layoutMode: 'NONE', layoutPositioning: 'AUTO' };
    counts[type] = (counts[type] || 0) + 1;
  }
  get width() { return this._w; } get height() { return this._h; }
  resize(w, h) { num(w, 'width'); num(h, 'height'); if (w < 0.01 || h < 0.01) issue('resize below 0.01'); this._w = w; this._h = h; }
  appendChild(c) { if (!(c instanceof Node)) issue('appendChild non-node'); if (c.parent) c.parent.children = c.parent.children.filter((x) => x !== c); this.children.push(c); c.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((x) => x !== this); }
  async setFillStyleIdAsync(id) { if (!styles.has(id)) issue('unknown fill style'); }
  async setStrokeStyleIdAsync(id) { if (!styles.has(id)) issue('unknown stroke style'); }
  async setEffectStyleIdAsync(id) { if (!styles.has(id)) issue('unknown effect style'); }
  async setTextStyleIdAsync(id) { if (this.type !== 'TEXT') issue('text style on non-text'); if (!styles.has(id)) issue('unknown text style'); }
}
const props = {
  fills: (n, v) => { if (!Array.isArray(v)) issue('fills not array'); v.forEach((p) => checkPaint(p, n.type + ' fill')); },
  strokes: (n, v) => v.forEach((p) => checkPaint(p, 'stroke')),
  effects: (n, v) => v.forEach(checkEffect),
  opacity: (n, v) => unit(v, 'opacity'),
  cornerRadius: (n, v) => num(v, 'radius'),
  strokeWeight: (n, v) => num(v, 'strokeWeight'),
  itemSpacing: (n, v) => { num(v, 'itemSpacing'); if (v < 0) issue('negative itemSpacing'); },
  layoutPositioning: (n, v) => { if (v === 'ABSOLUTE' && (!n.parent || n.parent._p.layoutMode === 'NONE')) issue('ABSOLUTE outside auto layout'); },
  layoutSizingHorizontal: (n, v) => { if (!n.parent || n.parent._p.layoutMode === 'NONE') issue('layoutSizing outside auto layout'); if (v === 'HUG' && !(n.type === 'TEXT' || n._p.layoutMode !== 'NONE')) issue('HUG on non-autolayout'); },
  layoutSizingVertical: (n, v) => { if (!n.parent || n.parent._p.layoutMode === 'NONE') issue('layoutSizing outside auto layout'); },
  fontName: (n, v) => { if (!loaded.has(v.family + '|' + v.style)) issue('font not loaded: ' + v.family + ' ' + v.style); },
  characters: (n, v) => { if (!loaded.has(n._p.fontName ? n._p.fontName.family + '|' + n._p.fontName.style : 'Inter|Regular')) issue('characters before font load'); },
  lineHeight: (n, v) => { if (!['PIXELS', 'AUTO', 'PERCENT'].includes(v.unit)) issue('lineHeight unit'); },
  layoutWrap: (n, v) => { if (v === 'WRAP' && n._p.layoutMode !== 'HORIZONTAL') issue('wrap needs HORIZONTAL'); },
  counterAxisSpacing: (n, v) => num(v, 'counterAxisSpacing'),
};
for (const k of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']) props[k] = (n, v) => { num(v, k); if (v < 0) issue('negative ' + k); };
const handler = {
  set(t, k, v) {
    if (ENUM[k] && !ENUM[k].includes(v)) issue(`${k}=${v}`);
    if (props[k]) props[k](t, v);
    if (k in t && !(k in props) && !ENUM[k] && typeof t[k] !== 'function' && k !== 'name' && k !== 'x' && k !== 'y' && k !== 'description' && k !== 'paints' && k !== 'textAutoResize' && !k.startsWith('_')) { t[k] = v; return true; }
    t._p[k] = v;
    if (['x', 'y', 'name', 'description', 'paints'].includes(k)) t[k] = v;
    return true;
  },
  get(t, k) { if (k in t) return t[k]; return t._p[k]; },
};
const make = (type) => new Proxy(new Node(type), handler);
const loaded = new Set();
const styles = new Map();
const FONTS = new Set(['Inter|Regular', 'Inter|Medium', 'Inter|Semi Bold', 'Inter|Bold', 'Inter|Extra Bold', 'Inter|Light', 'Inter|Extra Light', 'Inter|Black', 'Inter|Thin',
  ...['ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold'].map((s) => 'Plus Jakarta Sans|' + s), 'Noto Sans Devanagari|Regular', 'Noto Sans Devanagari|Bold']);
const pages = [];
const variables = [];
let ui = null, messages = [];
const figma = {
  root: { get children() { return pages; } },
  showUI: () => {},
  ui: { postMessage: (m) => messages.push(m), set onmessage(fn) { ui = fn; } },
  notify: (m) => messages.push({ type: 'notify', message: m }),
  loadFontAsync: async (f) => { if (!FONTS.has(f.family + '|' + f.style)) throw new Error('font'); loaded.add(f.family + '|' + f.style); },
  createFrame: () => make('FRAME'),
  createComponent: () => make('COMPONENT'),
  createRectangle: () => make('RECTANGLE'),
  createText: () => { const t = make('TEXT'); t._p.fontName = { family: 'Inter', style: 'Regular' }; return t; },
  createNodeFromSvg: (svg) => { if (!/^<svg[\s>]/.test(svg)) throw new Error('bad svg'); if (/currentColor/.test(svg)) issue('svg still has currentColor'); return make('FRAME'); },
  createPage: () => { const p = make('PAGE'); pages.push(p); return p; },
  setCurrentPageAsync: async () => {},
  createImage: (bytes) => { if (!(bytes instanceof Uint8Array) || bytes.length < 100) issue('bad image bytes'); return { hash: 'h' + bytes.length }; },
  base64Decode: (s) => new Uint8Array(Buffer.from(s, 'base64')),
  getLocalPaintStylesAsync: async () => [], getLocalTextStylesAsync: async () => [], getLocalEffectStylesAsync: async () => [],
  createPaintStyle: () => { const s = { id: 'S' + ++ids, type: 'PAINT' }; styles.set(s.id, s); return new Proxy(s, { set(t, k, v) { if (k === 'paints') v.forEach((p) => checkPaint(p, 'style')); t[k] = v; return true; } }); },
  createTextStyle: () => { const s = { id: 'S' + ++ids, type: 'TEXT' }; styles.set(s.id, s); return new Proxy(s, { set(t, k, v) { if (k === 'fontName' && !loaded.has(v.family + '|' + v.style)) issue('style font not loaded'); t[k] = v; return true; } }); },
  createEffectStyle: () => { const s = { id: 'S' + ++ids, type: 'EFFECT' }; styles.set(s.id, s); return new Proxy(s, { set(t, k, v) { if (k === 'effects') v.forEach(checkEffect); t[k] = v; return true; } }); },
  combineAsVariants: (nodes, parent) => {
    if (nodes.some((n) => n.type !== 'COMPONENT')) issue('combine non-components');
    for (const n of nodes) if (!/^[^=,]+=[^=,]+(, [^=,]+=[^=,]+)*$/.test(n.name)) issue('variant name not Prop=Value: ' + n.name);
    const set = make('COMPONENT_SET'); parent.appendChild(set); nodes.forEach((n) => set.appendChild(n)); return set;
  },
  variables: {
    getLocalVariableCollectionsAsync: async () => [], getLocalVariablesAsync: async () => variables,
    createVariableCollection: (name) => ({ id: 'VC', name, modes: [{ modeId: 'M1' }] }),
    createVariable: (name, coll, type) => { if (!['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'].includes(type)) issue('var type'); const v = { name, variableCollectionId: coll.id, setValueForMode: (m, val) => { if (type === 'FLOAT') num(val, 'var ' + name); } }; variables.push(v); return v; },
    setBoundVariableForPaint: (p) => p,
  },
};
// Text range methods.
Object.assign(Node.prototype, {
  setRangeFontName(s, e, f) { if (!loaded.has(f.family + '|' + f.style)) issue('range font not loaded'); if (s < 0 || e > (this._p.characters || '').length || s >= e) issue('bad range'); },
  setRangeFontSize() {}, setRangeFills(s, e, p) { p.forEach((x) => checkPaint(x, 'range fill')); }, setRangeTextDecoration() {}, setRangeTextCase() {},
});

const code = fs.readFileSync(path.resolve(__dirname, '../../figma-plugin/code.js'), 'utf8');
const ctx = vm.createContext({ figma, __html__: '', console, setTimeout, Promise, Math, JSON, Object, Array, Set, Map, String, Number, Error, Uint8Array });
vm.runInContext(code, ctx);
(async () => {
  const json = fs.readFileSync(process.argv[2], 'utf8');
  const t0 = Date.now();
  await ui({ type: 'import', json });
  const last = messages.filter((m) => m.type === 'done' || m.type === 'error').pop();
  console.log('result:', last);
  console.log('created:', counts, 'styles', styles.size, 'variables', variables.length, 'pages', pages.map((p) => p.name).join(' | '));
  console.log(`time ${(Date.now() - t0) / 1000}s`);
  const list = [...issues.entries()].sort((a, b) => b[1] - a[1]);
  console.log(list.length ? 'ISSUES:\n' + list.slice(0, 40).map(([m, c]) => `  ${c} × ${m}`).join('\n') : 'no issues');
  // Auto Layout coverage: every frame that holds children should be auto layout.
  let frames = 0, al = 0;
  const walk = (n) => { if (n.type === 'FRAME' || n.type === 'COMPONENT') { frames++; if (n._p.layoutMode && n._p.layoutMode !== 'NONE') al++; } n.children.forEach(walk); };
  pages.forEach(walk);
  console.log(`auto layout frames: ${al}/${frames} (the rest are SVG icon frames)`);
})();
