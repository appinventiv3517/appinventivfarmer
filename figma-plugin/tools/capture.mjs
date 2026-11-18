/*
 * Captures the whole Kisani Urjaa app (both design directions) into the data
 * pack the Figma plugin imports.
 *
 *   node figma-plugin/tools/capture.mjs [--dirs d1,d2] [--quick] [--concurrency 4]
 *
 * What it records, per direction:
 *   - every route, in its default state (dynamic routes are discovered by
 *     following links, a few instances per pattern so each status shows);
 *   - Loading (slow network skeletons), Empty (empty data), Offline / failed
 *     requests, Unverified account, Location denied and language variants,
 *     kept only when they differ from the default;
 *   - interaction states found by tapping each control on each screen:
 *     sheets and dialogs, validation errors, toasts, tab and filter switches;
 *   - scripted flows: onboarding slides, phone + OTP (wrong code and success),
 *     search with results and with none, order and booking validation;
 *   - the splash screen;
 *   - components from the gallery page, with variant properties;
 *   - design tokens (colours, radii, spacing, type, shadows).
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { playwright, startServer, stopServer, newContext, open, expand, serialize, baseState, frameSelector, Store, textSignature, slug, OUT, BASE, W, H, SAFE_CSS, REPO } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const QUICK = args.includes('--quick');
const DIRS = opt('dirs', 'd1,d2').split(',');
const CONC = Number(opt('concurrency', 4));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const DIRECTIONS = {
  d1: { id: 'd1', prefix: '', title: '01 · Illustrated', short: '01 Illustrated', start: '/home', startName: 'Home' },
  d2: { id: 'd2', prefix: '/d2', title: '02 · Field Journal', short: '02 Field Journal', start: '/d2/home', startName: 'Today' },
};

/* ---------- Route inventory ---------- */
// [path (direction-relative), title, group, session]
const STATIC = [
  ['/welcome', 'Welcome', 'Onboarding', 'new'],
  ['/welcome/language', 'Choose language', 'Onboarding', 'new'],
  ['/auth', 'Sign in', 'Onboarding', 'signedOut'],
  ['/auth/otp', 'Enter code', 'Onboarding', 'signedOut'],
  ['/auth/location', 'Location access', 'Onboarding', 'location'],
  ['/home', 'Home', 'Home', 'in'],
  ['/notifications', 'Notifications', 'Home', 'in'],
  ['/learn', 'Learn · Journal', 'Learn', 'in'],
  ['/search', 'Search', 'Learn', 'in', 'd2'],
  ['/bookmarks', 'Saved', 'Learn', 'in'],
  ['/events', 'Events', 'Events', 'in'],
  ['/orders', 'Orders & bookings', 'Orders & bookings', 'in'],
  ['/orders/fom/new', 'New FOM order', 'Orders & bookings', 'in'],
  ['/bookings/new', 'New booking', 'Orders & bookings', 'in'],
  ['/forms', 'Season records', 'Season records', 'in'],
  ['/lands', 'My fields', 'Fields', 'in'],
  ['/lands/new', 'Add a field', 'Fields', 'in'],
  ['/account', 'Account', 'Account', 'in'],
  ['/account/profile', 'Profile', 'Account', 'in'],
  ['/account/language', 'Language', 'Account', 'in'],
  ['/account/password', 'Password', 'Account', 'in'],
  ['/account/machinery', 'Machinery', 'Account', 'in'],
  ['/account/help', 'Help', 'Account', 'in'],
  ['/account/contact', 'Contact us', 'Account', 'in'],
  ['/account/about', 'About', 'Account', 'in'],
  ['/account/legal/privacy', 'Privacy policy', 'Account', 'in'],
  ['/account/legal/terms', 'Terms of use', 'Account', 'in'],
  ['/account/verify', 'Verify account', 'Account', 'unverified'],
  ['/account/prototype', 'Prototype controls', 'Account', 'in'],
  ['/design-system', 'Design system', 'System', 'in'],
  ['/this-page-does-not-exist', 'Not found', 'System', 'in'],
];
// Dynamic patterns discovered from links: [regex, title, group, max instances]
const DYNAMIC = [
  [/^\/news\/[^/]+$/, 'News story', 'Learn', 2],
  [/^\/articles\/[^/]+$/, 'Guide', 'Learn', 2],
  [/^\/videos\/[^/]+$/, 'Video', 'Learn', 2],
  [/^\/events\/[^/]+$/, 'Event', 'Events', 3],
  [/^\/orders\/fom\/[^/]+\/placed$/, 'Order placed', 'Orders & bookings', 1],
  [/^\/orders\/fom\/(?!new$)[^/]+$/, 'FOM order', 'Orders & bookings', 4],
  [/^\/bookings\/[^/]+\/requested$/, 'Booking requested', 'Orders & bookings', 1],
  [/^\/bookings\/(?!new$)[^/]+$/, 'Booking', 'Orders & bookings', 4],
  [/^\/forms\/[^/]+\/steps\/[^/]+$/, 'Season step', 'Season records', 3],
  [/^\/forms\/[^/]+$/, 'Season record', 'Season records', 2],
  [/^\/lands\/(?!new$)[^/]+$/, 'Field', 'Fields', 4],
];
const SEEDS = ['/articles/a-soil-health-card', '/articles/a-drip-cotton', '/videos/v-baling', '/videos/v-soil-sample', '/events/e-baling-demo', '/events/e-training', '/events/e-crop-health', '/bookings/4581', '/bookings/8458', '/bookings/5848', '/bookings/4589'];
const GROUP_ORDER = ['Onboarding', 'Home', 'Learn', 'Events', 'Orders & bookings', 'Season records', 'Fields', 'Account', 'System'];

function sessionState(kind, extra = {}) {
  const s = {
    new: { session: { onboarded: false, signedIn: false, verified: false, phone: '', location: 'unknown' } },
    signedOut: { session: { onboarded: true, signedIn: false, verified: false, phone: '9876543210', location: 'unknown' } },
    location: { session: { onboarded: true, signedIn: true, verified: true, phone: '9876543210', location: 'unknown' } },
    in: {},
    unverified: { session: { verified: false } },
  }[kind];
  return baseState({ ...s, ...extra });
}

/* ---------- Capture one state ---------- */
const store = new Store();
const seenScreens = new Map(); // id -> entry
const rowSigs = new Map(); // dir|row -> Set of text signatures already kept
/** False when this row already has a state showing exactly the same text. */
function fresh(dirId, row, sig) {
  const key = dirId + '|' + row;
  const s = JSON.stringify([...sig].sort());
  const set = rowSigs.get(key) || new Set();
  rowSigs.set(key, set);
  if (set.has(s)) return false;
  set.add(s);
  return true;
}
let errors = 0;

async function settle(page) {
  // Let images decode and lazy photos load once everything is in view.
  await expand(page);
  await page.evaluate(async () => {
    const imgs = Array.from(document.images).filter((i) => !i.complete);
    await Promise.race([Promise.all(imgs.map((i) => new Promise((r) => (i.onload = i.onerror = r)))), new Promise((r) => setTimeout(r, 2500))]);
  });
  await page.waitForTimeout(250);
}

async function waitImages(page) {
  await page.evaluate(async () => {
    const imgs = Array.from(document.images).filter((i) => !i.complete);
    await Promise.race([Promise.all(imgs.map((i) => new Promise((r) => (i.onload = i.onerror = r)))), new Promise((r) => setTimeout(r, 2500))]);
  });
  await page.waitForTimeout(200);
}

async function headingOf(page) {
  return page.evaluate(() => {
    const h = document.querySelector('[data-scroll-root] h1, h1, [data-scroll-root] h2');
    return h ? h.textContent.trim().replace(/\s+/g, ' ').slice(0, 48) : '';
  });
}

async function captureInto(page, dir, meta) {
  const route = meta.fullRoute;
  const cap = await serialize(page, frameSelector(route));
  cap.bottomTone = 'dark';
  const sig = textSignature(cap.root);
  const id = `${dir.id}:${slug(meta.row)}:${slug(meta.state)}`;
  if (seenScreens.has(id)) return { sig, entry: seenScreens.get(id) };
  fresh(dir.id, meta.row, sig);
  const entry = store.add({ id, dir: dir.id, group: meta.group, row: meta.row, state: meta.state, title: `${meta.row} · ${meta.state}`, route, primary: !!meta.primary, order: meta.order ?? 0 }, cap);
  entry.sig = sig;
  seenScreens.set(id, entry);
  if (page.__errors && page.__errors.length) log('  page errors', route, page.__errors.slice(0, 2));
  return { sig, entry, links: cap.links };
}

function differs(a, b, min = 1) {
  const A = new Set(a.filter((t) => !/^Offline/.test(t)));
  const B = new Set(b.filter((t) => !/^Offline/.test(t)));
  let d = 0;
  for (const t of A) if (!B.has(t)) d++;
  for (const t of B) if (!A.has(t)) d++;
  return d >= min;
}

/* ---------- Simple worker pool ---------- */
async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const my = items[i++];
      try {
        await fn(my);
      } catch (e) {
        errors++;
        log('  ! failed', my.label || my.route || '', e.message.split('\n')[0]);
      }
    }
  });
  await Promise.all(workers);
}

/* ---------- Direction run ---------- */
async function runDirection(browser, dir) {
  log('Direction', dir.title);
  const ctxs = await Promise.all(Array.from({ length: CONC }, () => newContext(browser)));
  let ci = 0;
  const ctx = () => ctxs[ci++ % ctxs.length];
  const P = (r) => dir.prefix + (r === '/' ? '' : r);
  const bases = []; // { route, row, group, session, sig, links }
  const queued = new Set();

  /* 1. Static routes, default state. */
  const statics = STATIC.filter((r) => !r[4] || r[4] === dir.id).map(([path, title, group, session], order) => ({ path, title, group, session, order }));
  if (QUICK) statics.splice(8);
  const dynFound = new Map(); // pattern index -> [paths]
  const discover = (links) => {
    for (const L of links || []) {
      const m = (L.href || '').match(/#(\/[^?]*)/);
      if (!m) continue;
      let p = m[1];
      if (dir.prefix) {
        if (!p.startsWith(dir.prefix + '/')) continue;
        p = p.slice(dir.prefix.length);
      } else if (p.startsWith('/d2')) continue;
      DYNAMIC.forEach(([re], i) => {
        if (!re.test(p)) return;
        const list = dynFound.get(i) || [];
        if (list.includes(p) || list.length >= DYNAMIC[i][3]) return;
        list.push(p);
        dynFound.set(i, list);
      });
    }
  };
  const captureBase = async (b) => {
    const page = await open(ctx(), P(b.path), sessionState(b.session));
    const landed = await page.evaluate(() => location.hash.slice(1).split('?')[0]);
    if (landed !== P(b.path) && !/does-not-exist/.test(b.path)) {
      // Redirected (e.g. the code screen needs a phone number first): the flow captures it instead.
      log('  redirect', P(b.path), '->', landed);
      await page.close();
      return;
    }
    await settle(page);
    const h = b.dynamic ? await headingOf(page) : '';
    b.row = b.dynamic ? `${b.title} · ${h || b.path.split('/').pop()}` : b.title;
    b.fullRoute = P(b.path);
    const res = await captureInto(page, dir, { fullRoute: b.fullRoute, group: b.group, row: b.row, state: 'Default', primary: true, order: b.order });
    b.sig = res.sig;
    discover(res.links);
    bases.push(b);
    queued.add(b.path);
    await page.close();
  };
  await pool(statics, CONC, captureBase);
  log('  static routes', bases.length);
  // Detail screens linked only from inside tabs (bookings, videos, guides, events list):
  // seed them with the sample data's stable ids so every detail type is captured.
  discover(SEEDS.map((p) => ({ href: '#' + P(p) })));

  /* 2. Dynamic routes found through links (two hops). */
  for (let hop = 0; hop < 2; hop++) {
    const todo = [];
    for (const [i, list] of dynFound) {
      for (const p of list) {
        if (queued.has(p)) continue;
        queued.add(p);
        todo.push({ path: p, title: DYNAMIC[i][1], group: DYNAMIC[i][2], session: 'in', dynamic: true, order: 100 + i });
      }
    }
    // Success screens are reached after creating something; any existing id renders them.
    if (hop === 0) {
      const order = (dynFound.get(DYNAMIC.findIndex((d) => d[1] === 'FOM order')) || [])[0];
      const booking = (dynFound.get(DYNAMIC.findIndex((d) => d[1] === 'Booking')) || [])[0];
      if (order && !queued.has(order + '/placed')) {
        queued.add(order + '/placed');
        todo.push({ path: order + '/placed', title: 'Order placed', group: 'Orders & bookings', session: 'in', dynamic: true, order: 104 });
      }
      if (booking && !queued.has(booking + '/requested')) {
        queued.add(booking + '/requested');
        todo.push({ path: booking + '/requested', title: 'Booking requested', group: 'Orders & bookings', session: 'in', dynamic: true, order: 106 });
      }
    }
    if (!todo.length) break;
    await pool(todo, CONC, captureBase);
  }
  log('  routes total', bases.length);

  /* 3. Data states: Loading / Empty / Offline, plus account and permission variants. */
  const variants = [];
  const seenPattern = new Set();
  for (const b of bases) {
    if (b.session !== 'in' || /design-system|does-not-exist|legal|prototype/.test(b.path)) continue;
    if (b.dynamic) {
      // Loading / empty / offline look the same for every order, field…: show them once per screen type.
      if (seenPattern.has(b.title)) continue;
      seenPattern.add(b.title);
    }
    variants.push({ b, state: 'Loading', extra: { demo: { network: 'slow' } }, wait: 1000, min: 1 });
    variants.push({ b, state: 'Empty', extra: { demo: { emptyData: true } }, min: 1 });
    variants.push({ b, state: 'Offline', extra: { demo: { network: 'offline' } }, min: 1, wait: 2200 });
  }
  for (const b of bases) {
    if (/^\/(home|orders|orders\/fom\/new|bookings\/new|account|lands\/new)$/.test(b.path)) variants.push({ b, state: 'Unverified account', extra: { session: { verified: false } }, min: 1 });
    if (/^\/(home|events)$/.test(b.path)) variants.push({ b, state: 'Location denied', extra: { session: { location: 'denied' } }, min: 1 });
    if (b.path === '/home') {
      variants.push({ b, state: 'Hindi', extra: { prefs: { language: 'hi' } }, min: 1 });
      variants.push({ b, state: 'Marathi', extra: { prefs: { language: 'mr' } }, min: 1 });
    }
    if (b.path === '/notifications') variants.push({ b, state: 'All read', extra: { unreadNotifications: [] }, min: 1 });
    if (b.path === '/bookmarks') variants.push({ b, state: 'No saved items', extra: { bookmarks: [] }, min: 1 });
    if (b.path === '/lands') variants.push({ b, state: 'No fields', extra: { lands: [] }, min: 1 });
  }
  await pool(variants, CONC, async (v) => {
    const st = sessionState(v.b.session, v.extra);
    const page = await open(ctx(), v.b.fullRoute, st, { wait: v.wait || 1800 });
    if (v.state !== 'Loading') await settle(page);
    else await expand(page);
    const cap = await serialize(page, frameSelector(v.b.fullRoute));
    const sig = textSignature(cap.root);
    if (differs(sig, v.b.sig, v.min) && fresh(dir.id, v.b.row, sig)) {
      store.add({ id: `${dir.id}:${slug(v.b.row)}:${slug(v.state)}`, dir: dir.id, group: v.b.group, row: v.b.row, state: v.state, title: `${v.b.row} · ${v.state}`, route: v.b.fullRoute, primary: false, order: v.b.order }, cap);
    }
    await page.close();
  });
  log('  data and account states done; screens so far', store.screens.length);

  /* 4. Interaction states: tap each control and keep what changes. */
  const explore = [];
  for (const b of bases) {
    if (/design-system|does-not-exist/.test(b.path)) continue;
    explore.push(b);
  }
  const navLinks = []; // { screenId, k, href } discovered by tapping buttons
  await pool(explore, CONC, async (b) => {
    const page = await open(ctx(), b.fullRoute, sessionState(b.session));
    const cands = await page.evaluate(() => {
      const root = document.querySelector('#fj-frame') || document.querySelector('#app-frame');
      const out = [];
      const els = root.querySelectorAll('button, [role="button"], [role="tab"], [role="radio"], [role="switch"]');
      for (const el of els) {
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
        if (el.closest('nav') && el.closest('nav').querySelector('a[href*="home"], a[href*="account"]')) continue; // bottom navigation
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const name = (el.getAttribute('aria-label') || el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
        if (!name) continue;
        if (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true') continue;
        out.push({ key: window.__figKeyOf ? null : null, name, role: el.getAttribute('role') || 'button', idx: out.length });
      }
      return out;
    });
    await page.close();
    const max = QUICK ? 4 : 16;
    for (const c of cands.slice(0, max)) {
      const p = await open(ctx(), b.fullRoute, sessionState(b.session));
      try {
        const before = await p.evaluate(() => ({ url: location.hash, dialogs: document.querySelectorAll('[role="dialog"]').length, alerts: document.querySelectorAll('[role="alert"], [aria-invalid="true"]').length, toast: ((document.querySelector('[role="status"][aria-live]') || {}).innerText || '').replace(/\s+/g, ' ') }));
        const ser = readFileSync(join(REPO, 'figma-plugin/tools/serialize.js'), 'utf8');
        await p.addScriptTag({ content: ser });
        const key = await p.evaluate((c) => {
          const root = document.querySelector('#fj-frame') || document.querySelector('#app-frame');
          const els = Array.from(root.querySelectorAll('button, [role="button"], [role="tab"], [role="radio"], [role="switch"]')).filter((el) => {
            if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
            if (el.closest('nav') && el.closest('nav').querySelector('a[href*="home"], a[href*="account"]')) return false;
            const r = el.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) return false;
            const name = (el.getAttribute('aria-label') || el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
            if (!name) return false;
            if (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true') return false;
            return true;
          });
          const el = els[c.idx];
          if (!el) return null;
          el.setAttribute('data-fig-target', '1');
          return window.__figKeyOf(el, root);
        }, c);
        if (key === null) continue;
        const isBack = /^(back|go back|close)$/i.test(c.name);
        await p.click('[data-fig-target="1"]', { timeout: 2500 }).catch(() => p.evaluate(() => document.querySelector('[data-fig-target="1"]').click()));
        await p.waitForTimeout(900);
        const after = await p.evaluate(() => ({ url: location.hash, dialogs: document.querySelectorAll('[role="dialog"]').length, alerts: document.querySelectorAll('[role="alert"], [aria-invalid="true"]').length, toast: ((document.querySelector('[role="status"][aria-live]') || {}).innerText || '').replace(/\s+/g, ' '), dialogTitle: (document.querySelector('[role="dialog"] h2, [role="dialog"] h1, [role="dialog"] [id]') || {}).textContent || '' }));
        const baseId = `${dir.id}:${slug(b.row)}:default`;
        if (after.url !== before.url) {
          navLinks.push({ screenId: baseId, k: key, href: after.url, back: isBack });
          continue;
        }
        let state = null;
        if (after.dialogs > before.dialogs) state = 'Sheet · ' + (after.dialogTitle.trim().slice(0, 40) || c.name);
        else if (after.alerts > before.alerts) state = 'Validation · ' + c.name;
        else if (after.toast && after.toast !== before.toast) state = 'Toast · ' + after.toast.trim().slice(0, 40);
        else if (c.role === 'tab' || c.role === 'radio') state = (c.role === 'tab' ? 'Tab · ' : 'Option · ') + c.name;
        else state = 'After tapping · ' + c.name;
        // Sheets and toasts sit on the visible screen: keep phone height for them.
        if (/^(Sheet|Toast)/.test(state)) await waitImages(p);
        else await settle(p);
        const cap = await serialize(p, frameSelector(b.fullRoute));
        const sig = textSignature(cap.root);
        const minDiff = /^(Sheet|Validation|Toast)/.test(state) ? 1 : 3;
        if (!differs(sig, b.sig, minDiff) || !fresh(dir.id, b.row, sig)) continue;
        const id = `${dir.id}:${slug(b.row)}:${slug(state)}`;
        if (store.screens.some((s) => s.id === id)) continue;
        store.add({ id, dir: dir.id, group: b.group, row: b.row, state, title: `${b.row} · ${state}`, route: b.fullRoute, primary: false, order: b.order }, cap);
      } catch (e) {
        log('  ! explore', b.path, c.name, e.message.split('\n')[0]);
      } finally {
        await p.close();
      }
    }
  });
  log('  interaction states done; screens so far', store.screens.length);

  /* 5. Scripted flows. */
  await flows(ctx, dir, P, bases);

  /* 6. Splash. */
  {
    const page = await ctx().newPage();
    await page.addInitScript((st) => {
      localStorage.setItem('kisani-urjaa:state', JSON.stringify(st));
      sessionStorage.clear();
    }, sessionState('in'));
    await page.goto(BASE + '#' + P('/home'));
    await page.addStyleTag({ content: SAFE_CSS });
    await page.waitForTimeout(560);
    const cap = await serialize(page, frameSelector(P('/home')));
    store.add({ id: `${dir.id}:splash:default`, dir: dir.id, group: 'Onboarding', row: 'Splash', state: 'Default', title: 'Splash', route: '', primary: false, order: -1 }, cap);
    await page.close();
  }

  /* Attach button-discovered navigation to their screens' links. */
  for (const L of navLinks) {
    const s = store.screens.find((x) => x.id === L.screenId);
    if (s) s.links.push({ k: L.k, href: L.href, back: L.back || undefined });
  }
  await Promise.all(ctxs.map((c) => c.close()));
}

/* ---------- Scripted flows ---------- */
async function flows(ctx, dir, P, bases) {
  const add = async (page, row, group, state, route, order = 0) => {
    await settle(page);
    const cap = await serialize(page, frameSelector(route));
    const id = `${dir.id}:${slug(row)}:${slug(state)}`;
    if (store.screens.some((s) => s.id === id)) return;
    if (!fresh(dir.id, row, textSignature(cap.root))) return;
    store.add({ id, dir: dir.id, group, row, state, title: `${row} · ${state}`, route, primary: false, order }, cap);
  };
  const tryStep = async (label, fn) => {
    try {
      await fn();
    } catch (e) {
      log('  ! flow', label, e.message.split('\n')[0]);
    }
  };
  const clickText = async (page, re) => {
    const el = page.locator('button, a, [role="button"]').filter({ hasText: re }).first();
    await el.click({ timeout: 3000 });
  };

  // Onboarding slides.
  await tryStep('welcome slides', async () => {
    const page = await open(ctx(), P('/welcome'), sessionState('new'));
    for (let i = 2; i <= 3; i++) {
      const next = page.locator('button[aria-label*="Next" i], button:has-text("Next")').first();
      if (!(await next.count())) break;
      await next.click({ timeout: 3000 });
      await page.waitForTimeout(700);
      await add(page, 'Welcome', 'Onboarding', `Slide ${i}`, P('/welcome'), 0);
    }
    await page.close();
  });

  // Sign in: phone filled, invalid phone, then OTP wrong / right.
  await tryStep('sign in', async () => {
    const page = await open(ctx(), P('/auth'), sessionState('signedOut'));
    const input = page.locator('input[type="tel"], input[inputmode="numeric"], input').first();
    await input.fill('98765');
    await clickText(page, /continue|send|get code|get otp|otp|next/i).catch(() => undefined);
    await page.waitForTimeout(700);
    await add(page, 'Sign in', 'Onboarding', 'Invalid phone number', P('/auth'), 2);
    await input.fill('9876543210');
    await page.waitForTimeout(300);
    await add(page, 'Sign in', 'Onboarding', 'Phone entered', P('/auth'), 2);
    await clickText(page, /continue|send|get code|get otp|otp|next/i);
    await page.waitForTimeout(1500);
    const otpRoute = await page.evaluate(() => location.hash.slice(1));
    if (/otp/.test(otpRoute)) {
      await add(page, 'Enter code', 'Onboarding', 'Code sent', otpRoute, 3);
      const otp = page.locator('input').first();
      await otp.fill('111111');
      await page.waitForTimeout(1500);
      await add(page, 'Enter code', 'Onboarding', 'Wrong code', otpRoute, 3);
      await otp.fill('');
      await otp.fill('123456');
      await page.waitForTimeout(400);
      await add(page, 'Enter code', 'Onboarding', 'Verifying', otpRoute, 3);
    }
    await page.close();
  });

  // Location permission: denied.
  await tryStep('location denied', async () => {
    const page = await open(ctx(), P('/auth/location'), sessionState('location'));
    const btn = page.locator('button').filter({ hasText: /allow|turn on|use my location/i }).first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(1500);
      if ((await page.evaluate(() => location.hash)).includes('location')) await add(page, 'Location access', 'Onboarding', 'Permission denied', P('/auth/location'), 4);
    }
    await page.close();
  });

  // Empty bookings: the Orders screen's second tab with no data.
  await tryStep('empty bookings', async () => {
    const page = await open(ctx(), P('/orders'), sessionState('in', { demo: { emptyData: true } }));
    const tab = page.locator('[role="tab"], button').filter({ hasText: /bookings/i }).first();
    if (await tab.count()) {
      await tab.click({ timeout: 3000 });
      await page.waitForTimeout(900);
      await add(page, 'Orders & bookings', 'Orders & bookings', 'Empty · No bookings', P('/orders'), 11);
    }
    await page.close();
  });

  // Search: results and no results.
  const searchRoute = dir.id === 'd2' ? '/search' : '/learn';
  for (const [q, state] of [
    ['soil', 'Search results'],
    ['zzqx', 'No search results'],
  ]) {
    await tryStep('search ' + q, async () => {
      const page = await open(ctx(), P(searchRoute), sessionState('in'));
      const input = page.locator('input[type="search"], input[placeholder*="Search" i]').first();
      await input.fill(q);
      await page.waitForTimeout(1400);
      await add(page, dir.id === 'd2' ? 'Search' : 'Learn · Journal', 'Learn', state, P(searchRoute), 8);
      await page.close();
    });
  }

  // New order: valid quantity and below-minimum error.
  for (const [qty, state, submit] of [
    ['250', 'Quantity entered', false],
    ['20', 'Below minimum', true],
  ]) {
    await tryStep('order ' + qty, async () => {
      const page = await open(ctx(), P('/orders/fom/new'), sessionState('in'));
      const input = page.locator('#fj-frame input:visible:not([type="radio"]):not([type="checkbox"]), #app-frame input:visible:not([type="radio"]):not([type="checkbox"])').first();
      await input.fill(qty);
      await page.waitForTimeout(500);
      if (submit) await clickText(page, /place order|continue|review/i).catch(() => undefined);
      await page.waitForTimeout(700);
      await add(page, 'New FOM order', 'Orders & bookings', state, P('/orders/fom/new'), 12);
      await page.close();
    });
  }

  // Booking and add-a-field wizards: step through by choosing the first option and continuing.
  for (const [route, row, group, order] of [
    ['/bookings/new', 'New booking', 'Orders & bookings', 13],
    ['/lands/new', 'Add a field', 'Fields', 16],
  ]) {
    await tryStep('wizard ' + route, async () => {
      const page = await open(ctx(), P(route), sessionState('in'));
      for (let step = 1; step <= 6; step++) {
        // Submitting empty shows the validation state of this step.
        const cont = page.locator('button').filter({ hasText: /^(continue|next|review|request booking|save field|add field|save)/i }).last();
        if (!(await cont.count())) break;
        if (step === 1) {
          await cont.click({ timeout: 3000 }).catch(() => undefined);
          await page.waitForTimeout(600);
          await add(page, row, group, 'Step 1 · Missing details', P(route), order);
        }
        // Fill what this step asks for.
        await page.evaluate(() => {
          const root = document.querySelector('#fj-frame') || document.querySelector('#app-frame');
          const pick = (sel) => {
            const el = Array.from(root.querySelectorAll(sel)).find((e) => !e.disabled && e.getAttribute('aria-checked') !== 'true' && e.getBoundingClientRect().width > 0);
            if (el) el.click();
          };
          pick('[role="radio"]');
          const sel = root.querySelector('select');
          if (sel && sel.options.length > 1 && !sel.value) {
            sel.value = sel.options[1].value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
        const inputs = page.locator('#fj-frame input:visible, #app-frame input:visible');
        const n = await inputs.count();
        for (let i = 0; i < n; i++) {
          const inp = inputs.nth(i);
          const type = (await inp.getAttribute('type')) || 'text';
          if (['radio', 'checkbox', 'search', 'hidden', 'date'].includes(type)) continue;
          if (await inp.inputValue()) continue;
          const mode = await inp.getAttribute('inputmode');
          await inp.fill(mode === 'numeric' || mode === 'decimal' || type === 'number' ? '5' : 'Sample field').catch(() => undefined);
        }
        // Pick a date if a day grid is shown.
        await page.evaluate(() => {
          const root = document.querySelector('#fj-frame') || document.querySelector('#app-frame');
          const day = Array.from(root.querySelectorAll('button')).find((b) => /^\d{1,2}$/.test(b.textContent.trim()) && !b.disabled && b.getAttribute('aria-pressed') !== 'true');
          if (day) day.click();
        });
        await page.waitForTimeout(400);
        await add(page, row, group, `Step ${step} · Filled`, P(route), order);
        const before = await page.evaluate(() => document.body.innerText.length + location.hash);
        await cont.click({ timeout: 3000 }).catch(() => undefined);
        await page.waitForTimeout(1600);
        const after = await page.evaluate(() => document.body.innerText.length + location.hash);
        if (before === after) break;
        const url = await page.evaluate(() => location.hash.slice(1));
        if (!url.endsWith(route)) {
          await add(page, row, group, 'Submitted', url, order);
          break;
        }
      }
      await page.close();
    });
  }
}

/* ---------- Components (gallery) ---------- */
async function captureComponents(browser, dir) {
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  await page.setViewportSize({ width: W, height: H });
  await page.goto(BASE + 'figma-plugin/tools/gallery/index.html?d=' + dir.id);
  await page.waitForTimeout(1500);
  const h = await page.evaluate(() => document.body.scrollHeight);
  await page.setViewportSize({ width: W, height: Math.min(14000, h + 50) });
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const imgs = Array.from(document.images).filter((i) => !i.complete);
    await Promise.race([Promise.all(imgs.map((i) => new Promise((r) => (i.onload = i.onerror = r)))), new Promise((r) => setTimeout(r, 4000))]);
  });
  await page.waitForTimeout(400);
  const ser = readFileSync(join(REPO, 'figma-plugin/tools/serialize.js'), 'utf8');
  await page.addScriptTag({ content: ser });
  const n = await page.evaluate(() => document.querySelectorAll('[data-fig-component]').length);
  const items = [];
  const images = {};
  for (let i = 0; i < n; i++) {
    const res = await page.evaluate(async (i) => {
      const el = document.querySelectorAll('[data-fig-component]')[i];
      window.__figResetImages();
      const target = el.children.length === 1 && !el.style.background ? el.firstElementChild : el;
      const data = await window.__figSerialize(target, {});
      return { set: el.getAttribute('data-fig-component'), variant: el.getAttribute('data-fig-variant'), data };
    }, i);
    const fake = { root: res.data.root, images: res.data.images, links: [], tone: 'dark' };
    const entry = store.add({ id: `${dir.id}:component:${i}`, dir: dir.id, kind: 'component', set: res.set, variant: res.variant }, fake);
    store.screens.pop(); // components are stored separately
    items.push({ set: res.set, variant: res.variant, root: entry.root });
    void images;
  }
  await ctx.close();
  log('  components', items.length);
  return items;
}

/* ---------- Tokens ---------- */
async function captureFoundations(browser, dir) {
  const ctx = await newContext(browser);
  const page = await open(ctx, dir.prefix + '/home', sessionState('in'));
  const ser = readFileSync(join(REPO, 'figma-plugin/tools/serialize.js'), 'utf8');
  await page.addScriptTag({ content: ser });
  const res = await page.evaluate((d2) => {
    const scopeEl = d2 ? document.querySelector('.fj') : document.documentElement;
    const names = new Set();
    const walk = (rules) => {
      for (const r of rules) {
        if (r.cssRules && !r.selectorText) walk(r.cssRules);
        if (!r.selectorText || !r.style) continue;
        const sel = r.selectorText;
        const ok = d2 ? /(^|,\s*)\.fj(\s*,|$)/.test(sel) : /(^|,\s*):root(\s*,|$)/.test(sel);
        if (!ok) continue;
        for (let i = 0; i < r.style.length; i++) if (r.style[i].startsWith('--')) names.add(r.style[i]);
      }
    };
    for (const sh of document.styleSheets) {
      try {
        walk(sh.cssRules);
      } catch (e) {
        /* cross-origin */
      }
    }
    const cs = getComputedStyle(scopeEl);
    const tokens = [];
    const textStyles = [];
    const effects = [];
    const probe = document.createElement('div');
    scopeEl.appendChild(probe);
    for (const name of names) {
      const raw = cs.getPropertyValue(name).trim();
      if (!raw) continue;
      let short = name.replace(/^--(fj-)?/, '');
      // Device insets and motion timings are not design tokens.
      if (/^(safe|dur|ease)|dock-clearance|header-h/.test(short)) continue;
      const group = /^r-|radius/.test(short) ? 'radius' : /^(s-|space|gap|gutter)/.test(short) ? 'space' : /shadow|elev/.test(short) ? 'shadow' : short.split('-')[0];
      const isColor = CSS.supports('color', raw) && !/^-?[\d.]/.test(raw);
      if (isColor) {
        const c = window.__figParseColor(raw);
        if (!c) continue;
        tokens.push({ type: 'color', group: /\d{2,3}$/.test(short) ? 'palette' : group, name: short, value: c, css: name, raw: /\d{2,3}$/.test(short) });
        continue;
      }
      if (/^-?[\d.]+px$/.test(raw)) {
        tokens.push({ type: 'number', group: group === 'radius' || group === 'space' ? group : 'size', name: short, value: parseFloat(raw), css: name });
        continue;
      }
      if (/^-?[\d.]+rem$/.test(raw)) {
        tokens.push({ type: 'number', group: group === 'radius' || group === 'space' ? group : 'size', name: short, value: parseFloat(raw) * 16, css: name });
        continue;
      }
      const fm = raw.match(/^(?:(italic)\s+)?(\d{3})\s+([\d.]+)(rem|px)\s*\/\s*([\d.]+)(rem|px)?/);
      if (fm) {
        const size = parseFloat(fm[3]) * (fm[4] === 'rem' ? 16 : 1);
        const lhRaw = parseFloat(fm[5]);
        const lineHeight = fm[6] === 'px' ? lhRaw : fm[6] === 'rem' ? lhRaw * 16 : Math.round(lhRaw * size * 100) / 100;
        textStyles.push({ name: short, family: 'Plus Jakarta Sans', weight: parseInt(fm[2], 10), italic: !!fm[1], size, lineHeight, css: name + ': ' + raw.replace(/\s+/g, ' ').slice(0, 60), sample: short.charAt(0).toUpperCase() + short.slice(1) + ' · Good morning, Ram' });
        continue;
      }
      if (/px/.test(raw) && /(rgba?|#)/.test(raw) && !/gradient/.test(raw)) {
        const fx = window.__figParseShadows(raw);
        if (fx.length) effects.push({ name: short, css: name + ': ' + raw, fx });
      }
    }
    probe.remove();
    return { tokens, textStyles, effects };
  }, dir.id === 'd2');
  const fx = res.effects;
  // Logo for the cover.
  const logo = await page.evaluate(async () => {
    const im = new Image();
    im.src = '/src/assets/brand/kisani-urjaa-logo.webp';
    await new Promise((r) => (im.onload = im.onerror = r));
    const c = document.createElement('canvas');
    c.width = im.naturalWidth;
    c.height = im.naturalHeight;
    c.getContext('2d').drawImage(im, 0, 0);
    const u = c.toDataURL('image/png');
    return { data: u.slice(u.indexOf(',') + 1), w: c.width, h: c.height };
  });
  store.images.logo = { mime: 'image/png', w: logo.w, h: logo.h, data: logo.data };
  await ctx.close();
  log('  tokens', res.tokens.length, 'text styles', res.textStyles.length, 'effects', fx.length);
  return { tokens: res.tokens, textStyles: res.textStyles, effects: fx };
}

/* ---------- Main ---------- */
const server = await startServer();
const { chromium } = playwright();
const browser = await chromium.launch();
const t0 = Date.now();
const foundations = {};
const components = {};
try {
  for (const d of DIRS) {
    const dir = DIRECTIONS[d];
    foundations[d] = await captureFoundations(browser, dir);
    components[d] = await captureComponents(browser, dir);
    await runDirection(browser, dir);
  }
} finally {
  await browser.close();
  stopServer(server);
}

// Order screens: group order, then route order, Default first.
const gi = (g) => (GROUP_ORDER.indexOf(g) + 1 || 99);
const stateRank = (s) => (s === 'Default' ? 0 : /^Slide|^Step|^Phone|^Code|^Invalid|^Wrong|^Verifying|^Quantity|^Below/.test(s) ? 1 : /^Loading/.test(s) ? 2 : /^Empty|^No /.test(s) ? 3 : /^Offline/.test(s) ? 4 : 5);
store.screens.sort((a, b) => a.dir.localeCompare(b.dir) || gi(a.group) - gi(b.group) || a.order - b.order || a.row.localeCompare(b.row) || stateRank(a.state) - stateRank(b.state) || a.state.localeCompare(b.state));
for (const s of store.screens) delete s.sig;

const manifest = {
  version: 1,
  app: 'Kisani Urjaa farmer app',
  capturedAt: new Date().toISOString().slice(0, 10),
  directions: DIRS.map((d) => DIRECTIONS[d]),
  logo: 'logo',
  summary: '',
  screens: store.screens.map(({ root, links, ...meta }) => ({ ...meta, w: root.w, h: root.h })),
  counts: {},
};
for (const d of DIRS) {
  const list = store.screens.filter((s) => s.dir === d);
  manifest.counts[d] = { screens: list.length, routes: list.filter((s) => s.primary).length, components: components[d].length, sets: new Set(components[d].map((c) => c.set)).size };
}
manifest.summary = DIRS.map((d) => `${DIRECTIONS[d].title}: ${manifest.counts[d].routes} screens, ${manifest.counts[d].screens - manifest.counts[d].routes} more states and flows, ${manifest.counts[d].sets} component sets`).join('. ') + '.';
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
writeFileSync(join(OUT, 'screens.json'), JSON.stringify(Object.fromEntries(store.screens.map((s) => [s.id, { root: s.root, links: s.links, tone: s.tone, bottomTone: 'dark' }]))));
writeFileSync(join(OUT, 'components.json'), JSON.stringify(components));
writeFileSync(join(OUT, 'foundations.json'), JSON.stringify(foundations));
writeFileSync(join(OUT, 'images.json'), JSON.stringify(store.images));
writeFileSync(join(OUT, 'svgs.json'), JSON.stringify(store.svgs));
log('Done in', Math.round((Date.now() - t0) / 1000) + 's', '· screens', store.screens.length, '· images', Object.keys(store.images).length, '· svgs', Object.keys(store.svgs).length, '· errors', errors);
