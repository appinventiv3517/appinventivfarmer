// Renders captured layer data back to HTML: a stand-in for what the plugin builds in Figma.
import '@fontsource-variable/plus-jakarta-sans';
type Any = any; // eslint-disable-line
const css = (c: number[]) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3] ?? 1})`;
function inv(m: number[]) { const [a, c, e, b, d, f] = m; const det = a * d - b * c || 1e-9; const A = d / det, B = -b / det, C = -c / det, D = a / det; return { a: A, b: B, c: C, d: D, e: -(A * e + C * f), f: -(B * e + D * f) }; }
function paintCss(p: Any, w: number, h: number, imgs: Any) {
  if (p.k === 'S') return { bg: `linear-gradient(${css(p.c)},${css(p.c)})` };
  if (p.k === 'L') {
    const M = inv(p.m);
    const s = { x: (M.a * 0 + M.c * 0.5 + M.e) * w, y: (M.b * 0 + M.d * 0.5 + M.f) * h };
    const e = { x: (M.a * 1 + M.c * 0.5 + M.e) * w, y: (M.b * 1 + M.d * 0.5 + M.f) * h };
    const ang = (Math.atan2(e.x - s.x, -(e.y - s.y)) * 180) / Math.PI;
    const t = (ang * Math.PI) / 180; const L = Math.abs(w * Math.sin(t)) + Math.abs(h * Math.cos(t)) || 1;
    const len = Math.hypot(e.x - s.x, e.y - s.y);
    const cx = w / 2, cy = h / 2; const ux = Math.sin(t), uy = -Math.cos(t);
    const startOff = ((s.x - cx) * ux + (s.y - cy) * uy + L / 2) / L;
    const stops = p.st.map((st: number[]) => `${css(st.slice(1))} ${((startOff + (st[0] * len) / L) * 100).toFixed(2)}%`).join(',');
    return { bg: `linear-gradient(${ang}deg,${stops})` };
  }
  if (p.k === 'R') {
    const M = inv(p.m);
    const cx = (M.a * 0.5 + M.c * 0.5 + M.e) * w, cy = (M.b * 0.5 + M.d * 0.5 + M.f) * h;
    const rx = Math.abs(M.a * 0.5 * w), ry = Math.abs(M.d * 0.5 * h);
    return { bg: `radial-gradient(${rx}px ${ry}px at ${cx}px ${cy}px,${p.st.map((st: number[]) => `${css(st.slice(1))} ${st[0] * 100}%`).join(',')})` };
  }
  if (p.k === 'I') {
    const im = imgs[p.id]; if (!im) return null;
    const url = `url(data:${im.mime};base64,${im.data})`;
    if (p.mode === 'TILE') return { bg: url, size: `${im.w * (p.sf || 1)}px auto`, pos: '0 0', rep: 'repeat' };
    if (p.mode === 'FIT') return { bg: url, size: 'contain', pos: 'center', rep: 'no-repeat' };
    if (p.mode === 'FILL' || !p.tf) return { bg: url, size: 'cover', pos: 'center', rep: 'no-repeat' };
    const dw = w / p.tf[0], dh = h / p.tf[4];
    return { bg: url, size: `${dw}px ${dh}px`, pos: `${-p.tf[2] * dw}px ${-p.tf[5] * dh}px`, rep: 'no-repeat' };
  }
  return null;
}
function render(n: Any, parent: HTMLElement, imgs: Any, svgs: Any) {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;left:${n.x}px;top:${n.y}px;width:${n.w}px;height:${n.h}px;box-sizing:border-box;`;
  if (n.op !== undefined) el.style.opacity = String(n.op);
  if (n.t === 'V') { el.innerHTML = svgs[n.sv] || n.svg || ''; const s = el.firstElementChild as HTMLElement; if (s) { s.style.width = '100%'; s.style.height = '100%'; s.style.display = 'block'; } parent.appendChild(el); return; }
  if (n.t === 'T') {
    el.style.height = 'auto';
    el.style.whiteSpace = n.ml ? 'pre-wrap' : 'pre';
    if (n.lh) el.style.lineHeight = n.lh + 'px';
    el.style.textAlign = { C: 'center', R: 'right', J: 'justify' }[n.al as string] || 'left';
    if (!n.ml) el.style.width = 'auto';
    for (const s of n.seg) { const sp = document.createElement('span'); sp.textContent = s.c; sp.style.cssText = `font-family:'Plus Jakarta Sans Variable','Noto Sans Devanagari',sans-serif;font-weight:${s.wt};font-size:${s.sz}px;color:${css(s.col)};letter-spacing:${s.ls || 0}px;font-style:${s.it ? 'italic' : 'normal'};text-decoration:${s.td === 'U' ? 'underline' : s.td === 'S' ? 'line-through' : 'none'};text-transform:${{ UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize' }[s.tc as string] || 'none'}`; el.appendChild(sp); }
    parent.appendChild(el); return;
  }
  const layers = (n.f || []).map((p: Any) => paintCss(p, n.w, n.h, imgs)).filter(Boolean).reverse();
  if (layers.length) { el.style.backgroundImage = layers.map((l: Any) => l.bg).join(','); el.style.backgroundSize = layers.map((l: Any) => l.size || 'auto').join(','); el.style.backgroundPosition = layers.map((l: Any) => l.pos || '0 0').join(','); el.style.backgroundRepeat = layers.map((l: Any) => l.rep || 'repeat').join(','); }
  const shadows: string[] = [];
  if (n.s) { const [t, r, b, l] = n.s.w; const c = css(n.s.c); if (t) shadows.push(`inset 0 ${t}px 0 0 ${c}`); if (b) shadows.push(`inset 0 -${b}px 0 0 ${c}`); if (l) shadows.push(`inset ${l}px 0 0 0 ${c}`); if (r) shadows.push(`inset -${r}px 0 0 0 ${c}`); }
  for (const f of n.fx || []) { if (f.k === 'DS') shadows.push(`${f.x}px ${f.y}px ${f.b}px ${f.s}px ${css(f.c)}`); if (f.k === 'IS') shadows.push(`inset ${f.x}px ${f.y}px ${f.b}px ${f.s}px ${css(f.c)}`); if (f.k === 'BB') el.style.backdropFilter = `blur(${f.b}px)`; if (f.k === 'LB') el.style.filter = `blur(${f.b}px)`; }
  if (shadows.length) el.style.boxShadow = shadows.join(',');
  if (n.r) el.style.borderRadius = n.r.map((v: number) => v + 'px').join(' ');
  if (n.c) el.style.overflow = 'hidden';
  parent.appendChild(el);
  for (const c of n.ch || []) render(c, el, imgs, svgs);
}
(window as Any).__renderScreens = (list: Any[], imgs: Any, svgs: Any) => {
  const out = document.getElementById('out')!; out.innerHTML = '';
  for (const s of list) { const box = document.createElement('div'); box.className = 'scr'; box.style.width = s.root.w + 'px'; box.style.height = s.root.h + 'px'; out.appendChild(box); render({ ...s.root, x: 0, y: 0 }, box, imgs, svgs); }
};
(window as Any).__ready = true;
