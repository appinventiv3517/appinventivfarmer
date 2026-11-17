/*
 * Kisani Urjaa — App importer · Figma plugin main thread.
 *
 * Rebuilds the Kisani Urjaa farmer app inside Figma as editable layers:
 *   Cover · Foundations (colour variables with Light/Dark modes, text styles,
 *   effect styles, radius & spacing) · Components (icons, status bar, tab bar,
 *   home indicator) · one page per app module · one page per UI state family
 *   (empty, loading, error & offline, success, permission) · Dark mode ·
 *   Design system.
 *
 * The UI (ui.html) holds the captured screen data and streams it here one
 * screen at a time; every message is acknowledged so the UI can show progress
 * and never floods the main thread.
 */
'use strict';

var PLUGIN_TAG = 'kisani-urjaa-importer';
var BRAND_FAMILY = 'Plus Jakarta Sans';
var FALLBACK_FAMILY = 'Inter';
var FRAME_GAP = 96;
var SECTION_PAD = 96;
var SECTION_GAP = 240;

var S = {
  opts: {},
  tokens: null,
  family: BRAND_FAMILY,
  fontStyles: [], // [{w, italic, name}]
  images: {}, // asset id → image hash
  svgs: {}, // asset id → markup
  pages: {}, // page title → PageNode
  pageOrder: [],
  sections: {}, // page|group → {node, x, h}
  pageCursor: {}, // page title → next section y
  routes: [], // {route, at, theme, page, id}
  links: [], // {nodeId, href, theme}
  backs: [], // node ids
  icons: {}, // icon key → ComponentNode
  comps: {}, // signature key → ComponentNode
  compMasterSig: {},
  compGroups: {}, // group name → {prop, list: [ComponentNode]}
  componentsPage: null,
  iconBoard: null,
  compBoard: null,
  collection: null,
  modeLight: null,
  modeDark: null,
  colorVars: [], // {name, variable, light, dark, kind}
  textStyles: [], // {style, size, weight, lh, ls, upper}
  effectStyles: [], // {style, fx}
  warnings: [],
  nodes: 0,
  screensBuilt: 0,
};

/* ================================================================== */
/* Messaging                                                            */
/* ================================================================== */

figma.showUI(__html__, { width: 440, height: 680, themeColors: true });
figma.skipInvisibleInstanceChildren = true;

figma.ui.onmessage = function (msg) {
  if (!msg || !msg.type) return;
  handle(msg)
    .then(function (res) {
      figma.ui.postMessage(Object.assign({ type: 'ack', seq: msg.seq, ok: true }, res || {}));
    })
    .catch(function (err) {
      var text = err && err.message ? err.message : String(err);
      figma.ui.postMessage({ type: 'ack', seq: msg.seq, ok: false, error: text });
    });
};

function warn(text) {
  if (S.warnings.length < 400) S.warnings.push(text);
}

async function handle(msg) {
  switch (msg.type) {
    case 'hello':
      return { editorType: figma.editorType, user: figma.currentUser ? figma.currentUser.name : null };
    case 'start':
      return start(msg);
    case 'assets':
      return storeAssets(msg.items);
    case 'screen':
      return buildScreen(msg.rec, msg.root);
    case 'finish':
      return finish(msg);
    case 'close':
      figma.closePlugin(msg.message || undefined);
      return {};
    default:
      throw new Error('Unknown message: ' + msg.type);
  }
}

/* ================================================================== */
/* Start: fonts, pages, foundations                                      */
/* ================================================================== */

async function start(msg) {
  S.opts = msg.opts || {};
  S.tokens = msg.tokens || null;
  S.warnings = [];
  S.nodes = 0;
  S.screensBuilt = 0;

  await setupFonts();

  // Remember pages from an earlier run so they can be replaced at the end.
  var old = [];
  if (S.opts.replace !== false) {
    figma.root.children.forEach(function (p) {
      if (p.getPluginData('tag') === PLUGIN_TAG) old.push(p);
    });
  }
  S.oldPages = old;

  // Create every page up front, in order.
  S.pages = {};
  S.pageOrder = msg.pages || [];
  for (var i = 0; i < S.pageOrder.length; i++) ensurePage(S.pageOrder[i]);

  if (S.tokens && S.opts.foundations !== false) {
    await buildFoundations();
  }
  await setupComponentsPage();
  return { family: S.family, styles: S.fontStyles.length };
}

async function setupFonts() {
  var available = [];
  try {
    available = await figma.listAvailableFontsAsync();
  } catch (e) {
    warn('Could not list fonts: ' + e.message);
  }
  function stylesFor(family) {
    return available
      .filter(function (f) {
        return f.fontName.family === family;
      })
      .map(function (f) {
        return f.fontName.style;
      });
  }
  var styles = stylesFor(BRAND_FAMILY);
  S.family = BRAND_FAMILY;
  if (!styles.length) {
    S.family = FALLBACK_FAMILY;
    styles = stylesFor(FALLBACK_FAMILY);
    warn('“' + BRAND_FAMILY + '” is not available in this file; using ' + FALLBACK_FAMILY + '. Install Plus Jakarta Sans and run again for an exact match.');
  }
  if (!styles.length) styles = ['Regular', 'Medium', 'Semi Bold', 'Bold'];
  var WEIGHTS = [
    [/extra\s*light|ultra\s*light/i, 200],
    [/thin|hairline/i, 100],
    [/semi\s*bold|demi\s*bold/i, 600],
    [/extra\s*bold|ultra\s*bold/i, 800],
    [/black|heavy/i, 900],
    [/light/i, 300],
    [/medium/i, 500],
    [/bold/i, 700],
    [/regular|normal|book|roman/i, 400],
  ];
  S.fontStyles = [];
  for (var i = 0; i < styles.length; i++) {
    var name = styles[i];
    var w = 400;
    for (var j = 0; j < WEIGHTS.length; j++) {
      if (WEIGHTS[j][0].test(name)) {
        w = WEIGHTS[j][1];
        break;
      }
    }
    if (/^italic$/i.test(name)) w = 400;
    var fn = { family: S.family, style: name };
    try {
      await figma.loadFontAsync(fn);
      S.fontStyles.push({ w: w, italic: /italic/i.test(name), font: fn });
    } catch (e) {
      warn('Could not load ' + S.family + ' ' + name);
    }
  }
  if (!S.fontStyles.length) {
    var inter = { family: 'Inter', style: 'Regular' };
    await figma.loadFontAsync(inter);
    S.fontStyles.push({ w: 400, italic: false, font: inter });
  }
}

/** Nearest available style; ties go to the lighter weight (650 → SemiBold). */
function fontFor(weight, italic) {
  var best = null;
  var bestScore = Infinity;
  for (var i = 0; i < S.fontStyles.length; i++) {
    var f = S.fontStyles[i];
    var score = Math.abs(f.w - weight) * 2 + (f.w > weight ? 1 : 0) + (f.italic !== !!italic ? 1000 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best.font;
}

function ensurePage(title) {
  if (S.pages[title]) return S.pages[title];
  var page = figma.createPage();
  page.name = title;
  page.setPluginData('tag', PLUGIN_TAG);
  S.pages[title] = page;
  S.pageCursor[title] = 0;
  return page;
}

async function showPage(page) {
  if (figma.currentPage !== page) await figma.setCurrentPageAsync(page);
}

/* ================================================================== */
/* Paint, effect and geometry helpers                                    */
/* ================================================================== */

function rgb(c) {
  return { r: clamp01(c[0]), g: clamp01(c[1]), b: clamp01(c[2]) };
}
function rgba(c) {
  return { r: clamp01(c[0]), g: clamp01(c[1]), b: clamp01(c[2]), a: c.length > 3 ? clamp01(c[3]) : 1 };
}
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function solid(c) {
  return { type: 'SOLID', color: rgb(c), opacity: c.length > 3 ? clamp01(c[3]) : 1 };
}
function hex(c) {
  return (
    '#' +
    [c[0], c[1], c[2]]
      .map(function (v) {
        var h = Math.round(clamp01(v) * 255).toString(16);
        return h.length < 2 ? '0' + h : h;
      })
      .join('')
      .toUpperCase()
  );
}

function invertAffine(m) {
  var a = m[0][0], b = m[0][1], c = m[0][2], d = m[1][0], e = m[1][1], f = m[1][2];
  var det = a * e - b * d;
  if (Math.abs(det) < 1e-9) return [[1, 0, 0], [0, 1, 0]];
  return [
    [e / det, -b / det, (b * f - c * e) / det],
    [-d / det, a / det, (c * d - a * f) / det],
  ];
}

function gradientStops(s) {
  return s.map(function (st) {
    return { position: clamp01(st[0]), color: { r: clamp01(st[1]), g: clamp01(st[2]), b: clamp01(st[3]), a: clamp01(st[4]) } };
  });
}

/** CSS linear-gradient angle → Figma gradient transform. */
function linearPaint(f, w, h) {
  w = Math.max(w, 0.01);
  h = Math.max(h, 0.01);
  var rad = (f.a * Math.PI) / 180;
  var dx = Math.sin(rad), dy = -Math.cos(rad);
  var len = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
  var sx = w / 2 - (dx * len) / 2, sy = h / 2 - (dy * len) / 2;
  var ex = w / 2 + (dx * len) / 2, ey = h / 2 + (dy * len) / 2;
  // Perpendicular, same length, in pixels.
  var qx = -(ey - sy), qy = ex - sx;
  var S0 = [sx / w, sy / h], E0 = [ex / w, ey / h], Q = [qx / w, qy / h];
  var M = [
    [E0[0] - S0[0], Q[0], S0[0] - 0.5 * Q[0]],
    [E0[1] - S0[1], Q[1], S0[1] - 0.5 * Q[1]],
  ];
  return { type: 'GRADIENT_LINEAR', gradientTransform: invertAffine(M), gradientStops: gradientStops(f.s) };
}

function radialPaint(f) {
  var rx = Math.max(f.rx, 0.0001), ry = Math.max(f.ry, 0.0001);
  var M = [
    [2 * rx, 0, f.cx - rx],
    [0, 2 * ry, f.cy - ry],
  ];
  return { type: 'GRADIENT_RADIAL', gradientTransform: invertAffine(M), gradientStops: gradientStops(f.s) };
}

function toPaints(fills, w, h, kind) {
  var out = [];
  if (!fills) return out;
  for (var i = 0; i < fills.length; i++) {
    var f = fills[i];
    try {
      if (f.k === 'S') out.push(bindPaint(solid(f.c), f.c, kind || 'fill'));
      else if (f.k === 'L') out.push(linearPaint(f, w, h));
      else if (f.k === 'R') out.push(radialPaint(f));
      else if (f.k === 'I') {
        var hash = S.images[f.ref];
        if (hash) out.push({ type: 'IMAGE', imageHash: hash, scaleMode: f.mode === 'FIT' ? 'FIT' : 'FILL' });
        else warn('Missing image ' + f.ref);
      }
    } catch (e) {
      warn('Paint skipped: ' + e.message);
    }
  }
  return out;
}

function toEffects(fx, allowSpread) {
  var out = [];
  if (!fx) return out;
  for (var i = 0; i < fx.length; i++) {
    var e = fx[i];
    var eff = {
      type: e.k === 'I' ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color: rgba(e.c),
      offset: { x: e.x, y: e.y },
      radius: Math.max(0, e.b),
      spread: allowSpread ? e.s || 0 : 0,
      visible: true,
      blendMode: 'NORMAL',
    };
    if (eff.type === 'DROP_SHADOW') eff.showShadowBehindNode = false;
    out.push(eff);
  }
  return out;
}

function setEffects(node, effects) {
  try {
    node.effects = effects;
  } catch (e) {
    // Spread is only accepted on some node types; drop it and retry.
    try {
      node.effects = effects.map(function (x) {
        var y = Object.assign({}, x);
        if (y.spread !== undefined) y.spread = 0;
        return y;
      });
    } catch (e2) {
      warn('Effects skipped on ' + node.name + ': ' + e2.message);
    }
  }
}

function blurEffect(type, radius) {
  return { type: type, radius: radius, visible: true, blurType: 'NORMAL' };
}

/* ================================================================== */
/* Token binding (colours → variables, text → styles, shadows → styles)  */
/* ================================================================== */

var TEXT_FIRST = ['fg', 'fg-2', 'fg-3', 'fg-inverse', 'on-primary', 'on-accent', 'on-tonal', 'accent-text', 'link', 'success-fg', 'warning-fg', 'danger-fg', 'info-fg', 'live', 'disabled-fg', 'primary', 'unread', 'accent'];
var FILL_FIRST = ['bg', 'surface', 'surface-2', 'surface-3', 'surface-tint', 'surface-inverse', 'primary', 'tonal', 'tonal-pressed', 'accent', 'success-bg', 'warning-bg', 'danger-bg', 'info-bg', 'success-solid', 'warning-solid', 'danger-solid', 'info-solid', 'disabled-bg', 'line', 'line-strong', 'scrim', 'glass-bg', 'glass-bg-strong', 'glass-border', 'glass-on-image', 'glass-on-image-border', 'band-a', 'band-b', 'unread', 'live', 'fg'];

function sameColor(a, b) {
  if (!a || !b) return false;
  var al = a.length > 3 ? a[3] : 1, bl = b.length > 3 ? b[3] : 1;
  return Math.abs(a[0] - b[0]) < 0.004 && Math.abs(a[1] - b[1]) < 0.004 && Math.abs(a[2] - b[2]) < 0.004 && Math.abs(al - bl) < 0.01;
}

var CURRENT_THEME = 'light';
function findColorVar(c, kind) {
  if (!S.colorVars.length) return null;
  var order = kind === 'text' ? TEXT_FIRST : FILL_FIRST;
  var key = CURRENT_THEME === 'dark' ? 'dark' : 'light';
  for (var i = 0; i < order.length; i++) {
    var v = S.colorVarByName[order[i]];
    if (v && sameColor(v[key], c)) return v.variable;
  }
  for (var j = 0; j < S.colorVars.length; j++) {
    var cv = S.colorVars[j];
    if (cv.group !== 'Palette' && sameColor(cv[key], c)) return cv.variable;
  }
  for (var k = 0; k < S.colorVars.length; k++) {
    var pv = S.colorVars[k];
    if (pv.group === 'Palette' && sameColor(pv[key], c)) return pv.variable;
  }
  return null;
}

function bindPaint(paint, c, kind) {
  if (!S.opts.bindTokens || !S.colorVars.length) return paint;
  var variable = findColorVar(c, kind);
  if (!variable) return paint;
  try {
    var p = Object.assign({}, paint, { opacity: 1 });
    return figma.variables.setBoundVariableForPaint(p, 'color', variable);
  } catch (e) {
    return paint;
  }
}

function groupLabel(group) {
  return (
    {
      Palette: 'Palette',
      'Semantic: surfaces & text': 'Surface & text',
      'Semantic: actions': 'Action',
      'Semantic: status': 'Status',
      'Decorative washes': 'Wash',
      Glass: 'Glass',
    }[group] || group
  );
}

async function buildFoundations() {
  var T = S.tokens;
  // ----- Colour variables (Light + Dark modes) -----
  S.colorVars = [];
  S.colorVarByName = {};
  try {
    var collections = await figma.variables.getLocalVariableCollectionsAsync();
    var col = null;
    for (var i = 0; i < collections.length; i++) if (collections[i].name === 'Kisani Urjaa · Colour') col = collections[i];
    if (!col) col = figma.variables.createVariableCollection('Kisani Urjaa · Colour');
    var light = col.modes[0];
    if (light.name !== 'Light') col.renameMode(light.modeId, 'Light');
    var dark = null;
    for (var m = 0; m < col.modes.length; m++) if (col.modes[m].name === 'Dark') dark = col.modes[m];
    var darkId = dark ? dark.modeId : col.addMode('Dark');
    S.collection = col;
    S.modeLight = light.modeId;
    S.modeDark = darkId;

    var existing = {};
    var vars = await figma.variables.getLocalVariablesAsync('COLOR');
    vars.forEach(function (v) {
      if (v.variableCollectionId === col.id) existing[v.name] = v;
    });
    // Palette first so semantic tokens can alias it.
    var sorted = T.colors.slice().sort(function (a, b) {
      return (a.group === 'Palette' ? 0 : 1) - (b.group === 'Palette' ? 0 : 1);
    });
    for (var k = 0; k < sorted.length; k++) {
      var c = sorted[k];
      var vname = groupLabel(c.group) + '/' + c.name;
      var v = existing[vname] || figma.variables.createVariable(vname, col, 'COLOR');
      var refVar = c.ref && S.colorVarByName[c.ref] && S.colorVarByName[c.ref].group === 'Palette' ? S.colorVarByName[c.ref].variable : null;
      if (refVar && sameColor(S.colorVarByName[c.ref].light, c.light)) v.setValueForMode(S.modeLight, figma.variables.createVariableAlias(refVar));
      else v.setValueForMode(S.modeLight, rgba(c.light));
      var darkRef = refVar && sameColor(S.colorVarByName[c.ref].dark, c.dark) ? refVar : null;
      if (darkRef) v.setValueForMode(S.modeDark, figma.variables.createVariableAlias(darkRef));
      else v.setValueForMode(S.modeDark, rgba(c.dark));
      v.description = (c.note ? c.note + ' · ' : '') + '--' + c.name;
      var textish = /(^fg|on-|-fg$|text|link|live|unread)/.test(c.name);
      try {
        v.scopes = textish ? ['TEXT_FILL', 'SHAPE_FILL', 'FRAME_FILL', 'STROKE_COLOR'] : ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR', 'EFFECT_COLOR', 'TEXT_FILL'];
      } catch (e) {
        /* older API */
      }
      var rec = { name: c.name, group: c.group, variable: v, light: c.light, dark: c.dark };
      S.colorVars.push(rec);
      S.colorVarByName[c.name] = rec;
    }
  } catch (e) {
    warn('Colour variables skipped: ' + e.message);
    S.colorVars = [];
  }

  // ----- Shape & space variables -----
  try {
    var cols2 = await figma.variables.getLocalVariableCollectionsAsync();
    var shape = null;
    for (var s2 = 0; s2 < cols2.length; s2++) if (cols2[s2].name === 'Kisani Urjaa · Shape & space') shape = cols2[s2];
    if (!shape) shape = figma.variables.createVariableCollection('Kisani Urjaa · Shape & space');
    var floats = {};
    (await figma.variables.getLocalVariablesAsync('FLOAT')).forEach(function (v) {
      if (v.variableCollectionId === shape.id) floats[v.name] = v;
    });
    T.radii.forEach(function (r) {
      var n = 'Radius/' + r.name;
      var v = floats[n] || figma.variables.createVariable(n, shape, 'FLOAT');
      v.setValueForMode(shape.modes[0].modeId, r.value);
      try {
        v.scopes = ['CORNER_RADIUS'];
      } catch (e) {}
    });
    T.space.forEach(function (sp) {
      var n = 'Space/' + sp.name;
      var v = floats[n] || figma.variables.createVariable(n, shape, 'FLOAT');
      v.setValueForMode(shape.modes[0].modeId, sp.value);
      try {
        v.scopes = ['GAP', 'WIDTH_HEIGHT'];
      } catch (e) {}
    });
  } catch (e) {
    warn('Shape variables skipped: ' + e.message);
  }

  // ----- Text styles -----
  S.textStyles = [];
  try {
    var localText = await figma.getLocalTextStylesAsync();
    var byName = {};
    localText.forEach(function (st) {
      byName[st.name] = st;
    });
    for (var t = 0; t < T.type.length; t++) {
      var ty = T.type[t];
      var label = ty.name.charAt(0).toUpperCase() + ty.name.slice(1).replace(/-(\w)/g, function (_, ch) {
        return ' ' + ch.toUpperCase();
      });
      var sname = 'Kisani Urjaa/' + label;
      var style = byName[sname] || figma.createTextStyle();
      style.name = sname;
      var fn = fontFor(ty.weight, false);
      style.fontName = fn;
      style.fontSize = ty.size;
      style.lineHeight = { unit: 'PIXELS', value: ty.lineHeight };
      style.letterSpacing = { unit: 'PIXELS', value: ty.letterSpacing || 0 };
      if (ty.upper) style.textCase = 'UPPER';
      style.description = (ty.note || '') + ' · CSS --t-' + ty.name + ' (weight ' + ty.weight + ')';
      S.textStyles.push({ style: style, size: ty.size, font: fn, lh: ty.lineHeight, upper: !!ty.upper, label: label, weight: ty.weight });
    }
  } catch (e) {
    warn('Text styles skipped: ' + e.message);
  }

  // ----- Effect styles -----
  S.effectStyles = [];
  try {
    var localFx = await figma.getLocalEffectStylesAsync();
    var fxByName = {};
    localFx.forEach(function (st) {
      fxByName[st.name] = st;
    });
    T.shadows.forEach(function (sh) {
      var n = 'Kisani Urjaa/Elevation ' + sh.name.replace('shadow-', '');
      var style = fxByName[n] || figma.createEffectStyle();
      style.name = n;
      style.effects = sh.light.map(function (l) {
        return { type: 'DROP_SHADOW', color: rgba(l.color), offset: { x: l.x, y: l.y }, radius: l.blur, spread: l.spread, visible: true, blendMode: 'NORMAL', showShadowBehindNode: false };
      });
      style.description = 'CSS --' + sh.name;
      S.effectStyles.push({ style: style, fx: sh.light, name: sh.name });
    });
  } catch (e) {
    warn('Effect styles skipped: ' + e.message);
  }

  if (S.pages['Foundations']) await drawFoundations(S.pages['Foundations']);
}

/* ----- Foundations page drawing ----- */

function txt(chars, size, weight, color, parent, x, y, opts) {
  var t = figma.createText();
  t.fontName = fontFor(weight || 400, false);
  t.characters = chars;
  t.fontSize = size;
  t.fills = [solid(color || [0.094, 0.125, 0.102, 1])];
  if (opts && opts.width) {
    t.textAutoResize = 'HEIGHT';
    t.resize(opts.width, t.height);
  }
  if (opts && opts.lh) t.lineHeight = { unit: 'PIXELS', value: opts.lh };
  if (parent) parent.appendChild(t);
  t.x = x || 0;
  t.y = y || 0;
  return t;
}

function autoFrame(name, dir, gap, pad) {
  var f = figma.createFrame();
  f.name = name;
  f.layoutMode = dir;
  f.itemSpacing = gap;
  f.paddingTop = f.paddingBottom = f.paddingLeft = f.paddingRight = pad || 0;
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.fills = [];
  f.clipsContent = false;
  return f;
}

var INK = [0.094, 0.125, 0.102, 1];
var INK2 = [0.306, 0.337, 0.31, 1];
var CREAM = [0.965, 0.953, 0.918, 1];

async function drawFoundations(page) {
  var root = autoFrame('Foundations', 'VERTICAL', 64, 80);
  root.fills = [solid([1, 1, 1, 1])];
  root.cornerRadius = 28;
  page.appendChild(root);
  txt('Foundations', 56, 700, INK, root);
  txt('Every colour is a variable with Light and Dark modes (collection “Kisani Urjaa · Colour”). Type, elevation, radius and spacing come straight from src/styles/tokens.css.', 20, 500, INK2, root, 0, 0, { width: 1100, lh: 30 });

  // Colour boards: one per mode, swatches bound to variables.
  var groups = [];
  S.colorVars.forEach(function (cv) {
    if (groups.indexOf(cv.group) < 0) groups.push(cv.group);
  });
  var boards = autoFrame('Colour', 'HORIZONTAL', 48, 0);
  root.appendChild(boards);
  for (var b = 0; b < 2; b++) {
    var darkBoard = b === 1;
    var board = autoFrame(darkBoard ? 'Colour · Dark' : 'Colour · Light', 'VERTICAL', 32, 40);
    board.cornerRadius = 28;
    board.fills = [solid(darkBoard ? [0.051, 0.078, 0.063, 1] : CREAM)];
    boards.appendChild(board);
    txt(darkBoard ? 'Dark mode' : 'Light mode', 28, 700, darkBoard ? [0.93, 0.945, 0.918, 1] : INK, board);
    for (var g = 0; g < groups.length; g++) {
      var gname = groups[g];
      txt(groupLabel(gname), 16, 700, darkBoard ? [0.71, 0.75, 0.71, 1] : INK2, board);
      var row = autoFrame(gname, 'HORIZONTAL', 16, 0);
      row.layoutWrap = 'WRAP';
      row.counterAxisSpacing = 16;
      row.primaryAxisSizingMode = 'FIXED';
      row.resize(1240, 10);
      board.appendChild(row);
      var list = S.colorVars.filter(function (cv) {
        return cv.group === gname;
      });
      for (var i = 0; i < list.length; i++) {
        var cv = list[i];
        var card = autoFrame(cv.name, 'VERTICAL', 8, 0);
        row.appendChild(card);
        var sw = figma.createRectangle();
        sw.name = 'Swatch';
        sw.resize(140, 72);
        sw.cornerRadius = 16;
        sw.strokes = [solid([0, 0, 0, 0.08])];
        sw.strokeWeight = 1;
        var p = solid(darkBoard ? cv.dark : cv.light);
        try {
          p = figma.variables.setBoundVariableForPaint(Object.assign({}, p, { opacity: 1 }), 'color', cv.variable);
        } catch (e) {}
        sw.fills = [p];
        card.appendChild(sw);
        var fg = darkBoard ? [0.93, 0.945, 0.918, 1] : INK;
        txt(cv.name, 13, 700, fg, card);
        var val = darkBoard ? cv.dark : cv.light;
        txt(hex(val) + (val[3] < 1 ? ' · ' + Math.round(val[3] * 100) + '%' : ''), 12, 500, darkBoard ? [0.58, 0.62, 0.57, 1] : INK2, card);
      }
    }
    if (darkBoard && S.collection) {
      try {
        board.setExplicitVariableModeForCollection(S.collection, S.modeDark);
      } catch (e) {}
    }
  }

  // Type scale.
  var type = autoFrame('Type scale', 'VERTICAL', 20, 40);
  type.cornerRadius = 28;
  type.fills = [solid(CREAM)];
  root.appendChild(type);
  txt('Type scale · ' + S.family, 28, 700, INK, type);
  for (var t = 0; t < S.textStyles.length; t++) {
    var ts = S.textStyles[t];
    var line = autoFrame(ts.label, 'HORIZONTAL', 32, 0);
    line.counterAxisAlignItems = 'CENTER';
    type.appendChild(line);
    var meta = txt(ts.label + '\n' + ts.size + ' / ' + Math.round(ts.lh * 10) / 10 + ' · ' + ts.weight, 13, 600, INK2, line, 0, 0, { width: 180 });
    meta.lineHeight = { unit: 'PIXELS', value: 18 };
    var sample = figma.createText();
    sample.fontName = ts.font;
    sample.characters = ts.upper ? 'Season records' : 'Paddy straw collection opens';
    line.appendChild(sample);
    try {
      await sample.setTextStyleIdAsync(ts.style.id);
    } catch (e) {}
    sample.fills = [solid(INK)];
  }

  // Radius, spacing, elevation.
  var misc = autoFrame('Shape, space & elevation', 'HORIZONTAL', 48, 0);
  root.appendChild(misc);
  var rad = autoFrame('Radius', 'VERTICAL', 16, 40);
  rad.cornerRadius = 28;
  rad.fills = [solid(CREAM)];
  misc.appendChild(rad);
  txt('Radius', 28, 700, INK, rad);
  var rrow = autoFrame('Radii', 'HORIZONTAL', 20, 0);
  rad.appendChild(rrow);
  S.tokens.radii.forEach(function (r) {
    var c = autoFrame(r.name, 'VERTICAL', 8, 0);
    rrow.appendChild(c);
    var box = figma.createRectangle();
    box.resize(72, 72);
    box.cornerRadius = Math.min(r.value, 36);
    box.fills = [solid([0.09, 0.227, 0.161, 1])];
    c.appendChild(box);
    txt(r.name + ' · ' + (r.value > 100 ? 'pill' : r.value + 'px'), 12, 600, INK2, c);
  });
  var sp = autoFrame('Spacing', 'VERTICAL', 10, 40);
  sp.cornerRadius = 28;
  sp.fills = [solid(CREAM)];
  misc.appendChild(sp);
  txt('Spacing (4px grid)', 28, 700, INK, sp);
  S.tokens.space.forEach(function (s) {
    var r = autoFrame(s.name, 'HORIZONTAL', 12, 0);
    r.counterAxisAlignItems = 'CENTER';
    sp.appendChild(r);
    var bar = figma.createRectangle();
    bar.resize(Math.max(2, s.value * 3), 12);
    bar.cornerRadius = 6;
    bar.fills = [solid([0.867, 0.416, 0.141, 1])];
    r.appendChild(bar);
    txt(s.name + ' · ' + s.value + 'px', 12, 600, INK2, r);
  });
  var el = autoFrame('Elevation', 'VERTICAL', 24, 40);
  el.cornerRadius = 28;
  el.fills = [solid(CREAM)];
  misc.appendChild(el);
  txt('Elevation', 28, 700, INK, el);
  var erow = autoFrame('Shadows', 'HORIZONTAL', 32, 16);
  el.appendChild(erow);
  for (var e = 0; e < S.effectStyles.length; e++) {
    var es = S.effectStyles[e];
    var card = figma.createFrame();
    card.name = es.name;
    card.resize(150, 110);
    card.cornerRadius = 22;
    card.fills = [solid([1, 1, 1, 1])];
    erow.appendChild(card);
    try {
      await card.setEffectStyleIdAsync(es.style.id);
    } catch (err) {}
    txt(es.name, 13, 700, INK, card, 16, 16);
  }
  root.x = 0;
  root.y = 0;
}

/* ================================================================== */
/* Components page                                                      */
/* ================================================================== */

async function setupComponentsPage() {
  var page = S.pages['Components'] || ensurePage('Components');
  S.componentsPage = page;
  S.icons = {};
  S.comps = {};
  S.compMasterSig = {};
  S.compGroups = {};
  var title = txt('Components', 56, 700, INK, null);
  page.appendChild(title);
  title.x = 0;
  title.y = -160;
  var sub = txt('Built from the app while importing: every icon is a component, and screens use instances. Status bar, Dynamic Island, home indicator and tab bar are variant sets.', 18, 500, INK2, null, 0, 0, { width: 1100, lh: 26 });
  page.appendChild(sub);
  sub.x = 0;
  sub.y = -84;

  S.iconBoard = autoFrame('Icons', 'HORIZONTAL', 20, 32);
  S.iconBoard.layoutWrap = 'WRAP';
  S.iconBoard.counterAxisSpacing = 20;
  S.iconBoard.primaryAxisSizingMode = 'FIXED';
  S.iconBoard.resize(1200, 100);
  S.iconBoard.cornerRadius = 28;
  S.iconBoard.fills = [solid(CREAM)];
  page.appendChild(S.iconBoard);
  S.iconBoard.x = 0;
  S.iconBoard.y = 0;

  // Masters of composite components are parked here, then laid out at the end.
  S.compBoard = figma.createFrame();
  S.compBoard.name = 'Composite components (staging)';
  S.compBoard.fills = [];
  S.compBoard.clipsContent = false;
  S.compBoard.resize(10, 10);
  page.appendChild(S.compBoard);
  S.compBoard.x = 1320;
  S.compBoard.y = 0;
}

/* ----- Icons ----- */

function iconKey(n) {
  return n.icon + (n.ifill ? ' (filled)' : '');
}

function recolorVectors(node, stroke, fill, strokeWeight) {
  var all = node.findAll ? node.findAll(function () {
    return true;
  }) : [];
  for (var i = 0; i < all.length; i++) {
    var v = all[i];
    if (v.type === 'FRAME' || v.type === 'GROUP' || v.type === 'COMPONENT' || v.type === 'INSTANCE') continue;
    try {
      if ('strokes' in v && v.strokes.length && stroke) v.strokes = [solid(stroke)];
      if ('fills' in v && v.fills !== figma.mixed && v.fills.length && (fill || stroke)) v.fills = [solid(fill || stroke)];
      if (strokeWeight && 'strokeWeight' in v && v.strokes.length) v.strokeWeight = strokeWeight;
    } catch (e) {
      /* locked vector */
    }
  }
}

function iconComponent(n) {
  var key = iconKey(n);
  if (S.icons[key]) return S.icons[key];
  var markup = S.svgs[n.ref];
  if (!markup) return null;
  var node = figma.createNodeFromSvg(markup);
  S.iconBoard.appendChild(node);
  node.name = 'Icon/' + key;
  recolorVectors(node, INK, n.ifill ? INK : null, 2);
  var comp = figma.createComponentFromNode(node);
  comp.name = 'Icon/' + key;
  comp.description = 'Lucide “' + n.icon + '” icon (ISC licence). 24×24, 2px stroke at 24px. Instances are rescaled to their size in the app.';
  S.icons[key] = comp;
  return comp;
}

function buildIcon(n, parent, ox, oy) {
  var comp = iconComponent(n);
  if (!comp) return null;
  var inst = comp.createInstance();
  parent.appendChild(inst);
  var scale = n.sx || 1;
  if (Math.abs(scale - 1) > 0.001) {
    try {
      inst.rescale(scale);
    } catch (e) {
      inst.resize(n.vw * scale, n.vh * scale);
    }
  }
  inst.x = n.x - ox + (n.ox || 0);
  inst.y = n.y - oy + (n.oy || 0);
  var sw = n.isw && Math.abs(n.isw - 2) > 0.01 ? n.isw * scale : null;
  recolorVectors(inst, n.ic, n.ifill || null, sw);
  if (n.o !== undefined) inst.opacity = n.o;
  inst.name = n.n;
  return inst;
}

/* ----- Composite components (exact-match instancing) ----- */

var COMPONENT_ROOTS = {
  StatusBar__bar: { group: 'Status bar', prop: 'Tone' },
  StatusBar__island: { group: 'Dynamic Island', prop: 'Type' },
  StatusBar__home: { group: 'Home indicator', prop: 'Tone' },
  TabBar__wrap: { group: 'Tab bar', prop: 'Active' },
};

function componentRoot(n) {
  if (!n.cls || !S.opts.components) return null;
  for (var i = 0; i < n.cls.length; i++) if (COMPONENT_ROOTS[n.cls[i]]) return COMPONENT_ROOTS[n.cls[i]];
  return null;
}

function signature(n, bx, by) {
  var parts = [];
  (function walk(m) {
    parts.push(
      [m.t, Math.round(m.x - bx), Math.round(m.y - by), Math.round(m.w), Math.round(m.h), JSON.stringify(m.fills || ''), JSON.stringify(m.st || ''), JSON.stringify(m.r || ''), JSON.stringify(m.fx || ''), m.o === undefined ? '' : m.o, m.chars || '', JSON.stringify(m.segs || ''), m.ref || '', m.icon || '', JSON.stringify(m.ic || ''), m.cur ? 'cur' : ''].join('|'),
    );
    if (m.c) m.c.forEach(walk);
    parts.push(')');
  })(n);
  var str = parts.join('\n');
  var h = 5381;
  for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ':' + str.length;
}

function luminance(c) {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function variantLabel(def, n) {
  if (def.group === 'Tab bar') {
    var label = 'None';
    (function walk(m) {
      if (m.cur && m.c) {
        m.c.forEach(function (k) {
          if (k.t === 'T') label = k.chars;
        });
      }
      if (m.c) m.c.forEach(walk);
    })(n);
    return label;
  }
  if (def.group === 'Status bar') {
    var tone = 'Dark';
    (function walk(m) {
      if (m.t === 'T' && m.segs && m.segs[0]) tone = luminance(m.segs[0].c) > 0.5 ? 'Light' : 'Dark';
      if (m.c) m.c.forEach(walk);
    })(n);
    return tone;
  }
  if (def.group === 'Home indicator') {
    var f = n.fills && n.fills[0] && n.fills[0].c;
    return f && luminance(f) > 0.5 ? 'Light' : 'Dark';
  }
  return 'Default';
}

async function buildComposite(def, n, parent, ox, oy) {
  var key = def.group + '|' + CURRENT_THEME + '|' + signature(n, n.x, n.y);
  var comp = S.comps[key];
  if (!comp) {
    var holder = figma.createFrame();
    holder.fills = [];
    holder.clipsContent = false;
    S.compBoard.appendChild(holder);
    var master = await buildNode(n, holder, n.x, n.y, true);
    if (!master) {
      holder.remove();
      return null;
    }
    if (master.type !== 'FRAME') {
      // Components must come from frames; wrap other node kinds.
      var wrap = figma.createFrame();
      wrap.fills = [];
      wrap.clipsContent = false;
      wrap.resize(Math.max(1, master.width), Math.max(1, master.height));
      holder.appendChild(wrap);
      wrap.appendChild(master);
      master.x = 0;
      master.y = 0;
      master = wrap;
    }
    S.compBoard.appendChild(master);
    holder.remove();
    master.x = 0;
    master.y = 0;
    comp = figma.createComponentFromNode(master);
    var group = S.compGroups[def.group] || (S.compGroups[def.group] = { prop: def.prop, list: [], labels: {} });
    var label = variantLabel(def, n) + (CURRENT_THEME === 'dark' ? ' · Dark mode' : '');
    var count = (group.labels[label] || 0) + 1;
    group.labels[label] = count;
    comp.name = def.prop + '=' + label + (count > 1 ? ' ' + count : '');
    comp.setPluginData('group', def.group);
    if (CURRENT_THEME === 'dark' && S.collection) {
      try {
        comp.setExplicitVariableModeForCollection(S.collection, S.modeDark);
      } catch (e) {}
    }
    group.list.push(comp);
    S.comps[key] = comp;
  }
  var inst = comp.createInstance();
  parent.appendChild(inst);
  inst.x = n.x - ox;
  inst.y = n.y - oy;
  inst.name = def.group;
  return inst;
}


/* ----- Atoms: auto-layout components with text & icon overrides ----- */

var BUTTON_VARIANTS = ['primary', 'accent', 'secondary', 'tonal', 'ghost', 'danger', 'glass'];
var ATOMS = {
  Button__btn: {
    group: 'Button',
    props: function (n) {
      var cls = n.cls.join(' ');
      var variant = 'primary';
      BUTTON_VARIANTS.forEach(function (v) {
        if (cls.indexOf('Button__' + v) >= 0) variant = v;
      });
      var size = /Button__sm/.test(cls) ? 'sm' : /Button__lg/.test(cls) ? 'lg' : 'md';
      var state = /Button__loading/.test(cls) ? 'Loading' : n.dis ? 'Disabled' : 'Default';
      return 'Variant=' + cap(variant) + ', Size=' + size.toUpperCase() + ', State=' + state;
    },
  },
  Chip__chip: {
    group: 'Chip',
    props: function (n) {
      return 'Selected=' + (/Chip__selected/.test(n.cls.join(' ')) || n.on ? 'On' : 'Off');
    },
  },
};

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function atomFor(n) {
  if (!n.cls || !S.opts.components || !n.flex || !n.c || !n.c.length || n.c.length > 4) return null;
  var def = null;
  for (var i = 0; i < n.cls.length; i++) if (ATOMS[n.cls[i]]) def = ATOMS[n.cls[i]];
  if (!def) return null;
  // Only flat atoms: text, icons and childless boxes (spinner, dots).
  for (var j = 0; j < n.c.length; j++) {
    var k = n.c[j];
    if (k.t === 'F' && k.c && k.c.length) return null;
    if (k.t === 'V' && !k.icon) return null;
  }
  return def;
}

function atomShape(n) {
  return n.c
    .map(function (k) {
      return k.t === 'T' ? 'T' : k.t === 'V' ? 'I' : 'F';
    })
    .join('');
}

var JUSTIFY = { center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', 'space-between': 'SPACE_BETWEEN' };
var ALIGN = { center: 'CENTER', 'flex-end': 'MAX', end: 'MAX', baseline: 'BASELINE' };

async function buildAtomMaster(def, n, label) {
  var frame = figma.createFrame();
  S.compBoard.appendChild(frame);
  await applyBox(frame, n);
  frame.clipsContent = !!n.clip;
  for (var i = 0; i < n.c.length; i++) await buildNode(n.c[i], frame, n.x, n.y, true);
  var flex = n.flex;
  var auto = true;
  try {
    frame.layoutMode = /column/.test(flex.d) ? 'VERTICAL' : 'HORIZONTAL';
    frame.primaryAxisSizingMode = 'FIXED';
    frame.counterAxisSizingMode = 'FIXED';
    frame.paddingTop = flex.p[0];
    frame.paddingRight = flex.p[1];
    frame.paddingBottom = flex.p[2];
    frame.paddingLeft = flex.p[3];
    frame.itemSpacing = flex.g || 0;
    frame.primaryAxisAlignItems = JUSTIFY[flex.j] || 'MIN';
    frame.counterAxisAlignItems = ALIGN[flex.a] || 'CENTER';
    frame.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));
    // Keep auto layout only if it reproduces the app within 2px.
    for (var j = 0; j < frame.children.length && j < n.c.length; j++) {
      var c = frame.children[j], k = n.c[j];
      var kx = k.t === 'T' && k.ix !== undefined ? k.ix : k.x;
      var ky = k.t === 'T' ? k.y : k.y;
      if (Math.abs(c.x - (kx - n.x)) > 2.5 || Math.abs(c.y - (ky - n.y)) > 2.5) auto = false;
    }
  } catch (e) {
    auto = false;
  }
  if (!auto) {
    frame.layoutMode = 'NONE';
    frame.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));
    // Rebuild children at their captured positions.
    frame.children.slice().forEach(function (c) {
      c.remove();
    });
    for (var m = 0; m < n.c.length; m++) await buildNode(n.c[m], frame, n.x, n.y, true);
  }
  frame.x = 0;
  frame.y = 0;
  var comp = figma.createComponentFromNode(frame);
  var group = S.compGroups[def.group] || (S.compGroups[def.group] = { prop: 'Variant', list: [], labels: {} });
  var count = (group.labels[label] || 0) + 1;
  group.labels[label] = count;
  comp.name = label + (count > 1 ? ', Version=' + count : group.hasVersions ? ', Version=1' : '');
  if (count > 1 && !group.hasVersions) {
    group.hasVersions = true;
    group.list.forEach(function (c) {
      if (!/Version=/.test(c.name)) c.name += ', Version=1';
    });
  }
  if (CURRENT_THEME === 'dark' && S.collection) {
    try {
      comp.setExplicitVariableModeForCollection(S.collection, S.modeDark);
    } catch (e) {}
  }
  comp.setPluginData('auto', auto ? '1' : '0');
  group.list.push(comp);
  return { comp: comp, auto: auto };
}

function applySegs(t, n) {
  var segs = n.segs || [];
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    var a = s.s, b = Math.min(s.e, n.chars.length);
    if (b <= a) continue;
    t.setRangeFontName(a, b, segFont(s));
    t.setRangeFontSize(a, b, s.f);
    t.setRangeFills(a, b, [bindPaint(solid(s.c), s.c, 'text')]);
  }
}

async function buildAtom(def, n, parent, ox, oy) {
  var label = def.props(n) + ', Theme=' + (CURRENT_THEME === 'dark' ? 'Dark' : 'Light');
  var key = def.group + '|' + label + '|' + atomShape(n) + '|' + CURRENT_THEME;
  var entry = S.comps[key];
  if (!entry) {
    entry = await buildAtomMaster(def, n, label);
    S.comps[key] = entry;
    S.compMasterSig[key] = signature(n, n.x, n.y);
  }
  var exact = S.compMasterSig[key] === signature(n, n.x, n.y);
  if (!entry.auto && !exact) return null; // can't override safely: caller builds a frame
  var inst = entry.comp.createInstance();
  parent.appendChild(inst);
  if (Math.abs(inst.width - n.w) > 0.5 || Math.abs(inst.height - n.h) > 0.5) inst.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));
  inst.x = n.x - ox;
  inst.y = n.y - oy;
  if (!exact) {
    var kids = inst.children;
    for (var i = 0; i < kids.length && i < n.c.length; i++) {
      var c = kids[i], k = n.c[i];
      try {
        if (c.type === 'TEXT' && k.t === 'T' && c.characters !== k.chars) {
          c.characters = k.chars;
          applySegs(c, k);
        } else if (c.type === 'TEXT' && k.t === 'T') applySegs(c, k);
        else if (c.type === 'INSTANCE' && k.t === 'V' && k.icon) {
          var ic = iconComponent(k);
          if (ic && c.mainComponent !== ic) c.swapComponent(ic);
          var target = k.vw * (k.sx || 1);
          if (Math.abs(c.width - target) > 0.2) c.rescale(target / c.width);
          var sw = k.isw && Math.abs(k.isw - 2) > 0.01 ? k.isw * (k.sx || 1) : 2 * (k.sx || 1);
          recolorVectors(c, k.ic, k.ifill || null, sw);
        }
      } catch (e) {
        warn('Override in ' + def.group + ': ' + e.message);
      }
    }
  }
  inst.name = def.group + ' · ' + (n.c.filter(function (k) {
    return k.t === 'T';
  }).map(function (k) {
    return k.chars;
  })[0] || label);
  if (n.href) S.links.push({ nodeId: inst.id, href: n.href, theme: CURRENT_THEME });
  if (/· Back$/.test(n.n || '')) S.backs.push(inst.id);
  if (n.o !== undefined) inst.opacity = n.o;
  return inst;
}

/* ================================================================== */
/* Node builder                                                          */
/* ================================================================== */

async function applyBox(frame, n) {
  frame.name = n.n || 'Frame';
  frame.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));
  var paints = toPaints(n.fills, n.w, n.h, 'fill');
  frame.fills = paints;
  frame.clipsContent = !!n.clip;
  if (n.r) {
    if (n.r[0] === n.r[1] && n.r[1] === n.r[2] && n.r[2] === n.r[3]) frame.cornerRadius = n.r[0];
    else {
      frame.topLeftRadius = n.r[0];
      frame.topRightRadius = n.r[1];
      frame.bottomRightRadius = n.r[2];
      frame.bottomLeftRadius = n.r[3];
    }
  }
  var fx = n.fx ? n.fx.slice() : [];
  var hasStroke = false;
  if (n.st) {
    frame.strokes = [bindPaint(solid(n.st.c), n.st.c, 'fill')];
    frame.strokeAlign = 'INSIDE';
    var w = n.st.w;
    if (w[0] === w[1] && w[1] === w[2] && w[2] === w[3]) frame.strokeWeight = w[0];
    else {
      frame.strokeTopWeight = w[0];
      frame.strokeRightWeight = w[1];
      frame.strokeBottomWeight = w[2];
      frame.strokeLeftWeight = w[3];
    }
    if (n.st.dash) frame.dashPattern = [6, 4];
    hasStroke = true;
  }
  // `inset 0 0 0 Npx` rings are borders in disguise: make them strokes.
  if (!hasStroke) {
    for (var i = 0; i < fx.length; i++) {
      var e = fx[i];
      if (e.k === 'I' && !e.x && !e.y && !e.b && e.s > 0) {
        frame.strokes = [bindPaint(solid(e.c), e.c, 'fill')];
        frame.strokeAlign = 'INSIDE';
        frame.strokeWeight = e.s;
        fx.splice(i, 1);
        break;
      }
    }
  }
  var effects = toEffects(fx, paints.length > 0 && !!n.clip);
  if (n.bblur) effects.push(blurEffect('BACKGROUND_BLUR', n.bblur));
  if (n.lblur) effects.push(blurEffect('LAYER_BLUR', n.lblur));
  if (effects.length) {
    var matched = matchEffectStyle(n.fx);
    if (matched && !n.bblur && !n.lblur && fx.length === n.fx.length) {
      try {
        await frame.setEffectStyleIdAsync(matched.style.id);
      } catch (e) {
        setEffects(frame, effects);
      }
    } else setEffects(frame, effects);
  }
  if (n.o !== undefined) frame.opacity = n.o;
  if (n.bm) {
    try {
      frame.blendMode = n.bm;
    } catch (e) {}
  }
}

function matchEffectStyle(fx) {
  if (!fx || !S.opts.bindTokens || CURRENT_THEME === 'dark') return null;
  for (var i = 0; i < S.effectStyles.length; i++) {
    var es = S.effectStyles[i];
    if (es.fx.length !== fx.length) continue;
    var ok = true;
    for (var j = 0; j < fx.length; j++) {
      var a = fx[j], b = es.fx[j];
      if (a.k !== 'D' || a.x !== b.x || a.y !== b.y || a.b !== b.blur || (a.s || 0) !== b.spread || !sameColor(a.c, b.color)) {
        ok = false;
        break;
      }
    }
    if (ok) return es;
  }
  return null;
}

async function buildNode(n, parent, ox, oy, asMaster) {
  S.nodes++;
  try {
    if (n.t === 'T') return await buildText(n, parent, ox, oy);
    if (n.t === 'V') return buildVector(n, parent, ox, oy);
    var def = asMaster ? null : componentRoot(n);
    if (def) return await buildComposite(def, n, parent, ox, oy);
    var atom = asMaster ? null : atomFor(n);
    if (atom) {
      var made = await buildAtom(atom, n, parent, ox, oy);
      if (made) return made;
    }
    var frame = figma.createFrame();
    parent.appendChild(frame);
    await applyBox(frame, n);
    frame.x = n.x - ox;
    frame.y = n.y - oy;
    if (n.href) {
      frame.setPluginData('href', n.href);
      S.links.push({ nodeId: frame.id, href: n.href, theme: CURRENT_THEME });
    }
    if (/· Back$/.test(n.n || '')) S.backs.push(frame.id);
    if (n.c) {
      for (var i = 0; i < n.c.length; i++) await buildNode(n.c[i], frame, n.x, n.y);
    }
    if (n.gray) {
      // CSS grayscale(): a grey layer in Saturation blend mode over the content.
      var g = figma.createRectangle();
      frame.appendChild(g);
      g.name = 'Grayscale ' + Math.round(n.gray * 100) + '%';
      g.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));
      g.fills = [solid([0.5, 0.5, 0.5, 1])];
      g.blendMode = 'SATURATION';
      g.opacity = Math.min(1, n.gray);
      if (n.r) g.cornerRadius = n.r[0];
      frame.clipsContent = true;
    }
    return frame;
  } catch (e) {
    warn((n.n || n.t) + ': ' + e.message);
    return null;
  }
}

/* ----- Text ----- */

function segFont(seg) {
  return fontFor(seg.w || 400, !!seg.i);
}

function sameSeg(a, b) {
  return a.f === b.f && a.w === b.w && a.i === b.i && a.d === b.d && a.ls === b.ls && a.tt === b.tt && sameColor(a.c, b.c);
}

async function buildText(n, parent, ox, oy) {
  var t = figma.createText();
  parent.appendChild(t);
  var segs = n.segs && n.segs.length ? n.segs : [{ s: 0, e: n.chars.length, f: 16, w: 400, c: INK }];
  var s0 = segs[0];
  t.fontName = segFont(s0);
  t.characters = n.chars;
  t.name = n.n || n.chars.slice(0, 40);
  var uniform = segs.every(function (s) {
    return sameSeg(s, s0);
  });
  if (n.lh) t.lineHeight = { unit: 'PIXELS', value: n.lh };
  t.textAlignHorizontal = n.al === 'C' ? 'CENTER' : n.al === 'R' ? 'RIGHT' : n.al === 'J' ? 'JUSTIFIED' : 'LEFT';

  // Text style first (when the run matches a type token), then overrides.
  var style = uniform ? matchTextStyle(s0, n.lh) : null;
  if (style) {
    try {
      await t.setTextStyleIdAsync(style.style.id);
    } catch (e) {
      style = null;
    }
  }
  if (uniform) {
    if (!style) {
      t.fontName = segFont(s0);
      t.fontSize = s0.f;
      if (n.lh) t.lineHeight = { unit: 'PIXELS', value: n.lh };
    }
    t.letterSpacing = { unit: 'PIXELS', value: s0.ls || 0 };
    t.textCase = s0.tt === 'U' ? 'UPPER' : s0.tt === 'L' ? 'LOWER' : s0.tt === 'T' ? 'TITLE' : 'ORIGINAL';
    t.textDecoration = s0.d === 'U' ? 'UNDERLINE' : s0.d === 'S' ? 'STRIKETHROUGH' : 'NONE';
    t.fills = [bindPaint(solid(s0.c), s0.c, 'text')];
  } else {
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      var a = s.s, b = Math.min(s.e, n.chars.length);
      if (b <= a) continue;
      t.setRangeFontName(a, b, segFont(s));
      t.setRangeFontSize(a, b, s.f);
      t.setRangeLetterSpacing(a, b, { unit: 'PIXELS', value: s.ls || 0 });
      t.setRangeTextCase(a, b, s.tt === 'U' ? 'UPPER' : s.tt === 'L' ? 'LOWER' : s.tt === 'T' ? 'TITLE' : 'ORIGINAL');
      t.setRangeTextDecoration(a, b, s.d === 'U' ? 'UNDERLINE' : s.d === 'S' ? 'STRIKETHROUGH' : 'NONE');
      t.setRangeFills(a, b, [bindPaint(solid(s.c), s.c, 'text')]);
    }
    if (n.lh) t.lineHeight = { unit: 'PIXELS', value: n.lh };
  }

  // Sizing and placement.
  if (n.ml || n.fixed || n.clamp) {
    t.textAutoResize = 'HEIGHT';
    t.resize(Math.max(1, n.w + (n.al === 'L' ? 1 : 0)), Math.max(1, t.height));
    t.x = n.x - ox;
    if (n.clamp) {
      try {
        t.textTruncation = 'ENDING';
        t.maxLines = n.clamp;
      } catch (e) {}
    } else if (n.ml && n.lh && !n.fixed) {
      // Static font weights are a touch narrower/wider than the app's variable
      // font: nudge the width so the paragraph keeps its line count.
      var want = Math.round(n.h / n.lh);
      var baseW = t.width;
      for (var step = 0; step < 24; step++) {
        var lines = Math.round(t.height / n.lh);
        if (lines === want) break;
        var nw = lines < want ? t.width - 3 : t.width + 3;
        if (nw < baseW * 0.8 || nw > baseW * 1.12) break;
        t.resize(nw, t.height);
      }
      if (Math.round(t.height / n.lh) !== want) t.resize(baseW, t.height);
      if (n.al === 'C') t.x = n.x - ox + (baseW - t.width) / 2;
    }
    t.y = n.y - oy;
  } else {
    t.textAutoResize = 'WIDTH_AND_HEIGHT';
    var w = t.width;
    var ix = n.ix !== undefined ? n.ix : n.x;
    var iw = n.iw !== undefined ? n.iw : n.w;
    var x = n.al === 'C' ? ix + iw / 2 - w / 2 : n.al === 'R' ? ix + iw - w : ix;
    t.x = x - ox;
    t.y = n.y - oy;
  }
  return t;
}

function matchTextStyle(seg, lh) {
  if (!S.opts.bindTokens || !S.textStyles.length) return null;
  var font = segFont(seg);
  for (var i = 0; i < S.textStyles.length; i++) {
    var ts = S.textStyles[i];
    if (Math.abs(ts.size - seg.f) < 0.05 && ts.font.style === font.style && (!lh || Math.abs(ts.lh - lh) < 0.6) && !!ts.upper === (seg.tt === 'U')) return ts;
  }
  return null;
}

/* ----- Vectors (inline SVG) ----- */

function buildVector(n, parent, ox, oy) {
  if (n.icon && S.opts.components) {
    try {
      var inst = buildIcon(n, parent, ox, oy);
      if (inst) return inst;
    } catch (e) {
      warn('Icon ' + n.icon + ': ' + e.message);
    }
  }
  var markup = S.svgs[n.ref];
  var node = null;
  var preferBitmap = !!n.png && S.opts.bitmapIllustrations;
  if (markup && !preferBitmap) {
    try {
      node = figma.createNodeFromSvg(markup);
    } catch (e) {
      node = null;
      if (!n.png) warn('SVG not supported (' + (n.n || n.ref) + '): ' + e.message);
    }
  }
  if (!node && n.png && S.images[n.png]) {
    var r = figma.createRectangle();
    parent.appendChild(r);
    r.name = n.n || 'Illustration';
    r.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));
    r.fills = [{ type: 'IMAGE', imageHash: S.images[n.png], scaleMode: 'FILL' }];
    r.x = n.x - ox;
    r.y = n.y - oy;
    if (n.o !== undefined) r.opacity = n.o;
    return r;
  }
  if (!node) return null;
  node.name = n.n || 'Vector';
  var sx = n.sx || 1, sy = n.sy || 1;
  var needsWrap = n.clip || Math.abs(n.ox || 0) > 0.5 || Math.abs(n.oy || 0) > 0.5;
  var target = parent;
  var baseX = n.x - ox, baseY = n.y - oy;
  if (needsWrap) {
    var wrap = figma.createFrame();
    parent.appendChild(wrap);
    wrap.name = node.name;
    wrap.fills = [];
    wrap.resize(Math.max(0.01, n.w), Math.max(0.01, n.h));
    wrap.x = baseX;
    wrap.y = baseY;
    wrap.clipsContent = true;
    if (n.r) wrap.cornerRadius = n.r[0];
    target = wrap;
    baseX = 0;
    baseY = 0;
    node.name = 'Artwork';
  }
  target.appendChild(node);
  if (Math.abs(sx - sy) < 0.001) {
    if (Math.abs(sx - 1) > 0.001) node.rescale(sx);
  } else {
    node.rescale(Math.min(sx, sy));
    node.resize(n.vw * sx, n.vh * sy);
  }
  node.x = baseX + (n.ox || 0);
  node.y = baseY + (n.oy || 0);
  if (n.o !== undefined) (needsWrap ? target : node).opacity = n.o;
  if (n.fx) setEffects(needsWrap ? target : node, toEffects(n.fx, false));
  return needsWrap ? target : node;
}

/* ================================================================== */
/* Assets and screens                                                    */
/* ================================================================== */

async function storeAssets(items) {
  var n = 0;
  for (var i = 0; i < items.length; i++) {
    var a = items[i];
    try {
      if (a.kind === 'svg') S.svgs[a.id] = a.text;
      else if (a.bytes) {
        var img = figma.createImage(a.bytes);
        S.images[a.id] = img.hash;
      }
      n++;
    } catch (e) {
      warn('Asset ' + a.id + ': ' + e.message);
    }
  }
  return { stored: n };
}

function sectionFor(pageTitle, group) {
  var key = pageTitle + '|' + group;
  if (S.sections[key]) return S.sections[key];
  var page = S.pages[pageTitle] || ensurePage(pageTitle);
  var sec = figma.createSection();
  sec.name = group;
  page.appendChild(sec);
  sec.x = 0;
  sec.y = S.pageCursor[pageTitle] || 0;
  var rec = { node: sec, page: pageTitle, x: SECTION_PAD, h: 400, count: 0 };
  sec.resizeWithoutConstraints(SECTION_PAD * 2, 400);
  S.sections[key] = rec;
  return rec;
}

async function buildScreen(rec, root) {
  var page = S.pages[rec.page] || ensurePage(rec.page);
  await showPage(page);
  CURRENT_THEME = rec.theme === 'dark' ? 'dark' : 'light';
  var sec = sectionFor(rec.page, rec.group);
  var frame = figma.createFrame();
  sec.node.appendChild(frame);
  var nodesBefore = S.nodes;
  var warnBefore = S.warnings.length;
  await applyBox(frame, root);
  frame.name = rec.name;
  frame.clipsContent = true;
  frame.x = sec.x;
  frame.y = SECTION_PAD + 24;
  if (CURRENT_THEME === 'dark' && S.collection && S.opts.bindTokens) {
    try {
      frame.setExplicitVariableModeForCollection(S.collection, S.modeDark);
    } catch (e) {}
  }
  if (root.c) {
    for (var i = 0; i < root.c.length; i++) await buildNode(root.c[i], frame, 0, 0);
  }
  frame.setPluginData('route', rec.at || rec.route || '');
  frame.setPluginData('screenId', rec.id);
  frame.setPluginData('tag', PLUGIN_TAG);
  // Readable notes for Dev Mode / handoff.
  var note = rec.name + '\nRoute: ' + (rec.at || rec.route) + (rec.desc ? '\n' + rec.desc : '');
  frame.setSharedPluginData('kisani', 'note', note);

  sec.x += frame.width + FRAME_GAP;
  sec.count++;
  sec.h = Math.max(sec.h, frame.height + SECTION_PAD * 2 + 24);
  sec.node.resizeWithoutConstraints(sec.x - FRAME_GAP + SECTION_PAD, sec.h);
  S.pageCursor[rec.page] = sec.node.y + sec.h + SECTION_GAP;

  S.routes.push({ route: rec.route, at: rec.at, theme: CURRENT_THEME, page: rec.page, id: frame.id, primary: !/^States|^Dark/.test(rec.page) });
  S.screensBuilt++;
  return { frameId: frame.id, nodes: S.nodes - nodesBefore, warnings: S.warnings.slice(warnBefore, warnBefore + 5) };
}

/* ================================================================== */
/* Finish: components, prototype links, cover                            */
/* ================================================================== */

function pathOf(route) {
  return (route || '').split('?')[0];
}

function destinationFor(href, theme) {
  var candidates = S.routes;
  function pick(pred) {
    var same = candidates.filter(function (r) {
      return pred(r) && r.theme === theme;
    });
    var any = candidates.filter(pred);
    var prim = same.filter(function (r) {
      return r.primary;
    });
    return (prim[0] || same[0] || any[0] || null);
  }
  return (
    pick(function (r) {
      return r.route === href || r.at === href;
    }) ||
    pick(function (r) {
      return pathOf(r.route) === pathOf(href) || pathOf(r.at) === pathOf(href);
    })
  );
}

async function wirePrototype() {
  var linked = 0;
  var transition = { type: 'SMART_ANIMATE', easing: { type: 'EASE_OUT' }, duration: 0.3 };
  for (var i = 0; i < S.links.length; i++) {
    var l = S.links[i];
    var dest = destinationFor(l.href, l.theme);
    if (!dest) continue;
    try {
      var node = await figma.getNodeByIdAsync(l.nodeId);
      if (!node || !('setReactionsAsync' in node)) continue;
      await node.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'NODE', destinationId: dest.id, navigation: 'NAVIGATE', transition: transition, resetScrollPosition: true }] }]);
      linked++;
    } catch (e) {
      /* nodes inside instances can't hold reactions */
    }
  }
  for (var j = 0; j < S.backs.length; j++) {
    try {
      var b = await figma.getNodeByIdAsync(S.backs[j]);
      if (b && 'setReactionsAsync' in b) {
        await b.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'BACK' }] }]);
        linked++;
      }
    } catch (e) {}
  }
  // A flow starting point per section on the module pages.
  Object.keys(S.pages).forEach(function (title) {
    var page = S.pages[title];
    var sections = Object.keys(S.sections)
      .filter(function (k) {
        return S.sections[k].page === title;
      })
      .map(function (k) {
        return S.sections[k];
      });
    var flows = [];
    sections.forEach(function (sec) {
      var first = sec.node.children.filter(function (c) {
        return c.type === 'FRAME';
      })[0];
      if (first) flows.push({ nodeId: first.id, name: sec.node.name });
    });
    try {
      if (flows.length) page.flowStartingPoints = flows;
    } catch (e) {}
  });
  return linked;
}

function layoutComponentSets() {
  var page = S.componentsPage;
  var y = 0;
  var x0 = 1320;
  var names = Object.keys(S.compGroups);
  var made = 0;
  for (var i = 0; i < names.length; i++) {
    var g = S.compGroups[names[i]];
    if (!g.list.length) continue;
    var node;
    try {
      if (g.list.length > 1) {
        node = figma.combineAsVariants(g.list, page);
        node.name = names[i];
        // Lay variants out in a row.
        var cx = 24;
        var maxH = 0;
        node.children.forEach(function (c) {
          c.x = cx;
          c.y = 24;
          cx += c.width + 24;
          maxH = Math.max(maxH, c.height);
        });
        node.resizeWithoutConstraints(cx, maxH + 48);
        node.fills = [solid(CREAM)];
        node.cornerRadius = 20;
      } else {
        node = g.list[0];
        page.appendChild(node);
        node.name = names[i];
      }
      node.description = describeComponent(names[i]);
      node.x = x0;
      node.y = y;
      y += node.height + 120;
      made++;
    } catch (e) {
      warn('Component set ' + names[i] + ': ' + e.message);
    }
  }
  if (S.compBoard && S.compBoard.children.length === 0) S.compBoard.remove();
  return made;
}

function describeComponent(name) {
  return (
    {
      'Status bar': 'Simulated iPhone 15 Pro status bar (time 9:41, signal, Wi-Fi, battery). Tone follows the content behind it.',
      'Dynamic Island': 'iPhone 15 Pro Dynamic Island, part of the device frame.',
      'Home indicator': 'iOS home indicator, dark on light screens and light on dark screens.',
      Button: 'Buttons from src/components/ui/Button.tsx. Variant × Size × State. Auto layout: change the label and the button grows like in the app.',
      Chip: 'Filter chips from src/components/ui/Chip.tsx (count inline). Selected=On uses the dark fill.',
      'Tab bar': 'Floating tab bar: Home, Learn, Create (opens the Create sheet), Orders, Account. The active tab carries a tonal pill.',
    }[name] || name
  );
}

async function drawCover(msg) {
  var page = S.pages['Cover'];
  if (!page) return;
  var cover = figma.createFrame();
  cover.name = 'Cover';
  cover.resize(1920, 1080);
  cover.fills = [solid(CREAM)];
  page.appendChild(cover);
  var glow = figma.createEllipse();
  glow.resize(1100, 1100);
  glow.x = 1080;
  glow.y = -380;
  glow.fills = [{ type: 'GRADIENT_RADIAL', gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [{ position: 0, color: { r: 0.957, g: 0.761, b: 0.302, a: 0.35 } }, { position: 1, color: { r: 0.957, g: 0.761, b: 0.302, a: 0 } }] }];
  cover.appendChild(glow);
  if (msg.logo && S.images[msg.logo]) {
    var logo = figma.createRectangle();
    logo.name = 'Kisani Urjaa logo';
    var ratio = msg.logoRatio || 1;
    logo.resize(360 * ratio, 360);
    logo.fills = [{ type: 'IMAGE', imageHash: S.images[msg.logo], scaleMode: 'FIT' }];
    cover.appendChild(logo);
    logo.x = 120;
    logo.y = 110;
  }
  txt('Kisani Urjaa', 96, 800, [0.063, 0.161, 0.114, 1], cover, 120, 520);
  txt('Farmer app · complete UI', 44, 600, [0.09, 0.227, 0.161, 1], cover, 124, 640);
  txt('Recreated from the React codebase with the Kisani Urjaa App Importer plugin. Every screen, flow and UI state as editable layers, with colour variables (Light/Dark), text styles, elevation styles, icon components and prototype links.', 22, 500, INK2, cover, 124, 720, { width: 980, lh: 34 });
  var stats = msg.stats || {};
  var line = (stats.screens || S.screensBuilt) + ' frames · ' + (stats.pages || 0) + ' pages · ' + Object.keys(S.icons).length + ' icon components · ' + S.colorVars.length + ' colour variables';
  txt(line, 20, 700, [0.71, 0.306, 0.082, 1], cover, 124, 880);
  var index = (msg.pageIndex || [])
    .map(function (p) {
      return p.title + (p.count ? '  ·  ' + p.count : '');
    })
    .join('\n');
  if (index) {
    var idx = txt('Pages\n' + index, 20, 600, INK, cover, 1300, 520, { width: 520, lh: 34 });
    idx.setRangeFontSize(0, 5, 26);
    idx.setRangeFontName(0, 5, fontFor(700, false));
  }
  txt('Generated ' + new Date().toISOString().slice(0, 10) + ' · Plus Jakarta Sans · Lucide icons', 16, 500, INK2, cover, 124, 1010);
  cover.x = 0;
  cover.y = 0;
  try {
    figma.root.setPluginData('cover', cover.id);
    await figma.setFileThumbnailNodeAsync(cover);
  } catch (e) {}
}

async function finish(msg) {
  var made = 0, linked = 0;
  try {
    made = layoutComponentSets();
  } catch (e) {
    warn('Components: ' + e.message);
  }
  // Icon board height follows its content (auto layout); place sets beside it.
  if (S.opts.prototype !== false) {
    try {
      linked = await wirePrototype();
    } catch (e) {
      warn('Prototype: ' + e.message);
    }
  }
  try {
    await drawCover(msg);
  } catch (e) {
    warn('Cover: ' + e.message);
  }
  // Drop pages from an earlier run.
  var removed = 0;
  var cover = S.pages['Cover'] || S.pages[S.pageOrder[0]];
  if (cover) await showPage(cover);
  if (S.oldPages && S.oldPages.length) {
    for (var i = 0; i < S.oldPages.length; i++) {
      try {
        if (S.oldPages[i] !== figma.currentPage && !S.oldPages[i].removed) {
          S.oldPages[i].remove();
          removed++;
        }
      } catch (e) {
        warn('Could not remove old page: ' + e.message);
      }
    }
  }
  // Order pages as planned.
  S.pageOrder.forEach(function (title, idx) {
    var p = S.pages[title];
    if (p) {
      try {
        figma.root.insertChild(idx, p);
      } catch (e) {}
    }
  });
  try {
    figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);
  } catch (e) {}
  figma.notify('Kisani Urjaa: ' + S.screensBuilt + ' screens built' + (S.warnings.length ? ' · ' + S.warnings.length + ' notes' : ''));
  return { screens: S.screensBuilt, nodes: S.nodes, icons: Object.keys(S.icons).length, componentSets: made, links: linked, removedPages: removed, warnings: S.warnings };
}
