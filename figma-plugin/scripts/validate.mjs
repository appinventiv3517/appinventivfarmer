#!/usr/bin/env node
/*
 * Offline validation for the plugin.
 *  1. manifest.json points at files that exist and uses known fields.
 *  2. ui.html parses and its embedded data references only present assets.
 *  3. main.js runs end to end against a strict mock of the Figma Plugin API,
 *     driven exactly like the UI drives it (start → assets → screen … → finish).
 *     The mock rejects the mistakes Figma rejects: colours outside 0–1, alpha
 *     inside paint colours, unloaded fonts, bad enum values, negative sizes,
 *     appending to non-containers, and so on.
 *   node figma-plugin/scripts/validate.mjs [--only id1,id2]
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const errors = [];
const fail = (m) => errors.push(m);

/* ---------- 1. manifest ---------- */
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
for (const k of ['name', 'id', 'api', 'main', 'editorType']) if (!manifest[k]) fail('manifest missing ' + k);
for (const k of ['main', 'ui']) if (manifest[k] && !fs.existsSync(path.join(ROOT, manifest[k]))) fail('manifest ' + k + ' file missing: ' + manifest[k]);
if (!Array.isArray(manifest.editorType) || !manifest.editorType.includes('figma')) fail('manifest editorType must include "figma"');

/* ---------- 2. ui.html ---------- */
const html = fs.readFileSync(path.join(ROOT, 'ui.html'), 'utf8');
const m = html.match(/<script id="ku-data" type="application\/json">([\s\S]*?)<\/script>/);
if (!m) throw new Error('ui.html has no data block');
const DATA = JSON.parse(m[1]);
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
for (const s of scripts) {
  try {
    new vm.Script(s);
  } catch (e) {
    fail('ui.html script does not parse: ' + e.message);
  }
}

/* ---------- 3. mock Figma API ---------- */
let idSeq = 0;
const loadedFonts = new Set();
const fontKey = (f) => f.family + '|' + f.style;
const AVAILABLE = ['ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Italic', 'Bold Italic'].map((style) => ({ fontName: { family: 'Plus Jakarta Sans', style } }));
const images = new Set();
const stats = { nodes: 0, byType: {}, reactions: 0, instances: 0 };
const ENUMS = {
  textAutoResize: ['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE'],
  textAlignHorizontal: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'],
  textCase: ['ORIGINAL', 'UPPER', 'LOWER', 'TITLE', 'SMALL_CAPS', 'SMALL_CAPS_FORCED'],
  textDecoration: ['NONE', 'UNDERLINE', 'STRIKETHROUGH'],
  strokeAlign: ['INSIDE', 'OUTSIDE', 'CENTER'],
  layoutMode: ['NONE', 'HORIZONTAL', 'VERTICAL', 'GRID'],
  layoutWrap: ['NO_WRAP', 'WRAP'],
  primaryAxisSizingMode: ['FIXED', 'AUTO'],
  counterAxisSizingMode: ['FIXED', 'AUTO'],
  counterAxisAlignItems: ['MIN', 'MAX', 'CENTER', 'BASELINE'],
  textTruncation: ['DISABLED', 'ENDING'],
  primaryAxisAlignItems: ['MIN', 'MAX', 'CENTER', 'SPACE_BETWEEN'],
  blendMode: ['PASS_THROUGH', 'NORMAL', 'DARKEN', 'MULTIPLY', 'LINEAR_BURN', 'COLOR_BURN', 'LIGHTEN', 'SCREEN', 'LINEAR_DODGE', 'COLOR_DODGE', 'OVERLAY', 'SOFT_LIGHT', 'HARD_LIGHT', 'DIFFERENCE', 'EXCLUSION', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY'],
};
const in01 = (v) => typeof v === 'number' && v >= 0 && v <= 1 && !Number.isNaN(v);
function checkColor(c, where, alpha) {
  if (!c || !in01(c.r) || !in01(c.g) || !in01(c.b)) throw new Error(where + ': colour channel outside 0–1 ' + JSON.stringify(c));
  if (alpha ? !in01(c.a) : 'a' in c) throw new Error(where + (alpha ? ': RGBA needs a in 0–1' : ': paint colour must not have a'));
}
function checkPaints(paints, where) {
  if (!Array.isArray(paints)) throw new Error(where + ': paints must be an array');
  for (const p of paints) {
    if (p.type === 'SOLID') {
      checkColor(p.color, where);
      if (p.opacity !== undefined && !in01(p.opacity)) throw new Error(where + ': opacity outside 0–1');
    } else if (p.type === 'GRADIENT_LINEAR' || p.type === 'GRADIENT_RADIAL') {
      const t = p.gradientTransform;
      if (!t || t.length !== 2 || t.some((r) => r.length !== 3 || r.some((v) => !Number.isFinite(v)))) throw new Error(where + ': bad gradientTransform');
      if (!p.gradientStops.length) throw new Error(where + ': no gradient stops');
      p.gradientStops.forEach((s) => {
        if (!in01(s.position)) throw new Error(where + ': stop position');
        checkColor(s.color, where + ' stop', true);
      });
    } else if (p.type === 'IMAGE') {
      if (!images.has(p.imageHash)) throw new Error(where + ': unknown image hash');
      if (!['FILL', 'FIT', 'CROP', 'TILE'].includes(p.scaleMode)) throw new Error(where + ': scaleMode');
    } else throw new Error(where + ': unknown paint type ' + p.type);
  }
}
function checkEffects(effects, where) {
  for (const e of effects) {
    if (e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') {
      checkColor(e.color, where, true);
      if (!Number.isFinite(e.offset.x) || !Number.isFinite(e.offset.y) || !(e.radius >= 0)) throw new Error(where + ': bad shadow');
      if (e.blendMode !== 'NORMAL') throw new Error(where + ': blendMode');
    } else if (e.type === 'BACKGROUND_BLUR' || e.type === 'LAYER_BLUR') {
      if (!(e.radius >= 0)) throw new Error(where + ': blur radius');
    } else throw new Error(where + ': effect type ' + e.type);
  }
}

const CONTAINERS = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'SECTION', 'PAGE', 'GROUP', 'DOCUMENT']);

class Node {
  constructor(type) {
    this.id = '1:' + ++idSeq;
    this.type = type;
    this.name = type;
    this.parent = null;
    this.children = CONTAINERS.has(type) || type === 'INSTANCE' ? [] : undefined;
    this._x = 0;
    this._y = 0;
    this.width = 100;
    this.height = 100;
    this._fills = [];
    this._strokes = [];
    this._effects = [];
    this._pd = {};
    this.reactions = [];
    this.removed = false;
    stats.nodes++;
    stats.byType[type] = (stats.byType[type] || 0) + 1;
  }
  get x() { return this._x; }
  set x(v) { if (!Number.isFinite(v)) throw new Error(this.name + ': x is not finite'); this._x = v; }
  get y() { return this._y; }
  set y(v) { if (!Number.isFinite(v)) throw new Error(this.name + ': y is not finite'); this._y = v; }
  get fills() { return this._fills; }
  set fills(v) { checkPaints(v, this.name + '.fills'); this._fills = v; }
  get strokes() { return this._strokes; }
  set strokes(v) { checkPaints(v, this.name + '.strokes'); this._strokes = v; }
  get effects() { return this._effects; }
  set effects(v) { checkEffects(v, this.name + '.effects'); this._effects = v; }
  resize(w, h) {
    if (!(w >= 0.01) || !(h >= 0.01) || !Number.isFinite(w) || !Number.isFinite(h)) throw new Error(this.name + ': resize(' + w + ',' + h + ') — must be ≥ 0.01');
    this.width = w;
    this.height = h;
  }
  resizeWithoutConstraints(w, h) { this.resize(w, h); }
  rescale(s) {
    if (!(s > 0)) throw new Error('rescale must be > 0');
    this.width *= s;
    this.height *= s;
  }
  appendChild(child) {
    if (!this.children) throw new Error('Cannot append to ' + this.type);
    if (this.type === 'INSTANCE') throw new Error('Cannot append to an instance');
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
    child.parent = this;
    this.children.push(child);
  }
  insertChild(i, child) { this.appendChild(child); }
  remove() {
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.removed = true;
    this.parent = null;
  }
  findAll(pred) {
    const out = [];
    (function walk(n) { (n.children || []).forEach((c) => { if (!pred || pred(c)) out.push(c); walk(c); }); })(this);
    return out;
  }
  setPluginData(k, v) { if (typeof v !== 'string') throw new Error('plugin data must be a string'); this._pd[k] = v; }
  getPluginData(k) { return this._pd[k] || ''; }
  setSharedPluginData(ns, k, v) { if (typeof v !== 'string') throw new Error('shared plugin data must be a string'); }
  async setReactionsAsync(r) {
    for (const x of r) {
      if (!x.trigger || !x.actions) throw new Error('reaction needs trigger and actions');
      for (const a of x.actions) if (a.type === 'NODE' && !a.destinationId) throw new Error('reaction without destination');
    }
    this.reactions = r;
    stats.reactions++;
  }
  async setEffectStyleIdAsync(id) { this.effectStyleId = id; }
  setExplicitVariableModeForCollection(c, mode) { if (!c || !mode) throw new Error('explicit mode needs collection and mode'); }
  clone() { const n = new Node(this.type); return n; }
  swapComponent(c) { if (this.type !== 'INSTANCE') throw new Error('swapComponent on ' + this.type); if (!c || c.type !== 'COMPONENT') throw new Error('swapComponent needs a component'); this.mainComponent = c; }
  createInstance() {
    if (this.type !== 'COMPONENT') throw new Error('createInstance on ' + this.type);
    const inst = new Node('INSTANCE');
    inst.mainComponent = this;
    inst.width = this.width;
    inst.height = this.height;
    inst.children = this.children.map(function copy(c) {
      const k = c.type === 'TEXT' ? new TextNode() : new Node(c.type);
      if (c.type === 'TEXT') { k._fontName = c._fontName; k._chars = c._chars; }
      k._strokes = c._strokes; k._fills = c._fills; k.strokeWeight = c.strokeWeight; k.mainComponent = c.mainComponent; k.width = c.width; k.height = c.height;
      k.children = c.children ? c.children.map(copy) : undefined;
      if (k.children) k.children.forEach((g) => (g.parent = k));
      k.parent = inst;
      return k;
    });
    stats.instances++;
    return inst;
  }
}
for (const [prop, values] of Object.entries(ENUMS)) {
  Object.defineProperty(Node.prototype, prop, {
    get() { return this['_' + prop]; },
    set(v) { if (!values.includes(v)) throw new Error(this.name + ': invalid ' + prop + ' "' + v + '"'); this['_' + prop] = v; },
  });
}

class TextNode extends Node {
  constructor() {
    super('TEXT');
    this._fontName = { family: 'Inter', style: 'Regular' };
    this._chars = '';
    this.fontSize = 12;
  }
  requireFont(f) { if (!loadedFonts.has(fontKey(f || this._fontName))) throw new Error('Font not loaded: ' + fontKey(f || this._fontName)); }
  get fontName() { return this._fontName; }
  set fontName(f) { this.requireFont(f); this._fontName = f; }
  get characters() { return this._chars; }
  set characters(c) {
    this.requireFont();
    if (typeof c !== 'string') throw new Error('characters must be a string');
    this._chars = c;
    const lines = c.split('\n').length;
    this.width = Math.max(1, Math.min(c.length * 7, 2000));
    this.height = 20 * lines;
  }
  get lineHeight() { return this._lh; }
  set lineHeight(v) { if (!v || !['PIXELS', 'AUTO', 'PERCENT'].includes(v.unit) || (v.unit !== 'AUTO' && !Number.isFinite(v.value))) throw new Error('bad lineHeight ' + JSON.stringify(v)); this._lh = v; }
  get letterSpacing() { return this._ls; }
  set letterSpacing(v) { if (!v || !['PIXELS', 'PERCENT'].includes(v.unit) || !Number.isFinite(v.value)) throw new Error('bad letterSpacing ' + JSON.stringify(v)); this._ls = v; }
  get maxLines() { return this._ml; }
  set maxLines(v) { if (v !== null && !(v >= 1)) throw new Error('maxLines'); this._ml = v; }
  range(a, b) { if (!(a >= 0 && b <= this._chars.length && a < b)) throw new Error('range ' + a + '-' + b + ' outside 0-' + this._chars.length); }
  setRangeFontName(a, b, f) { this.range(a, b); this.requireFont(f); }
  setRangeFontSize(a, b, s) { this.range(a, b); if (!(s >= 1)) throw new Error('font size'); }
  setRangeFills(a, b, p) { this.range(a, b); checkPaints(p, 'text range'); }
  setRangeLetterSpacing(a, b, v) { this.range(a, b); this.letterSpacing = v; }
  setRangeTextCase(a, b, v) { this.range(a, b); this.textCase = v; }
  setRangeTextDecoration(a, b, v) { this.range(a, b); this.textDecoration = v; }
  async setTextStyleIdAsync(id) { this.textStyleId = id; }
}

function svgNode(markup) {
  if (typeof markup !== 'string' || !markup.startsWith('<svg')) throw new Error('createNodeFromSvg: not an SVG');
  const w = +(markup.match(/width="([\d.]+)"/) || [0, 24])[1];
  const h = +(markup.match(/height="([\d.]+)"/) || [0, 24])[1];
  const f = new Node('FRAME');
  f.resize(Math.max(w, 0.01), Math.max(h, 0.01));
  const paths = (markup.match(/<(path|rect|circle|ellipse|line|polyline|polygon)\b/g) || []).length;
  for (let i = 0; i < Math.min(paths, 3); i++) {
    const v = new Node('VECTOR');
    v._strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    v.strokeWeight = 2;
    f.appendChild(v);
  }
  return f;
}

const document_ = new Node('DOCUMENT');
document_.name = 'Document';
const firstPage = new Node('PAGE');
firstPage.name = 'Page 1';
document_.appendChild(firstPage);
const pageProto = { flowStartingPoints: [] };
Object.assign(firstPage, pageProto);
let current = firstPage;
const variables = [];
const collections = [];
const styles = { text: [], effect: [] };

const figma = {
  editorType: 'figma',
  currentUser: { name: 'Validator' },
  root: document_,
  get currentPage() { return current; },
  set currentPage(_) { throw new Error('Setting figma.currentPage is not supported (dynamic-page)'); },
  async setCurrentPageAsync(p) { if (p.type !== 'PAGE') throw new Error('not a page'); current = p; },
  showUI() {},
  ui: { onmessage: null, postMessage(msg) { figma.__last = msg; } },
  notify() {},
  closePlugin() {},
  mixed: Symbol('mixed'),
  skipInvisibleInstanceChildren: false,
  viewport: { scrollAndZoomIntoView() {} },
  async listAvailableFontsAsync() { return AVAILABLE; },
  async loadFontAsync(f) { if (!AVAILABLE.some((a) => fontKey(a.fontName) === fontKey(f)) && f.family !== 'Inter') throw new Error('font unavailable'); loadedFonts.add(fontKey(f)); },
  createPage() { const p = new Node('PAGE'); Object.assign(p, { flowStartingPoints: [] }); document_.appendChild(p); return p; },
  createFrame() { const n = new Node('FRAME'); n._fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]; current.appendChild(n); return n; },
  createRectangle() { const n = new Node('RECTANGLE'); current.appendChild(n); return n; },
  createEllipse() { const n = new Node('ELLIPSE'); current.appendChild(n); return n; },
  createText() { const n = new TextNode(); current.appendChild(n); return n; },
  createSection() { const n = new Node('SECTION'); current.appendChild(n); return n; },
  createNodeFromSvg(markup) { const n = svgNode(markup); current.appendChild(n); return n; },
  createImage(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 8) throw new Error('createImage needs PNG/JPEG bytes');
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!png && !jpg) throw new Error('createImage: only PNG, JPEG and GIF are supported');
    const hash = 'img' + images.size;
    images.add(hash);
    return { hash };
  },
  createComponentFromNode(node) {
    if (!['FRAME', 'GROUP', 'RECTANGLE', 'VECTOR', 'TEXT'].includes(node.type)) throw new Error('createComponentFromNode: ' + node.type);
    const c = new Node('COMPONENT');
    c.children = node.children || [];
    c.children.forEach((k) => (k.parent = c));
    c.width = node.width;
    c.height = node.height;
    const parent = node.parent;
    if (parent) { parent.children.splice(parent.children.indexOf(node), 1, c); c.parent = parent; }
    return c;
  },
  combineAsVariants(list, parent) {
    const names = new Set();
    for (const c of list) {
      if (c.type !== 'COMPONENT') throw new Error('combineAsVariants: not a component');
      if (!/^[^=,]+=[^=,]+(,\s*[^=,]+=[^=,]+)*$/.test(c.name)) throw new Error('variant name must be Prop=Value: ' + c.name);
      if (names.has(c.name)) throw new Error('duplicate variant ' + c.name);
      names.add(c.name);
    }
    const set = new Node('COMPONENT_SET');
    list.forEach((c) => set.appendChild(c));
    parent.appendChild(set);
    return set;
  },
  async getNodeByIdAsync(id) {
    let found = null;
    (function walk(n) { if (found) return; if (n.id === id) found = n; (n.children || []).forEach(walk); })(document_);
    return found;
  },
  async setFileThumbnailNodeAsync() {},
  async getLocalTextStylesAsync() { return styles.text; },
  async getLocalEffectStylesAsync() { return styles.effect; },
  createTextStyle() {
    const s = { id: 'S:t' + styles.text.length, name: '', description: '' };
    Object.defineProperty(s, 'fontName', { set(f) { if (!loadedFonts.has(fontKey(f))) throw new Error('style font not loaded'); }, get() { return null; } });
    styles.text.push(s);
    return s;
  },
  createEffectStyle() { const s = { id: 'S:e' + styles.effect.length, name: '' }; Object.defineProperty(s, 'effects', { set(v) { checkEffects(v, 'effect style'); } }); styles.effect.push(s); return s; },
  variables: {
    async getLocalVariableCollectionsAsync() { return collections; },
    async getLocalVariablesAsync() { return variables; },
    createVariableCollection(name) {
      const c = { id: 'VC:' + collections.length, name, modes: [{ modeId: 'm0', name: 'Mode 1' }], renameMode(id, n) { this.modes.find((m) => m.modeId === id).name = n; }, addMode(n) { const id = 'm' + this.modes.length; this.modes.push({ modeId: id, name: n }); return id; } };
      collections.push(c);
      return c;
    },
    createVariable(name, col, type) {
      if (!col || !col.id) throw new Error('createVariable needs a collection');
      const v = { id: 'V:' + variables.length, name, variableCollectionId: col.id, resolvedType: type, values: {}, setValueForMode(mode, val) { if (type === 'COLOR' && !val.type) checkColor(val, 'variable ' + name, true); this.values[mode] = val; } };
      variables.push(v);
      return v;
    },
    createVariableAlias(v) { return { type: 'VARIABLE_ALIAS', id: v.id }; },
    setBoundVariableForPaint(paint, field, v) { if (field !== 'color' || !v) throw new Error('bad bind'); return Object.assign({}, paint, { boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } } }); },
  },
};

/* ---------- run main.js with the mock ---------- */
const code = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const ctx = vm.createContext({ figma, __html__: '<html></html>', console, setTimeout, Promise, Uint8Array, Object, Array, JSON, Math, Date, String, Number, RegExp, Error, Symbol, isFinite, Infinity, NaN });
new vm.Script(code, { filename: 'main.js' }).runInContext(ctx);
let seq = 0;
async function send(type, payload) {
  const id = ++seq;
  await figma.ui.onmessage(Object.assign({ type, seq: id }, payload));
  // onmessage resolves asynchronously; poll for our ack.
  for (let i = 0; i < 20000; i++) {
    if (figma.__last && figma.__last.seq === id) break;
    await new Promise((r) => setImmediate(r));
  }
  const ack = figma.__last;
  if (!ack || ack.seq !== id) throw new Error('no ack for ' + type);
  if (!ack.ok) throw new Error(type + ' failed: ' + ack.error);
  return ack;
}

const screens = DATA.screens.filter((s) => !only || only.has(s.rec.id));
const pages = DATA.pages.map((p) => p.title);
const t0 = Date.now();
const sent = new Set();
let failedScreens = 0;
const notes = [];
try {
  await send('hello', {});
  await send('start', { opts: { bindTokens: true, components: true, prototype: true, replace: true, foundations: true }, tokens: DATA.tokens, pages });
  if (DATA.logo) await send('assets', { items: [assetItem(DATA.logo.id)] });
  for (const s of screens) {
    const refs = [];
    (function walk(n) {
      (n.fills || []).forEach((f) => f.k === 'I' && refs.push(f.ref));
      if (n.t === 'V') { refs.push(n.ref); if (n.png) refs.push(n.png); }
      (n.c || []).forEach(walk);
    })(s.root);
    const items = refs.filter((r) => !sent.has(r)).map((r) => { sent.add(r); return assetItem(r); });
    if (items.length) await send('assets', { items });
    try {
      const ack = await send('screen', { rec: s.rec, root: s.root });
      if (ack.warnings && ack.warnings.length) notes.push(s.rec.id + ': ' + ack.warnings.join(' | '));
    } catch (e) {
      failedScreens++;
      fail('screen ' + s.rec.id + ': ' + e.message);
    }
  }
  const done = await send('finish', { logo: DATA.logo && DATA.logo.id, logoRatio: 1, stats: { screens: screens.length, pages: pages.length }, pageIndex: pages.map((t) => ({ title: t })) });
  console.log(`main.js: ${done.screens} screens, ${done.nodes} captured layers → ${stats.nodes} Figma nodes, ${done.icons} icon components, ${done.componentSets} component sets, ${done.links} prototype links, ${stats.instances} instances (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (done.warnings.length) {
    const grouped = {};
    done.warnings.forEach((w) => { const k = w.replace(/[\d.]+/g, '#').slice(0, 90); grouped[k] = (grouped[k] || 0) + 1; });
    console.log('Plugin notes (' + done.warnings.length + '):');
    Object.entries(grouped).slice(0, 25).forEach(([k, c]) => console.log('  ' + c + '× ' + k));
    const unexpected = done.warnings.filter((w) => !/is not available in this file/.test(w));
    if (unexpected.length) fail(unexpected.length + ' plugin notes (see above)');
  }
} catch (e) {
  fail('run: ' + e.message);
}

function assetItem(id) {
  const a = DATA.assets[id];
  if (!a) { fail('ui.html missing asset ' + id); return { id, kind: 'svg', text: '<svg/>' }; }
  return a.kind === 'svg' ? { id, kind: 'svg', text: a.text } : { id, kind: a.kind, bytes: new Uint8Array(Buffer.from(a.b64, 'base64')) };
}

try { const G = ctx.S.compGroups; console.log("component sets: " + Object.keys(G).map((k) => k + " (" + G[k].list.length + ")").join(", ")); const atoms = Object.keys(ctx.S.comps).filter((k) => /^(Button|Chip)/.test(k)).map((k) => ctx.S.comps[k].auto); console.log("atoms with auto layout kept: " + atoms.filter(Boolean).length + "/" + atoms.length); } catch (e) {}
console.log(`pages: ${document_.children.filter((p) => !p.removed).map((p) => p.name).join(', ')}`);
if (errors.length) {
  console.error('\nFAILED (' + errors.length + '):\n  ' + errors.slice(0, 40).join('\n  '));
  process.exit(1);
}
console.log('\nValidation passed.');
