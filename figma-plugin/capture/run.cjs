#!/usr/bin/env node
/*
 * Capture every scenario from the running app into figma-plugin/data.
 *   node figma-plugin/capture/run.cjs [--only id1,id2] [--shots dir]
 * Requires the capture dev server: npx vite --config figma-plugin/capture/vite.capture.config.ts
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const L = require('./lib.cjs');
const SCENARIOS = require('./scenarios.cjs');

const args = process.argv.slice(2);
const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',')) : null;
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const DATA = path.join(__dirname, '..', 'data');
const SCREENS = path.join(DATA, 'screens');
const ASSETS = path.join(DATA, 'assets');
fs.mkdirSync(SCREENS, { recursive: true });
fs.mkdirSync(ASSETS, { recursive: true });
if (shots) fs.mkdirSync(shots, { recursive: true });

const assetIndexPath = path.join(DATA, 'assets.json');
const assetIndex = fs.existsSync(assetIndexPath) && only ? JSON.parse(fs.readFileSync(assetIndexPath, 'utf8')) : {};

function saveAssets(assets) {
  for (const [id, a] of Object.entries(assets)) {
    if (assetIndex[id]) continue;
    let file;
    if (a.kind === 'svg') {
      file = id + '.svg';
      fs.writeFileSync(path.join(ASSETS, file), a.data);
    } else {
      const m = a.data.match(/^data:image\/(png|jpeg);base64,(.*)$/);
      if (!m) continue;
      file = id + (m[1] === 'png' ? '.png' : '.jpg');
      fs.writeFileSync(path.join(ASSETS, file), Buffer.from(m[2], 'base64'));
    }
    assetIndex[id] = { kind: a.kind, file, ...(a.vw ? { vw: a.vw, vh: a.vh } : {}) };
  }
}

(async () => {
  const browser = await chromium.launch();
  const index = [];
  const failures = [];
  const list = SCENARIOS.filter((s) => !only || only.has(s.id));
  let n = 0;
  for (const sc of list) {
    n++;
    const page = await L.newPage(browser, { theme: sc.theme || 'light' });
    const t0 = Date.now();
    try {
      if (sc.splash) {
        await L.open(page, sc.route, sc.st, { waitSplash: false });
        await page.waitForSelector('[class*="Splash__"]');
        await page.waitForTimeout(450);
      } else if (sc.fast) {
        await L.open(page, sc.route, sc.st, { waitSplash: true });
        await page.waitForTimeout(80);
      } else {
        await L.open(page, sc.route, sc.st);
        await L.settle(page, 700);
        if (sc.stale) {
          await page.context().setOffline(true);
          await L.go(page, '/home');
          await page.waitForTimeout(600);
          await L.go(page, sc.route);
          await L.settle(page, 1400);
        }
      }
      if (sc.act) await sc.act(page);
      if (!sc.fast && !sc.splash) await L.settle(page, 350);
      const out = await L.capture(page, sc.name, { tall: sc.tall !== false && !sc.fast && !sc.splash, still: !sc.fast && !sc.splash });
      if (shots) await page.locator('#app-frame').screenshot({ path: path.join(shots, sc.id + '.png') });
      const route = await page.evaluate(() => location.hash.slice(1));
      saveAssets(out.assets);
      const rec = { id: sc.id, page: sc.page, group: sc.group, name: sc.name, route: sc.route, at: route, theme: sc.theme || 'light', w: out.root.w, h: out.root.h };
      if (sc.desc) rec.desc = sc.desc;
      fs.writeFileSync(path.join(SCREENS, sc.id + '.json'), JSON.stringify({ ...rec, root: out.root }));
      index.push(rec);
      const errs = page.__errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|net::/.test(e));
      console.log(`${String(n).padStart(3)}/${list.length} ${sc.id.padEnd(26)} ${String(Math.round(out.root.h)).padStart(5)}px ${Date.now() - t0}ms${errs.length ? '  ⚠ ' + errs.join(' | ').slice(0, 160) : ''}`);
    } catch (e) {
      failures.push({ id: sc.id, error: e.message.split('\n')[0] });
      console.log(`${String(n).padStart(3)}/${list.length} ${sc.id.padEnd(26)} FAILED ${e.message.split('\n')[0].slice(0, 160)}`);
      if (shots) await page.screenshot({ path: path.join(shots, sc.id + '-FAIL.png') }).catch(() => undefined);
    }
    await page.context().close();
  }
  await browser.close();

  // Merge with an existing index when capturing a subset.
  const idxPath = path.join(DATA, 'screens.json');
  let all = index;
  if (only && fs.existsSync(idxPath)) {
    const prev = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
    const byId = new Map(prev.map((r) => [r.id, r]));
    index.forEach((r) => byId.set(r.id, r));
    all = SCENARIOS.map((s) => byId.get(s.id)).filter(Boolean);
  }
  fs.writeFileSync(idxPath, JSON.stringify(all, null, 1));
  fs.writeFileSync(assetIndexPath, JSON.stringify(assetIndex));
  // A full run owns the asset folder: drop files no screen refers to any more.
  if (!only) {
    const keep = new Set(Object.values(assetIndex).map((a) => a.file));
    for (const f of fs.readdirSync(ASSETS)) if (!keep.has(f)) fs.unlinkSync(path.join(ASSETS, f));
  }
  console.log(`\n${index.length} captured, ${failures.length} failed, ${Object.keys(assetIndex).length} assets`);
  if (failures.length) {
    console.log(JSON.stringify(failures, null, 1));
    process.exitCode = 1;
  }
})();
