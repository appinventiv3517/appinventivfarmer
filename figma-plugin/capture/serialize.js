/*
 * In-page serializer for the Figma capture.
 *
 * Runs inside the app (via Playwright) and turns the rendered screen into a
 * compact node tree that the plugin rebuilds as editable Figma layers:
 *   F  frame (boxes, backgrounds, borders, radii, shadows, blur, clipping)
 *   T  text (characters + styled ranges, alignment, line clamp)
 *   V  vector (inline SVG, ids normalised, computed colours inlined)
 * Images and videos become frames with an image fill. SVG and bitmap payloads
 * go into a shared, de-duplicated asset table keyed by content hash.
 *
 * Exposes window.__figmaCapture(selector, options) → { root, assets, meta }.
 */
(function () {
  'use strict';

  // ---------- helpers ----------
  const r2 = (n) => Math.round(n * 100) / 100;

  function hash(str) {
    let h1 = 0xdeadbeef ^ str.length, h2 = 0x41c6ce57 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
  }

  /** Parse any computed CSS colour into [r,g,b,a] with r,g,b in 0..1. */
  const colorCanvas = document.createElement('canvas').getContext('2d');
  function parseColor(str) {
    if (!str) return null;
    str = str.trim();
    if (str === 'transparent') return [0, 0, 0, 0];
    let m = str.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) {
      let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return [m[1] / 255, m[2] / 255, m[3] / 255, a];
    }
    m = str.match(/^color\(srgb\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
    if (m) {
      const cl = (v) => Math.min(1, Math.max(0, parseFloat(v)));
      let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      return [cl(m[1]), cl(m[2]), cl(m[3]), a];
    }
    // Anything else (oklab, named, color-mix leftovers): let canvas resolve it.
    // Canvas silently keeps the previous value for invalid input, so probe with
    // two different sentinels: only a real colour changes both.
    if (/^-?[\d.]+(%|px|deg|em|rem)?$/.test(str)) return null;
    colorCanvas.fillStyle = '#010203';
    colorCanvas.fillStyle = str;
    const v = colorCanvas.fillStyle;
    colorCanvas.fillStyle = '#030201';
    colorCanvas.fillStyle = str;
    if (colorCanvas.fillStyle !== v) return null;
    if (v.startsWith('#')) {
      const n = parseInt(v.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
    }
    m = v.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(',').map((x) => parseFloat(x));
      return [p[0] / 255, p[1] / 255, p[2] / 255, p[3] === undefined ? 1 : p[3]];
    }
    return null;
  }
  const rc = (c) => c.map((v, i) => (i < 3 ? Math.round(v * 1000) / 1000 : Math.round(v * 1000) / 1000));

  /** Split on commas that are not inside parentheses. */
  function splitTop(str, sep = ',') {
    const out = [];
    let depth = 0, cur = '';
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
  /** Split on whitespace not inside parentheses. */
  function splitSpace(str) {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of str) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (/\s/.test(ch) && depth === 0) {
        if (cur) out.push(cur);
        cur = '';
      } else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }

  function parseStops(parts, lengthPx) {
    const stops = [];
    for (const p of parts) {
      const tokens = splitSpace(p);
      const col = parseColor(tokens[0]);
      if (!col) continue;
      const positions = tokens.slice(1).map((t) => (t.endsWith('%') ? parseFloat(t) / 100 : t.endsWith('px') ? parseFloat(t) / (lengthPx || 1) : NaN));
      if (positions.length === 0) stops.push({ c: col, p: null });
      for (const pos of positions) stops.push({ c: col, p: pos });
    }
    if (!stops.length) return null;
    // Fill missing positions (first 0, last 1, interpolate gaps).
    if (stops[0].p === null || isNaN(stops[0].p)) stops[0].p = 0;
    if (stops[stops.length - 1].p === null || isNaN(stops[stops.length - 1].p)) stops[stops.length - 1].p = 1;
    for (let i = 1; i < stops.length; i++) {
      if (stops[i].p === null || isNaN(stops[i].p)) {
        let j = i;
        while (stops[j].p === null || isNaN(stops[j].p)) j++;
        const a = stops[i - 1].p, b = stops[j].p;
        for (let k = i; k < j; k++) stops[k].p = a + ((b - a) * (k - i + 1)) / (j - i + 1);
      }
      if (stops[i].p < stops[i - 1].p) stops[i].p = stops[i - 1].p;
    }
    return stops.map((s) => [r2(Math.min(1, Math.max(0, s.p))), ...rc(s.c)]);
  }

  const SIDE_ANGLE = { top: 0, right: 90, bottom: 180, left: 270, 'top right': 45, 'right top': 45, 'bottom right': 135, 'right bottom': 135, 'bottom left': 225, 'left bottom': 225, 'top left': 315, 'left top': 315 };

  function parseGradient(layer, w, h) {
    let m = layer.match(/^(repeating-)?linear-gradient\((.*)\)$/s);
    if (m) {
      const parts = splitTop(m[2]);
      let angle = 180;
      if (/^-?[\d.]+(deg|turn|rad|grad)$/.test(parts[0])) {
        const v = parseFloat(parts[0]);
        angle = parts[0].endsWith('turn') ? v * 360 : parts[0].endsWith('rad') ? (v * 180) / Math.PI : parts[0].endsWith('grad') ? v * 0.9 : v;
        parts.shift();
      } else if (parts[0].startsWith('to ')) {
        const side = parts.shift().slice(3).trim();
        angle = SIDE_ANGLE[side] ?? 180;
        if (side.includes(' ')) {
          // Corner angles depend on the box aspect ratio.
          const a = (Math.atan2(w, h) * 180) / Math.PI;
          angle = { 45: a, 135: 180 - a, 225: 180 + a, 315: 360 - a }[angle] ?? angle;
        }
      }
      const rad = (angle * Math.PI) / 180;
      const len = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
      const stops = parseStops(parts, len);
      return stops ? { k: 'L', a: r2(angle), s: stops } : null;
    }
    m = layer.match(/^(repeating-)?radial-gradient\((.*)\)$/s);
    if (m) {
      const parts = splitTop(m[2]);
      let shape = 'ellipse', size = 'farthest-corner', cx = 0.5, cy = 0.5, rx = null, ry = null;
      if (!parseColor(splitSpace(parts[0])[0])) {
        const spec = parts.shift();
        const [shapePart, atPart] = spec.split(/\bat\b/).map((x) => (x || '').trim());
        if (atPart) {
          const pos = splitSpace(atPart);
          const toFrac = (t, dim) => (t === 'left' || t === 'top' ? 0 : t === 'right' || t === 'bottom' ? 1 : t === 'center' ? 0.5 : t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t) / dim);
          if (pos.length === 1) cx = toFrac(pos[0], w);
          else {
            cx = toFrac(pos[0], w);
            cy = toFrac(pos[1], h);
          }
        }
        for (const tok of splitSpace(shapePart)) {
          if (tok === 'circle' || tok === 'ellipse') shape = tok;
          else if (/(closest|farthest)-(side|corner)/.test(tok)) size = tok;
          else if (/[\d.]+(px|%)$/.test(tok)) {
            const v = tok.endsWith('%') ? (parseFloat(tok) / 100) * (rx === null ? w : h) : parseFloat(tok);
            if (rx === null) rx = v;
            else ry = v;
          }
        }
      }
      const px = cx * w, py = cy * h;
      if (rx === null) {
        const dx = [px, w - px], dy = [py, h - py];
        if (shape === 'circle') {
          const corners = [Math.hypot(px, py), Math.hypot(w - px, py), Math.hypot(px, h - py), Math.hypot(w - px, h - py)];
          const sides = [px, w - px, py, h - py];
          const r = size === 'closest-side' ? Math.min(...sides) : size === 'farthest-side' ? Math.max(...sides) : size === 'closest-corner' ? Math.min(...corners) : Math.max(...corners);
          rx = ry = r;
        } else {
          const sx = size.includes('closest') ? Math.min(...dx) : Math.max(...dx);
          const sy = size.includes('closest') ? Math.min(...dy) : Math.max(...dy);
          const k = size.includes('corner') ? Math.SQRT2 : 1;
          rx = sx * k;
          ry = sy * k;
        }
      }
      if (ry === null) ry = rx;
      const stops = parseStops(parts, rx);
      return stops ? { k: 'R', cx: r2(cx), cy: r2(cy), rx: r2(rx / (w || 1)), ry: r2(ry / (h || 1)), s: stops } : null;
    }
    return null;
  }

  function parseShadows(str) {
    if (!str || str === 'none') return [];
    const out = [];
    for (const layer of splitTop(str)) {
      const tokens = splitSpace(layer);
      let inset = false, color = [0, 0, 0, 0.25];
      const nums = [];
      for (const t of tokens) {
        if (t === 'inset') inset = true;
        else if (/^-?[\d.]+(px)?$/.test(t)) nums.push(parseFloat(t));
        else {
          const c = parseColor(t);
          if (c) color = c;
        }
      }
      if (color[3] === 0) continue;
      out.push({ k: inset ? 'I' : 'D', c: rc(color), x: nums[0] || 0, y: nums[1] || 0, b: nums[2] || 0, s: nums[3] || 0 });
    }
    return out;
  }

  function parseFilterFn(str, name) {
    if (!str || str === 'none') return null;
    const m = str.match(new RegExp(name + '\\(([^)]*(?:\\([^)]*\\)[^)]*)*)\\)'));
    return m ? m[1] : null;
  }

  function radiusPx(v, w, h) {
    const first = v.split(' ')[0];
    const px = first.endsWith('%') ? (parseFloat(first) / 100) * Math.min(w, h) : parseFloat(first) || 0;
    return r2(Math.min(px, Math.min(w, h) / 2));
  }

  const BLEND = { multiply: 'MULTIPLY', screen: 'SCREEN', overlay: 'OVERLAY', darken: 'DARKEN', lighten: 'LIGHTEN', 'color-dodge': 'COLOR_DODGE', 'color-burn': 'COLOR_BURN', 'hard-light': 'HARD_LIGHT', 'soft-light': 'SOFT_LIGHT', difference: 'DIFFERENCE', exclusion: 'EXCLUSION', hue: 'HUE', saturation: 'SATURATION', color: 'COLOR', luminosity: 'LUMINOSITY' };

  // ---------- naming ----------
  function moduleClasses(el) {
    const out = [];
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
    for (const c of cls.split(/\s+/)) {
      const m = c.match(/^([A-Za-z0-9]+)__([A-Za-z0-9_]+)$/);
      if (m) out.push({ mod: m[1], local: m[2] });
    }
    return out;
  }
  function nameFor(el) {
    const mc = moduleClasses(el);
    const tag = el.tagName.toLowerCase();
    const aria = el.getAttribute('aria-label');
    let base = '';
    if (mc.length) base = mc[0].mod + '/' + mc.map((m) => m.local).join('.');
    else {
      const plain = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter((c) => c && !c.startsWith('lucide'))[0];
      base = plain || tag;
    }
    if (aria && (tag === 'button' || tag === 'a' || el.getAttribute('role'))) base += ' · ' + aria.slice(0, 40);
    return base;
  }

  // ---------- visibility ----------
  function isHidden(el, cs) {
    if (cs.display === 'none') return true;
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return true;
    if (parseFloat(cs.opacity) === 0) return true;
    if (cs.clip && cs.clip !== 'auto' && /rect\(0px,? 0px,? 0px,? 0px\)/.test(cs.clip)) return true;
    if (cs.clipPath && /inset\(50%\)/.test(cs.clipPath)) return true;
    return false;
  }
  const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function intersect(a, b) {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
  }

  // ---------- pseudo elements ----------
  // ::before/::after boxes (live dots, unread markers) are made into real spans
  // for the duration of the capture so they get exact positions.
  function materializePseudos(root) {
    const made = [];
    const style = document.createElement('style');
    style.textContent = '[data-fc-host="before"]::before,[data-fc-host="after"]::after,[data-fc-host="both"]::before,[data-fc-host="both"]::after{content:none!important}';
    const all = root.querySelectorAll('*');
    const plans = [];
    for (const el of all) {
      if (el.closest('svg')) continue;
      for (const which of ['::before', '::after']) {
        const cs = getComputedStyle(el, which);
        const content = cs.content;
        if (!content || content === 'none' || content === 'normal') continue;
        if (/url\(/.test(cs.backgroundImage)) continue; // film grain texture: skipped
        const text = content.replace(/^["']|["']$/g, '');
        const hasBox = parseColor(cs.backgroundColor)?.[3] > 0 || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none' || cs.backgroundImage !== 'none';
        if (!hasBox && !text.trim()) continue;
        if (parseFloat(cs.opacity) === 0 || cs.display === 'none') continue;
        // Shimmer sweeps are animation, not design.
        if (cs.animationName && /shimmer/.test(cs.animationName)) continue;
        const copy = {};
        for (let i = 0; i < cs.length; i++) copy[cs[i]] = cs.getPropertyValue(cs[i]);
        plans.push({ el, which, text, copy });
      }
    }
    for (const { el, which, text, copy } of plans) {
      const span = document.createElement('span');
      span.setAttribute('data-fc-pseudo', which);
      for (const k in copy) {
        if (k === 'content' || k.startsWith('animation') || k.startsWith('transition')) continue;
        span.style.setProperty(k, copy[k]);
      }
      if (text && text !== '""' && text !== "''") span.textContent = text;
      if (which === '::before') el.insertBefore(span, el.firstChild);
      else el.appendChild(span);
      const prev = el.getAttribute('data-fc-host');
      el.setAttribute('data-fc-host', prev ? 'both' : which.slice(2));
      made.push(span);
    }
    document.head.appendChild(style);
    return () => {
      made.forEach((s) => s.remove());
      root.querySelectorAll('[data-fc-host]').forEach((e) => e.removeAttribute('data-fc-host'));
      style.remove();
    };
  }

  // ---------- assets ----------
  let ASSETS = {};
  function addAsset(kind, data, extra) {
    const id = kind[0] + hash(data);
    if (!ASSETS[id]) ASSETS[id] = Object.assign({ kind, data }, extra || {});
    return id;
  }

  async function rasterizeSvgString(svgStr, w, h, scale) {
    const s = scale || 2;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    const img = new Image();
    img.decoding = 'sync';
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  async function imageToData(el, w, h) {
    try {
      const c = document.createElement('canvas');
      let iw, ih, mime = 'image/png';
      if (el.tagName === 'VIDEO') {
        if (!el.videoWidth || el.readyState < 2) return null;
        iw = el.videoWidth;
        ih = el.videoHeight;
        mime = 'image/jpeg';
      } else {
        if (!el.complete || !el.naturalWidth) await el.decode().catch(() => undefined);
        iw = el.naturalWidth;
        ih = el.naturalHeight;
        if (!iw) return null;
        if (/\.(jpe?g)(\?|$)/i.test(el.currentSrc || el.src)) mime = 'image/jpeg';
      }
      const max = 1400;
      const k = Math.min(1, max / Math.max(iw, ih), Math.max((w * 2.5) / iw, (h * 2.5) / ih, 0.1));
      c.width = Math.max(1, Math.round(iw * k));
      c.height = Math.max(1, Math.round(ih * k));
      c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
      return c.toDataURL(mime, 0.86);
    } catch (e) {
      return null;
    }
  }

  const SVG_PRESENTATION = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'clip-rule', 'stop-color', 'stop-opacity'];

  function serializeSvg(svg) {
    const clone = svg.cloneNode(true);
    const srcEls = [svg, ...svg.querySelectorAll('*')];
    const dstEls = [clone, ...clone.querySelectorAll('*')];
    const drop = [];
    for (let i = 0; i < srcEls.length; i++) {
      const s = srcEls[i], d = dstEls[i];
      const cs = getComputedStyle(s);
      if (cs.display === 'none' && s !== svg && !s.closest('defs') && s.tagName !== 'defs' && s.tagName !== 'linearGradient' && s.tagName !== 'radialGradient' && s.tagName !== 'stop' && s.tagName !== 'clipPath' && s.tagName !== 'mask') {
        drop.push(d);
        continue;
      }
      for (const p of SVG_PRESENTATION) {
        let v = cs.getPropertyValue(p);
        if (!v) continue;
        if (p === 'stop-color' && s.tagName !== 'stop') continue;
        if (p === 'stop-opacity' && s.tagName !== 'stop') continue;
        if ((p === 'fill' || p === 'stroke' || p === 'stop-color') && /^(rgb|color)/.test(v)) {
          const c = parseColor(v);
          if (c) {
            d.setAttribute(p, '#' + c.slice(0, 3).map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join(''));
            if (c[3] < 1) d.setAttribute(p === 'stop-color' ? 'stop-opacity' : p + '-opacity', String(r2(c[3] * (parseFloat(cs.getPropertyValue(p === 'stop-color' ? 'stop-opacity' : p + '-opacity')) || 1))));
            continue;
          }
        }
        if (p === 'fill' || p === 'stroke') {
          if (v.startsWith('url(')) v = v.replace(/url\(["']?[^#]*#([^"')]+)["']?\)/, 'url(#$1)');
        }
        if (p === 'stroke-width') v = String(parseFloat(v));
        if (p === 'stroke-dasharray' && v === 'none') continue;
        if ((p === 'opacity' || p === 'fill-opacity' || p === 'stroke-opacity') && parseFloat(v) === 1) continue;
        if ((p === 'fill-rule' || p === 'clip-rule') && v === 'nonzero') continue;
        d.setAttribute(p, v);
      }
      d.removeAttribute('class');
      d.removeAttribute('style');
      for (const a of [...d.attributes]) if (a.name.startsWith('aria-') || a.name === 'role' || a.name === 'focusable' || a.name.startsWith('data-')) d.removeAttribute(a.name);
    }
    drop.forEach((d) => d.remove());
    // Normalise ids so identical artwork dedupes across screens.
    const ids = [...clone.querySelectorAll('[id]')];
    let markup;
    const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : null;
    const rect = svg.getBoundingClientRect();
    const vw = vb ? vb.width : rect.width, vh = vb ? vb.height : rect.height;
    clone.setAttribute('width', String(r2(vw)));
    clone.setAttribute('height', String(r2(vh)));
    if (!vb) clone.setAttribute('viewBox', `0 0 ${r2(rect.width)} ${r2(rect.height)}`);
    clone.removeAttribute('preserveAspectRatio');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    markup = new XMLSerializer().serializeToString(clone);
    ids.forEach((el, i) => {
      const id = el.getAttribute('id');
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      markup = markup.replace(new RegExp('id="' + esc + '"', 'g'), `id="g${i}"`).replace(new RegExp('#' + esc + '([")\\s])', 'g'), `#g${i}$1`);
    });
    markup = markup.replace(/ xmlns:xlink="[^"]*"/g, '').replace(/xlink:href/g, 'href');
    // Placement inside the element box (viewBox + preserveAspectRatio).
    let s = 1, ox = 0, oy = 0;
    const par = (svg.getAttribute('preserveAspectRatio') || 'xMidYMid meet').trim();
    if (par === 'none') {
      return { markup, vw, vh, sx: rect.width / vw, sy: rect.height / vh, ox: 0, oy: 0 };
    }
    const slice = /slice/.test(par);
    s = slice ? Math.max(rect.width / vw, rect.height / vh) : Math.min(rect.width / vw, rect.height / vh);
    const align = par.split(' ')[0];
    const ax = /xMin/.test(align) ? 0 : /xMax/.test(align) ? 1 : 0.5;
    const ay = /YMin/.test(align) ? 0 : /YMax/.test(align) ? 1 : 0.5;
    ox = (rect.width - vw * s) * ax;
    oy = (rect.height - vh * s) * ay;
    return { markup, vw, vh, sx: s, sy: s, ox, oy, slice };
  }

  // ---------- text ----------
  const PLAIN_INLINE = new Set(['inline', 'contents']);
  function isPlainInline(el) {
    if (el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === 'BR') return true;
    if (tag === 'svg' || tag === 'IMG' || tag === 'VIDEO' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'CANVAS') return false;
    const cs = getComputedStyle(el);
    if (!PLAIN_INLINE.has(cs.display)) return false;
    if (isHidden(el, cs)) return true; // will be skipped
    const bg = parseColor(cs.backgroundColor);
    if ((bg && bg[3] > 0) || cs.backgroundImage !== 'none') return false;
    if (parseFloat(cs.borderTopWidth) || parseFloat(cs.borderLeftWidth) || parseFloat(cs.paddingLeft) || parseFloat(cs.paddingRight)) return false;
    for (const c of el.childNodes) if (c.nodeType === 1 && !isPlainInline(c)) return false;
    return true;
  }

  function weightOf(cs) {
    const w = parseInt(cs.fontWeight, 10);
    return isNaN(w) ? (cs.fontWeight === 'bold' ? 700 : 400) : w;
  }

  function styleKey(cs) {
    const col = parseColor(cs.color) || [0, 0, 0, 1];
    const deco = cs.textDecorationLine && cs.textDecorationLine.includes('underline') ? 'U' : cs.textDecorationLine && cs.textDecorationLine.includes('line-through') ? 'S' : '';
    return {
      f: r2(parseFloat(cs.fontSize)),
      w: weightOf(cs),
      i: cs.fontStyle === 'italic' ? 1 : 0,
      c: rc(col),
      d: deco,
      ls: cs.letterSpacing === 'normal' ? 0 : r2(parseFloat(cs.letterSpacing)),
      tt: cs.textTransform === 'uppercase' ? 'U' : cs.textTransform === 'lowercase' ? 'L' : cs.textTransform === 'capitalize' ? 'T' : '',
    };
  }

  /** Collect text with styled ranges from a run of nodes. */
  function collectRun(nodes, hostCs) {
    let text = '';
    const segs = [];
    const pre = /pre/.test(hostCs.whiteSpace);
    function pushText(str, cs) {
      if (!pre) str = str.replace(/[\t\n\r ]+/g, ' ');
      if (!str) return;
      if (!pre && text.endsWith(' ') && str.startsWith(' ')) str = str.slice(1);
      if (!str) return;
      const st = styleKey(cs);
      const start = text.length;
      text += str;
      const last = segs[segs.length - 1];
      if (last && JSON.stringify(last.st) === JSON.stringify(st) && last.e === start) last.e = text.length;
      else segs.push({ s: start, e: text.length, st });
    }
    function visit(node, cs) {
      if (node.nodeType === 3) pushText(node.nodeValue, cs);
      else if (node.nodeType === 1) {
        if (node.tagName === 'BR') {
          pushText('\n', cs);
          return;
        }
        const ccs = getComputedStyle(node);
        if (isHidden(node, ccs)) return;
        for (const c of node.childNodes) visit(c, ccs);
      }
    }
    for (const n of nodes) visit(n, hostCs);
    // Trim (keeping ranges consistent).
    let lead = 0;
    while (lead < text.length && text[lead] === ' ') lead++;
    let trail = text.length;
    while (trail > lead && text[trail - 1] === ' ') trail--;
    if (lead >= trail) return null;
    const out = text.slice(lead, trail).replace(/ ?\n ?/g, '\n');
    // Recompute segments after trim/line-break cleanup by walking chars.
    const map = [];
    for (let i = lead, j = 0; i < trail; i++) {
      map.push(i);
    }
    const segs2 = [];
    let oi = 0;
    // Build a per-char style array, then compress against cleaned text.
    const charStyle = new Array(text.length);
    segs.forEach((sg, si) => {
      for (let k = sg.s; k < sg.e; k++) charStyle[k] = si;
    });
    const cleaned = [];
    let src = lead;
    const raw = text.slice(lead, trail);
    for (let k = 0; k < raw.length; k++) {
      const ch = raw[k];
      if (ch === ' ' && (raw[k + 1] === '\n' || raw[k - 1] === '\n')) {
        src++;
        continue;
      }
      cleaned.push(charStyle[src]);
      src++;
    }
    for (let k = 0; k < cleaned.length; k++) {
      const si = cleaned[k];
      const last = segs2[segs2.length - 1];
      if (last && last.si === si) last.e = k + 1;
      else segs2.push({ s: k, e: k + 1, si });
    }
    return {
      chars: out,
      segs: segs2.map((g) => Object.assign({ s: g.s, e: g.e }, segs[g.si].st)),
    };
  }

  function rangeRects(nodes) {
    const range = document.createRange();
    range.setStartBefore(nodes[0]);
    range.setEndAfter(nodes[nodes.length - 1]);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
    return rects;
  }

  function lineCount(rects, lh) {
    const tops = [];
    for (const r of rects) {
      const cy = r.top + r.height / 2;
      if (!tops.some((t) => Math.abs(t - cy) < lh * 0.5)) tops.push(cy);
    }
    return Math.max(1, tops.length);
  }

  function makeText(nodes, host, hostCs, origin, isLeaf) {
    const run = collectRun(nodes, hostCs);
    if (!run) return null;
    const rects = rangeRects(nodes);
    if (!rects.length) return null;
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const r of rects) {
      x1 = Math.min(x1, r.left);
      y1 = Math.min(y1, r.top);
      x2 = Math.max(x2, r.right);
      y2 = Math.max(y2, r.bottom);
    }
    const fs = parseFloat(hostCs.fontSize);
    const lhRaw = hostCs.lineHeight;
    const lh = lhRaw === 'normal' ? fs * 1.26 : parseFloat(lhRaw);
    const lines = run.chars.includes('\n') ? Math.max(lineCount(rects, lh), run.chars.split('\n').length) : lineCount(rects, lh);
    const clamp = parseInt(hostCs.webkitLineClamp || hostCs.getPropertyValue('-webkit-line-clamp'), 10);
    const ellipsis = hostCs.textOverflow === 'ellipsis' && hostCs.whiteSpace === 'nowrap';
    let align = hostCs.textAlign;
    if (align === 'start' || align === '-webkit-auto') align = 'left';
    if (align === 'end') align = 'right';
    if (align === '-webkit-center') align = 'center';
    // Box: for a leaf with several lines, use the element's content box so
    // wrapping matches; otherwise use the ink box of the text itself.
    let bx = x1, bw = x2 - x1;
    const hb = host.getBoundingClientRect();
    const pl = parseFloat(hostCs.paddingLeft) + parseFloat(hostCs.borderLeftWidth);
    const pr = parseFloat(hostCs.paddingRight) + parseFloat(hostCs.borderRightWidth);
    const contentX = hb.left + pl, contentW = hb.width - pl - pr;
    if (lines > 1 || clamp > 0 || ellipsis) {
      if (isLeaf || contentW < bw + 2) {
        bx = contentX;
        bw = contentW;
      }
    }
    const first = rects.reduce((a, r) => (r.top < a.top ? r : a), rects[0]);
    const firstCy = first.top + first.height / 2;
    const top = lhRaw === 'normal' ? y1 : firstCy - lh / 2;
    const node = {
      t: 'T',
      n: run.chars.slice(0, 48).replace(/\n/g, ' '),
      x: r2(bx - origin.x),
      y: r2(top - origin.y),
      w: r2(Math.max(1, bw)),
      h: r2(lhRaw === 'normal' ? y2 - y1 : lines * lh),
      chars: run.chars,
      segs: run.segs,
      lh: lhRaw === 'normal' ? 0 : r2(lh),
      al: align === 'center' ? 'C' : align === 'right' ? 'R' : align === 'justify' ? 'J' : 'L',
      ml: lines > 1 ? 1 : 0,
    };
    if (clamp > 0) node.clamp = clamp;
    if (ellipsis) node.clamp = 1;
    // Single line: remember the ink box so the plugin can anchor it.
    if (!node.ml) {
      node.ix = r2(x1 - origin.x);
      node.iw = r2(x2 - x1);
    }
    return node;
  }

  // ---------- main walk ----------
  let ORIGIN, LINKS;
  const INSTANT = { lucide: true };

  function boxOf(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left - ORIGIN.x, y: r.top - ORIGIN.y, w: r.width, h: r.height };
  }

  function stackLayer(cs) {
    const pos = cs.position;
    const z = cs.zIndex === 'auto' ? null : parseInt(cs.zIndex, 10);
    if (z !== null && z < 0 && pos !== 'static') return [0, z];
    if (pos === 'static' && !(z !== null && (cs.display.includes('flex') || cs.display.includes('grid')))) return [1, 0];
    if (z === null || z === 0) return [2, 0];
    return [3, z];
  }

  function visualOf(el, cs, b) {
    const v = {};
    const fills = [];
    const bg = parseColor(cs.backgroundColor);
    if (bg && bg[3] > 0) fills.push({ k: 'S', c: rc(bg) });
    if (cs.backgroundImage && cs.backgroundImage !== 'none') {
      const layers = splitTop(cs.backgroundImage).reverse(); // bottom-most first
      for (const layer of layers) {
        const g = parseGradient(layer, b.w, b.h);
        if (g) fills.push(g);
      }
    }
    if (fills.length) v.fills = fills; // bottom → top (Figma order)
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map((s) => (cs['border' + s + 'Style'] === 'none' || cs['border' + s + 'Style'] === 'hidden' ? 0 : parseFloat(cs['border' + s + 'Width']) || 0));
    if (bw.some((x) => x > 0)) {
      const side = ['Top', 'Right', 'Bottom', 'Left'][bw.findIndex((x) => x > 0)];
      const bc = parseColor(cs['border' + side + 'Color']);
      if (bc && bc[3] > 0) v.st = { c: rc(bc), w: bw.map(r2), dash: /dash|dot/.test(cs['border' + side + 'Style']) ? 1 : 0 };
    }
    const rad = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((r) => radiusPx(r, b.w, b.h));
    if (rad.some((x) => x > 0)) v.r = rad;
    const fx = parseShadows(cs.boxShadow);
    const ds = parseFilterFn(cs.filter, 'drop-shadow');
    if (ds) fx.push(...parseShadows(ds).map((s) => Object.assign(s, { k: 'D', s: 0 })));
    if (fx.length) v.fx = fx;
    const bf = parseFilterFn(cs.backdropFilter || cs.webkitBackdropFilter, 'blur');
    if (bf) v.bblur = r2(parseFloat(bf));
    const lb = parseFilterFn(cs.filter, 'blur');
    if (lb) v.lblur = r2(parseFloat(lb));
    const gs = parseFilterFn(cs.filter, 'grayscale');
    if (gs) v.gray = r2(parseFloat(gs));
    const op = parseFloat(cs.opacity);
    if (op < 0.999) v.o = r2(op);
    if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') v.clip = 1;
    if (BLEND[cs.mixBlendMode]) v.bm = BLEND[cs.mixBlendMode];
    return v;
  }
  const hasVisual = (v) => !!(v.fills || v.st || v.fx || v.bblur || v.lblur || v.o !== undefined || v.bm);

  async function walk(el, clipRect, depth) {
    const cs = getComputedStyle(el);
    if (isHidden(el, cs)) return null;
    if (el.matches('[data-fc-skip], [class*="AppFrame__glare"]')) return null;
    const b = boxOf(el);
    const tag = el.tagName;
    if (b.w < 0.5 && b.h < 0.5 && !el.childElementCount && tag !== 'svg') return null;
    if ((b.w > 0 || b.h > 0) && !intersects(b, clipRect) && cs.position !== 'fixed') {
      // Off-screen or clipped away (carousel items past the edge): skip.
      if (b.w > 0 && b.h > 0) return null;
    }
    const v = visualOf(el, cs, b);
    const node = { t: 'F', n: nameFor(el), x: r2(b.x), y: r2(b.y), w: r2(b.w), h: r2(b.h) };
    Object.assign(node, v);
    const mc = moduleClasses(el);
    if (mc.length) node.cls = mc.map((m) => m.mod + '__' + m.local);
    if (tag === 'A') {
      const href = el.getAttribute('href');
      if (href && href.startsWith('#/')) node.href = href.slice(1);
    }
    if (el.getAttribute('aria-current') === 'page') node.cur = 1;
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') node.dis = 1;
    if (el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true') node.on = 1;
    if (cs.display.includes('flex')) {
      node.flex = {
        d: cs.flexDirection,
        g: r2(parseFloat(cs.columnGap) || 0),
        rg: r2(parseFloat(cs.rowGap) || 0),
        j: cs.justifyContent,
        a: cs.alignItems,
        wrap: cs.flexWrap !== 'nowrap' ? 1 : 0,
        p: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((x) => r2(parseFloat(x))),
      };
    }

    // ----- SVG -----
    if (tag === 'svg') {
      const s = serializeSvg(el);
      const cls = el.getAttribute('class') || '';
      const lucide = cls.match(/lucide-([a-z0-9-]+)/);
      const isLottie = !!el.closest('[data-lottie]') || !!el.querySelector('[id^="__lottie"]');
      const id = addAsset('svg', s.markup, { vw: r2(s.vw), vh: r2(s.vh) });
      Object.assign(node, { t: 'V', ref: id, vw: r2(s.vw), vh: r2(s.vh), sx: r2(s.sx * 1000) / 1000, sy: r2(s.sy * 1000) / 1000, ox: r2(s.ox), oy: r2(s.oy) });
      if (s.slice) node.clip = 1;
      if (lucide) {
        node.icon = lucide[1];
        node.n = 'Icon/' + lucide[1];
        const col = /^(rgb|color)/.test(cs.stroke) ? parseColor(cs.stroke) : parseColor(cs.color);
        node.ic = col ? rc(col) : [0, 0, 0, 1];
        const fc = /^(rgb|color)/.test(cs.fill) ? parseColor(cs.fill) : null;
        if (fc && fc[3] > 0) node.ifill = rc(fc);
        node.isw = r2(parseFloat(cs.strokeWidth) || parseFloat(el.getAttribute('stroke-width')) || 2);
      }
      if (isLottie || el.querySelector('mask, clipPath, filter, pattern, image')) {
        try {
          const png = await rasterizeSvgString(s.markup, b.w, b.h, 2);
          node.png = addAsset('png', png);
        } catch (e) {
          /* vector only */
        }
        if (isLottie) node.n = 'Illustration';
      }
      if (!node.n.startsWith('Icon/') && !isLottie) node.n = (el.getAttribute('aria-label') ? 'Image · ' + el.getAttribute('aria-label').slice(0, 40) : 'Vector');
      return node;
    }

    // ----- Images / video -----
    if (tag === 'IMG' || tag === 'VIDEO') {
      const data = await imageToData(el, b.w, b.h);
      if (data) {
        const fit = cs.objectFit === 'contain' ? 'FIT' : cs.objectFit === 'fill' ? 'STRETCH' : 'FILL';
        const id = addAsset(data.startsWith('data:image/jpeg') ? 'jpg' : 'png', data);
        node.fills = (node.fills || []).concat([{ k: 'I', ref: id, mode: fit }]);
        node.n = tag === 'IMG' ? 'Image · ' + (el.getAttribute('alt') || 'image').slice(0, 40) : 'Video frame';
      }
      if (tag === 'VIDEO' && !data) return hasVisual(v) ? node : null;
      return node;
    }

    // ----- Form fields -----
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio' || type === 'range' || type === 'hidden') return hasVisual(v) ? node : null;
      let value = tag === 'SELECT' ? el.options[el.selectedIndex]?.text || '' : el.value;
      let placeholder = false;
      if (!value && el.placeholder) {
        value = el.placeholder;
        placeholder = true;
      }
      if (type === 'password' && !placeholder) value = '•'.repeat(value.length);
      node.n = (tag === 'TEXTAREA' ? 'Text area' : tag === 'SELECT' ? 'Select' : 'Input') + ' · ' + (el.getAttribute('aria-label') || el.name || el.id || '');
      if (value) {
        const pcs = placeholder ? getComputedStyle(el, '::placeholder') : cs;
        const st = styleKey(cs);
        const col = parseColor(pcs.color) || [0.5, 0.5, 0.5, 1];
        st.c = rc(col);
        const pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
        const pr = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth);
        const pt = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
        const fs = parseFloat(cs.fontSize);
        const lh = cs.lineHeight === 'normal' ? fs * 1.26 : parseFloat(cs.lineHeight);
        const multi = tag === 'TEXTAREA';
        const tx = {
          t: 'T',
          n: placeholder ? 'Placeholder' : 'Value',
          x: r2(b.x + pl),
          y: r2(multi ? b.y + pt : b.y + b.h / 2 - lh / 2),
          w: r2(b.w - pl - pr),
          h: r2(lh),
          chars: value,
          segs: [Object.assign({ s: 0, e: value.length }, st)],
          lh: r2(lh),
          al: cs.textAlign === 'center' ? 'C' : cs.textAlign === 'right' || cs.textAlign === 'end' ? 'R' : 'L',
          ml: multi ? 1 : 0,
          fixed: 1,
        };
        if (cs.letterSpacing !== 'normal') tx.segs[0].ls = r2(parseFloat(cs.letterSpacing));
        node.c = [tx];
      }
      return node;
    }

    // ----- Children -----
    const childClip = v.clip ? intersect(clipRect, b) : clipRect;
    const kids = [];
    const nodes = [...el.childNodes];
    const leaf = nodes.length > 0 && nodes.every((c) => c.nodeType === 3 || c.nodeType === 8 || isPlainInline(c)) && nodes.some((c) => (c.textContent || '').trim());
    if (leaf) {
      const t = makeText(nodes.filter((c) => c.nodeType !== 8), el, cs, ORIGIN, true);
      if (t) kids.push({ node: t, key: [1, 0], i: 0 });
    } else {
      let run = [];
      let i = 0;
      const flush = () => {
        if (run.length && run.some((c) => (c.textContent || '').trim())) {
          const t = makeText(run, el, cs, ORIGIN, false);
          if (t) kids.push({ node: t, key: [1, 0], i: i++ });
        }
        run = [];
      };
      for (const c of nodes) {
        if (c.nodeType === 8) continue;
        if (c.nodeType === 3 || isPlainInline(c)) {
          run.push(c);
          continue;
        }
        flush();
        if (c.nodeType !== 1) continue;
        const ccs = getComputedStyle(c);
        if (ccs.display === 'contents') {
          for (const gc of c.children) {
            const n = await walk(gc, childClip, depth + 1);
            if (n) kids.push({ node: n, key: stackLayer(getComputedStyle(gc)), i: i++ });
          }
          continue;
        }
        const n = await walk(c, childClip, depth + 1);
        if (n) kids.push({ node: n, key: stackLayer(ccs), i: i++ });
      }
      flush();
    }
    kids.sort((a, b2) => a.key[0] - b2.key[0] || a.key[1] - b2.key[1] || a.i - b2.i);
    const children = kids.map((k) => k.node);
    if (children.length) node.c = children;

    // Collapse plain wrappers: no visuals and a single child that fills it.
    if (!hasVisual(v) && !v.clip && depth > 0 && !node.href && !node.flex && children.length === 1 && !mc.length) return children[0];
    if (!hasVisual(v) && !v.clip && depth > 0 && !children.length) return null;
    return node;
  }

  window.__figmaCapture = async function (selector, options) {
    const opts = options || {};
    const root = document.querySelector(selector);
    if (!root) throw new Error('Capture root not found: ' + selector);
    ASSETS = {};
    const undo = materializePseudos(root);
    try {
      const rr = root.getBoundingClientRect();
      ORIGIN = { x: rr.left, y: rr.top };
      const clip = { x: 0, y: 0, w: rr.width, h: rr.height };
      const tree = await walk(root, clip, 0);
      tree.x = 0;
      tree.y = 0;
      tree.n = opts.name || tree.n;
      tree.clip = 1;
      delete tree.r;
      return { root: tree, assets: ASSETS };
    } finally {
      undo();
    }
  };
})();
