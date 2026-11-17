// Shared Playwright helpers for the Figma capture.
const fs = require('fs');
const path = require('path');

const BASE = process.env.CAPTURE_URL || 'http://localhost:5199/';
const SERIALIZER = fs.readFileSync(path.join(__dirname, 'serialize.js'), 'utf8');
const SCREEN_W = 393;
const SCREEN_H = 852;
// Fixed clock: the classic 9:41, on the date the sample data was written for.
const NOW = new Date('2026-11-04T09:41:00+05:30');

/** Signed-in, verified sample user with every sheet closed. */
function baseState(over = {}) {
  const s = {
    version: 3,
    session: { onboarded: true, signedIn: true, verified: true, phone: '9876543210', location: 'granted' },
    prefs: { theme: 'light', text: 'default', motion: 'reduce', language: 'en' },
    demo: { network: 'normal', emptyData: false },
  };
  for (const k of Object.keys(over)) s[k] = typeof over[k] === 'object' && !Array.isArray(over[k]) && s[k] ? { ...s[k], ...over[k] } : over[k];
  return s;
}

async function newPage(browser, { theme = 'light' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: theme,
    reducedMotion: 'reduce',
    timezoneId: 'Asia/Kolkata',
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|open-meteo/.test(m.text())) page.__errors.push(m.text().slice(0, 200));
  });
  return page;
}

/** Load the app at a route with a given persisted state (full reload). */
async function open(page, route, state, { waitSplash = true } = {}) {
  // Set storage from a same-origin file that doesn't boot the app, so the
  // router can't redirect (or persist its own state) before ours is in place.
  await page.goto(BASE + 'favicon.png');
  await page.evaluate((st) => {
    localStorage.clear();
    sessionStorage.clear();
    if (st) localStorage.setItem('kisani-urjaa:state', JSON.stringify(st));
  }, state);
  await page.goto(BASE + '#' + route);
  await page.waitForSelector('#app-frame');
  if (waitSplash) await waitNoSplash(page);
}

async function waitNoSplash(page) {
  await page.waitForFunction(() => !document.querySelector('[class*="Splash__"]'), null, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(150);
}

/** Navigate inside the running app (keeps in-memory caches). */
async function go(page, route) {
  await page.evaluate((r) => {
    location.hash = r;
  }, route);
  await page.waitForTimeout(100);
}

async function settle(page, ms = 900) {
  await page.waitForTimeout(ms);
  // Lottie illustrations load lazily; wait until each has drawn.
  await page.waitForFunction(() => [...document.querySelectorAll('#app-frame [data-lottie]')].every((el) => el.querySelector('svg')), null, { timeout: 5000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  // Let images/videos decode.
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll('#app-frame img')];
    await Promise.all(imgs.map((i) => (i.complete ? null : i.decode().catch(() => null))));
  });
}

/**
 * Grow the device screen to the full scroll height so long screens are
 * captured top to bottom (fixed bars stay pinned to the bottom).
 */
async function growToContent(page, maxH = 6000) {
  let h = SCREEN_H;
  for (let i = 0; i < 4; i++) {
    const extra = await page.evaluate(() => {
      // The screen's scroll container: [data-scroll-root], or the largest
      // vertically scrollable element (success pages, sheets-free screens).
      let best = 0;
      for (const el of document.querySelectorAll('#app-frame *')) {
        if (el.closest('[role="dialog"]')) continue;
        const cs = getComputedStyle(el);
        if (!/(auto|scroll)/.test(cs.overflowY) && !el.hasAttribute('data-scroll-root')) continue;
        if (el.clientHeight < 300) continue;
        best = Math.max(best, el.scrollHeight - el.clientHeight);
      }
      return best;
    });
    if (extra < 2) break;
    h = Math.min(maxH, h + extra);
    await setScreenHeight(page, h);
    await page.waitForTimeout(250);
  }
  return h;
}

async function setScreenHeight(page, h) {
  await page.setViewportSize({ width: 1400, height: Math.max(1000, h + 160) });
  await page.evaluate((hh) => {
    let st = document.getElementById('fc-tall');
    if (!st) {
      st = document.createElement('style');
      st.id = 'fc-tall';
      document.head.appendChild(st);
    }
    st.textContent = `[class*="AppFrame__device"]{height:${hh + 40}px!important}[class*="AppFrame__stage"]{height:${hh + 40}px!important}#app-frame{height:${hh}px!important}`;
  }, h);
}

async function resetHeight(page) {
  await page.evaluate(() => document.getElementById('fc-tall')?.remove());
  await page.setViewportSize({ width: 1400, height: 1000 });
}

/** Wait until nothing in the screen is still fading or moving. */
async function waitStill(page, timeout = 4000) {
  const t0 = Date.now();
  let prev = '';
  while (Date.now() - t0 < timeout) {
    const snap = await page.evaluate(() => {
      let h = 0;
      const els = document.querySelectorAll('#app-frame *');
      for (let i = 0; i < els.length; i++) {
        const cs = getComputedStyle(els[i]);
        const s = cs.opacity + cs.transform;
        for (let j = 0; j < s.length; j++) h = (h * 31 + s.charCodeAt(j)) | 0;
      }
      return els.length + ':' + h;
    });
    if (snap === prev) return;
    prev = snap;
    await page.waitForTimeout(220);
  }
}

async function capture(page, name, { tall = true, still = true } = {}) {
  if (still) await waitStill(page);
  if (tall) await growToContent(page);
  await page.evaluate(() => {
    const el = document.querySelector('[data-scroll-root]');
    if (el) el.scrollTop = 0;
  });
  await page.waitForTimeout(120);
  const has = await page.evaluate(() => typeof window.__figmaCapture === 'function');
  if (!has) await page.addScriptTag({ content: SERIALIZER });
  const out = await page.evaluate((n) => window.__figmaCapture('#app-frame', { name: n }), name);
  if (tall) await resetHeight(page);
  return out;
}

module.exports = { waitStill, BASE, NOW, SCREEN_W, SCREEN_H, baseState, newPage, open, go, settle, capture, waitNoSplash, growToContent, resetHeight };
