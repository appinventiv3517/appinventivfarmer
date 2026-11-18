/*
 * Kisani Urjaa · Figma importer (plugin main thread)
 *
 * Rebuilds the Kisani Urjaa farmer app inside Figma as editable layers:
 * variables and styles, component sets with variants, every screen and every
 * captured UI state, and prototype links between screens.
 *
 * The data pack (captured from the running app by tools/capture.mjs) lives in
 * ui.html. This thread asks the UI for one piece at a time, so memory stays low
 * and progress can be reported.
 */

'use strict';

var UI_W = 440;
var UI_H = 620;
figma.showUI(__html__, { width: UI_W, height: UI_H, title: 'Kisani Urjaa → Figma' });

/* ------------------------------------------------------------------ */
/* Messaging with the UI (request / response)                          */
/* ------------------------------------------------------------------ */

var pending = {};
var seq = 0;
function ask(type, payload) {
  return new Promise(function (resolve, reject) {
    var id = ++seq;
    pending[id] = { resolve: resolve, reject: reject };
    figma.ui.postMessage({ type: 'request', id: id, what: type, payload: payload || null });
  });
}
function progress(text, done, total) {
  figma.ui.postMessage({ type: 'progress', text: text, done: done || 0, total: total || 0 });
}
function log(level, text) {
  figma.ui.postMessage({ type: 'log', level: level, text: text });
}

var cancelled = false;
var running = false;

figma.ui.onmessage = function (msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'response' && pending[msg.id]) {
    var p = pending[msg.id];
    delete pending[msg.id];
    if (msg.error) p.reject(new Error(msg.error));
    else p.resolve(msg.data);
    return;
  }
  if (msg.type === 'start') {
    if (running) return;
    running = true;
    cancelled = false;
    run(msg.options || {})
      .then(function (summary) {
        figma.ui.postMessage({ type: 'done', summary: summary });
        figma.notify('Kisani Urjaa imported: ' + summary.screens + ' screens, ' + summary.components + ' components');
      })
      .catch(function (err) {
        var text = err && err.message ? err.message : String(err);
        log('error', text);
        figma.ui.postMessage({ type: 'failed', error: text });
        figma.notify('Import stopped: ' + text, { error: true });
      })
      .then(function () {
        running = false;
      });
  }
  if (msg.type === 'cancel') cancelled = true;
  if (msg.type === 'close') figma.closePlugin();
  if (msg.type === 'resize') figma.ui.resize(UI_W, msg.height || UI_H);
};

function checkCancel() {
  if (cancelled) throw new Error('Cancelled by you. Layers created so far are kept.');
}
function tick() {
  return new Promise(function (r) {
    setTimeout(r, 0);
  });
}

/* ------------------------------------------------------------------ */
/* Fonts                                                               */
/* ------------------------------------------------------------------ */

var STYLE_BY_WEIGHT = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
var available = null; // family -> { style: true }
var loadedFonts = {};
var fontFallbackWarned = {};

/** Scripts that Plus Jakarta Sans does not cover, and the Noto family Figma offers for each. */
var SCRIPTS = [
  { re: /[ऀ-ॿ]/, family: 'Noto Sans Devanagari' },
  { re: /[਀-੿]/, family: 'Noto Sans Gurmukhi' },
  { re: /[઀-૿]/, family: 'Noto Sans Gujarati' },
  { re: /[଀-୿]/, family: 'Noto Sans Oriya' },
  { re: /[ఀ-౿]/, family: 'Noto Sans Telugu' },
  { re: /[₹]/, family: null }, // ₹ is in Plus Jakarta Sans
];

async function loadAvailableFonts() {
  if (available) return;
  available = {};
  var list = await figma.listAvailableFontsAsync();
  for (var i = 0; i < list.length; i++) {
    var f = list[i].fontName;
    if (!available[f.family]) available[f.family] = {};
    available[f.family][f.style] = true;
  }
}

function styleName(weight, italic) {
  var w = Math.min(900, Math.max(100, Math.round(weight / 100) * 100));
  var base = STYLE_BY_WEIGHT[w] || 'Regular';
  if (!italic) return base;
  return base === 'Regular' ? 'Italic' : base + ' Italic';
}

/** Nearest available FontName for a family/weight/italic, falling back to Inter. */
function resolveFont(family, weight, italic) {
  var fams = [family, 'Inter', 'Roboto'];
  for (var i = 0; i < fams.length; i++) {
    var fam = fams[i];
    var styles = available[fam];
    if (!styles) continue;
    var want = styleName(weight, italic);
    if (styles[want]) return { family: fam, style: want };
    // Nearest weight with the same italic flag.
    var best = null;
    var bestD = 1e9;
    for (var w = 100; w <= 900; w += 100) {
      var s = styleName(w, italic);
      if (styles[s] && Math.abs(w - weight) < bestD) {
        best = s;
        bestD = Math.abs(w - weight);
      }
    }
    if (!best && italic) return resolveFont(fam, weight, false);
    if (best) {
      if (fam !== family && !fontFallbackWarned[family]) {
        fontFallbackWarned[family] = true;
        log('warn', family + ' is not available in this Figma account; using ' + fam + '. Install it and run the import again for exact type.');
      }
      return { family: fam, style: best };
    }
  }
  return { family: 'Inter', style: 'Regular' };
}

async function ensureFont(fn) {
  var key = fn.family + '|' + fn.style;
  if (loadedFonts[key]) return fn;
  try {
    await figma.loadFontAsync(fn);
    loadedFonts[key] = true;
    return fn;
  } catch (e) {
    var fb = { family: 'Inter', style: 'Regular' };
    await figma.loadFontAsync(fb);
    loadedFonts[fb.family + '|' + fb.style] = true;
    return fb;
  }
}

function scriptFamilyFor(ch) {
  for (var i = 0; i < SCRIPTS.length; i++) if (SCRIPTS[i].re.test(ch)) return SCRIPTS[i].family;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Paints, effects and variables                                       */
/* ------------------------------------------------------------------ */

function rgb(c) {
  return { r: clamp01(c[0]), g: clamp01(c[1]), b: clamp01(c[2]) };
}
function rgba(c) {
  return { r: clamp01(c[0]), g: clamp01(c[1]), b: clamp01(c[2]), a: clamp01(c[3] === undefined ? 1 : c[3]) };
}
function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0));
}
function colorKey(c) {
  return [c[0], c[1], c[2], c[3] === undefined ? 1 : c[3]]
    .map(function (n) {
      return Math.round(n * 255);
    })
    .join(',');
}

var images = {}; // data-pack image key -> Figma image hash
var colorVars = {}; // colorKey -> Variable (current direction)

async function imageHash(key) {
  if (images[key]) return images[key];
  var b64 = await ask('image', key);
  if (!b64) return null;
  var img = figma.createImage(figma.base64Decode(b64));
  images[key] = img.hash;
  return img.hash;
}

async function makePaint(p) {
  if (p.k === 'S') {
    var paint = { type: 'SOLID', color: rgb(p.c), opacity: clamp01(p.c[3]) };
    var v = colorVars[colorKey(p.c)];
    if (v && figma.variables && figma.variables.setBoundVariableForPaint) {
      try {
        paint = figma.variables.setBoundVariableForPaint(paint, 'color', v);
      } catch (e) {
        /* keep the raw colour */
      }
    }
    return paint;
  }
  if (p.k === 'L' || p.k === 'R') {
    return {
      type: p.k === 'L' ? 'GRADIENT_LINEAR' : 'GRADIENT_RADIAL',
      gradientTransform: [
        [p.m[0], p.m[1], p.m[2]],
        [p.m[3], p.m[4], p.m[5]],
      ],
      gradientStops: p.st.map(function (s) {
        return { position: clamp01(s[0]), color: rgba([s[1], s[2], s[3], s[4]]) };
      }),
    };
  }
  if (p.k === 'I') {
    var hash = await imageHash(p.id);
    if (!hash) return null;
    var ip = { type: 'IMAGE', imageHash: hash, scaleMode: p.mode || 'FILL' };
    if (p.mode === 'TILE') ip.scalingFactor = p.sf || 1;
    if (p.mode === 'CROP' && p.tf) {
      ip.imageTransform = [
        [p.tf[0], p.tf[1], p.tf[2]],
        [p.tf[3], p.tf[4], p.tf[5]],
      ];
    }
    return ip;
  }
  return null;
}

async function makePaints(list) {
  var out = [];
  for (var i = 0; i < (list || []).length; i++) {
    var p = await makePaint(list[i]);
    if (p) out.push(p);
  }
  return out;
}

function makeEffects(list) {
  var out = [];
  for (var i = 0; i < (list || []).length; i++) {
    var e = list[i];
    if (e.k === 'DS' || e.k === 'IS') {
      out.push({ type: e.k === 'DS' ? 'DROP_SHADOW' : 'INNER_SHADOW', color: rgba(e.c), offset: { x: e.x || 0, y: e.y || 0 }, radius: Math.max(0, e.b || 0), spread: e.s || 0, visible: true, blendMode: 'NORMAL' });
    } else if (e.k === 'LB' || e.k === 'BB') {
      out.push({ type: e.k === 'LB' ? 'LAYER_BLUR' : 'BACKGROUND_BLUR', radius: Math.max(0, e.b || 0), visible: true });
    }
  }
  return out;
}

function setEffects(node, list) {
  if (!list || !list.length) return;
  var fx = makeEffects(list);
  try {
    node.effects = fx;
  } catch (e) {
    // Newer Figma versions want blurType on blur effects.
    try {
      node.effects = fx.map(function (f) {
        return f.type === 'LAYER_BLUR' || f.type === 'BACKGROUND_BLUR' ? Object.assign({ blurType: 'NORMAL' }, f) : f;
      });
    } catch (e2) {
      /* effects are decorative; skip */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Node builders                                                       */
/* ------------------------------------------------------------------ */

var stats = { nodes: 0, vectorsFailed: 0, imagesFailed: 0 };
var keyIndex = {}; // current screen: DOM key -> SceneNode (for prototype links)
var svgCache = {};

function place(node, d) {
  node.x = d.x || 0;
  node.y = d.y || 0;
}

function safeResize(node, w, h) {
  try {
    node.resize(Math.max(0.01, w || 0.01), Math.max(0.01, h || 0.01));
  } catch (e) {
    /* some nodes cannot be resized */
  }
}

async function buildFrame(d, parent) {
  var f = figma.createFrame();
  parent.appendChild(f);
  f.name = d.n || 'Frame';
  place(f, d);
  safeResize(f, d.w, d.h);
  f.fills = await makePaints(d.f);
  f.clipsContent = !!d.c;
  if (d.s) {
    f.strokes = [{ type: 'SOLID', color: rgb(d.s.c), opacity: clamp01(d.s.c[3]) }];
    f.strokeAlign = 'INSIDE';
    var w = d.s.w;
    if (w[0] === w[1] && w[1] === w[2] && w[2] === w[3]) f.strokeWeight = w[0];
    else {
      f.strokeTopWeight = w[0];
      f.strokeRightWeight = w[1];
      f.strokeBottomWeight = w[2];
      f.strokeLeftWeight = w[3];
    }
    if (d.s.d) f.dashPattern = d.s.d;
  }
  if (d.r) {
    f.topLeftRadius = d.r[0];
    f.topRightRadius = d.r[1];
    f.bottomRightRadius = d.r[2];
    f.bottomLeftRadius = d.r[3];
  }
  if (d.op !== undefined) f.opacity = d.op;
  if (d.bm) {
    try {
      f.blendMode = d.bm;
    } catch (e) {
      /* unsupported blend mode */
    }
  }
  setEffects(f, d.fx);
  if (d.k !== undefined) keyIndex[d.k] = f;
  if (d.dis) f.setPluginData('disabled', '1');
  stats.nodes++;
  if (d.ch) for (var i = 0; i < d.ch.length; i++) await build(d.ch[i], f);
  return f;
}

async function buildText(d, parent) {
  var t = figma.createText();
  parent.appendChild(t);
  // Split runs further by script so Indic text gets a font that has its glyphs.
  var runs = [];
  for (var i = 0; i < d.seg.length; i++) {
    var s = d.seg[i];
    var cur = null;
    for (var j = 0; j < s.c.length; j++) {
      var ch = s.c[j];
      var fam = scriptFamilyFor(ch);
      var family = fam === undefined || fam === null ? s.f : fam;
      if (ch === ' ' && cur) family = cur.family;
      if (!cur || cur.family !== family) {
        cur = { c: '', family: family, s: s };
        runs.push(cur);
      }
      cur.c += ch;
    }
  }
  var chars = runs
    .map(function (r) {
      return r.c;
    })
    .join('');
  if (!chars) {
    t.remove();
    return null;
  }
  var first = await ensureFont(resolveFont(runs[0].family, runs[0].s.wt, runs[0].s.it));
  t.fontName = first;
  t.characters = chars;
  var pos = 0;
  for (var k = 0; k < runs.length; k++) {
    var r = runs[k];
    var st = r.s;
    var end = pos + r.c.length;
    var fn = await ensureFont(resolveFont(r.family, st.wt, st.it));
    t.setRangeFontName(pos, end, fn);
    t.setRangeFontSize(pos, end, Math.max(1, st.sz || 12));
    var fill = await makePaint({ k: 'S', c: st.col });
    t.setRangeFills(pos, end, [fill]);
    if (st.ls) t.setRangeLetterSpacing(pos, end, { unit: 'PIXELS', value: st.ls });
    if (st.td) t.setRangeTextDecoration(pos, end, st.td === 'U' ? 'UNDERLINE' : 'STRIKETHROUGH');
    if (st.tc) t.setRangeTextCase(pos, end, st.tc === 'UPPER' ? 'UPPER' : st.tc === 'LOWER' ? 'LOWER' : 'TITLE');
    pos = end;
  }
  if (d.lh) t.lineHeight = { unit: 'PIXELS', value: d.lh };
  if (d.al) t.textAlignHorizontal = d.al === 'C' ? 'CENTER' : d.al === 'R' ? 'RIGHT' : d.al === 'J' ? 'JUSTIFIED' : 'LEFT';
  t.name = d.n || chars.slice(0, 40);
  if (d.ml) {
    t.textAutoResize = 'HEIGHT';
    safeResize(t, d.w, d.h);
    t.textAutoResize = 'HEIGHT';
  } else {
    t.textAutoResize = 'WIDTH_AND_HEIGHT';
  }
  if (d.el) {
    try {
      t.textAutoResize = 'NONE';
      safeResize(t, d.w, d.h);
      t.textTruncation = 'ENDING';
    } catch (e) {
      /* older API */
    }
  }
  place(t, d);
  if (d.op !== undefined) t.opacity = d.op;
  setEffects(t, d.fx);
  stats.nodes++;
  return t;
}

async function buildVector(d, parent) {
  var svg = d.svg || svgCache[d.sv];
  if (!svg && d.sv) {
    svg = await ask('svg', d.sv);
    svgCache[d.sv] = svg;
  }
  var node = null;
  try {
    node = figma.createNodeFromSvg(svg);
  } catch (e) {
    stats.vectorsFailed++;
    node = figma.createFrame();
    node.fills = [];
    node.name = (d.n || 'Vector') + ' (SVG could not be imported)';
  }
  parent.appendChild(node);
  if (node.name === 'Frame' || node.name === 'svg' || node.name.indexOf('(SVG') < 0) node.name = d.n || 'Vector';
  if (node.type === 'FRAME') {
    node.clipsContent = false;
    if (Math.abs(node.width - d.w) > 0.5 || Math.abs(node.height - d.h) > 0.5) {
      try {
        node.rescale(d.w / Math.max(0.01, node.width));
      } catch (e) {
        safeResize(node, d.w, d.h);
      }
    }
  }
  place(node, d);
  if (d.op !== undefined) node.opacity = d.op;
  stats.nodes++;
  return node;
}

async function build(d, parent) {
  if (!d) return null;
  if (d.t === 'T') return buildText(d, parent);
  if (d.t === 'V') return buildVector(d, parent);
  return buildFrame(d, parent);
}

/* ------------------------------------------------------------------ */
/* Foundations: variables, styles, specimens                           */
/* ------------------------------------------------------------------ */

async function findCollection(name) {
  var cols = await figma.variables.getLocalVariableCollectionsAsync();
  for (var i = 0; i < cols.length; i++) if (cols[i].name === name) return cols[i];
  return null;
}

/** Creates (or updates) a variable collection for a direction's tokens. */
async function buildVariables(dirMeta, tokens) {
  colorVars = {};
  if (!figma.variables || !figma.variables.createVariableCollection) {
    log('warn', 'This Figma version has no Variables API; colours are applied as raw values.');
    return 0;
  }
  var name = dirMeta.title + ' · Tokens';
  var col = (await findCollection(name)) || figma.variables.createVariableCollection(name);
  var modeId = col.modes[0].modeId;
  try {
    col.renameMode(modeId, 'Light');
  } catch (e) {
    /* fine */
  }
  var existing = {};
  var all = await figma.variables.getLocalVariablesAsync();
  for (var i = 0; i < all.length; i++) if (all[i].variableCollectionId === col.id) existing[all[i].name] = all[i];
  var count = 0;
  // Semantic tokens first so on-screen colours bind to them before raw palette entries.
  var list = tokens.slice().sort(function (a, b) {
    return (a.raw ? 1 : 0) - (b.raw ? 1 : 0);
  });
  for (var j = 0; j < list.length; j++) {
    var tk = list[j];
    var vname = tk.group + '/' + tk.name;
    try {
      if (tk.type === 'color') {
        var v = existing[vname] || figma.variables.createVariable(vname, col, 'COLOR');
        v.setValueForMode(modeId, rgba(tk.value));
        if (tk.css) v.description = 'CSS ' + tk.css;
        var key = colorKey(tk.value);
        if (!colorVars[key]) colorVars[key] = v;
        try {
          v.scopes = ['ALL_FILLS', 'STROKE_COLOR', 'EFFECT_COLOR'];
        } catch (e) {
          /* scopes are optional */
        }
        count++;
      } else if (tk.type === 'number') {
        var nv = existing[vname] || figma.variables.createVariable(vname, col, 'FLOAT');
        nv.setValueForMode(modeId, tk.value);
        if (tk.css) nv.description = 'CSS ' + tk.css;
        try {
          if (tk.group === 'radius') nv.scopes = ['CORNER_RADIUS'];
          else if (tk.group === 'space') nv.scopes = ['GAP', 'WIDTH_HEIGHT'];
        } catch (e) {
          /* scopes are optional */
        }
        count++;
      }
    } catch (e) {
      log('warn', 'Variable ' + vname + ': ' + e.message);
    }
  }
  return count;
}

var textStyleByName = {};
async function buildTextStyles(dirMeta, styles) {
  var made = [];
  var locals = await figma.getLocalTextStylesAsync();
  for (var i = 0; i < styles.length; i++) {
    var s = styles[i];
    var name = dirMeta.title + '/' + s.name;
    var ts = null;
    for (var j = 0; j < locals.length; j++) if (locals[j].name === name) ts = locals[j];
    if (!ts) ts = figma.createTextStyle();
    ts.name = name;
    var fn = await ensureFont(resolveFont(s.family, s.weight, s.italic));
    ts.fontName = fn;
    ts.fontSize = s.size;
    if (s.lineHeight) ts.lineHeight = { unit: 'PIXELS', value: s.lineHeight };
    if (s.letterSpacing) ts.letterSpacing = { unit: 'PIXELS', value: s.letterSpacing };
    if (s.textCase) ts.textCase = s.textCase;
    if (s.css) ts.description = s.css;
    textStyleByName[name] = ts;
    made.push({ style: ts, sample: s.sample || s.name });
  }
  return made;
}

async function buildEffectStyles(dirMeta, effects) {
  var made = [];
  var locals = await figma.getLocalEffectStylesAsync();
  for (var i = 0; i < effects.length; i++) {
    var e = effects[i];
    var name = dirMeta.title + '/' + e.name;
    var es = null;
    for (var j = 0; j < locals.length; j++) if (locals[j].name === name) es = locals[j];
    if (!es) es = figma.createEffectStyle();
    es.name = name;
    try {
      es.effects = makeEffects(e.fx);
    } catch (err) {
      /* skip */
    }
    made.push(es);
  }
  return made;
}

/* ---------- Layout helpers for documentation frames ---------- */

async function label(parent, text, size, weight, color, x, y, width) {
  var t = figma.createText();
  var fn = await ensureFont(resolveFont('Plus Jakarta Sans', weight || 400, false));
  t.fontName = fn;
  t.characters = String(text);
  t.fontSize = size || 14;
  t.fills = [{ type: 'SOLID', color: rgb(color || [0.15, 0.13, 0.12]) }];
  parent.appendChild(t);
  t.x = x || 0;
  t.y = y || 0;
  if (width) {
    t.textAutoResize = 'HEIGHT';
    t.resize(width, t.height);
  }
  return t;
}

function docFrame(name, page, x, y, w, h, fill) {
  var f = figma.createFrame();
  page.appendChild(f);
  f.name = name;
  f.x = x;
  f.y = y;
  f.resize(w, h);
  f.fills = [{ type: 'SOLID', color: rgb(fill || [1, 1, 1]) }];
  f.cornerRadius = 28;
  return f;
}

async function buildFoundationsPage(page, dirMeta, foundation) {
  var X = 0;
  var made = { variables: 0, textStyles: 0, effectStyles: 0 };
  made.variables = await buildVariables(dirMeta, foundation.tokens || []);
  var textStyles = await buildTextStyles(dirMeta, foundation.textStyles || []);
  made.textStyles = textStyles.length;
  var effectStyles = await buildEffectStyles(dirMeta, foundation.effects || []);
  made.effectStyles = effectStyles.length;

  // Colour board.
  var colours = (foundation.tokens || []).filter(function (t) {
    return t.type === 'color';
  });
  var groups = {};
  colours.forEach(function (c) {
    (groups[c.group] = groups[c.group] || []).push(c);
  });
  var gnames = Object.keys(groups);
  var cols = 6;
  var sw = 150;
  var rows = 0;
  gnames.forEach(function (g) {
    rows += 1 + Math.ceil(groups[g].length / cols);
  });
  var board = docFrame('Colour · ' + dirMeta.title, page, X, 0, cols * (sw + 16) + 64, rows * 130 + 120);
  await label(board, 'Colour', 32, 700, null, 32, 32);
  var y = 96;
  for (var gi = 0; gi < gnames.length; gi++) {
    var g = gnames[gi];
    await label(board, g, 16, 700, [0.4, 0.36, 0.33], 32, y);
    y += 32;
    var list = groups[g];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      var cx = 32 + (i % cols) * (sw + 16);
      var cy = y + Math.floor(i / cols) * 130;
      var chip = figma.createFrame();
      board.appendChild(chip);
      chip.name = g + '/' + c.name;
      chip.x = cx;
      chip.y = cy;
      chip.resize(sw, 64);
      chip.cornerRadius = 12;
      chip.fills = [await makePaint({ k: 'S', c: c.value })];
      chip.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.08 }];
      await label(board, c.name, 12, 600, null, cx, cy + 70, sw);
      await label(board, c.css || '', 10, 400, [0.45, 0.42, 0.4], cx, cy + 88, sw);
    }
    y += Math.ceil(list.length / cols) * 130 + 8;
  }
  board.resize(board.width, y + 32);
  X += board.width + 80;

  // Type board.
  if (textStyles.length) {
    var tb = docFrame('Type · ' + dirMeta.title, page, X, 0, 760, 120 + textStyles.length * 110);
    await label(tb, 'Typography · Plus Jakarta Sans', 32, 700, null, 32, 32);
    var ty = 110;
    for (var k = 0; k < textStyles.length; k++) {
      var ts = textStyles[k];
      await label(tb, ts.style.name.split('/').pop() + ' · ' + ts.style.fontSize + ' / ' + ts.style.fontName.style, 12, 600, [0.45, 0.42, 0.4], 32, ty);
      var sample = figma.createText();
      tb.appendChild(sample);
      sample.fontName = ts.style.fontName;
      sample.characters = ts.sample;
      try {
        await sample.setTextStyleIdAsync(ts.style.id);
      } catch (e) {
        try {
          sample.textStyleId = ts.style.id;
        } catch (e2) {
          /* keep raw */
        }
      }
      sample.x = 32;
      sample.y = ty + 20;
      ty += Math.max(80, sample.height + 40);
    }
    tb.resize(tb.width, ty + 32);
    X += tb.width + 80;
  }

  // Radius and effects board.
  var radii = (foundation.tokens || []).filter(function (t) {
    return t.type === 'number' && t.group === 'radius';
  });
  var rb = docFrame('Radius & elevation · ' + dirMeta.title, page, X, 0, 760, 420 + effectStyles.length * 0);
  await label(rb, 'Radius', 32, 700, null, 32, 32);
  for (var r = 0; r < radii.length; r++) {
    var box = figma.createRectangle();
    rb.appendChild(box);
    box.x = 32 + r * 100;
    box.y = 100;
    box.resize(84, 84);
    box.cornerRadius = Math.min(42, radii[r].value);
    box.fills = [{ type: 'SOLID', color: rgb([0.95, 0.92, 0.87]) }];
    box.strokes = [{ type: 'SOLID', color: rgb([0.6, 0.55, 0.5]) }];
    box.name = radii[r].name;
    await label(rb, radii[r].name, 11, 600, null, 32 + r * 100, 192, 90);
    await label(rb, radii[r].value + 'px', 11, 400, [0.45, 0.42, 0.4], 32 + r * 100, 208);
  }
  await label(rb, 'Elevation', 32, 700, null, 32, 260);
  for (var e = 0; e < effectStyles.length; e++) {
    var card = figma.createFrame();
    rb.appendChild(card);
    card.x = 32 + e * 180;
    card.y = 320;
    card.resize(150, 100);
    card.cornerRadius = 22;
    card.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
    try {
      await card.setEffectStyleIdAsync(effectStyles[e].id);
    } catch (err) {
      try {
        card.effectStyleId = effectStyles[e].id;
      } catch (err2) {
        /* skip */
      }
    }
    card.name = effectStyles[e].name;
    await label(rb, effectStyles[e].name.split('/').pop(), 12, 600, null, card.x, 432);
  }
  rb.resize(Math.max(760, radii.length * 100 + 64, effectStyles.length * 180 + 64), 480);
  return made;
}

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

async function buildComponentsPage(page, dirMeta, items) {
  // Group by component set name, keeping capture order.
  var sets = [];
  var bySet = {};
  items.forEach(function (it) {
    if (!bySet[it.set]) {
      bySet[it.set] = [];
      sets.push(it.set);
    }
    bySet[it.set].push(it);
  });
  var x = 0;
  var y = 0;
  var rowH = 0;
  var MAXW = 2400;
  var made = 0;
  var library = {};
  for (var s = 0; s < sets.length; s++) {
    checkCancel();
    var name = sets[s];
    progress(dirMeta.title + ' · components · ' + name, s, sets.length);
    var comps = [];
    var used = {};
    for (var i = 0; i < bySet[name].length; i++) {
      var it = bySet[name][i];
      if (used[it.variant]) continue;
      used[it.variant] = true;
      keyIndex = {};
      var holder = figma.createFrame();
      page.appendChild(holder);
      holder.fills = [];
      var root = await build(it.root, holder);
      var frame = root;
      if (!root || root.type !== 'FRAME') {
        // Wrap text or vectors so they can become components.
        frame = figma.createFrame();
        page.appendChild(frame);
        frame.fills = [];
        frame.resize(Math.max(1, it.root.w), Math.max(1, it.root.h));
        if (root) {
          frame.appendChild(root);
          root.x = 0;
          root.y = 0;
        }
      } else {
        page.appendChild(frame);
      }
      holder.remove();
      frame.x = 0;
      frame.y = 0;
      var comp = figma.createComponentFromNode(frame);
      comp.name = it.variant || 'Default';
      comps.push(comp);
      made++;
      await tick();
    }
    var node;
    if (comps.length > 1) {
      node = figma.combineAsVariants(comps, page);
      node.name = name;
      // Lay variants out in a grid inside the set.
      var cx = 24;
      var cy = 24;
      var rowMax = 0;
      var setW = 0;
      var limit = Math.max(800, Math.min(1600, comps[0].width * 4 + 120));
      for (var c = 0; c < comps.length; c++) {
        var comp2 = comps[c];
        if (cx + comp2.width > limit && cx > 24) {
          cx = 24;
          cy += rowMax + 24;
          rowMax = 0;
        }
        comp2.x = cx;
        comp2.y = cy;
        cx += comp2.width + 24;
        rowMax = Math.max(rowMax, comp2.height);
        setW = Math.max(setW, cx);
      }
      node.resizeWithoutConstraints(setW, cy + rowMax + 24);
      node.fills = [{ type: 'SOLID', color: rgb([0.98, 0.97, 0.95]) }];
      node.strokes = [{ type: 'SOLID', color: rgb([0.6, 0.35, 0.85]) }];
      node.dashPattern = [6, 4];
      node.cornerRadius = 16;
    } else {
      node = comps[0];
      node.name = name;
    }
    node.description = (bySet[name][0].doc || '') + ' Captured from the running app.';
    library[name] = node;
    if (x + node.width > MAXW && x > 0) {
      x = 0;
      y += rowH + 120;
      rowH = 0;
    }
    node.x = x;
    node.y = y + 48;
    await label(page, name, 20, 700, null, x, y);
    x += node.width + 120;
    rowH = Math.max(rowH, node.height + 48);
  }
  return { count: made, library: library };
}

/* ------------------------------------------------------------------ */
/* Device chrome: status bar and home indicator components             */
/* ------------------------------------------------------------------ */

var chrome = null;
async function buildChrome(page) {
  if (chrome) return chrome;
  var fnB = await ensureFont(resolveFont('Plus Jakarta Sans', 600, false));
  var make = async function (tone) {
    var c = figma.createComponent();
    page.appendChild(c);
    c.name = 'Tone=' + tone;
    c.resize(393, 54);
    c.fills = [];
    var col = tone === 'Light' ? { r: 1, g: 1, b: 1 } : { r: 0.1, g: 0.09, b: 0.08 };
    var t = figma.createText();
    c.appendChild(t);
    t.fontName = fnB;
    t.characters = '9:41';
    t.fontSize = 17;
    t.fills = [{ type: 'SOLID', color: col }];
    t.x = 52;
    t.y = 18;
    var island = figma.createRectangle();
    c.appendChild(island);
    island.resize(124, 36);
    island.cornerRadius = 18;
    island.x = 134;
    island.y = 11;
    island.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    island.name = 'Dynamic Island';
    for (var i = 0; i < 4; i++) {
      var bar = figma.createRectangle();
      c.appendChild(bar);
      bar.resize(3, 4 + i * 2.5);
      bar.cornerRadius = 1;
      bar.x = 286 + i * 5;
      bar.y = 30 - (4 + i * 2.5);
      bar.fills = [{ type: 'SOLID', color: col }];
      bar.name = 'Signal';
    }
    var batt = figma.createRectangle();
    c.appendChild(batt);
    batt.resize(25, 12);
    batt.cornerRadius = 4;
    batt.x = 316;
    batt.y = 19;
    batt.fills = [];
    batt.strokes = [{ type: 'SOLID', color: col, opacity: 0.4 }];
    batt.name = 'Battery';
    var lvl = figma.createRectangle();
    c.appendChild(lvl);
    lvl.resize(19, 8);
    lvl.cornerRadius = 2;
    lvl.x = 319;
    lvl.y = 21;
    lvl.fills = [{ type: 'SOLID', color: col }];
    lvl.name = 'Level';
    return c;
  };
  var dark = await make('Dark');
  var light = await make('Light');
  var set = figma.combineAsVariants([dark, light], page);
  set.name = 'Status bar';
  light.x = 413;
  set.resizeWithoutConstraints(826, 74);
  dark.y = light.y = 10;
  dark.x = 10;
  set.x = 0;
  set.y = -220;

  var homeMake = function (tone) {
    var c = figma.createComponent();
    page.appendChild(c);
    c.name = 'Tone=' + tone;
    c.resize(393, 34);
    c.fills = [];
    var bar = figma.createRectangle();
    c.appendChild(bar);
    bar.resize(134, 5);
    bar.cornerRadius = 3;
    bar.x = 129.5;
    bar.y = 21;
    bar.fills = [{ type: 'SOLID', color: tone === 'Light' ? { r: 1, g: 1, b: 1 } : { r: 0, g: 0, b: 0 } }];
    bar.name = 'Home indicator';
    return c;
  };
  var hd = homeMake('Dark');
  var hl = homeMake('Light');
  var hset = figma.combineAsVariants([hd, hl], page);
  hset.name = 'Home indicator';
  hd.x = 10;
  hl.x = 413;
  hd.y = hl.y = 10;
  hset.resizeWithoutConstraints(826, 54);
  hset.x = 900;
  hset.y = -220;
  chrome = { status: { Dark: dark, Light: light }, home: { Dark: hd, Light: hl } };
  return chrome;
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

var COLUMN_GAP = 80;
var ROW_GAP = 220;

async function buildScreen(meta, data, x, y, page, parent) {
  keyIndex = {};
  var root = data.root;
  var frame = figma.createFrame();
  (parent || page).appendChild(frame);
  frame.name = meta.title;
  frame.x = x;
  frame.y = y;
  frame.resize(root.w, root.h);
  frame.clipsContent = true;
  frame.fills = await makePaints(root.f);
  if (!frame.fills.length) frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  if (root.ch) {
    for (var i = 0; i < root.ch.length; i++) {
      if (i % 40 === 0) {
        checkCancel();
        await tick();
      }
      await build(root.ch[i], frame);
    }
  }
  if (chrome) {
    var tone = data.tone === 'light' ? 'Light' : 'Dark';
    var sb = chrome.status[tone].createInstance();
    frame.appendChild(sb);
    sb.x = 0;
    sb.y = 0;
    sb.name = 'Status bar';
    var hi = chrome.home[data.bottomTone === 'light' ? 'Light' : 'Dark'].createInstance();
    frame.appendChild(hi);
    hi.x = 0;
    hi.y = root.h - 34;
    hi.name = 'Home indicator';
  }
  frame.setPluginData('route', meta.route || '');
  frame.setPluginData('state', meta.state || '');
  frame.setPluginData('screenId', meta.id);
  return { frame: frame, keys: keyIndex };
}

/** Normalise an href from the app into a route path. */
function routeOf(href) {
  if (!href) return null;
  var h = href;
  var i = h.indexOf('#');
  if (i >= 0) h = h.slice(i + 1);
  if (h.charAt(0) !== '/') return null;
  var q = h.indexOf('?');
  return q >= 0 ? h.slice(0, q) : h;
}

async function addReactions(node, actions) {
  var reactions = [{ trigger: { type: 'ON_CLICK' }, actions: actions }];
  await node.setReactionsAsync(reactions);
}

async function linkScreens(built, byRoute) {
  var made = 0;
  for (var i = 0; i < built.length; i++) {
    var b = built[i];
    var links = b.links || [];
    for (var j = 0; j < links.length; j++) {
      var L = links[j];
      var node = b.keys[L.k];
      if (!node) continue;
      try {
        if (L.back) {
          await addReactions(node, [{ type: 'BACK' }]);
          made++;
          continue;
        }
        var dest = byRoute[routeOf(L.href)];
        if (!dest || dest === b.frame) continue;
        await addReactions(node, [{ type: 'NODE', destinationId: dest.id, navigation: 'NAVIGATE', transition: { type: 'DISSOLVE', easing: { type: 'EASE_OUT' }, duration: 0.25 }, preserveScrollPosition: false }]);
        made++;
      } catch (e) {
        log('warn', 'Prototype link skipped on ' + b.frame.name + ': ' + e.message);
      }
    }
  }
  return made;
}

async function buildScreensPage(page, dirMeta, screens, options) {
  await buildChrome(page);
  // Rows: one per base screen (route); columns: its states.
  var groups = [];
  var byGroup = {};
  screens.forEach(function (s) {
    if (!byGroup[s.group]) {
      byGroup[s.group] = [];
      groups.push(s.group);
    }
    byGroup[s.group].push(s);
  });
  var y = 0;
  var built = [];
  var byRoute = {};
  var done = 0;
  var total = screens.length;
  for (var g = 0; g < groups.length; g++) {
    var gname = groups[g];
    var rows = [];
    var rowOf = {};
    byGroup[gname].forEach(function (s) {
      if (!rowOf[s.row]) {
        rowOf[s.row] = [];
        rows.push(s.row);
      }
      rowOf[s.row].push(s);
    });
    var section = figma.createSection ? figma.createSection() : null;
    var sectionTop = y;
    if (section) {
      page.appendChild(section);
      section.name = gname;
    }
    var gy = y + 120;
    var maxX = 0;
    for (var r = 0; r < rows.length; r++) {
      var row = rowOf[rows[r]];
      var x = 0;
      var rowH = 0;
      var rowLabel = await label(page, rows[r], 28, 700, [0.2, 0.17, 0.15], 0, gy);
      if (section) section.appendChild(rowLabel);
      for (var c = 0; c < row.length; c++) {
        checkCancel();
        var meta = row[c];
        progress(dirMeta.title + ' · ' + meta.title, done, total);
        var data = await ask('screen', meta.id);
        var res = await buildScreen(meta, data, x, gy + 56, page, section || page);
        var st = await label(page, meta.state || 'Default', 16, 600, [0.45, 0.42, 0.4], x, gy + 56 + data.root.h + 16, data.root.w);
        if (section) section.appendChild(st);
        built.push({ frame: res.frame, keys: res.keys, links: data.links });
        if (meta.primary && meta.route && !byRoute[meta.route]) byRoute[meta.route] = res.frame;
        x += data.root.w + COLUMN_GAP;
        rowH = Math.max(rowH, data.root.h);
        done++;
        stats.screens++;
        await tick();
      }
      maxX = Math.max(maxX, x);
      gy += 56 + rowH + ROW_GAP;
    }
    if (section) {
      section.x = -80;
      section.y = sectionTop;
      section.resizeWithoutConstraints(maxX + 160, gy - sectionTop);
      section.fills = [{ type: 'SOLID', color: rgb([0.96, 0.94, 0.91]) }];
      // Sections position children in page space; shift them into place.
      for (var k = 0; k < section.children.length; k++) section.children[k].x += 80;
      for (var m = 0; m < section.children.length; m++) section.children[m].y -= sectionTop;
    }
    var title = await label(page, gname, 48, 800, [0.15, 0.12, 0.1], 0, sectionTop + 24);
    if (section) {
      section.appendChild(title);
      title.x = 80;
      title.y = 24;
    }
    y = gy + 200;
  }
  var linkCount = 0;
  if (options.prototype !== false) {
    progress(dirMeta.title + ' · prototype links', total, total);
    linkCount = await linkScreens(built, byRoute);
    var start = byRoute[dirMeta.start] || (built[0] && built[0].frame);
    if (start) {
      try {
        page.flowStartingPoints = [{ nodeId: start.id, name: dirMeta.title + ' · ' + (dirMeta.startName || 'Start') }];
      } catch (e) {
        /* older API */
      }
    }
  }
  return { links: linkCount };
}

/* ------------------------------------------------------------------ */
/* Cover page                                                          */
/* ------------------------------------------------------------------ */

async function buildCover(page, manifest) {
  var f = docFrame('Cover', page, 0, 0, 1920, 1080, [0.118, 0.102, 0.086]);
  f.cornerRadius = 0;
  if (manifest.logo) {
    var plate = figma.createFrame();
    f.appendChild(plate);
    plate.resize(240, 240);
    plate.x = 120;
    plate.y = 120;
    plate.cornerRadius = 34;
    plate.fills = [{ type: 'SOLID', color: rgb([0.984, 0.969, 0.945]) }];
    plate.name = 'Logo plate';
    var hash = await imageHash(manifest.logo);
    if (hash) {
      var logo = figma.createRectangle();
      plate.appendChild(logo);
      logo.resize(200, 200);
      logo.x = 20;
      logo.y = 20;
      logo.fills = [{ type: 'IMAGE', imageHash: hash, scaleMode: 'FIT' }];
      logo.name = 'Kisani Urjaa logo';
    }
  }
  await label(f, 'FARMER APP · DESIGN FILE', 24, 600, [0.9, 0.87, 0.82], 120, 420);
  await label(f, 'Kisani Urjaa', 120, 800, [0.957, 0.933, 0.902], 120, 470);
  await label(f, 'From Waste to Wealth, for Farmers’ Health', 36, 500, [0.914, 0.627, 0.416], 120, 630);
  await label(f, manifest.summary || '', 24, 400, [0.79, 0.75, 0.7], 120, 720, 1200);
  await label(f, 'Generated by the Kisani Urjaa Figma importer from the running app · ' + (manifest.capturedAt || ''), 18, 400, [0.6, 0.56, 0.52], 120, 960, 1500);
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

async function pageNamed(name, reuse) {
  if (reuse) {
    for (var i = 0; i < figma.root.children.length; i++) {
      var p = figma.root.children[i];
      if (p.name === name) {
        if (p.loadAsync) await p.loadAsync();
        p.children.slice().forEach(function (n) {
          n.remove();
        });
        return p;
      }
    }
  }
  var page = figma.createPage();
  page.name = name;
  return page;
}

async function setPage(page) {
  if (figma.setCurrentPageAsync) await figma.setCurrentPageAsync(page);
  else figma.currentPage = page;
}

async function run(options) {
  stats = { nodes: 0, vectorsFailed: 0, imagesFailed: 0, screens: 0 };
  progress('Reading the data pack', 0, 0);
  var manifest = await ask('manifest');
  await loadAvailableFonts();
  // Preload the core faces once.
  await ensureFont(resolveFont('Plus Jakarta Sans', 400, false));
  await ensureFont({ family: 'Inter', style: 'Regular' });

  var dirs = (options.directions && options.directions.length ? options.directions : manifest.directions.map(function (d) { return d.id; }));
  var parts = options.parts || { foundations: true, components: true, screens: true };
  var reuse = options.replace !== false;
  var summary = { screens: 0, components: 0, variables: 0, textStyles: 0, links: 0, pages: [] };

  if (options.cover !== false) {
    var cover = await pageNamed('Cover', reuse);
    await setPage(cover);
    await buildCover(cover, manifest);
    summary.pages.push(cover.name);
  }

  for (var d = 0; d < manifest.directions.length; d++) {
    var dir = manifest.directions[d];
    if (dirs.indexOf(dir.id) < 0) continue;
    checkCancel();
    if (parts.foundations) {
      var fp = await pageNamed(dir.short + ' · Foundations', reuse);
      await setPage(fp);
      progress(dir.title + ' · tokens and styles', 0, 0);
      var foundation = await ask('foundation', dir.id);
      var fm = await buildFoundationsPage(fp, dir, foundation);
      summary.variables += fm.variables;
      summary.textStyles += fm.textStyles;
      summary.pages.push(fp.name);
    } else {
      // Still bind colours to variables if they exist from an earlier import.
      await buildVariables(dir, (await ask('foundation', dir.id)).tokens || []);
    }
    if (parts.components) {
      var cp = await pageNamed(dir.short + ' · Components', reuse);
      await setPage(cp);
      var items = await ask('components', dir.id);
      var cm = await buildComponentsPage(cp, dir, items);
      summary.components += cm.count;
      summary.pages.push(cp.name);
    }
    if (parts.screens) {
      var groupFilter = options.groups && options.groups.length ? options.groups : null;
      var screens = manifest.screens.filter(function (s) {
        return s.dir === dir.id && (!groupFilter || groupFilter.indexOf(s.group) >= 0) && (options.states !== false || s.state === 'Default');
      });
      var sp = await pageNamed(dir.short + ' · Screens & states', reuse);
      await setPage(sp);
      chrome = null;
      var sm = await buildScreensPage(sp, dir, screens, options);
      summary.links += sm.links;
      summary.pages.push(sp.name);
    }
  }
  summary.screens = stats.screens;
  summary.nodes = stats.nodes;
  summary.vectorsFailed = stats.vectorsFailed;
  if (stats.vectorsFailed) log('warn', stats.vectorsFailed + ' SVG shapes could not be imported and were left as empty frames.');
  return summary;
}
