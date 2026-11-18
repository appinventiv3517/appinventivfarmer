// Shared helpers for the capture tools: dev server, pages, serialisation, storage.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const PLUGIN = join(HERE, '..');
export const REPO = join(PLUGIN, '..');
export const OUT = join(PLUGIN, 'data');
export const PORT = Number(process.env.FIG_PORT || 5179);
export const BASE = `http://localhost:${PORT}/`;
export const W = 393;
export const H = 852;
export const SAFE_TOP = 54;
export const SAFE_BOTTOM = 34;

/** Start the Vite dev server (or reuse one already on PORT). */
export async function startServer() {
  if (await ping()) return null;
  const child = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: REPO, stdio: 'ignore', detached: true });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await ping()) return child;
  }
  throw new Error('Vite dev server did not start');
}
async function ping() {
  try {
    const r = await fetch(BASE);
    return r.ok;
  } catch {
    return false;
  }
}
export function stopServer(child) {
  if (child) {
    try {
      process.kill(-child.pid);
    } catch {
      /* already gone */
    }
  }
}

/** Signed-in, verified sample user unless a scenario overrides it. */
export function baseState(over = {}) {
  const s = {
    version: 3,
    session: { onboarded: true, signedIn: true, verified: true, phone: '9876543210', location: 'skipped' },
    prefs: { text: 'default', motion: 'reduce', language: 'en' },
    demo: { network: 'normal', emptyData: false },
  };
  for (const [k, v] of Object.entries(over)) s[k] = typeof v === 'object' && !Array.isArray(v) && s[k] ? { ...s[k], ...v } : v;
  return s;
}

/** Device-like safe areas so every screen leaves room for a status bar and home indicator. */
export const SAFE_CSS = `:root, .fj { --safe-top: ${SAFE_TOP}px !important; --safe-bottom: ${SAFE_BOTTOM}px !important; }
*, *::before, *::after { caret-color: transparent !important; }
::-webkit-scrollbar { display: none; }`;

export async function newContext(browser) {
  return browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'en-IN', timezoneId: 'Asia/Kolkata', permissions: [] });
}

/** Open a route with the given stored state. */
export async function open(ctx, route, state, { wait = 1500 } = {}) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => (page.__errors = (page.__errors || []).concat(e.message)));
  await page.addInitScript(
    ({ st }) => {
      try {
        localStorage.clear();
        localStorage.setItem('kisani-urjaa:state', JSON.stringify(st));
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
    },
    { st: state },
  );
  await page.goto(BASE + '#' + route, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: SAFE_CSS });
  await page.waitForTimeout(Math.min(wait, 900));
  // Wait for the splash screen to finish (it shows on every launch).
  await page.waitForFunction(() => !document.querySelector('[data-testid="fj-splash"], [class*="splash"]'), null, { timeout: 5000 }).catch(() => undefined);
  await page.waitForTimeout(Math.max(250, wait - 900));
  return page;
}

export function frameSelector(route) {
  return route.startsWith('/d2') ? '#fj-frame' : '#app-frame';
}

/** Grow the viewport so the whole scrolling screen is visible, then settle. */
export async function expand(page, maxH = 4600) {
  for (let i = 0; i < 3; i++) {
    const need = await page.evaluate(() => {
      let extra = 0;
      for (const el of document.querySelectorAll('[data-scroll-root]')) {
        const r = el.getBoundingClientRect();
        if (r.height < 50) continue;
        extra = Math.max(extra, el.scrollHeight - el.clientHeight);
      }
      return extra;
    });
    if (need <= 2) break;
    const vp = page.viewportSize();
    await page.setViewportSize({ width: W, height: Math.min(maxH, vp.height + need) });
    await page.waitForTimeout(450);
  }
  await page.evaluate(() => document.querySelectorAll('[data-scroll-root]').forEach((el) => (el.scrollTop = 0)));
}

const SER = readFileSync(join(HERE, 'serialize.js'), 'utf8');

/** Serialize the app screen. Returns { root, images, links, fonts, tone }. */
export async function serialize(page, selector) {
  const has = await page.evaluate(() => !!window.__figSerialize);
  if (!has) await page.addScriptTag({ content: SER });
  const tone = await page
    .evaluate(async () => {
      try {
        const m = await import('/src/lib/statusTone.ts');
        return m.getStatusTone ? m.getStatusTone() : 'dark';
      } catch {
        return 'dark';
      }
    })
    .catch(() => 'dark');
  const data = await page.evaluate(async (sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error('No screen root ' + sel);
    window.__figResetImages();
    return window.__figSerialize(el, {});
  }, selector);
  data.tone = tone;
  return data;
}

/* ---------------- Store: dedupe images across captures ---------------- */
export class Store {
  constructor() {
    this.images = {}; // hash -> {mime,w,h,data}
    this.svgs = {}; // hash -> svg markup (icons and illustrations repeat across screens)
    this.screens = [];
    mkdirSync(OUT, { recursive: true });
  }
  /** Re-key the capture's images by content hash and add it. */
  add(meta, cap) {
    const map = {};
    for (const [id, im] of Object.entries(cap.images)) {
      const hash = createHash('sha1').update(im.data).digest('hex').slice(0, 16);
      map[id] = hash;
      if (!this.images[hash]) this.images[hash] = { mime: im.mime, w: im.w, h: im.h, data: im.data };
    }
    const fix = (n) => {
      if (n.f) for (const p of n.f) if (p.k === 'I') p.id = map[p.id] || p.id;
      if (n.svg) {
        const h = createHash('sha1').update(n.svg).digest('hex').slice(0, 16);
        this.svgs[h] = n.svg;
        n.sv = h;
        delete n.svg;
      }
      if (n.ch) n.ch.forEach(fix);
    };
    fix(cap.root);
    const entry = { ...meta, tone: cap.tone, root: cap.root, links: cap.links };
    this.screens.push(entry);
    return entry;
  }
  save(name) {
    writeFileSync(join(OUT, name + '.screens.json'), JSON.stringify(this.screens));
    writeFileSync(join(OUT, name + '.images.json'), JSON.stringify(this.images));
    writeFileSync(join(OUT, name + '.svgs.json'), JSON.stringify(this.svgs));
  }
}

export function textSignature(node) {
  const out = [];
  const walk = (n) => {
    if (n.t === 'T') out.push(n.seg.map((s) => s.c).join(''));
    if (n.ch) n.ch.forEach(walk);
  };
  walk(node);
  return out;
}

export function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

/* Playwright is installed globally in some environments; resolve it either way. */
import { createRequire } from 'node:module';
export function playwright() {
  const req = createRequire(import.meta.url);
  try {
    return req('playwright');
  } catch {
    return req(join(REPO, 'node_modules', 'playwright'));
  }
}
