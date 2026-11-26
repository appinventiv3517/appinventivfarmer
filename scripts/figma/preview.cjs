/*
 * Fidelity check: renders frames from the Figma JSON back to HTML using
 * Figma's Auto Layout rules (fixed sizes, padding, gap, alignment, absolute
 * children, inside strokes that do not affect layout) and compares them with
 * screenshots of the real app.
 *   node scripts/figma/preview.cjs <json> <outdir> [screen names…]
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const [, , jsonPath, outDir, ...only] = process.argv;
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const css = (c) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${c.a ?? 1})`;
function bg(fills, w, h) {
  const layers = [];
  for (const f of [...(fills || [])].reverse()) {
    if (f.type === 'SOLID') layers.push(`linear-gradient(${css(f.color)},${css(f.color)})`);
    else if (f.type === 'GRADIENT_LINEAR') layers.push(`linear-gradient(${f.angle}deg,${f.stops.map((s) => `${css(s.color)} ${s.position * 100}%`).join(',')})`);
    else if (f.type === 'GRADIENT_RADIAL') layers.push(`radial-gradient(${f.radius[0] * w}px ${f.radius[1] * h}px at ${f.center[0] * 100}% ${f.center[1] * 100}%,${f.stops.map((s) => `${css(s.color)} ${s.position * 100}%`).join(',')})`);
    else if (f.type === 'IMAGE') {
      const img = data.images[f.ref];
      if (!img) continue;
      const url = `url(data:${img.mime};base64,${img.base64})`;
      if (f.scaleMode === 'CROP' && f.transform) {
        const [[sw, , x0], [, sh, y0]] = f.transform;
        layers.push(`${url} ${-(x0 * w) / sw}px ${-(y0 * h) / sh}px / ${w / sw}px ${h / sh}px no-repeat`);
      } else layers.push(`${url} center / ${f.scaleMode === 'FIT' ? 'contain' : 'cover'} no-repeat`);
    }
  }
  return layers.join(',');
}
function shadow(n) {
  const out = [];
  if (n.strokes?.length) {
    const [t, r, b, l] = n.strokeWeights || [1, 1, 1, 1];
    const c = css(n.strokes[0].color);
    const sign = n.strokeAlign === 'OUTSIDE' ? '' : 'inset';
    if (t === r && r === b && b === l) out.push(`${sign} 0 0 0 ${t}px ${c}`);
    else {
      if (t) out.push(`inset 0 ${t}px 0 0 ${c}`);
      if (b) out.push(`inset 0 -${b}px 0 0 ${c}`);
      if (l) out.push(`inset ${l}px 0 0 0 ${c}`);
      if (r) out.push(`inset -${r}px 0 0 0 ${c}`);
    }
  }
  for (const e of n.effects || []) if (e.type.endsWith('SHADOW')) out.push(`${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${e.x}px ${e.y}px ${e.blur}px ${e.spread}px ${css(e.color)}`);
  return out.join(',');
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function textStyle(st) {
  return `font-family:'Plus Jakarta Sans';font-weight:${st.fontWeight};font-size:${st.fontSize}px;line-height:${st.lineHeight ? st.lineHeight + 'px' : 'normal'};letter-spacing:${st.letterSpacing}px;color:${st.color ? css(st.color) : 'inherit'};text-transform:${{ UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize' }[st.textCase] || 'none'};text-decoration:${st.decoration === 'UNDERLINE' ? 'underline' : 'none'}`;
}
function render(n, parentAuto) {
  const pos = parentAuto && n.positioning !== 'ABSOLUTE' ? 'position:relative;flex:none;' : `position:absolute;left:${n.x}px;top:${n.y}px;`;
  if (n.type === 'TEXT') {
    let inner = '', last = 0;
    for (const r of [...n.ranges].sort((a, b) => a.start - b.start)) {
      inner += esc(n.characters.slice(last, r.start)) + `<span style="${textStyle(r.style)}">${esc(n.characters.slice(r.start, r.end))}</span>`;
      last = r.end;
    }
    inner += esc(n.characters.slice(last));
    const w = n.autoResize === 'WIDTH_AND_HEIGHT' ? 'white-space:pre;' : `width:${n.width}px;white-space:pre-wrap;`;
    return `<div style="${pos}${w}${textStyle(n.style)};text-align:${(n.align || 'LEFT').toLowerCase()};opacity:${n.opacity ?? 1}">${inner}</div>`;
  }
  if (n.type === 'SVG') return `<div style="${pos}width:${n.width}px;height:${n.height}px;opacity:${n.opacity ?? 1}">${n.svg}</div>`;
  if (n.type === 'SPACER') return `<div style="${pos}width:${n.width}px;height:${n.height}px"></div>`;
  const L = n.layout || { mode: 'VERTICAL', spacing: 0, padding: [0, 0, 0, 0], counter: 'MIN' };
  const r = n.radius ? `border-radius:${n.radius.map((x) => x + 'px').join(' ')};` : '';
  const al = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end' }[L.counter] || 'flex-start';
  const style = `${pos}box-sizing:border-box;width:${n.width}px;height:${n.height}px;display:flex;flex-direction:${L.mode === 'HORIZONTAL' ? 'row' : 'column'};gap:${L.spacing}px;padding:${L.padding.map((x) => x + 'px').join(' ')};align-items:${al};background:${bg(n.fills, n.width, n.height)};box-shadow:${shadow(n) || 'none'};${r}overflow:${n.clip ? 'hidden' : 'visible'};opacity:${n.opacity ?? 1};${n.blendMode ? 'mix-blend-mode:' + n.blendMode.toLowerCase().replace(/_/g, '-') + ';' : ''}${(n.effects || []).some((e) => e.type === 'BACKGROUND_BLUR') ? 'backdrop-filter:blur(' + n.effects.find((e) => e.type === 'BACKGROUND_BLUR').radius + 'px);' : ''}`;
  return `<div style="${style}">${(n.children || []).map((c) => render(c, true)).join('')}</div>`;
}
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  const font = fs.readFileSync(path.resolve(__dirname, '../../src/assets/fonts/plus-jakarta-sans-latin-wght-normal.woff2')).toString('base64');
  for (const pg of data.pages) for (const f of pg.frames) {
    if (only.length && !only.includes(f.name)) continue;
    const html = `<!doctype html><style>@font-face{font-family:'Plus Jakarta Sans';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}body{margin:0}</style>${render({ ...f, x: 0, y: 0 }, false)}`;
    await p.setViewportSize({ width: 393, height: Math.round(f.height) });
    await p.setContent(html);
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(outDir, f.name.replace(/[^\w·-]+/g, '_') + '.png') });
  }
  await b.close();
})();
