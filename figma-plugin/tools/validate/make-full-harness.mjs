// Builds a use_figma script that runs the COMPLETE main.js (minified) on a small
// slice of the data pack, with the UI messaging replaced by in-script lookups.
//   node make-full-harness.mjs <out.js> <dir> <screenId,...> <componentSet,...>
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadSvgs } from '../pack.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [out, dir, screenIds, setNames] = process.argv.slice(2);
const D = (f) => JSON.parse(readFileSync(join(ROOT, 'data', f), 'utf8'));
const manifest = D('manifest.json');
const screens = D('screens.json');
const comps = D('components.json');
const found = D('foundations.json');
const svgs = loadSvgs();
const ids = screenIds.split(',');
const sets = setNames.split(',');
const tiny = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAGklEQVR4nGP4z8DwnwEJMDEwMDAxMKADAEcOAgEXz6c6AAAAAElFTkSuQmCC';

const usedSvg = {};
const fix = (n) => {
  if (n.sv) usedSvg[n.sv] = svgs[n.sv];
  for (const p of n.f || []) if (p.k === 'I') p.id = 'tiny';
  (n.ch || []).forEach(fix);
};
const packScreens = {};
for (const id of ids) {
  packScreens[id] = JSON.parse(JSON.stringify(screens[id]));
  fix(packScreens[id].root);
}
const packComps = { [dir]: comps[dir].filter((c) => sets.includes(c.set)).map((c) => JSON.parse(JSON.stringify(c))) };
packComps[dir].forEach((c) => fix(c.root));
const fd = found[dir];
const pack = {
  manifest: { ...manifest, logo: 'tiny', directions: manifest.directions.filter((d) => d.id === dir), screens: manifest.screens.filter((s) => ids.includes(s.id)) },
  foundations: { [dir]: { tokens: fd.tokens.slice(0, 24), textStyles: fd.textStyles.slice(0, 4), effects: fd.effects.slice(0, 2) } },
  components: packComps,
  screens: packScreens,
  svgs: usedSvg,
};

let main = readFileSync(join(ROOT, 'main.js'), 'utf8');
main = main.replace(/figma\.showUI\([^;]*\);/, '');
main = main.replace(/figma\.ui\.onmessage = function \(msg\) \{[\s\S]*?\n\};\n/, '');
main = main.replace(/figma\.ui\.postMessage\(/g, '__post(');
main = main.replace(/\b(\w+)\.setPluginData\(/g, 'void (');
main = main.replace(/function ask\(type, payload\) \{[\s\S]*?\n\}\n/, `async function ask(type, p) {
  if (type === 'manifest') return __pack.manifest;
  if (type === 'foundation') return __pack.foundations[p];
  if (type === 'components') return __pack.components[p];
  if (type === 'screen') return __pack.screens[p];
  if (type === 'svg') return __pack.svgs[p];
  if (type === 'image') return '${tiny}';
}
`);
const prelude = `var __log = []; function __post(m) { if (m.type === 'log') __log.push(m.level + ': ' + m.text); }\nvar __pack = ${JSON.stringify(pack)};\n`;
const tail = `\nvar __summary = await run({ directions: ['${dir}'], replace: true });\nreturn { summary: __summary, log: __log.slice(0, 10) };\n`;
// Minify the plugin code (keeps top-level await/return outside).
const tmp = join(ROOT, 'tools/validate/.tmp-main.js');
writeFileSync(tmp, main);
const min = execFileSync('npx', ['--yes', 'terser@5.31.0', tmp, '-c', '-m', '--ecma', '2017'], { encoding: 'utf8' });
writeFileSync(out, prelude + min + tail);
console.log('bytes', (prelude + min + tail).length, 'main(min)', min.length, 'pack', JSON.stringify(pack).length);
