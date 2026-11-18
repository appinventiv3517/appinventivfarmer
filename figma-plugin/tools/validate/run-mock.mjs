/*
 * Runs main.js end to end against a strict mock of the Figma Plugin API and
 * the real data pack, answering the plugin's requests the way ui.html does.
 * Fails on any invalid value the real API would reject (NaN geometry, colour
 * channels out of range, alpha inside a SOLID colour, text edits without a
 * loaded font, ranges past the end of a text, links to missing nodes…).
 *
 *   node tools/validate/run-mock.mjs [--dirs d1,d2] [--groups Home,Learn]
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { loadPack, loadImages } from '../pack.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA = join(ROOT, 'data');
const args = process.argv.slice(2);
const arg = (n) => {
  const i = args.indexOf('--' + n);
  return i >= 0 ? args[i + 1] : null;
};
const pack = loadPack();
const images = loadImages();

/* ---------------- Strict mock ---------------- */
const problems = [];
const fail = (msg) => {
  problems.push(msg);
  if (problems.length > 200) throw new Error('Too many problems');
};
const finite = (v, what) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${what} is not a finite number: ${v}`);
};
const unit = (v, what) => {
  finite(v, what);
  if (v < 0 || v > 1) fail(`${what} out of range 0..1: ${v}`);
};
function checkColor(c, alpha, what) {
  if (!c || typeof c !== 'object') return fail(what + ' missing colour');
  ['r', 'g', 'b'].forEach((k) => unit(c[k], `${what}.${k}`));
  if (alpha) unit(c.a, what + '.a');
  else if ('a' in c) fail(what + ' SOLID colour must not have an alpha channel');
}
function checkPaints(list, what) {
  if (!Array.isArray(list)) return fail(what + ' must be an array');
  for (const p of list) {
    if (p.boundVariables) continue;
    if (p.type === 'SOLID') {
      checkColor(p.color, false, what);
      if (p.opacity !== undefined) unit(p.opacity, what + '.opacity');
    } else if (p.type === 'GRADIENT_LINEAR' || p.type === 'GRADIENT_RADIAL') {
      const t = p.gradientTransform;
      if (!Array.isArray(t) || t.length !== 2 || t.some((r) => r.length !== 3)) fail(what + ' gradientTransform must be 2x3');
      else t.flat().forEach((v) => finite(v, what + ' gradientTransform'));
      if (!p.gradientStops || !p.gradientStops.length) fail(what + ' gradient needs stops');
      for (const s of p.gradientStops || []) {
        unit(s.position, what + ' stop.position');
        checkColor(s.color, true, what + ' stop');
      }
    } else if (p.type === 'IMAGE') {
      if (!hashes.has(p.imageHash)) fail(what + ' image hash unknown');
      if (!['FILL', 'FIT', 'CROP', 'TILE'].includes(p.scaleMode)) fail(what + ' bad scaleMode ' + p.scaleMode);
      if (p.imageTransform) p.imageTransform.flat().forEach((v) => finite(v, what + ' imageTransform'));
    } else fail(what + ' unknown paint type ' + p.type);
  }
}
function checkEffects(list, what) {
  for (const e of list) {
    if (!['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR'].includes(e.type)) fail(what + ' bad effect ' + e.type);
    finite(e.radius, what + ' effect radius');
    if (e.radius < 0) fail(what + ' negative blur');
    if (e.color) checkColor(e.color, true, what + ' effect');
    if (e.offset) {
      finite(e.offset.x, what + ' offset.x');
      finite(e.offset.y, what + ' offset.y');
    }
  }
}

let ids = 0;
const hashes = new Set();
const allNodes = new Map();
const loaded = new Set(['Inter|Regular']);
const FONT_LIST = [];
for (const fam of ['Plus Jakarta Sans', 'Inter', 'Noto Sans Devanagari', 'Noto Sans Gurmukhi', 'Noto Sans Gujarati', 'Noto Sans Oriya', 'Noto Sans Telugu']) {
  for (const st of ['ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Italic', 'Light Italic', 'Medium Italic', 'SemiBold Italic', 'Bold Italic', 'ExtraBold Italic']) FONT_LIST.push({ fontName: { family: fam, style: st } });
}

class Node {
  constructor(type) {
    this.id = '1:' + ++ids;
    this.type = type;
    this.children = [];
    this.parent = null;
    this._name = type;
    this._x = 0;
    this._y = 0;
    this.width = 100;
    this.height = 100;
    this._fills = [];
    this.strokes = [];
    this._effects = [];
    this.reactions = [];
    this.removed = false;
    this.plugin = {};
    allNodes.set(this.id, this);
  }
  get name() {
    return this._name;
  }
  set name(v) {
    if (typeof v !== 'string') fail('name must be a string');
    this._name = v;
  }
  get x() {
    return this._x;
  }
  set x(v) {
    finite(v, this.type + ' x');
    this._x = v;
  }
  get y() {
    return this._y;
  }
  set y(v) {
    finite(v, this.type + ' y');
    this._y = v;
  }
  get fills() {
    return this._fills;
  }
  set fills(v) {
    checkPaints(v, this.type + ' fills');
    this._fills = v;
  }
  get effects() {
    return this._effects;
  }
  set effects(v) {
    checkEffects(v, this.type);
    this._effects = v;
  }
  set opacity(v) {
    unit(v, 'opacity');
  }
  set cornerRadius(v) {
    finite(v, 'cornerRadius');
  }
  set topLeftRadius(v) {
    finite(v, 'radius');
  }
  set topRightRadius(v) {
    finite(v, 'radius');
  }
  set bottomLeftRadius(v) {
    finite(v, 'radius');
  }
  set bottomRightRadius(v) {
    finite(v, 'radius');
  }
  set strokeWeight(v) {
    finite(v, 'strokeWeight');
  }
  resize(w, h) {
    finite(w, 'width');
    finite(h, 'height');
    if (w < 0.01 || h < 0.01) fail(`resize below 0.01: ${w}x${h}`);
    this.width = w;
    this.height = h;
  }
  resizeWithoutConstraints(w, h) {
    this.resize(w, h);
  }
  rescale(s) {
    finite(s, 'rescale');
    if (s <= 0) fail('rescale <= 0');
    this.width *= s;
    this.height *= s;
  }
  appendChild(n) {
    if (this.type === 'TEXT' || this.type === 'RECTANGLE') fail('appendChild on ' + this.type);
    if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1);
    n.parent = this;
    this.children.push(n);
  }
  remove() {
    this.removed = true;
    if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
  setPluginData(k, v) {
    if (typeof v !== 'string') fail('pluginData must be a string');
    this.plugin[k] = v;
  }
  async setReactionsAsync(r) {
    for (const x of r) for (const a of x.actions) if (a.type === 'NODE' && !allNodes.has(a.destinationId)) fail('reaction to missing node');
    this.reactions = r;
  }
  async setTextStyleIdAsync() {}
  async setEffectStyleIdAsync() {}
  createInstance() {
    if (this.type !== 'COMPONENT') fail('createInstance on ' + this.type);
    const i = new Node('INSTANCE');
    i.mainComponent = this;
    i.width = this.width;
    i.height = this.height;
    return i;
  }
}
class TextNode extends Node {
  constructor() {
    super('TEXT');
    this._chars = '';
    this._font = { family: 'Inter', style: 'Regular' };
  }
  get fontName() {
    return this._font;
  }
  set fontName(f) {
    if (!loaded.has(f.family + '|' + f.style)) fail('font not loaded: ' + f.family + ' ' + f.style);
    this._font = f;
  }
  get characters() {
    return this._chars;
  }
  set characters(v) {
    if (!loaded.has(this._font.family + '|' + this._font.style)) fail('characters set with unloaded font');
    this._chars = v;
  }
  _range(a, b, what) {
    if (!(a >= 0 && b <= this._chars.length && a < b)) fail(`${what} range ${a}-${b} invalid for length ${this._chars.length}`);
  }
  setRangeFontName(a, b, f) {
    this._range(a, b, 'setRangeFontName');
    if (!loaded.has(f.family + '|' + f.style)) fail('range font not loaded: ' + f.family + ' ' + f.style);
  }
  setRangeFontSize(a, b, s) {
    this._range(a, b, 'fontSize');
    finite(s, 'fontSize');
    if (s < 1) fail('fontSize < 1');
  }
  setRangeFills(a, b, f) {
    this._range(a, b, 'fills');
    checkPaints(f, 'text fills');
  }
  setRangeLetterSpacing(a, b, v) {
    this._range(a, b, 'letterSpacing');
    finite(v.value, 'letterSpacing');
  }
  setRangeTextDecoration(a, b) {
    this._range(a, b, 'decoration');
  }
  setRangeTextCase(a, b) {
    this._range(a, b, 'case');
  }
  set lineHeight(v) {
    if (v.unit === 'PIXELS') finite(v.value, 'lineHeight');
  }
  set textAutoResize(v) {
    if (!['NONE', 'HEIGHT', 'WIDTH_AND_HEIGHT', 'TRUNCATE'].includes(v)) fail('bad textAutoResize ' + v);
  }
  set textAlignHorizontal(v) {
    if (!['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'].includes(v)) fail('bad align ' + v);
  }
  set fontSize(v) {
    finite(v, 'fontSize');
  }
}

const pages = [];
const makePage = () => {
  const p = new Node('PAGE');
  p.flowStartingPoints = [];
  p.loadAsync = async () => {};
  pages.push(p);
  return p;
};
const root = { children: pages };
let current = makePage();
current.name = 'Page 1';
const collections = [];
const variables = [];
const textStyles = [];
const effectStyles = [];
let uiHandler = null;
let done = null;
const outbox = [];

const figma = {
  showUI() {},
  ui: {
    postMessage: (m) => outbox.push(m),
    set onmessage(fn) {
      uiHandler = fn;
    },
    resize() {},
  },
  root,
  get currentPage() {
    return current;
  },
  async setCurrentPageAsync(p) {
    current = p;
  },
  notify() {},
  closePlugin() {},
  createPage() {
    return makePage();
  },
  createFrame() {
    const n = new Node('FRAME');
    n._fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    current.appendChild(n);
    return n;
  },
  createRectangle() {
    const n = new Node('RECTANGLE');
    current.appendChild(n);
    return n;
  },
  createText() {
    const n = new TextNode();
    current.appendChild(n);
    return n;
  },
  createComponent() {
    const n = new Node('COMPONENT');
    current.appendChild(n);
    return n;
  },
  createSection() {
    const n = new Node('SECTION');
    current.appendChild(n);
    return n;
  },
  createComponentFromNode(node) {
    if (node.type !== 'FRAME') fail('createComponentFromNode on ' + node.type);
    node.type = 'COMPONENT';
    return node;
  },
  combineAsVariants(list, parent) {
    if (!list.length) fail('combineAsVariants with none');
    const names = new Set();
    for (const c of list) {
      if (c.type !== 'COMPONENT') fail('combineAsVariants with ' + c.type);
      if (!/=/.test(c.name)) fail('variant name without property: ' + c.name);
      if (names.has(c.name)) fail('duplicate variant name: ' + c.name);
      names.add(c.name);
    }
    const set = new Node('COMPONENT_SET');
    parent.appendChild(set);
    list.forEach((c) => set.appendChild(c));
    return set;
  },
  createNodeFromSvg(svg) {
    if (typeof svg !== 'string' || !svg.startsWith('<svg')) throw new Error('Invalid SVG');
    const n = new Node('FRAME');
    const w = svg.match(/width="([\d.]+)/);
    const h = svg.match(/height="([\d.]+)/);
    n.width = w ? +w[1] : 100;
    n.height = h ? +h[1] : 100;
    current.appendChild(n);
    return n;
  },
  createImage(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < 8) fail('createImage needs bytes');
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!png && !jpg) fail('image is neither PNG nor JPEG');
    const hash = 'h' + hashes.size;
    hashes.add(hash);
    return { hash };
  },
  base64Decode: (s) => new Uint8Array(Buffer.from(s, 'base64')),
  async listAvailableFontsAsync() {
    return FONT_LIST;
  },
  async loadFontAsync(f) {
    if (!FONT_LIST.some((x) => x.fontName.family === f.family && x.fontName.style === f.style)) throw new Error('Font not found ' + f.family + ' ' + f.style);
    loaded.add(f.family + '|' + f.style);
  },
  createTextStyle() {
    const s = { id: 'S:t' + textStyles.length, name: '', fontName: null, fontSize: 12 };
    textStyles.push(s);
    return s;
  },
  createEffectStyle() {
    const s = {
      id: 'S:e' + effectStyles.length,
      name: '',
      set effects(v) {
        checkEffects(v, 'effect style');
      },
    };
    effectStyles.push(s);
    return s;
  },
  async getLocalTextStylesAsync() {
    return textStyles;
  },
  async getLocalEffectStylesAsync() {
    return effectStyles;
  },
  variables: {
    createVariableCollection(name) {
      const c = { id: 'VC:' + collections.length, name, modes: [{ modeId: 'm1', name: 'Mode 1' }], renameMode() {} };
      collections.push(c);
      return c;
    },
    createVariable(name, col, type) {
      if (variables.some((v) => v.name === name && v.variableCollectionId === col.id)) fail('duplicate variable ' + name);
      const v = {
        id: 'V:' + variables.length,
        name,
        type,
        variableCollectionId: col.id,
        setValueForMode(m, val) {
          if (type === 'COLOR') checkColor(val, true, 'variable ' + name);
          else finite(val, 'variable ' + name);
        },
      };
      variables.push(v);
      return v;
    },
    async getLocalVariableCollectionsAsync() {
      return collections;
    },
    async getLocalVariablesAsync() {
      return variables;
    },
    setBoundVariableForPaint(p, field, v) {
      return { ...p, boundVariables: { color: { type: 'VARIABLE_ALIAS', id: v.id } } };
    },
  },
};

/* ---------------- UI side ---------------- */
function answer(msg) {
  const p = msg.payload;
  let data = null;
  switch (msg.what) {
    case 'manifest':
      data = pack.manifest;
      break;
    case 'foundation':
      data = pack.foundations[p];
      break;
    case 'components':
      data = pack.components[p];
      break;
    case 'screen':
      data = pack.screens[p];
      break;
    case 'svg':
      data = pack.svgs[p];
      break;
    case 'image':
      data = images[p] ? images[p].data : null;
      break;
  }
  // Deep copy, as postMessage would.
  return { type: 'response', id: msg.id, data: data == null ? null : JSON.parse(JSON.stringify(data)) };
}

const ctx = vm.createContext({ figma, __html__: '<html></html>', console, setTimeout, Promise, Object, Array, JSON, Math, Number, String, Error, RegExp });
vm.runInContext(readFileSync(join(ROOT, 'main.js'), 'utf8'), ctx, { filename: 'main.js' });

const t0 = Date.now();
const opts = { directions: arg('dirs') ? arg('dirs').split(',') : undefined, groups: arg('groups') ? arg('groups').split(',') : undefined };
uiHandler({ type: 'start', options: opts });
const logs = [];
await new Promise((resolve) => {
  const pump = () => {
    while (outbox.length) {
      const m = outbox.shift();
      if (m.type === 'request') setTimeout(() => uiHandler(answer(m)), 0);
      else if (m.type === 'log') logs.push(m.level + ': ' + m.text);
      else if (m.type === 'done' || m.type === 'failed') {
        done = m;
        return resolve();
      }
    }
    setTimeout(pump, 0);
  };
  pump();
});

const countType = {};
for (const n of allNodes.values()) if (!n.removed) countType[n.type] = (countType[n.type] || 0) + 1;
const links = [...allNodes.values()].filter((n) => n.reactions && n.reactions.length).length;
console.log(JSON.stringify({ result: done.type, summary: done.summary || done.error, seconds: Math.round((Date.now() - t0) / 1000), pages: pages.map((p) => p.name + ' (' + p.children.length + ')'), nodes: countType, reactions: links, variables: variables.length, textStyles: textStyles.length, effectStyles: effectStyles.length, images: hashes.size }, null, 1));
if (logs.length) console.log('Plugin log:\n  ' + logs.slice(0, 20).join('\n  '));
if (problems.length) {
  console.log(`\n${problems.length} PROBLEMS:`);
  const counts = {};
  problems.forEach((p) => (counts[p] = (counts[p] || 0) + 1));
  Object.entries(counts)
    .slice(0, 40)
    .forEach(([p, n]) => console.log(`  ${n}× ${p}`));
  process.exit(1);
}
if (done.type !== 'done') process.exit(1);
console.log('\nVALID: no API violations.');
