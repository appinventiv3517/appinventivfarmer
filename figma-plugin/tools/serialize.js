/*
 * In-page serializer: turns the rendered app (a DOM subtree) into a compact,
 * Figma-ready layer tree. Injected by capture.mjs into the running app.
 *
 * window.__figSerialize(rootEl, opts) -> Promise<{ root, images, links, fonts }>
 *
 * Node shapes (keys kept short to keep the data pack small):
 *   common: t (type), n (name), x, y, w, h (px, relative to parent), op (opacity),
 *           fx (effects), k (stable DOM key, set on links/buttons for prototyping)
 *   F frame: f (fills), s (stroke), r (radii [tl,tr,br,bl]), c (clips), ch (children)
 *   T text:  seg [{c (chars), f (family), wt, it, sz, col, ls, td, tc}], lh, al, va, ml (multi-line), sz
 *   V vector: svg
 * Paints: {k:'S', c:[r,g,b,a]} | {k:'L'|'R', m:[a,b,c,d,e,f], st:[[pos,r,g,b,a],...]} | {k:'I', id, mode, tf}
 */
(function () {
  'use strict';

  /* ---------------- Colours ---------------- */
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = colorCanvas.height = 1;
  const cctx = colorCanvas.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();
  function parseColor(v) {
    if (!v) return null;
    v = v.trim();
    if (v === 'transparent' || v === 'none' || v === 'currentcolor') return null;
    if (colorCache.has(v)) return colorCache.get(v);
    let out = null;
    const m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) {
      let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      out = [+m[1] / 255, +m[2] / 255, +m[3] / 255, a];
    } else {
      // Anything else (color(), oklab(), color-mix() results): let the canvas resolve it.
      cctx.clearRect(0, 0, 1, 1);
      cctx.fillStyle = 'rgba(0,0,0,0)';
      cctx.fillStyle = v;
      cctx.fillRect(0, 0, 1, 1);
      const d = cctx.getImageData(0, 0, 1, 1).data;
      const a = d[3] / 255;
      out = a === 0 ? [0, 0, 0, 0] : [d[0] / 255, d[1] / 255, d[2] / 255, a];
      // Canvas premultiplies poorly for low alpha; good enough for design use.
    }
    out = out.map((n, i) => (i < 3 ? Math.round(n * 1000) / 1000 : Math.round(n * 1000) / 1000));
    colorCache.set(v, out);
    return out;
  }
  const visibleColor = (c) => c && c[3] > 0.003;

  /* ---------------- Small helpers ---------------- */
  const px = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };
  const r2 = (n) => Math.round(n * 2) / 2;
  const r3 = (n) => Math.round(n * 1000) / 1000;

  function splitTop(str, sep = ',') {
    const out = [];
    let depth = 0;
    let cur = '';
    for (const ch of str) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === sep && depth === 0) {
        out.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /** Inverse of a 2x3 affine matrix [[a,c,e],[b,d,f]] given as {a,b,c,d,e,f}. */
  function invert(m) {
    const det = m.a * m.d - m.b * m.c || 1e-9;
    const a = m.d / det;
    const b = -m.b / det;
    const c = -m.c / det;
    const d = m.a / det;
    const e = -(a * m.e + c * m.f);
    const f = -(b * m.e + d * m.f);
    return [r3(a), r3(c), r3(e), r3(b), r3(d), r3(f)]; // Figma row-major [[a,c,e],[b,d,f]]
  }

  /* ---------------- Gradients ---------------- */
  function parseStops(parts, lengthPx) {
    const stops = [];
    for (const p of parts) {
      // Colour first or last; positions may follow ("red 10%", "rgb(..) 0% 20%").
      const m = p.match(/^(.*?\))\s*(.*)$/) || p.match(/^(#[0-9a-f]+|[a-z]+)\s*(.*)$/i);
      if (!m) continue;
      const col = parseColor(m[1]);
      if (!col) continue;
      const positions = (m[2] || '').split(/\s+/).filter(Boolean);
      if (!positions.length) stops.push({ c: col, p: null });
      for (const pos of positions) {
        let v = null;
        if (pos.endsWith('%')) v = parseFloat(pos) / 100;
        else if (pos.endsWith('px') && lengthPx) v = parseFloat(pos) / lengthPx;
        stops.push({ c: col, p: v });
      }
    }
    if (!stops.length) return null;
    if (stops[0].p === null) stops[0].p = 0;
    if (stops[stops.length - 1].p === null) stops[stops.length - 1].p = 1;
    // Fill missing positions evenly between known ones.
    for (let i = 1; i < stops.length; i++) {
      if (stops[i].p === null) {
        let j = i;
        while (stops[j].p === null) j++;
        const a = stops[i - 1].p;
        const b = stops[j].p;
        for (let k = i; k < j; k++) stops[k].p = a + ((b - a) * (k - i + 1)) / (j - i + 1);
      }
      if (stops[i].p < stops[i - 1].p) stops[i].p = stops[i - 1].p;
    }
    return stops.map((s) => [r3(Math.min(1, Math.max(0, s.p))), ...s.c]);
  }

  function linearGradient(args, w, h) {
    const parts = splitTop(args);
    let angle = 180;
    if (/^-?[\d.]+(deg|turn|rad|grad)$/.test(parts[0])) {
      const v = parts.shift();
      angle = v.endsWith('turn') ? parseFloat(v) * 360 : v.endsWith('rad') ? (parseFloat(v) * 180) / Math.PI : v.endsWith('grad') ? parseFloat(v) * 0.9 : parseFloat(v);
    } else if (/^to /.test(parts[0])) {
      const dir = parts.shift().slice(3).trim();
      const diag = (Math.atan2(h, w) * 180) / Math.PI;
      const map = { top: 0, right: 90, bottom: 180, left: 270, 'top right': diag, 'right top': diag, 'bottom right': 180 - diag, 'right bottom': 180 - diag, 'bottom left': 180 + diag, 'left bottom': 180 + diag, 'top left': 360 - diag, 'left top': 360 - diag };
      angle = map[dir] ?? 180;
    }
    const t = (angle * Math.PI) / 180;
    const ux = Math.sin(t);
    const uy = -Math.cos(t);
    const L = Math.abs(w * Math.sin(t)) + Math.abs(h * Math.cos(t)) || 1;
    const st = parseStops(parts, L);
    if (!st) return null;
    const cx = w / 2;
    const cy = h / 2;
    const Sx = cx - (ux * L) / 2;
    const Sy = cy - (uy * L) / 2;
    const Dx = ux * L;
    const Dy = uy * L;
    const Px = -Dy;
    const Py = Dx;
    const M = { a: Dx / w, b: Dy / h, c: Px / w, d: Py / h, e: (Sx - 0.5 * Px) / w, f: (Sy - 0.5 * Py) / h };
    return { k: 'L', m: invert(M), st };
  }

  function radialGradient(args, w, h) {
    const parts = splitTop(args);
    let shape = 'ellipse farthest-corner';
    let pos = '50% 50%';
    if (!parseColor(parts[0].split(/\s+/)[0]) || /\bat\b|circle|ellipse|closest|farthest/.test(parts[0])) {
      const first = parts[0];
      if (!/^(rgb|#|color|hsl|oklab|oklch|lab|lch)/.test(first)) {
        parts.shift();
        const at = first.split(/\bat\b/);
        shape = at[0].trim() || shape;
        if (at[1]) pos = at[1].trim();
      }
    }
    const pp = pos.split(/\s+/);
    const toPx = (v, size) => (v.endsWith('%') ? (parseFloat(v) / 100) * size : v === 'center' ? size / 2 : v === 'left' || v === 'top' ? 0 : v === 'right' || v === 'bottom' ? size : parseFloat(v));
    const cx = toPx(pp[0] || '50%', w);
    const cy = toPx(pp[1] || pp[0] || '50%', h);
    let rx;
    let ry;
    const sizes = shape.split(/\s+/).filter((s) => /[\d.]+(px|%)$/.test(s));
    if (sizes.length) {
      rx = toPx(sizes[0], w);
      ry = sizes[1] ? toPx(sizes[1], h) : rx;
    } else {
      const fx = Math.max(cx, w - cx);
      const fy = Math.max(cy, h - cy);
      const closest = /closest-side/.test(shape);
      const circle = /circle/.test(shape);
      if (closest) {
        rx = Math.min(cx, w - cx);
        ry = Math.min(cy, h - cy);
      } else {
        rx = fx * Math.SQRT2;
        ry = fy * Math.SQRT2;
      }
      if (circle) rx = ry = closest ? Math.min(rx, ry) : Math.hypot(fx, fy);
    }
    rx = rx || 1;
    ry = ry || 1;
    const st = parseStops(parts, rx);
    if (!st) return null;
    const M = { a: (2 * rx) / w, b: 0, c: 0, d: (2 * ry) / h, e: (cx - rx) / w, f: (cy - ry) / h };
    return { k: 'R', m: invert(M), st };
  }

  /* ---------------- Images ---------------- */
  const images = {};
  const imageKeys = new Map();
  let imageSeq = 0;
  const MAX_IMG = 1000;

  function loadImage(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  /** Rasterise an image source to JPEG/PNG base64 and register it. Returns the image id. */
  async function registerImage(src, renderW, renderH, el) {
    const cacheKey = src + '|' + Math.round(renderW) + 'x' + Math.round(renderH);
    if (imageKeys.has(src)) return imageKeys.get(src);
    let im = el && el.complete && el.naturalWidth ? el : await loadImage(src);
    if (!im || !(im.naturalWidth || im.width)) return null;
    let nw = im.naturalWidth || im.width;
    let nh = im.naturalHeight || im.height;
    const isSvg = /^data:image\/svg|\.svg(\?|$)/.test(src);
    if (isSvg) {
      // Vector sources: rasterise at 2x their rendered size for crisp results.
      const ratio = nw / nh || renderW / renderH || 1;
      nw = Math.max(nw, renderW * 2);
      nh = nw / ratio;
    }
    const scale = Math.min(1, MAX_IMG / Math.max(nw, nh));
    const cw = Math.max(1, Math.round(nw * scale));
    const ch = Math.max(1, Math.round(nh * scale));
    const cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const ctx = cv.getContext('2d');
    try {
      ctx.drawImage(im, 0, 0, cw, ch);
    } catch (e) {
      return null;
    }
    let alpha = false;
    try {
      const data = ctx.getImageData(0, 0, cw, ch).data;
      for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 250) { alpha = true; break; }
    } catch (e) {
      return null;
    }
    const mime = alpha ? 'image/png' : 'image/jpeg';
    const url = alpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.82);
    const id = 'img' + imageSeq++;
    images[id] = { mime, w: cw, h: ch, data: url.slice(url.indexOf(',') + 1), src: src.slice(0, 120) };
    imageKeys.set(src, id);
    void cacheKey;
    return id;
  }

  async function registerCanvas(cv, tag) {
    try {
      const url = cv.toDataURL('image/png');
      const id = 'img' + imageSeq++;
      images[id] = { mime: 'image/png', w: cv.width, h: cv.height, data: url.slice(url.indexOf(',') + 1), src: tag };
      return id;
    } catch (e) {
      return null;
    }
  }

  function objectFitTransform(fit, posStr, W, H, iw, ih) {
    if (fit === 'contain' || fit === 'scale-down') return { mode: 'FIT' };
    if (fit === 'fill') return { mode: 'FILL' };
    if (fit === 'none') return { mode: 'CROP', tf: [1, 0, 0, 0, 1, 0] };
    // cover (and default for background-size: cover)
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s;
    const dh = ih * s;
    const parts = (posStr || '50% 50%').split(/\s+/);
    const pct = (v) => (v === 'left' || v === 'top' ? 0 : v === 'right' || v === 'bottom' ? 1 : v === 'center' ? 0.5 : v && v.endsWith('%') ? parseFloat(v) / 100 : 0.5);
    const ox = (W - dw) * pct(parts[0]);
    const oy = (H - dh) * pct(parts[1] || parts[0]);
    return { mode: 'CROP', tf: [r3(W / dw), 0, r3(-ox / dw), 0, r3(H / dh), r3(-oy / dh)] };
  }

  /* ---------------- Styles → paints/effects ---------------- */
  async function backgroundPaints(cs, w, h) {
    const fills = [];
    const bg = parseColor(cs.backgroundColor);
    if (visibleColor(bg)) fills.push({ k: 'S', c: bg });
    const bi = cs.backgroundImage;
    if (bi && bi !== 'none') {
      const layers = splitTop(bi);
      const sizes = splitTop(cs.backgroundSize || 'auto');
      const positions = splitTop(cs.backgroundPosition || '0% 0%');
      // CSS: first layer on top. Figma: last fill on top.
      for (let i = layers.length - 1; i >= 0; i--) {
        const L = layers[i];
        let p = null;
        const lin = L.match(/^(?:repeating-)?linear-gradient\((.*)\)$/s);
        const rad = L.match(/^(?:repeating-)?radial-gradient\((.*)\)$/s);
        const url = L.match(/^url\(["']?(.*?)["']?\)$/s);
        if (lin) p = linearGradient(lin[1], w, h);
        else if (rad) p = radialGradient(rad[1], w, h);
        else if (url) {
          const im = await loadImage(url[1]);
          const repeat = (splitTop(cs.backgroundRepeat || 'repeat')[i] || splitTop(cs.backgroundRepeat || 'repeat')[0] || 'repeat').trim();
          const size0 = (sizes[i] || sizes[0] || 'auto').trim();
          const tiled = im && repeat !== 'no-repeat' && (size0 === 'auto' || /^[\d.]+px/.test(size0));
          if (tiled) {
            // Repeating textures (film grain etc.): one small tile, repeated by Figma.
            const nw = im.naturalWidth || 100;
            const nh = im.naturalHeight || 100;
            const tw = size0 === 'auto' ? nw : px(size0.split(/\s+/)[0]);
            const tid = await registerImage(url[1], tw, (tw * nh) / nw, im);
            if (tid) p = { k: 'I', id: tid, mode: 'TILE', sf: r3(tw / images[tid].w) };
            if (p) fills.push(p);
            continue;
          }
          const id = im ? await registerImage(url[1], w, h, im) : null;
          if (id) {
            const size = sizes[i] || sizes[0] || 'auto';
            const fit = size === 'contain' ? 'contain' : size === 'cover' ? 'cover' : size === '100% 100%' ? 'fill' : 'cover';
            p = { k: 'I', id, ...objectFitTransform(fit, positions[i] || positions[0], w, h, im.naturalWidth, im.naturalHeight) };
          }
        }
        if (p) fills.push(p);
      }
    }
    return fills;
  }

  function parseShadows(str, inset) {
    if (!str || str === 'none') return [];
    const out = [];
    for (const part of splitTop(str)) {
      const isInset = /\binset\b/.test(part);
      if (inset !== undefined && isInset !== inset) continue;
      const colMatch = part.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8}|color\([^)]*\)|oklab\([^)]*\)|oklch\([^)]*\))/i);
      const col = colMatch ? parseColor(colMatch[1]) : [0, 0, 0, 0.25];
      if (!visibleColor(col)) continue;
      const nums = part.replace(colMatch ? colMatch[1] : '', '').replace('inset', '').trim().split(/\s+/).map(px);
      out.push({ k: isInset ? 'IS' : 'DS', c: col, x: nums[0] || 0, y: nums[1] || 0, b: nums[2] || 0, s: nums[3] || 0 });
    }
    return out;
  }

  function effectsFor(cs) {
    const fx = parseShadows(cs.boxShadow);
    const filt = cs.filter;
    if (filt && filt !== 'none') {
      const ds = filt.match(/drop-shadow\((.*?\))\s*([\d.-]+px)\s+([\d.-]+px)\s*([\d.-]+px)?\)/);
      if (ds) fx.push({ k: 'DS', c: parseColor(ds[1]) || [0, 0, 0, 0.25], x: px(ds[2]), y: px(ds[3]), b: px(ds[4] || '0'), s: 0 });
      const bl = filt.match(/blur\(([\d.]+)px\)/);
      if (bl && +bl[1] > 0) fx.push({ k: 'LB', b: +bl[1] });
    }
    const bf = cs.backdropFilter || cs.webkitBackdropFilter;
    if (bf && bf !== 'none') {
      const bl = bf.match(/blur\(([\d.]+)px\)/);
      if (bl && +bl[1] > 0) fx.push({ k: 'BB', b: +bl[1] });
    }
    return fx;
  }

  function strokeFor(cs) {
    const sides = ['Top', 'Right', 'Bottom', 'Left'];
    const ws = sides.map((s) => (cs['border' + s + 'Style'] === 'none' || cs['border' + s + 'Style'] === 'hidden' ? 0 : px(cs['border' + s + 'Width'])));
    if (!ws.some((v) => v > 0)) return null;
    let col = null;
    for (let i = 0; i < 4; i++) if (ws[i] > 0) { col = parseColor(cs['border' + sides[i] + 'Color']); if (visibleColor(col)) break; }
    if (!visibleColor(col)) return null;
    const style = cs.borderTopStyle !== 'none' ? cs.borderTopStyle : cs.borderBottomStyle;
    const s = { c: col, w: ws };
    if (style === 'dashed') s.d = [Math.max(...ws) * 3, Math.max(...ws) * 2];
    if (style === 'dotted') s.d = [Math.max(...ws), Math.max(...ws)];
    return s;
  }

  function radiiFor(cs, w, h) {
    const lim = Math.min(w, h) / 2;
    const get = (v) => {
      const first = String(v).split(' ')[0];
      const n = first.endsWith('%') ? (parseFloat(first) / 100) * Math.min(w, h) : px(first);
      return r2(Math.min(n, lim));
    };
    const r = [get(cs.borderTopLeftRadius), get(cs.borderTopRightRadius), get(cs.borderBottomRightRadius), get(cs.borderBottomLeftRadius)];
    return r.some((v) => v > 0) ? r : null;
  }

  /* ---------------- Fonts / text ---------------- */
  const fonts = new Set();
  function familyFor(ff) {
    const f = (ff || '').toLowerCase();
    if (f.includes('jakarta')) return 'Plus Jakarta Sans';
    if (f.includes('mono')) return 'Roboto Mono';
    if (f.includes('serif') && !f.includes('sans')) return 'Noto Serif';
    return 'Plus Jakarta Sans';
  }

  function textStyle(cs) {
    const col = parseColor(cs.color) || [0, 0, 0, 1];
    const fam = familyFor(cs.fontFamily);
    const wt = Math.round(px(cs.fontWeight) || 400);
    const it = cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique') ? 1 : 0;
    fonts.add(fam + '|' + wt + '|' + it);
    const st = { f: fam, wt, sz: r2(px(cs.fontSize)), col };
    if (it) st.it = 1;
    const ls = cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing);
    if (ls) st.ls = r3(ls);
    const td = cs.textDecorationLine || cs.textDecoration || '';
    if (td.includes('underline')) st.td = 'U';
    else if (td.includes('line-through')) st.td = 'S';
    const tt = cs.textTransform;
    if (tt === 'uppercase') st.tc = 'UPPER';
    else if (tt === 'lowercase') st.tc = 'LOWER';
    else if (tt === 'capitalize') st.tc = 'TITLE';
    return st;
  }

  const INLINE = new Set(['inline', 'inline-block', 'contents']);
  function isPlainInline(el) {
    if (el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === 'BR') return true;
    if (/^(IMG|SVG|svg|INPUT|TEXTAREA|SELECT|VIDEO|CANVAS|BUTTON)$/.test(tag)) return false;
    const cs = getComputedStyle(el);
    if (cs.display !== 'inline') return false;
    if (hasBox(cs)) return false;
    for (const c of el.childNodes) if (c.nodeType === 1 && !isPlainInline(c)) return false;
    return true;
  }

  function hasBox(cs) {
    return visibleColor(parseColor(cs.backgroundColor)) || (cs.backgroundImage && cs.backgroundImage !== 'none') || strokeFor(cs) || (cs.boxShadow && cs.boxShadow !== 'none');
  }

  function collapse(text, ws) {
    if (/^pre/.test(ws)) return text;
    return text.replace(/[ \t\n\r\f]+/g, ' ');
  }

  /** Text segments of an element made only of text and plain inline elements. */
  function segmentsOf(el) {
    return segmentsOfNodes(Array.from(el.childNodes), getComputedStyle(el));
  }
  function segmentsOfNodes(nodes, baseCs) {
    const segs = [];
    const walk = (list, cs) => {
      for (const c of list) {
        if (c.nodeType === 3) {
          const t = collapse(c.nodeValue, cs.whiteSpace);
          if (t) segs.push({ c: t, st: textStyle(cs) });
        } else if (c.nodeType === 1) {
          if (c.tagName === 'BR') segs.push({ c: '\n', st: textStyle(cs) });
          else {
            const ccs = getComputedStyle(c);
            if (ccs.display === 'none' || ccs.visibility === 'hidden') continue;
            walk(c.childNodes, ccs);
          }
        }
      }
    };
    walk(nodes, baseCs);
    // Trim leading/trailing whitespace of the block and spaces around line breaks.
    let joined = segs.map((s) => s.c).join('');
    if (!joined.trim()) return null;
    while (segs.length && !segs[0].c.trim() && segs[0].c !== '\n') segs.shift();
    while (segs.length && !segs[segs.length - 1].c.trim()) segs.pop();
    if (segs.length) {
      segs[0].c = segs[0].c.replace(/^ +/, '');
      segs[segs.length - 1].c = segs[segs.length - 1].c.replace(/ +$/, '');
    }
    for (let i = 1; i < segs.length; i++) if (segs[i - 1].c.endsWith(' ') && segs[i].c.startsWith(' ')) segs[i].c = segs[i].c.slice(1);
    // Merge neighbours with identical style.
    const out = [];
    for (const s of segs) {
      const prev = out[out.length - 1];
      if (prev && JSON.stringify(prev.st) === JSON.stringify(s.st)) prev.c += s.c;
      else if (s.c) out.push({ c: s.c, st: s.st });
    }
    return out.map((s) => Object.assign({ c: s.c.replace(/ ?\n ?/g, '\n') }, s.st));
  }

  function textRect(nodeOrEl, lastNode) {
    const range = document.createRange();
    if (lastNode) {
      range.setStartBefore(nodeOrEl);
      range.setEndAfter(lastNode);
    } else range.selectNodeContents(nodeOrEl);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) return null;
    const box = rects.reduce((a, r) => ({ l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) }), { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
    const lines = new Set(rects.map((r) => Math.round(r.top + r.height / 2))).size;
    return { x: box.l, y: box.t, w: box.r - box.l, h: box.b - box.t, lines };
  }

  function lineHeightOf(cs) {
    if (cs.lineHeight === 'normal') return null;
    return r2(px(cs.lineHeight));
  }

  function alignOf(cs) {
    const a = cs.textAlign;
    if (a === 'center' || a === '-webkit-center') return 'C';
    if (a === 'right' || a === 'end') return 'R';
    if (a === 'justify') return 'J';
    return null;
  }

  function makeText(segs, rect, cs, contentBox, name) {
    if (!segs || !segs.length || !rect) return null;
    const multi = rect.lines > 1 || segs.some((s) => s.c.includes('\n'));
    const al = alignOf(cs);
    const node = { t: 'T', n: name || segs.map((s) => s.c).join('').slice(0, 40), seg: segs };
    const lh = lineHeightOf(cs);
    if (lh) node.lh = lh;
    if (al) node.al = al;
    if (cs.textOverflow === 'ellipsis' && cs.overflow !== 'visible') node.el = 1;
    if (multi || al === 'C' || al === 'R') {
      // Fixed width box. For centred/right text use the element's content box so alignment survives.
      const box = multi || !contentBox ? (contentBox && (al || multi) ? contentBox : rect) : contentBox;
      node.ab = { x: box.x, y: rect.y, w: Math.max(rect.w, box.w) + 1, h: rect.h };
      node.ml = 1;
    } else {
      node.ab = { x: rect.x, y: rect.y, w: rect.w + 1, h: rect.h };
    }
    const tsh = parseShadows(cs.textShadow);
    if (tsh.length) node.fx = tsh.map((s) => Object.assign(s, { k: 'DS' }));
    return node;
  }

  /* ---------------- SVG ---------------- */
  const SVG_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'stop-color', 'stop-opacity', 'visibility', 'display'];
  const SVG_DEFAULTS = { 'stroke-dasharray': 'none', 'stroke-dashoffset': '0px', opacity: '1', 'fill-opacity': '1', 'stroke-opacity': '1', 'fill-rule': 'nonzero', 'stop-opacity': '1', 'stroke-width': '1px', 'stroke-linecap': 'butt', 'stroke-linejoin': 'miter', stroke: 'none' };
  const SVG_INHERITED = new Set(['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'visibility']);
  function svgColor(v) {
    const c = parseColor(v);
    if (!c) return { v, a: 1 };
    return { v: `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`, a: c[3] };
  }
  function serializeSvg(svg) {
    const rect = svg.getBoundingClientRect();
    const clone = svg.cloneNode(true);
    const src = [svg, ...svg.querySelectorAll('*')];
    const dst = [clone, ...clone.querySelectorAll('*')];
    const resolved = new Map();
    src.forEach((s, i) => {
      const d = dst[i];
      if (!d || !d.setAttribute) return;
      const cs = getComputedStyle(s);
      const mine = {};
      const parentVals = resolved.get(s.parentElement) || null;
      for (const p of SVG_PROPS) {
        let v = cs.getPropertyValue(p);
        if (!v) continue;
        if (p === 'display') { if (v === 'none') d.setAttribute('display', 'none'); continue; }
        if (p === 'visibility') { if (v !== 'visible') d.setAttribute('visibility', v); continue; }
        if (p === 'stop-color' && s.tagName.toLowerCase() !== 'stop') continue;
        if (p === 'stop-opacity' && s.tagName.toLowerCase() !== 'stop') continue;
        let extraOpacity = null;
        if ((p === 'fill' || p === 'stroke' || p === 'stop-color') && v !== 'none' && !v.startsWith('url')) {
          const c = svgColor(v);
          v = c.v;
          if (c.a < 1) extraOpacity = c.a;
        }
        mine[p] = v;
        const inherited = parentVals && SVG_INHERITED.has(p) ? parentVals[p] : undefined;
        const skip = parentVals ? (SVG_INHERITED.has(p) ? inherited === v : SVG_DEFAULTS[p] === v) : SVG_DEFAULTS[p] === v;
        if (!skip) d.setAttribute(p, v);
        else d.removeAttribute(p);
        if (extraOpacity !== null) {
          const op = p === 'stop-color' ? 'stop-opacity' : p + '-opacity';
          d.setAttribute(op, String(Math.round(extraOpacity * px(cs.getPropertyValue(op) || '1') * 1000) / 1000));
        }
      }
      resolved.set(s, mine);
      d.removeAttribute('class');
      d.removeAttribute('style');
    });
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(r2(rect.width)));
    clone.setAttribute('height', String(r2(rect.height)));
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    clone.removeAttribute('aria-hidden');
    clone.removeAttribute('focusable');
    return new XMLSerializer().serializeToString(clone).replace(/\s+xmlns:xlink="[^"]*"/, ' xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  /* ---------------- Pseudo-elements → real nodes ---------------- */
  function materializePseudo(root) {
    const style = document.createElement('style');
    style.textContent = '[data-fig-pb]::before{content:none!important}[data-fig-pa]::after{content:none!important}';
    const made = [];
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      for (const which of ['::before', '::after']) {
        const cs = getComputedStyle(el, which);
        const content = cs.content;
        if (!content || content === 'none' || content === 'normal' || cs.display === 'none') continue;
        const span = document.createElement('span');
        span.setAttribute('data-fig-pseudo', which === '::before' ? 'before' : 'after');
        for (let i = 0; i < cs.length; i++) {
          const prop = cs[i];
          if (prop === 'content') continue;
          span.style.setProperty(prop, cs.getPropertyValue(prop));
        }
        const str = content.match(/^"(.*)"$/s);
        if (str) span.textContent = str[1].replace(/\\([0-9a-f]{1,6}) ?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
        const url = content.match(/url\(["']?(.*?)["']?\)/);
        if (url) {
          const img = document.createElement('img');
          img.src = url[1];
          span.appendChild(img);
        }
        made.push({ el, span, which });
      }
    }
    for (const m of made) {
      if (m.which === '::before') {
        m.el.setAttribute('data-fig-pb', '');
        m.el.insertBefore(m.span, m.el.firstChild);
      } else {
        m.el.setAttribute('data-fig-pa', '');
        m.el.appendChild(m.span);
      }
    }
    document.head.appendChild(style);
    return made.length;
  }

  /* ---------------- Naming ---------------- */
  const moduleClass = /^_?([A-Za-z][\w-]*?)_[\w-]{5}(?:_\d+)?$/;
  function nameFor(el) {
    const a = el.getAttribute && (el.getAttribute('data-fig-name') || el.getAttribute('aria-label'));
    const role = el.getAttribute && el.getAttribute('role');
    let cls = '';
    if (el.classList) {
      for (const c of el.classList) {
        const m = c.match(moduleClass);
        if (m) { cls = m[1]; break; }
      }
      if (!cls && el.classList.length) cls = el.classList[0];
    }
    const tag = el.tagName.toLowerCase();
    const human = cls ? cls.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase()) : '';
    if (el.getAttribute && el.getAttribute('data-fig-pseudo')) return (human || 'Decoration') + ' (' + el.getAttribute('data-fig-pseudo') + ')';
    if (tag === 'button' || role === 'button') return 'Button / ' + (a || el.textContent.trim().slice(0, 32) || human || 'button');
    if (tag === 'a') return 'Link / ' + (a || el.textContent.trim().slice(0, 32) || human || 'link');
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'Input / ' + (a || el.getAttribute('placeholder') || el.name || human || tag);
    if (tag === 'img') return 'Image / ' + (el.alt || human || 'image').slice(0, 48);
    if (role === 'dialog') return 'Dialog / ' + (a || human || 'dialog');
    if (a) return (human ? human + ' · ' : '') + a.slice(0, 48);
    if (human) return human;
    if (/^h[1-6]$/.test(tag)) return 'Heading';
    const map = { header: 'Header', nav: 'Navigation', main: 'Main', section: 'Section', footer: 'Footer', ul: 'List', ol: 'List', li: 'Item', article: 'Article', aside: 'Aside', form: 'Form', figure: 'Figure', p: 'Text', span: 'Span', label: 'Label', video: 'Video' };
    return map[tag] || 'Frame';
  }

  /** Stable key for an element: index path from the capture root. */
  function keyOf(el, root) {
    const path = [];
    let cur = el;
    while (cur && cur !== root) {
      const p = cur.parentElement;
      if (!p) break;
      // Ignore materialised pseudo-elements so keys match the live DOM.
      const sibs = Array.prototype.filter.call(p.children, (c) => !c.hasAttribute('data-fig-pseudo'));
      path.push(sibs.indexOf(cur));
      cur = p;
    }
    return path.reverse().join('.');
  }

  /* ---------------- Walk ---------------- */
  function isHidden(el, cs) {
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return true;
    if (px(cs.opacity) === 0) return true;
    // Screen-reader-only blocks.
    if (cs.position === 'absolute' && (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)') ) return true;
    return false;
  }

  async function inputNode(el, cs, rect, base) {
    let text = '';
    let placeholder = false;
    if (el.tagName === 'SELECT') text = el.selectedOptions[0] ? el.selectedOptions[0].textContent : '';
    else if (el.type === 'checkbox' || el.type === 'radio' || el.type === 'range' || el.type === 'file' || el.type === 'hidden') return null;
    else text = el.type === 'password' ? '•'.repeat(el.value.length) : el.value;
    if (!text && el.placeholder) {
      text = el.placeholder;
      placeholder = true;
    }
    if (!text) return null;
    const st = textStyle(cs);
    if (placeholder) {
      const pcs = getComputedStyle(el, '::placeholder');
      st.col = parseColor(pcs.color) || st.col;
    }
    const pl = px(cs.paddingLeft) + px(cs.borderLeftWidth);
    const pr = px(cs.paddingRight) + px(cs.borderRightWidth);
    const lh = lineHeightOf(cs) || st.sz * 1.3;
    const multi = el.tagName === 'TEXTAREA';
    const y = multi ? rect.top + px(cs.paddingTop) + px(cs.borderTopWidth) : rect.top + (rect.height - lh) / 2;
    const node = { t: 'T', n: placeholder ? 'Placeholder' : 'Value', seg: [Object.assign({ c: text }, st)], lh, ab: { x: rect.left + pl, y, w: Math.max(4, rect.width - pl - pr), h: multi ? rect.height - px(cs.paddingTop) * 2 : lh }, ml: 1 };
    const al = alignOf(cs);
    if (al) node.al = al;
    node.x = r2(node.ab.x - base.x);
    node.y = r2(node.ab.y - base.y);
    node.w = r2(node.ab.w);
    node.h = r2(node.ab.h);
    delete node.ab;
    return node;
  }

  const LINKS = [];

  async function walk(el, root, parentAbs, opts, depth) {
    const cs = getComputedStyle(el);
    if (el !== root && isHidden(el, cs)) return null;
    const rect = el.getBoundingClientRect();
    const tag = el.tagName;
    const abs = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    const rel = (b) => ({ x: r2(b.x - parentAbs.x), y: r2(b.y - parentAbs.y), w: r2(b.w), h: r2(b.h) });
    const op = px(cs.opacity);

    // SVG → vector node.
    if (tag.toLowerCase() === 'svg') {
      if (rect.width < 0.5 || rect.height < 0.5) return null;
      const node = Object.assign({ t: 'V', n: el.getAttribute('aria-label') || (el.classList[0] && el.classList[0].startsWith('lucide') ? 'Icon / ' + el.classList[1].replace('lucide-', '') : 'Vector'), svg: serializeSvg(el) }, rel(abs));
      if (op < 1) node.op = r3(op);
      return node;
    }

    const node = Object.assign({ t: 'F', n: nameFor(el) }, rel(abs));
    if (op < 1) node.op = r3(op);
    const fills = await backgroundPaints(cs, abs.w, abs.h);
    if (fills.length) node.f = fills;
    const st = strokeFor(cs);
    if (st) node.s = st;
    const rad = radiiFor(cs, abs.w, abs.h);
    if (rad) node.r = rad;
    const fx = effectsFor(cs);
    if (fx.length) node.fx = fx;
    const clip = (cs.overflowX !== 'visible' && cs.overflowX !== 'unset') || (cs.overflowY !== 'visible' && cs.overflowY !== 'unset') || (cs.clipPath && cs.clipPath !== 'none');
    if (clip && el !== root) node.c = 1;
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') node.bm = cs.mixBlendMode.toUpperCase().replace('-', '_');
    if (tag === 'A' && el.getAttribute('href')) {
      node.k = keyOf(el, root);
      LINKS.push({ k: node.k, href: el.getAttribute('href') });
    } else if (tag === 'BUTTON' || el.getAttribute('role') === 'button' || el.getAttribute('role') === 'tab' || el.getAttribute('role') === 'radio' || el.getAttribute('role') === 'switch') {
      node.k = keyOf(el, root);
    }
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') node.dis = 1;

    // Replaced elements.
    if (tag === 'IMG') {
      const src = el.currentSrc || el.src;
      if (src && rect.width > 0.5 && rect.height > 0.5) {
        const id = await registerImage(src, rect.width, rect.height, el);
        if (id) {
          const fit = cs.objectFit || 'fill';
          node.f = (node.f || []).concat([{ k: 'I', id, ...objectFitTransform(fit, cs.objectPosition, rect.width, rect.height, el.naturalWidth || rect.width, el.naturalHeight || rect.height) }]);
          node.c = 1;
          node.img = 1;
        }
      }
      return node;
    }
    if (tag === 'VIDEO' || tag === 'CANVAS') {
      let cv = el;
      if (tag === 'VIDEO') {
        cv = document.createElement('canvas');
        cv.width = el.videoWidth || Math.round(rect.width * 2);
        cv.height = el.videoHeight || Math.round(rect.height * 2);
        try {
          if (el.readyState >= 2) cv.getContext('2d').drawImage(el, 0, 0, cv.width, cv.height);
          else cv = null;
        } catch (e) {
          cv = null;
        }
        if (!cv && el.poster) {
          const id = await registerImage(el.poster, rect.width, rect.height);
          if (id) node.f = (node.f || []).concat([{ k: 'I', id, mode: 'FILL' }]);
        }
      }
      if (cv) {
        const id = await registerCanvas(cv, tag);
        if (id) node.f = (node.f || []).concat([{ k: 'I', id, ...objectFitTransform(cs.objectFit || 'contain', cs.objectPosition, rect.width, rect.height, cv.width, cv.height) }]);
      }
      node.c = 1;
      return node;
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      const t = await inputNode(el, cs, rect, abs);
      if (t) node.ch = [t];
      return node;
    }

    // Children, in painting order.
    const kids = [];
    const childEls = Array.from(el.childNodes);
    const contentBox = {
      x: rect.left + px(cs.borderLeftWidth) + px(cs.paddingLeft),
      y: rect.top + px(cs.borderTopWidth) + px(cs.paddingTop),
      w: rect.width - px(cs.borderLeftWidth) - px(cs.borderRightWidth) - px(cs.paddingLeft) - px(cs.paddingRight),
      h: rect.height - px(cs.borderTopWidth) - px(cs.borderBottomWidth) - px(cs.paddingTop) - px(cs.paddingBottom),
    };
    const onlyInline = childEls.length > 0 && childEls.every((c) => c.nodeType === 3 || (c.nodeType === 1 && isPlainInline(c)) || c.nodeType === 8);
    if (onlyInline) {
      const segs = segmentsOf(el);
      const tr = segs ? textRect(el) : null;
      const t = makeText(segs, tr, cs, contentBox);
      if (t) kids.push({ z: [0, 0, 0], node: t });
    } else {
      let i = 0;
      let run = [];
      const flush = () => {
        if (!run.length) return;
        const segs = segmentsOfNodes(run, cs);
        const tr = segs ? textRect(run[0], run[run.length - 1]) : null;
        const t = makeText(segs, tr, cs, null);
        if (t) kids.push({ z: [0, 0, i], node: t });
        run = [];
      };
      for (const c of childEls) {
        i++;
        if (c.nodeType === 3 || (c.nodeType === 1 && isPlainInline(c))) {
          // Consecutive text and plain inline elements form one text layer.
          run.push(c);
          continue;
        }
        flush();
        if (c.nodeType === 1) {
          const ccs = getComputedStyle(c);
          if (isHidden(c, ccs)) continue;
          const positioned = ccs.position !== 'static';
          const zi = ccs.zIndex === 'auto' ? 0 : parseInt(ccs.zIndex, 10) || 0;
          const bucket = zi < 0 ? -1 : positioned || zi > 0 || ccs.transform !== 'none' || px(ccs.opacity) < 1 ? 1 : 0;
          const child = await walk(c, root, abs, opts, depth + 1);
          if (child) kids.push({ z: [bucket, zi, i], node: child });
        }
      }
      flush();
    }
    kids.sort((a, b) => a.z[0] - b.z[0] || a.z[1] - b.z[1] || a.z[2] - b.z[2]);
    const ch = [];
    for (const k of kids) {
      const n = k.node;
      if (n.ab) {
        // Text boxes are measured in page space; make them relative to this element.
        Object.assign(n, { x: r2(n.ab.x - abs.x), y: r2(n.ab.y - abs.y), w: r2(n.ab.w), h: r2(n.ab.h) });
        delete n.ab;
      }
      ch.push(n);
    }
    if (ch.length) node.ch = ch;

    // Collapse an invisible wrapper around exactly one child: keep the tree shallow.
    const plain = !node.f && !node.s && !node.fx && !node.c && !node.op && !node.k && !node.bm && el !== root;
    if (plain && ch.length === 1 && ch[0].t === 'F' && Math.abs(ch[0].x) < 0.6 && Math.abs(ch[0].y) < 0.6 && Math.abs(ch[0].w - node.w) < 0.6 && Math.abs(ch[0].h - node.h) < 0.6) {
      const only = ch[0];
      only.x = node.x;
      only.y = node.y;
      if (/^(Frame|Span|Section|Text)$/.test(only.n) && !/^(Frame|Span)$/.test(node.n)) only.n = node.n;
      return only;
    }
    if (plain && !ch.length) return null;
    if (plain && ch.length === 1 && ch[0].t === 'T') {
      // A plain block holding only text: the text node stands in for it.
      const t = ch[0];
      t.x = r2(t.x + node.x);
      t.y = r2(t.y + node.y);
      if (!/^(Frame|Span|Text|Heading)$/.test(node.n)) t.n = node.n;
      return t;
    }
    return node;
  }

  window.__figSerialize = async function (rootEl, opts) {
    opts = opts || {};
    LINKS.length = 0;
    const pseudo = materializePseudo(rootEl);
    const rect = rootEl.getBoundingClientRect();
    const root = await walk(rootEl, rootEl, { x: rect.left, y: rect.top }, opts, 0);
    root.x = 0;
    root.y = 0;
    return { root, images: Object.assign({}, images), links: LINKS.slice(), fonts: Array.from(fonts), pseudo };
  };

  window.__figResetImages = function () {
    for (const k of Object.keys(images)) delete images[k];
    imageKeys.clear();
  };

  window.__figKeyOf = keyOf;
  window.__figParseShadows = parseShadows;
  window.__figParseColor = parseColor;
})();
