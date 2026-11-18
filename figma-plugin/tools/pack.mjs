// Reads the data pack. Images and SVGs live as real files under assets/
// (assets/images/<key>.jpg|png + index.json, assets/svg/<hash>.svg); a fresh
// capture writes them as data/images.json and data/svgs.json first, and
// syncAssets() moves them into assets/.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const IMG = join(ROOT, 'assets', 'images');
const SVG = join(ROOT, 'assets', 'svg');
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Move freshly captured images/SVGs from data/*.json into assets/ files. */
export function syncAssets() {
  const ij = join(DATA, 'images.json');
  const sj = join(DATA, 'svgs.json');
  if (existsSync(ij)) {
    rmSync(IMG, { recursive: true, force: true });
    mkdirSync(IMG, { recursive: true });
    const images = readJSON(ij);
    const index = {};
    for (const [key, im] of Object.entries(images)) {
      const file = key + (im.mime === 'image/png' ? '.png' : '.jpg');
      writeFileSync(join(IMG, file), Buffer.from(im.data, 'base64'));
      index[key] = { file, mime: im.mime, w: im.w, h: im.h };
    }
    writeFileSync(join(IMG, 'index.json'), JSON.stringify(index, null, 1));
    rmSync(ij);
  }
  if (existsSync(sj)) {
    rmSync(SVG, { recursive: true, force: true });
    mkdirSync(SVG, { recursive: true });
    for (const [hash, svg] of Object.entries(readJSON(sj))) writeFileSync(join(SVG, hash + '.svg'), svg);
    rmSync(sj);
  }
}

export function loadImages() {
  syncAssets();
  const index = readJSON(join(IMG, 'index.json'));
  return Object.fromEntries(Object.entries(index).map(([k, v]) => [k, { ...v, data: readFileSync(join(IMG, v.file)).toString('base64') }]));
}

export function loadSvgs() {
  syncAssets();
  return Object.fromEntries(
    readdirSync(SVG)
      .filter((f) => f.endsWith('.svg'))
      .map((f) => [f.slice(0, -4), readFileSync(join(SVG, f), 'utf8')]),
  );
}

export function loadPack() {
  return {
    manifest: readJSON(join(DATA, 'manifest.json')),
    screens: readJSON(join(DATA, 'screens.json')),
    components: readJSON(join(DATA, 'components.json')),
    foundations: readJSON(join(DATA, 'foundations.json')),
    svgs: loadSvgs(),
  };
}
