// Assembles ui.html: the UI template, its CSS and JS, and the data pack.
//   node tools/build.mjs          gzip-compressed pack (default)
//   node tools/build.mjs --raw    plain JSON pack, for Figma builds without DecompressionStream
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPack, loadImages } from './pack.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const raw = process.argv.includes('--raw');
for (const f of ['manifest.json', 'screens.json', 'components.json', 'foundations.json']) {
  if (!existsSync(join(DATA, f))) throw new Error(`Missing data/${f}. Run tools/capture.mjs first.`);
}
const pack = loadPack();
const images = Object.fromEntries(Object.entries(loadImages()).map(([k, v]) => [k, v.data]));

// Sanity: every referenced image and SVG must be in the pack.
const missing = new Set();
const walk = (n) => {
  for (const p of n.f || []) if (p.k === 'I' && !images[p.id]) missing.add('image ' + p.id);
  if (n.sv && !pack.svgs[n.sv]) missing.add('svg ' + n.sv);
  (n.ch || []).forEach(walk);
};
Object.values(pack.screens).forEach((s) => walk(s.root));
Object.values(pack.components).forEach((list) => list.forEach((c) => walk(c.root)));
for (const s of pack.manifest.screens) if (!pack.screens[s.id]) missing.add('screen ' + s.id);
if (missing.size) throw new Error('Data pack is inconsistent: ' + [...missing].slice(0, 10).join(', '));

const json = JSON.stringify(pack);
const packText = raw ? json.replace(/<\//g, '<\\/') : gzipSync(Buffer.from(json), { level: 9 }).toString('base64');
const tpl = readFileSync(join(ROOT, 'src/ui.template.html'), 'utf8');
const html = tpl
  .replace('/*__UI_CSS__*/', () => readFileSync(join(ROOT, 'src/ui.css'), 'utf8'))
  .replace('/*__UI_JS__*/', () => readFileSync(join(ROOT, 'src/ui.js'), 'utf8'))
  .replace('/*__PACK__*/', () => packText)
  .replace('/*__IMAGES__*/', () => JSON.stringify(images));
writeFileSync(join(ROOT, 'ui.html'), html);
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
console.log(`ui.html ${mb(html.length)} · pack ${mb(json.length)} → ${mb(packText.length)} · images ${Object.keys(images).length} (${mb(JSON.stringify(images).length)}) · screens ${pack.manifest.screens.length}`);
