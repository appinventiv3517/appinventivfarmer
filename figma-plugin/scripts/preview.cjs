#!/usr/bin/env node
/*
 * Fidelity check: re-renders captured screens from data/ the way the plugin
 * rebuilds them (absolute layers, static font weights, the same text anchoring
 * and SVG placement) and compares them with screenshots of the real app.
 *   node figma-plugin/scripts/preview.cjs <app-shots-dir> <out-dir> [id,id,…]
 * Prints a per-screen mismatch score and writes side-by-side images.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const [shotsDir, outDir, onlyArg] = process.argv.slice(2);
const assets = JSON.parse(fs.readFileSync(path.join(DATA, 'assets.json'), 'utf8'));
const FONT = path.join(ROOT, '..', 'src', 'assets', 'fonts', 'plus-jakarta-sans-latin-wght-normal.woff2');

const cssColor = (c) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${c[3] ?? 1})`;
const stopList = (s, unit) => s.map((st) => `${cssColor(st.slice(1))} ${(st[0] * 100).toFixed(2)}%`).join(',');
// Same static-weight snapping as the plugin (ties go lighter).
const snap = (w) => [200, 300, 400, 500, 600, 700, 800].reduce((best, x) => (Math.abs(x - w) * 2 + (x > w ? 1 : 0) < Math.abs(best - w) * 2 + (best > w ? 1 : 0) ? x : best), 400);

function assetUrl(id) {
  const a = assets[id];
  if (!a) return '';
  const buf = fs.readFileSync(path.join(DATA, 'assets', a.file));
  if (a.kind === 'svg') return 'data:image/svg+xml;base64,' + buf.toString('base64');
  return `data:image/${a.kind === 'jpg' ? 'jpeg' : 'png'};base64,` + buf.toString('base64');
}

function bg(n) {
  if (!n.fills) return '';
  const layers = n.fills
    .slice()
    .reverse()
    .map((f) => {
      if (f.k === 'S') return `linear-gradient(${cssColor(f.c)},${cssColor(f.c)})`;
      if (f.k === 'L') return `linear-gradient(${f.a}deg,${stopList(f.s)})`;
      if (f.k === 'R') return `radial-gradient(${(f.rx * n.w).toFixed(1)}px ${(f.ry * n.h).toFixed(1)}px at ${(f.cx * 100).toFixed(1)}% ${(f.cy * 100).toFixed(1)}%,${stopList(f.s)})`;
      if (f.k === 'I') return `url(${assetUrl(f.ref)}) center/${f.mode === 'FIT' ? 'contain' : 'cover'} no-repeat`;
      return '';
    })
    .filter(Boolean);
  return layers.length ? `background:${layers.join(',')};` : '';
}

function box(n) {
  let s = bg(n);
  if (n.r) s += `border-radius:${n.r.map((r) => r + 'px').join(' ')};`;
  const shadows = [];
  if (n.st) {
    const w = n.st.w;
    shadows.push(`inset 0 ${w[0]}px 0 0 ${cssColor(n.st.c)}`, `inset -${w[1]}px 0 0 0 ${cssColor(n.st.c)}`, `inset 0 -${w[2]}px 0 0 ${cssColor(n.st.c)}`, `inset ${w[3]}px 0 0 0 ${cssColor(n.st.c)}`);
  }
  (n.fx || []).forEach((e) => shadows.push(`${e.k === 'I' ? 'inset ' : ''}${e.x}px ${e.y}px ${e.b}px ${e.s || 0}px ${cssColor(e.c)}`));
  if (shadows.length) s += `box-shadow:${shadows.join(',')};`;
  if (n.bblur) s += `backdrop-filter:blur(${n.bblur}px);`;
  if (n.gray) s += `filter:grayscale(${n.gray});`;
  if (n.o !== undefined) s += `opacity:${n.o};`;
  if (n.clip) s += 'overflow:hidden;';
  if (n.bm) s += `mix-blend-mode:${n.bm.toLowerCase().replace(/_/g, '-')};`;
  return s;
}

function render(n, px, py) {
  const left = n.x - px, top = n.y - py;
  if (n.t === 'T') {
    const spans = n.segs
      .map((sg) => {
        const t = n.chars.slice(sg.s, sg.e).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        return `<span style="font-size:${sg.f}px;font-weight:${snap(sg.w)};color:${cssColor(sg.c)};letter-spacing:${sg.ls || 0}px;${sg.tt === 'U' ? 'text-transform:uppercase;' : ''}${sg.d === 'U' ? 'text-decoration:underline;' : ''}">${t}</span>`;
      })
      .join('');
    const lh = n.lh ? `line-height:${n.lh}px;` : 'line-height:normal;';
    if (n.ml || n.fixed || n.clamp) {
      const clamp = n.clamp ? `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${n.clamp};overflow:hidden;` : '';
      return `<div style="position:absolute;left:${left}px;top:${top}px;width:${n.w + 1}px;white-space:pre-wrap;text-align:${{ L: 'left', C: 'center', R: 'right', J: 'justify' }[n.al]};${lh}${clamp}">${spans}</div>`;
    }
    const ix = (n.ix ?? n.x) - px, iw = n.iw ?? n.w;
    const pos = n.al === 'C' ? `left:${ix + iw / 2}px;transform:translateX(-50%);` : n.al === 'R' ? `left:${ix + iw}px;transform:translateX(-100%);` : `left:${ix}px;`;
    return `<div style="position:absolute;${pos}top:${top}px;white-space:pre;${lh}">${spans}</div>`;
  }
  if (n.t === 'V') {
    const w = n.vw * n.sx, h = n.vh * n.sy;
    const img = `<img src="${assetUrl(n.ref)}" style="position:absolute;left:${n.ox || 0}px;top:${n.oy || 0}px;width:${w}px;height:${h}px;${n.o !== undefined ? 'opacity:' + n.o : ''}">`;
    return `<div style="position:absolute;left:${left}px;top:${top}px;width:${n.w}px;height:${n.h}px;${n.clip ? 'overflow:hidden;' : ''}${n.r ? 'border-radius:' + n.r[0] + 'px;' : ''}">${img}</div>`;
  }
  const kids = (n.c || []).map((c) => render(c, n.x, n.y)).join('');
  return `<div style="position:absolute;left:${left}px;top:${top}px;width:${n.w}px;height:${n.h}px;${box(n)}">${kids}</div>`;
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const index = JSON.parse(fs.readFileSync(path.join(DATA, 'screens.json'), 'utf8'));
  const only = onlyArg ? new Set(onlyArg.split(',')) : null;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  const font = 'data:font/woff2;base64,' + fs.readFileSync(FONT).toString('base64');
  const results = [];
  for (const rec of index) {
    if (only && !only.has(rec.id)) continue;
    const { root } = JSON.parse(fs.readFileSync(path.join(DATA, 'screens', rec.id + '.json'), 'utf8'));
    const html = `<!doctype html><html><head><style>@font-face{font-family:P;src:url(${font}) format('woff2-variations');font-weight:200 800}body{margin:0;font-family:P}*{box-sizing:border-box}</style></head><body>${render({ ...root, x: 0, y: 0 }, 0, 0)}</body></html>`;
    await page.setViewportSize({ width: 393, height: Math.round(root.h) });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(outDir, rec.id + '.png');
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 393, height: 852 } });
    // Mismatch vs the real app (first 852px).
    const shot = path.join(shotsDir, rec.id + '.png');
    if (!fs.existsSync(shot)) continue;
    const diff = await page.evaluate(
      async ([a, b]) => {
        const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const c = document.createElement('canvas');
        c.width = 393; c.height = 852;
        const x = c.getContext('2d');
        x.drawImage(ia, 0, 0); const da = x.getImageData(0, 0, 393, 852).data;
        x.clearRect(0, 0, 393, 852); x.drawImage(ib, 0, 0); const db = x.getImageData(0, 0, 393, 852).data;
        let bad = 0;
        for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 60) bad++;
        return bad / (393 * 852);
      },
      ['data:image/png;base64,' + fs.readFileSync(file).toString('base64'), 'data:image/png;base64,' + fs.readFileSync(shot).toString('base64')],
    );
    results.push([rec.id, diff]);
  }
  await browser.close();
  results.sort((a, b) => b[1] - a[1]);
  results.forEach(([id, d]) => console.log((d * 100).toFixed(2).padStart(6) + '%  ' + id));
  const avg = results.reduce((s, r) => s + r[1], 0) / (results.length || 1);
  console.log(`\n${results.length} screens · average mismatch ${(avg * 100).toFixed(2)}% of pixels`);
})();
