/*
 * Runs inside the page (injected by capture.cjs). Converts a rendered DOM
 * subtree into a Figma-ready node tree:
 *   - every container is an Auto Layout frame; direction, padding and gaps are
 *     inferred from the measured positions of its children, so the result
 *     matches the screen to the pixel (uneven gaps become spacer frames, offset
 *     children get a padded wrapper, overlapping children become absolute);
 *   - text keeps font, size, weight, line height, tracking, case and colour,
 *     with styled ranges for inline emphasis;
 *   - photos become image fills cropped exactly like object-fit/object-position;
 *   - icons and animations become SVG;
 *   - ::before/::after are turned into real layers first.
 */
(() => {
  const PX = (v) => parseFloat(v) || 0;
  const round = (n) => Math.round(n * 100) / 100;

  /* ---------- colours and gradients ---------- */
  function parseColor(str) {
    if (!str) return null;
    str = str.trim();
    let m = str.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) {
      let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? PX(m[4]) / 100 : PX(m[4]);
      return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a };
    }
    m = str.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\)$/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : m[4].endsWith('%') ? PX(m[4]) / 100 : +m[4] };
    if (str === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    return null;
  }
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
  function parseStops(parts, lengthPx) {
    const stops = parts.map((p) => {
      const m = p.match(/^(.*\))\s*([\d.-]+(?:%|px))?\s*([\d.-]+(?:%|px))?$/) || p.match(/^(\S+)\s*([\d.-]+(?:%|px))?/);
      const color = parseColor(m[1]);
      const pos = m[2] ? (m[2].endsWith('%') ? PX(m[2]) / 100 : PX(m[2]) / (lengthPx || 1)) : null;
      return { color, position: pos };
    }).filter((s) => s.color);
    // Fill in missing positions evenly.
    if (stops.length) {
      if (stops[0].position === null) stops[0].position = 0;
      if (stops[stops.length - 1].position === null) stops[stops.length - 1].position = 1;
      for (let i = 1; i < stops.length - 1; i++) {
        if (stops[i].position !== null) continue;
        let j = i;
        while (stops[j].position === null) j++;
        const a = stops[i - 1].position, b = stops[j].position, n = j - i + 1;
        for (let k = i; k < j; k++) stops[k].position = a + ((b - a) * (k - i + 1)) / n;
      }
    }
    return stops.map((s) => ({ position: Math.max(0, Math.min(1, s.position)), color: s.color }));
  }
  function parseBackgroundImage(bg, w, h) {
    if (!bg || bg === 'none') return [];
    const fills = [];
    for (const layer of splitTop(bg)) {
      let m = layer.match(/^linear-gradient\((.*)\)$/s);
      if (m) {
        const parts = splitTop(m[1]);
        let angle = 180;
        if (/deg$/.test(parts[0])) angle = PX(parts.shift());
        else if (/^to /.test(parts[0])) {
          const d = parts.shift();
          angle = { 'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270 }[d] ?? 180;
        }
        const rad = (angle * Math.PI) / 180;
        const len = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
        fills.push({ type: 'GRADIENT_LINEAR', angle, stops: parseStops(parts, len) });
        continue;
      }
      m = layer.match(/^radial-gradient\((.*)\)$/s);
      if (m) {
        const parts = splitTop(m[1]);
        let cx = 0.5, cy = 0.5, rx = null, ry = null, shape = 'farthest-corner';
        if (!parseColor(parts[0].split(' ')[0]) && !/^(rgb|color)/.test(parts[0])) {
          const head = parts.shift();
          const [sizePart, atPart] = head.split(/\s*at\s*/);
          if (atPart) {
            const [ax, ay] = atPart.trim().split(/\s+/);
            cx = ax.endsWith('%') ? PX(ax) / 100 : PX(ax) / w;
            cy = (ay ?? '50%').endsWith('%') ? PX(ay ?? '50%') / 100 : PX(ay) / h;
          }
          const sz = (sizePart || '').trim();
          if (/closest-side/.test(sz)) shape = 'closest-side';
          else if (/^[\d.]+(%|px)\s+[\d.]+(%|px)$/.test(sz)) {
            const [a, b] = sz.split(/\s+/);
            rx = a.endsWith('%') ? PX(a) / 100 : PX(a) / w;
            ry = b.endsWith('%') ? PX(b) / 100 : PX(b) / h;
          }
        }
        if (rx === null) {
          if (shape === 'closest-side') {
            rx = Math.min(cx, 1 - cx);
            ry = Math.min(cy, 1 - cy);
          } else {
            rx = Math.max(cx, 1 - cx) * Math.SQRT2;
            ry = Math.max(cy, 1 - cy) * Math.SQRT2;
          }
        }
        fills.push({ type: 'GRADIENT_RADIAL', center: [cx, cy], radius: [rx, ry], stops: parseStops(parts, Math.max(w, h)) });
        continue;
      }
      m = layer.match(/^url\("?(.*?)"?\)$/);
      if (m) fills.push({ type: 'IMAGE', ref: register(m[1], 0, 0), scaleMode: 'FILL' });
    }
    return fills.reverse(); // CSS: first layer on top; Figma: last fill on top
  }

  /* ---------- shadows, borders, radii ---------- */
  function parseShadows(str) {
    if (!str || str === 'none') return [];
    return splitTop(str).map((s) => {
      const inset = /\binset\b/.test(s);
      const colorM = s.match(/(rgba?\([^)]*\)|color\([^)]*\))/);
      const color = parseColor(colorM ? colorM[1] : 'rgba(0,0,0,0.25)');
      const nums = s.replace(colorM ? colorM[1] : '', '').replace('inset', '').trim().split(/\s+/).filter(Boolean).map(PX);
      const [x = 0, y = 0, blur = 0, spread = 0] = nums;
      return { inset, x, y, blur, spread, color };
    });
  }
  function radii(cs, w, h) {
    const lim = Math.min(w, h) / 2;
    const one = (v) => {
      const p = v.split(' ')[0];
      const n = p.endsWith('%') ? (PX(p) / 100) * Math.min(w, h) : PX(p);
      return round(Math.min(n, lim));
    };
    return [one(cs.borderTopLeftRadius), one(cs.borderTopRightRadius), one(cs.borderBottomRightRadius), one(cs.borderBottomLeftRadius)];
  }

  /* ---------- names ---------- */
  function nameOf(el) {
    const fc = el.getAttribute && el.getAttribute('data-figma-component');
    if (fc) return fc;
    const aria = el.getAttribute && el.getAttribute('aria-label');
    if (aria) return aria.slice(0, 40);
    if (el.getAttribute && el.getAttribute('data-fig-pseudo')) return el.getAttribute('data-fig-pseudo') === '::before' ? 'before' : 'after';
    const cls = (el.getAttribute && el.getAttribute('class')) || '';
    const mod = cls.split(/\s+/).map((c) => c.match(/^_([A-Za-z0-9]+)_[a-z0-9]{5}_\d+$/)).find(Boolean);
    if (mod) return mod[1];
    const plain = cls.split(/\s+/).find((c) => c && !c.startsWith('_'));
    if (plain) return plain.replace(/^fj3-/, '');
    return el.tagName.toLowerCase();
  }

  /* ---------- images ---------- */
  let images = {};
  function register(src, w, h) {
    if (!images[src]) images[src] = { w, h };
    return src;
  }
  function imageFilters(filter) {
    const out = {};
    if (!filter || filter === 'none') return undefined;
    const fn = (name) => {
      const m = filter.match(new RegExp(name + '\\(([^)]+)\\)'));
      return m ? PX(m[1]) * (m[1].endsWith('%') ? 0.01 : 1) : null;
    };
    const sepia = fn('sepia'), sat = fn('saturate'), con = fn('contrast'), bri = fn('brightness'), gray = fn('grayscale');
    if (sepia) out.temperature = round(Math.min(1, sepia * 1.1));
    if (sat !== null || gray) out.saturation = round(Math.max(-1, (sat ?? 1) - 1 - (gray ?? 0)));
    if (con !== null) out.contrast = round(con - 1);
    if (bri !== null) out.exposure = round((bri - 1) * 2);
    return Object.keys(out).length ? out : undefined;
  }
  function objectPos(v, i) {
    const p = (v || '50% 50%').split(/\s+/)[i] ?? '50%';
    if (p === 'left' || p === 'top') return 0;
    if (p === 'right' || p === 'bottom') return 1;
    if (p === 'center') return 0.5;
    return p.endsWith('%') ? PX(p) / 100 : 0.5;
  }
  function imagePaint(el, cs, w, h, inheritedFilter) {
    const src = el.currentSrc || el.src;
    const nw = el.naturalWidth || w, nh = el.naturalHeight || h;
    register(src, nw, nh);
    const fit = cs.objectFit;
    const paint = { type: 'IMAGE', ref: src, filters: imageFilters(cs.filter !== 'none' ? cs.filter : inheritedFilter) };
    if (fit === 'contain') return { ...paint, scaleMode: 'FIT' };
    if (fit === 'cover' && nw && nh) {
      const s = Math.max(w / nw, h / nh);
      const dw = nw * s, dh = nh * s;
      const px = objectPos(cs.objectPosition, 0), py = objectPos(cs.objectPosition, 1);
      const ox = (w - dw) * px, oy = (h - dh) * py;
      return { ...paint, scaleMode: 'CROP', transform: [[round(w / dw * 1e4) / 1e4, 0, round((-ox / dw) * 1e4) / 1e4], [0, round(h / dh * 1e4) / 1e4, round((-oy / dh) * 1e4) / 1e4]] };
    }
    return { ...paint, scaleMode: 'FILL' };
  }

  /* ---------- pseudo-elements become real layers ---------- */
  function materialize(root) {
    if (!document.getElementById('fig-pseudo-off')) {
      const st = document.createElement('style');
      st.id = 'fig-pseudo-off';
      st.textContent = '[data-fpb]::before{content:none!important}[data-fpa]::after{content:none!important}';
      document.head.append(st);
    }
    const els = [root, ...root.querySelectorAll('*')].filter((el) => !(el instanceof SVGElement) && !['IMG', 'INPUT', 'TEXTAREA', 'SELECT', 'VIDEO', 'BR'].includes(el.tagName));
    const jobs = [];
    for (const el of els) {
      for (const which of ['::before', '::after']) {
        const cs = getComputedStyle(el, which);
        if (!cs || cs.content === 'none' || cs.content === 'normal' || cs.display === 'none') continue;
        const span = document.createElement('span');
        span.setAttribute('data-fig-pseudo', which);
        for (let i = 0; i < cs.length; i++) span.style.setProperty(cs[i], cs.getPropertyValue(cs[i]));
        let txt = cs.content;
        txt = /^".*"$/.test(txt) ? txt.slice(1, -1).replace(/\\"/g, '"').replace(/\\([0-9a-f]{2,6})\s?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))) : '';
        span.style.setProperty('content', 'normal');
        span.textContent = txt;
        jobs.push([el, which, span]);
      }
    }
    for (const [el, which, span] of jobs) {
      if (which === '::before') {
        el.setAttribute('data-fpb', '');
        el.insertBefore(span, el.firstChild);
      } else {
        el.setAttribute('data-fpa', '');
        el.appendChild(span);
      }
    }
  }

  /* ---------- text ---------- */
  const INLINE = new Set(['inline']);
  function isSrOnly(cs, r) {
    return (cs.position === 'absolute' && r.width <= 1.5 && r.height <= 1.5) || cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)';
  }
  function hasBox(cs) {
    const bg = parseColor(cs.backgroundColor);
    return (bg && bg.a > 0) || cs.backgroundImage !== 'none' || PX(cs.borderTopWidth) + PX(cs.borderBottomWidth) + PX(cs.borderLeftWidth) + PX(cs.borderRightWidth) > 0 || (cs.boxShadow && cs.boxShadow !== 'none');
  }
  function isTextLeaf(el) {
    let text = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3) {
        if (n.data.trim()) text = true;
      } else if (n.nodeType === 1) {
        if (n.tagName === 'BR') continue;
        const cs = getComputedStyle(n);
        if (cs.display === 'none') continue;
        if (!INLINE.has(cs.display) || hasBox(cs) || n.querySelector('svg,img,input,br + *') || n instanceof SVGElement) return false;
        if ([...n.children].some((c) => getComputedStyle(c).display !== 'inline')) return false;
        if (n.textContent.trim()) text = true;
      }
    }
    return text;
  }
  function fontWeight(cs) {
    return Math.min(900, Math.max(100, Math.round(PX(cs.fontWeight) / 100) * 100));
  }
  function textStyle(cs) {
    const size = PX(cs.fontSize);
    const lh = cs.lineHeight === 'normal' ? null : PX(cs.lineHeight);
    const ls = cs.letterSpacing === 'normal' ? 0 : PX(cs.letterSpacing);
    return {
      fontFamily: cs.fontFamily.split(',')[0].replace(/["']/g, '').replace(/ Variable$/, '').trim(),
      fontWeight: fontWeight(cs),
      fontStyle: cs.fontStyle === 'italic' ? 'italic' : 'normal',
      fontSize: round(size),
      lineHeight: lh ? round(lh) : null,
      letterSpacing: round(ls),
      color: parseColor(cs.color),
      textCase: { uppercase: 'UPPER', lowercase: 'LOWER', capitalize: 'TITLE' }[cs.textTransform] || 'ORIGINAL',
      decoration: cs.textDecorationLine.includes('underline') ? 'UNDERLINE' : cs.textDecorationLine.includes('line-through') ? 'STRIKETHROUGH' : 'NONE',
    };
  }
  function collectText(el, pre) {
    const segs = [];
    const walkT = (node, cs) => {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) segs.push({ text: n.data, cs });
        else if (n.nodeType === 1) {
          if (n.tagName === 'BR') segs.push({ text: '\n', cs, br: true });
          else {
            const c = getComputedStyle(n);
            if (c.display !== 'none' && !(c.position === 'absolute' && n.getBoundingClientRect().width <= 1.5)) walkT(n, c);
          }
        }
      }
    };
    walkT(el, getComputedStyle(el));
    let chars = '', ranges = [];
    for (const s of segs) {
      let t = s.br ? '\n' : pre ? s.text : s.text.replace(/\s+/g, ' ');
      if (!pre && !s.br && (chars.endsWith(' ') || chars.endsWith('\n') || chars === '') && t.startsWith(' ')) t = t.slice(1);
      if (!t) continue;
      ranges.push({ start: chars.length, end: chars.length + t.length, style: textStyle(s.cs) });
      chars += t;
    }
    const trimmed = chars.replace(/\s+$/, '');
    ranges = ranges.map((r) => ({ ...r, end: Math.min(r.end, trimmed.length) })).filter((r) => r.end > r.start);
    return { chars: trimmed, ranges };
  }
  function sameStyle(a, b) {
    return a.fontWeight === b.fontWeight && a.fontSize === b.fontSize && a.decoration === b.decoration && a.textCase === b.textCase && JSON.stringify(a.color) === JSON.stringify(b.color) && a.fontStyle === b.fontStyle;
  }
  function textShadow(cs) {
    if (!cs.textShadow || cs.textShadow === 'none') return [];
    return parseShadows(cs.textShadow).map((s) => ({ type: 'DROP_SHADOW', x: s.x, y: s.y, blur: s.blur, spread: 0, color: s.color }));
  }
  function textNode(el, cs, rect, chars, ranges, parentRect, name) {
    const base = textStyle(cs);
    const lines = base.lineHeight ? Math.round(rect.height / base.lineHeight) : rect.height > base.fontSize * 1.8 ? 2 : 1;
    return {
      type: 'TEXT',
      name: name || chars.slice(0, 32),
      x: round(rect.left - parentRect.left),
      y: round(rect.top - parentRect.top),
      width: round(rect.width),
      height: round(rect.height),
      characters: chars,
      style: base,
      ranges: ranges.filter((r) => !sameStyle(r.style, base)).map((r) => ({ start: r.start, end: r.end, style: r.style })),
      align: { left: 'LEFT', start: 'LEFT', center: 'CENTER', right: 'RIGHT', end: 'RIGHT', justify: 'JUSTIFIED' }[cs.textAlign] || 'LEFT',
      autoResize: lines <= 1 && cs.whiteSpace !== 'normal' ? 'WIDTH_AND_HEIGHT' : lines <= 1 ? 'WIDTH_AND_HEIGHT' : 'HEIGHT',
      truncate: cs.textOverflow === 'ellipsis' ? true : undefined,
      effects: textShadow(cs),
      opacity: round(PX(cs.opacity)),
    };
  }
  function contentRect(el, cs) {
    const r = el.getBoundingClientRect();
    return {
      left: r.left + PX(cs.paddingLeft) + PX(cs.borderLeftWidth),
      top: r.top + PX(cs.paddingTop) + PX(cs.borderTopWidth),
      width: r.width - PX(cs.paddingLeft) - PX(cs.paddingRight) - PX(cs.borderLeftWidth) - PX(cs.borderRightWidth),
      height: r.height - PX(cs.paddingTop) - PX(cs.paddingBottom) - PX(cs.borderTopWidth) - PX(cs.borderBottomWidth),
    };
  }
  function rangeRect(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
    if (!rects.length) return null;
    const l = Math.min(...rects.map((r) => r.left)), t = Math.min(...rects.map((r) => r.top));
    const rr = Math.max(...rects.map((r) => r.right)), b = Math.max(...rects.map((r) => r.bottom));
    return { left: l, top: t, width: rr - l, height: b - t };
  }

  /* ---------- visuals of a box ---------- */
  function visuals(el, cs, w, h) {
    const out = {};
    const fills = [];
    const bg = parseColor(cs.backgroundColor);
    if (bg && bg.a > 0) fills.push({ type: 'SOLID', color: bg });
    fills.push(...parseBackgroundImage(cs.backgroundImage, w, h));
    if (fills.length) out.fills = fills;
    const bw = [PX(cs.borderTopWidth), PX(cs.borderRightWidth), PX(cs.borderBottomWidth), PX(cs.borderLeftWidth)];
    const shadows = parseShadows(cs.boxShadow);
    const bcol = parseColor(cs.borderTopColor) || parseColor(cs.borderBottomColor) || parseColor(cs.borderLeftColor);
    if (bw.some((x) => x > 0) && bcol && bcol.a > 0) {
      const side = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor].map(parseColor);
      const col = side.find((c, i) => bw[i] > 0 && c && c.a > 0) || bcol;
      out.strokes = [{ type: 'SOLID', color: col }];
      out.strokeAlign = 'INSIDE';
      out.strokeWeights = bw;
      if (cs.borderTopStyle === 'dashed' || cs.borderLeftStyle === 'dashed') out.dashPattern = [5, 4];
    } else {
      const ring = shadows.find((s) => s.inset && !s.x && !s.y && !s.blur && s.spread > 0);
      if (ring) {
        out.strokes = [{ type: 'SOLID', color: ring.color }];
        out.strokeAlign = 'INSIDE';
        out.strokeWeights = [ring.spread, ring.spread, ring.spread, ring.spread];
      }
    }
    const effects = [];
    for (const s of shadows) {
      if (s.inset && !s.x && !s.y && !s.blur && s.spread > 0 && out.strokes && !bw.some((x) => x > 0)) continue;
      if (!s.inset && !s.x && !s.y && !s.blur && s.spread > 0) {
        // a solid outer ring (e.g. the white ring round the New key): outside stroke
        if (!out.strokes) {
          out.strokes = [{ type: 'SOLID', color: s.color }];
          out.strokeAlign = 'OUTSIDE';
          out.strokeWeights = [s.spread, s.spread, s.spread, s.spread];
          continue;
        }
      }
      effects.push({ type: s.inset ? 'INNER_SHADOW' : 'DROP_SHADOW', x: s.x, y: s.y, blur: s.blur, spread: s.spread, color: s.color });
    }
    const bd = (cs.backdropFilter || cs.webkitBackdropFilter || '').match(/blur\(([\d.]+)px\)/);
    if (bd) effects.push({ type: 'BACKGROUND_BLUR', radius: PX(bd[1]) });
    const lb = (cs.filter || '').match(/blur\(([\d.]+)px\)/);
    if (lb) effects.push({ type: 'LAYER_BLUR', radius: PX(lb[1]) });
    if (effects.length) out.effects = effects;
    const rad = radii(cs, w, h);
    if (rad.some((x) => x > 0)) out.radius = rad;
    const op = PX(cs.opacity);
    if (op < 1) out.opacity = round(op);
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || (cs.clipPath && cs.clipPath !== 'none')) out.clip = true;
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') out.blendMode = cs.mixBlendMode.toUpperCase().replace(/-/g, '_');
    return out;
  }

  /* ---------- SVG ---------- */
  function svgString(el, r) {
    const clone = el.cloneNode(true);
    const src = [el, ...el.querySelectorAll('*')];
    const dst = [clone, ...clone.querySelectorAll('*')];
    src.forEach((s, i) => {
      const cs = getComputedStyle(s);
      const d = dst[i];
      if (!(d instanceof Element)) return;
      for (const p of ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset']) {
        const v = cs.getPropertyValue(p);
        if (v && v !== 'none' || p === 'fill' || p === 'stroke') d.setAttribute(p, v === 'currentcolor' ? cs.color : v);
      }
      if (cs.display === 'none' || cs.visibility === 'hidden') d.setAttribute('display', 'none');
      d.removeAttribute('class');
      d.removeAttribute('style');
    });
    clone.setAttribute('width', round(r.width));
    clone.setAttribute('height', round(r.height));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return clone.outerHTML.replace(/currentColor/g, getComputedStyle(el).color);
  }

  /* ---------- layout inference ---------- */
  const EPS = 0.75;
  function layout(frame, cs, r, kids) {
    const flow = kids.filter((k) => !k.abs);
    const abs = kids.filter((k) => k.abs);
    const rowHint = cs.display.includes('flex') && cs.flexDirection.startsWith('row');
    const stacks = (axis) => flow.every((k, i) => i === 0 || (axis === 'V' ? k.r.top >= flow[i - 1].r.bottom - EPS : k.r.left >= flow[i - 1].r.right - EPS));
    let mode = null;
    if (flow.length <= 1) mode = rowHint ? 'HORIZONTAL' : 'VERTICAL';
    else {
      const order = rowHint ? ['H', 'V'] : ['V', 'H'];
      for (const a of order) if (stacks(a)) { mode = a === 'V' ? 'VERTICAL' : 'HORIZONTAL'; break; }
    }
    const out = [];
    if (!mode) {
      frame.layout = { mode: 'VERTICAL', spacing: 0, padding: [0, 0, 0, 0], primary: 'MIN', counter: 'MIN' };
      for (const k of kids) out.push({ ...k.node, positioning: 'ABSOLUTE' });
      frame.children = out;
      return;
    }
    const V = mode === 'VERTICAL';
    const start = (b) => (V ? b.top : b.left), end = (b) => (V ? b.bottom : b.right);
    const cStart = (b) => (V ? b.left : b.top), cEnd = (b) => (V ? b.right : b.bottom);
    const fStart = start(r), fEnd = end(r), fcStart = cStart(r), fcEnd = cEnd(r);
    let padStart = flow.length ? start(flow[0].r) - fStart : 0;
    if (padStart < -EPS) {
      // content pokes out of the box (negative margin): keep it exact with absolute positioning
      frame.layout = { mode, spacing: 0, padding: [0, 0, 0, 0], primary: 'MIN', counter: 'MIN' };
      frame.children = kids.map((k) => ({ ...k.node, positioning: 'ABSOLUTE' }));
      return;
    }
    padStart = Math.max(0, padStart);
    const gaps = flow.slice(1).map((k, i) => start(k.r) - end(flow[i].r));
    const uniform = gaps.every((g) => Math.abs(g - gaps[0]) < EPS);
    const spacing = gaps.length && uniform ? Math.max(0, round(gaps[0])) : 0;
    const offs = flow.map((k) => cStart(k.r) - fcStart);
    const centres = flow.map((k) => (cStart(k.r) + cEnd(k.r)) / 2 - (fcStart + fcEnd) / 2);
    const ends = flow.map((k) => fcEnd - cEnd(k.r));
    let counter = 'MIN', padC = Math.max(0, Math.min(...offs, Infinity));
    let padCEnd = Math.max(0, Math.min(...ends, Infinity));
    if (flow.length && !offs.every((o) => Math.abs(o - offs[0]) < EPS)) {
      if (centres.every((c) => Math.abs(c) < EPS)) { counter = 'CENTER'; padC = 0; padCEnd = 0; }
      else if (ends.every((e) => Math.abs(e - ends[0]) < EPS)) { counter = 'MAX'; padC = 0; }
    } else if (flow.length === 1 && Math.abs(centres[0]) < EPS && offs[0] > EPS) {
      counter = 'CENTER'; padC = 0; padCEnd = 0;
    }
    const last = flow[flow.length - 1];
    const padEnd = last ? Math.max(0, fEnd - end(last.r)) : 0;
    frame.layout = {
      mode,
      spacing,
      padding: V ? [round(padStart), round(padCEnd), round(padEnd), round(padC)] : [round(padC), round(padEnd), round(padCEnd), round(padStart)],
      primary: 'MIN',
      counter,
    };
    // Rebuild children in DOM order: spacers for uneven gaps, wrappers for offset items.
    let fi = 0;
    for (const k of kids) {
      if (k.abs) { out.push({ ...k.node, positioning: 'ABSOLUTE' }); continue; }
      if (fi > 0 && !uniform) {
        const g = round(gaps[fi - 1]);
        if (g > 0.01) out.push({ type: 'SPACER', name: 'spacer', width: V ? 1 : g, height: V ? g : 1 });
      }
      let node = { ...k.node };
      const extra = counter === 'MIN' ? round(offs[fi] - padC) : 0;
      if (extra > 0.5) {
        node = {
          type: 'FRAME', name: 'offset', width: V ? round(node.width + extra) : node.width, height: V ? node.height : round(node.height + extra),
          layout: { mode: V ? 'HORIZONTAL' : 'VERTICAL', spacing: 0, padding: V ? [0, 0, 0, extra] : [extra, 0, 0, 0], primary: 'MIN', counter: 'MIN' },
          children: [node],
        };
      }
      out.push(node);
      fi++;
    }
    frame.children = out;
  }

  /* ---------- walk ---------- */
  function walk(el, pr, inheritedFilter) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || PX(cs.opacity) === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 0.5 || r.height < 0.5) return null;
    if (isSrOnly(cs, r)) return null;
    const abs = cs.position === 'absolute' || cs.position === 'fixed';
    const base = { name: nameOf(el), x: round(r.left - pr.left), y: round(r.top - pr.top), width: round(r.width), height: round(r.height) };
    const tag = el.tagName;
    let node;
    if (el instanceof SVGSVGElement) node = { ...base, type: 'SVG', svg: svgString(el, r), opacity: PX(cs.opacity) < 1 ? round(PX(cs.opacity)) : undefined };
    else if (tag === 'IMG') {
      const v = visuals(el, cs, r.width, r.height);
      node = { ...base, type: 'FRAME', ...v, fills: [imagePaint(el, cs, r.width, r.height, inheritedFilter)], layout: { mode: 'VERTICAL', spacing: 0, padding: [0, 0, 0, 0], primary: 'MIN', counter: 'MIN' }, children: [] };
      if (!node.name || node.name === 'img') node.name = (el.alt || 'image').slice(0, 40);
    } else if (tag === 'VIDEO') {
      node = { ...base, type: 'FRAME', ...visuals(el, cs, r.width, r.height), fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], layout: { mode: 'VERTICAL', spacing: 0, padding: [0, 0, 0, 0], primary: 'MIN', counter: 'MIN' }, children: [] };
    } else if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      node = { ...base, type: 'FRAME', ...visuals(el, cs, r.width, r.height) };
      const value = tag === 'SELECT' ? el.options[el.selectedIndex]?.text ?? '' : el.type === 'password' ? '•'.repeat(el.value.length) : el.value;
      const chars = value || el.placeholder || '';
      const kids = [];
      if (chars) {
        const cr = contentRect(el, cs);
        const pcs = value ? cs : getComputedStyle(el, '::placeholder');
        const style = textStyle(cs);
        if (!value) style.color = parseColor(pcs.color);
        const lh = style.lineHeight || style.fontSize * 1.25;
        const lines = tag === 'TEXTAREA' ? Math.max(1, Math.ceil(chars.length * style.fontSize * 0.5 / cr.width)) : 1;
        const th = Math.min(cr.height, lh * lines);
        const top = tag === 'TEXTAREA' ? cr.top : cr.top + (cr.height - th) / 2;
        const t = { type: 'TEXT', name: value ? 'value' : 'placeholder', x: 0, y: 0, width: round(cr.width), height: round(th), characters: chars, style, ranges: [], align: 'LEFT', autoResize: tag === 'TEXTAREA' ? 'HEIGHT' : 'NONE', truncate: true };
        kids.push({ node: t, r: { left: cr.left, top, right: cr.left + cr.width, bottom: top + th }, abs: false });
      }
      layout(node, cs, { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, kids);
    } else if (isTextLeaf(el)) {
      const pre = /pre/.test(cs.whiteSpace);
      const { chars, ranges } = collectText(el, pre);
      const rr = rangeRect(el) || contentRect(el, cs);
      const cr = contentRect(el, cs);
      // multi-line text wraps at the element's content width
      const box = { left: rr.height > PX(cs.lineHeight || cs.fontSize) * 1.5 ? cr.left : rr.left, top: rr.top, width: rr.height > PX(cs.lineHeight || cs.fontSize) * 1.5 ? cr.width : rr.width + 1, height: rr.height };
      const v = visuals(el, cs, r.width, r.height);
      const t = textNode(el, cs, box, chars, ranges, r, null);
      if (!Object.keys(v).some((k) => k !== 'opacity' && k !== 'clip') && Math.abs(box.left - r.left) < 1 && Math.abs(box.top - r.top) < 1.5 && Math.abs(box.width - r.width) < 1.5) {
        node = { ...t, name: base.name !== el.tagName.toLowerCase() ? base.name : t.name, x: base.x, y: base.y };
      } else {
        node = { ...base, type: 'FRAME', ...v };
        layout(node, cs, { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, [{ node: { ...t, opacity: undefined }, r: { left: box.left, top: box.top, right: box.left + box.width, bottom: box.top + box.height }, abs: false }]);
      }
    } else {
      node = { ...base, type: 'FRAME', ...visuals(el, cs, r.width, r.height) };
      const filt = cs.filter && cs.filter !== 'none' ? cs.filter : inheritedFilter;
      const kids = [];
      for (const n of el.childNodes) {
        if (n.nodeType === 3) {
          if (!n.data.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          const rects = [...range.getClientRects()].filter((x) => x.width > 0);
          if (!rects.length) continue;
          const l = Math.min(...rects.map((x) => x.left)), t = Math.min(...rects.map((x) => x.top)), rr = Math.max(...rects.map((x) => x.right)), b = Math.max(...rects.map((x) => x.bottom));
          const box = { left: l, top: t, width: rr - l + 1, height: b - t };
          const chars = /pre/.test(cs.whiteSpace) ? n.data : n.data.replace(/\s+/g, ' ').trim();
          kids.push({ node: textNode(el, cs, box, chars, [], r, null), r: { left: l, top: t, right: rr, bottom: b }, abs: false });
        } else if (n.nodeType === 1) {
          const ccs = getComputedStyle(n);
          const child = walk(n, r, filt);
          if (!child) continue;
          const cr = n.getBoundingClientRect();
          kids.push({ node: child, r: { left: cr.left, top: cr.top, right: cr.right, bottom: cr.bottom }, abs: ccs.position === 'absolute' || ccs.position === 'fixed', z: parseInt(ccs.zIndex) || 0 });
        }
      }
      // stacking: negative z-index first, raised absolute layers last
      const neg = kids.filter((k) => k.z < 0);
      const mid = kids.filter((k) => k.z >= 0 && !(k.abs && k.z > 0));
      const top = kids.filter((k) => k.abs && k.z > 0).sort((x, y) => x.z - y.z);
      layout(node, cs, { left: r.left, top: r.top, right: r.right, bottom: r.bottom }, [...neg, ...mid, ...top]);
    }
    node._abs = abs;
    return node;
  }

  window.__figExtract = function (root, { name } = {}) {
    images = {};
    materialize(root);
    const r = root.getBoundingClientRect();
    const node = walk(root, r, undefined) || { type: 'FRAME', width: r.width, height: r.height, children: [] };
    node.x = 0;
    node.y = 0;
    if (name) node.name = name;
    return { node, images };
  };

  /** Design tokens, resolved by the browser. */
  window.__figTokens = function (el) {
    const cs = getComputedStyle(el);
    const root = getComputedStyle(document.documentElement);
    const names = new Set();
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      const scan = (list) => {
        for (const rule of list) {
          if (rule.cssRules) scan(rule.cssRules);
          if (!rule.style) continue;
          for (let i = 0; i < rule.style.length; i++) if (rule.style[i].startsWith('--')) names.add(rule.style[i]);
        }
      };
      scan(rules);
    }
    const out = {};
    for (const n of names) {
      const v = (cs.getPropertyValue(n) || root.getPropertyValue(n)).trim();
      if (v) out[n] = v;
    }
    return out;
  };
})();
