// node preview.mjs <out.png> <screenId> [screenId...] — renders captured screens from the data pack.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { playwright, startServer, stopServer, BASE, OUT } from './lib.mjs';
import { loadImages, loadSvgs } from './pack.mjs';
const [out, ...ids] = process.argv.slice(2);
const screens = JSON.parse(readFileSync(join(OUT, 'screens.json'), 'utf8'));
const comps = JSON.parse(readFileSync(join(OUT, 'components.json'), 'utf8'));
const images = loadImages();
const svgs = loadSvgs();
const list = ids.map((id) => { if (id.startsWith('comp:')) { const [, d, i] = id.split(':'); return { root: comps[d][+i].root }; } return screens[id]; }).filter(Boolean);
const need = new Set(); const walk = (n) => { (n.f || []).forEach((p) => p.k === 'I' && need.add(p.id)); (n.ch || []).forEach(walk); }; list.forEach((s) => walk(s.root));
const imgs = Object.fromEntries([...need].map((k) => [k, images[k]]));
const srv = await startServer(); const { chromium } = playwright(); const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: list.reduce((a, s) => a + s.root.w + 20, 20), height: Math.max(...list.map((s) => s.root.h)) + 40 } });
await p.goto(BASE + 'figma-plugin/tools/preview/index.html'); await p.waitForFunction(() => window.__ready);
await p.evaluate(([l, i, s]) => window.__renderScreens(l, i, s), [list, imgs, svgs]); await p.waitForTimeout(800);
await p.screenshot({ path: out, fullPage: true }); await b.close(); stopServer(srv); console.log('ok', list.length);
