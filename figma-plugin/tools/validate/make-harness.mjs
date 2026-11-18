// Builds a use_figma script: the plugin's own builder code + one captured screen.
import { readFileSync, writeFileSync } from 'node:fs';
const [,, screensFile, svgsFile, imagesFile, screenId, outFile, budget = '42000'] = process.argv;
const main = readFileSync(new URL('../../main.js', import.meta.url), 'utf8');
const start = main.indexOf('/* Fonts ');
const end = main.indexOf('/* Foundations');
let builder = main.slice(main.lastIndexOf('/* ---', start), main.lastIndexOf('/* ---', end));
builder = builder.replace(/f\.setPluginData\([^)]*\);/g, 'void 0;');
const screens = JSON.parse(readFileSync(screensFile, 'utf8'));
const svgs = JSON.parse(readFileSync(svgsFile, 'utf8'));
const sc = screens.find((s) => s.id === screenId);
// Take children until the size budget is used; drop images except a tiny test image.
const tiny = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAGklEQVR4nGP4z8DwnwEJMDEwMDAxMKADAEcOAgEXz6c6AAAAAElFTkSuQmCC';
let usedImg = 0;
const strip = (n) => {
  if (n.f) n.f = n.f.map((p) => (p.k === 'I' ? (usedImg++ < 2 ? { ...p, id: 'tiny' } : { k: 'S', c: [0.8, 0.75, 0.7, 1] }) : p));
  (n.ch || []).forEach(strip);
};
const usedSvgs = {};
let size = 0;
const B = Number(budget);
// Depth-first copy of the tree, keeping nodes while the size budget lasts.
const copy = (n) => {
  const { ch, ...rest } = n;
  const own = JSON.stringify(rest).length;
  const svgCost = n.sv && !usedSvgs[n.sv] ? svgs[n.sv].length : 0;
  if (size + own + svgCost > B) return null;
  size += own + svgCost;
  if (n.sv) usedSvgs[n.sv] = svgs[n.sv];
  const out = { ...rest };
  if (ch) {
    out.ch = [];
    for (const c of ch) {
      const cc = copy(c);
      if (cc) out.ch.push(cc);
    }
  }
  return out;
};
const root = copy(sc.root);
strip(root);
const code = `
var __svgs = ${JSON.stringify(usedSvgs)};
var __imgs = { tiny: '${tiny}' };
function log() {}
async function ask(type, key) { return type === 'svg' ? __svgs[key] : __imgs[key]; }
${builder}
await loadAvailableFonts();
var page = figma.currentPage;
var frame = figma.createFrame();
frame.name = 'Validation · ${sc.id}';
frame.resize(${sc.root.w}, ${sc.root.h});
frame.x = ${Math.round(Math.random() * 0) + 0};
frame.fills = await makePaints(${JSON.stringify(sc.root.f || [])});
frame.clipsContent = true;
var data = ${JSON.stringify(root)};
var errors = [];
for (var i = 0; i < data.ch.length; i++) {
  try { await build(data.ch[i], frame); } catch (e) { errors.push(String(e && e.message || e).slice(0, 300)); }
}
return { frameId: frame.id, nodes: stats.nodes, vectorsFailed: stats.vectorsFailed, children: data.ch.length, errors: errors.slice(0, 10), fontsWarned: Object.keys(fontFallbackWarned) };
`;
writeFileSync(outFile, code);
console.log('bytes', code.length, 'children', root.ch.length, 'of', (sc.root.ch || []).length);
