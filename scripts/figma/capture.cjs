/*
 * Captures every Ver 3 screen, state and component into one Figma-ready JSON
 * file for the plugin in figma-plugin/.
 *
 *   npx vite --port 5199 &           (dev server: the component kit is dev-only)
 *   node scripts/figma/capture.cjs   → dist-figma/kisani-urjaa-ver3.figma.json
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE_URL = process.env.FIGMA_BASE ?? 'http://localhost:5199/';
const OUT = path.resolve(__dirname, '../../dist-figma/kisani-urjaa-ver3.figma.json');
const ROOT = path.resolve(__dirname, '../..');
const FLOW = 'kisani-urjaa:v3-auth-flow';

/* ---------- states ---------- */
const DEMO = { version: 3, session: { onboarded: true, signedIn: true, verified: true, phone: '9000012345', location: 'skipped', demo: true }, profileDetails: { completed: 3 } };
const with_ = (a, b) => JSON.parse(JSON.stringify({ ...a, ...b, session: { ...a.session, ...(b.session || {}) }, profileDetails: { ...a.profileDetails, ...(b.profileDetails || {}) } }));
const EMPTY = with_(DEMO, { demo: { network: 'normal', emptyData: true } });
const OFFLINE = with_(DEMO, { demo: { network: 'offline', emptyData: false } });
const UNVERIFIED = with_(DEMO, { session: { verified: false } });
const FRESH = null;
const ONBOARDED = { version: 3, session: { onboarded: true, signedIn: false, verified: false, phone: '', location: 'unknown' } };
const ACCOUNT = { userId: 'RamPrasad', phone: '9876543210', passwordHash: '0' };
const HAS_ACCOUNT = { ...ONBOARDED, account: ACCOUNT, session: { ...ONBOARDED.session, phone: '9876543210' } };
const SETUP = (completed, details = {}) => ({ version: 3, account: ACCOUNT, session: { onboarded: true, signedIn: true, verified: true, phone: '9876543210', location: 'skipped', demo: false }, profileDetails: { completed, ...details } });
const FILLED = { didiId: 'KD00001', docType: 'driving-licence', idNumber: 'MH2820210006753', fullName: 'Ram Prasad Yadav', gender: 'male', dob: '1984-03-12', address: '11/24, Aamrapali, near Hanuman temple', pincode: '443303', state: 'Maharashtra', district: 'Buldhana', mandal: 'Buldhana', village: 'Ratanpur', relation: 'father', relationName: 'Paresh Kumar', altPhone: '9123456780', email: 'ram@example.com', education: 'High school' };

/* ---------- helpers for setups ---------- */
const frame = (p) => p.locator('#fj3-frame');
const click = (sel) => async (p) => { await frame(p).locator(sel).first().click(); };
const role = (r, name) => async (p) => { await frame(p).getByRole(r, { name, exact: true }).first().click(); };
const fill = (label, value) => async (p) => { await frame(p).getByLabel(label).first().fill(value); };
const seq = (...fns) => async (p) => { for (const f of fns) { await f(p); await p.waitForTimeout(350); } };

/* ---------- screens ---------- */
function screens(ids) {
  return [
    ['Onboarding', [
      { name: 'Splash', route: 'welcome', state: FRESH, splash: true },
      { name: 'Welcome · 1 Your farm', route: 'welcome', state: FRESH },
      { name: 'Welcome · 2 From waste to wealth', route: 'welcome', state: FRESH, setup: role('button', 'Next') },
      { name: 'Welcome · 3 Your Kisani Didi', route: 'welcome', state: FRESH, setup: seq(role('button', 'Next'), role('button', 'Next')) },
      { name: 'Choose language', route: 'welcome/language', state: FRESH },
      { name: 'Get started', route: 'start', state: ONBOARDED },
      { name: 'Sign up', route: 'auth', state: ONBOARDED },
      { name: 'Sign up · invalid number', route: 'auth', state: ONBOARDED, setup: role('button', 'Get OTP') },
      { name: 'OTP verification', route: 'auth/otp', state: ONBOARDED, flow: { purpose: 'signup', phone: '9876543210' } },
      { name: 'OTP verification · wrong code', route: 'auth/otp', state: ONBOARDED, flow: { purpose: 'signup', phone: '9876543210' }, setup: fill('OTP, 6 digits', '111111'), wait: 1300 },
      { name: 'Verified successfully', route: 'auth/otp', state: ONBOARDED, flow: { purpose: 'signup', phone: '9876543210' }, setup: fill('OTP, 6 digits', '123456'), wait: 500 },
      { name: 'Create User ID', route: 'auth/user-id', state: ONBOARDED, flow: { purpose: 'signup', phone: '9876543210', verified: true } },
      { name: 'Create User ID · error', route: 'auth/user-id', state: ONBOARDED, flow: { purpose: 'signup', phone: '9876543210', verified: true }, setup: seq(fill(/^User ID/, 'राम'), role('button', 'Continue')) },
      { name: 'Create password', route: 'auth/password', state: ONBOARDED, flow: { purpose: 'signup', phone: '9876543210', verified: true, userId: 'RamPrasad' } },
      { name: 'Create password · mismatch', route: 'auth/password', state: ONBOARDED, flow: { purpose: 'signup', phone: '9876543210', verified: true, userId: 'RamPrasad' }, setup: seq(fill(/^Password/, 'abcd@12345'), fill(/^Confirm password/, 'abcd@1234'), role('button', 'Continue')) },
      { name: 'Thanks for joining', route: 'auth/password', state: ONBOARDED, flow: { purpose: 'signup', phone: '9876543210', verified: true, userId: 'RamPrasad' }, setup: seq(fill(/^Password/, 'abcd@12345'), fill(/^Confirm password/, 'abcd@12345'), role('button', 'Continue')) },
      { name: 'Log in · OTP', route: 'login', state: HAS_ACCOUNT },
      { name: 'Log in · User ID & password', route: 'login?with=password', state: HAS_ACCOUNT },
      { name: 'Log in · wrong password', route: 'login?with=password', state: HAS_ACCOUNT, setup: seq(fill(/^User ID/, 'RamPrasad'), fill(/^Password/, 'wrongpass1'), role('button', 'Continue')) },
      { name: 'Forgot password', route: 'auth/forgot-password', state: HAS_ACCOUNT },
      { name: 'Forgot User ID', route: 'auth/forgot-user-id', state: HAS_ACCOUNT },
      { name: 'Reset password', route: 'auth/reset-password', state: HAS_ACCOUNT, flow: { purpose: 'forgot-password', phone: '9876543210', verified: true } },
      { name: 'Password updated', route: 'auth/reset-password', state: HAS_ACCOUNT, flow: { purpose: 'forgot-password', phone: '9876543210', verified: true }, setup: seq(fill(/^New password/, 'newpass123'), fill(/^Confirm password/, 'newpass123'), role('button', 'Submit')), wait: 600 },
      { name: 'Enter password (forgot User ID)', route: 'auth/enter-password', state: HAS_ACCOUNT, flow: { purpose: 'forgot-user-id', phone: '9876543210', verified: true } },
      { name: 'Location access', route: 'auth/location', state: with_(DEMO, { session: { location: 'unknown' } }) },
    ]],
    ['Profile setup', [
      { name: 'Step 1 · Personal details', route: 'profile/setup/1', state: SETUP(0) },
      { name: 'Step 1 · errors', route: 'profile/setup/1', state: SETUP(0), setup: role('button', 'Continue') },
      { name: 'Step 1 · filled', route: 'profile/setup/1', state: SETUP(0, FILLED) },
      { name: 'Select Kisani Didi (sheet)', route: 'profile/setup/1', state: SETUP(0), setup: click('button[aria-haspopup="dialog"]') },
      { name: 'Step 2 · Address details', route: 'profile/setup/2', state: SETUP(1) },
      { name: 'Step 2 · filled', route: 'profile/setup/2', state: SETUP(1, FILLED) },
      { name: 'Select district (sheet)', route: 'profile/setup/2', state: SETUP(1, { pincode: '443303', state: 'Maharashtra' }), setup: async (p) => { await frame(p).getByRole('button', { name: /District/ }).first().click(); } },
      { name: 'Step 3 · Additional details', route: 'profile/setup/3', state: SETUP(2) },
      { name: 'Step 3 · filled', route: 'profile/setup/3', state: SETUP(2, FILLED) },
      { name: 'Profile complete', route: 'profile/setup/3', state: SETUP(2, FILLED), setup: role('button', 'Submit') },
    ]],
    ['Home', [
      { name: 'Home', route: 'home', state: DEMO },
      { name: 'Home · number not verified', route: 'home', state: UNVERIFIED },
      { name: 'Home · weather sheet', route: 'home', state: DEMO, setup: click('[class*="panel"]') },
      { name: 'Home · New sheet', route: 'home', state: DEMO, setup: click('button[aria-label^="New"]') },
      { name: 'Home · language sheet', route: 'home', state: DEMO, setup: click('[class*="heroActions"] > :nth-child(3)') },
      { name: 'Home · empty', route: 'home', state: EMPTY },
      { name: 'Home · offline', route: 'home', state: OFFLINE },
    ]],
    ['Learn', [
      { name: 'Learn · News', route: 'learn', state: DEMO },
      { name: 'Learn · Videos', route: 'learn?tab=videos', state: DEMO },
      { name: 'Learn · Articles', route: 'learn?tab=articles', state: DEMO },
      { name: 'Learn · empty', route: 'learn', state: EMPTY },
      { name: 'Learn · offline', route: 'learn', state: OFFLINE },
      { name: 'Search', route: 'search', state: DEMO },
      { name: 'Search · no results', route: 'search', state: DEMO, setup: async (p) => { await frame(p).getByRole('searchbox').first().fill('zzzz'); }, wait: 1000 },
      { name: 'News story', route: 'news/n-straw-collection', state: DEMO },
      { name: 'Article', route: 'articles/a-soil-health-card', state: DEMO },
      { name: 'Video', route: 'videos/v-baling', state: DEMO },
      { name: 'Bookmarks', route: 'bookmarks', state: DEMO },
      { name: 'Bookmarks · empty', route: 'bookmarks', state: with_(DEMO, { bookmarks: [] }) },
    ]],
    ['Events', [
      { name: 'Events', route: 'events', state: DEMO },
      { name: 'Event · upcoming', route: 'events/e-training', state: DEMO },
      { name: 'Event · live', route: 'events/e-baling-demo', state: DEMO },
      { name: 'Events · empty', route: 'events', state: EMPTY },
    ]],
    ['Requests', [
      { name: 'Requests · FOM orders', route: 'orders', state: DEMO },
      { name: 'Requests · Bookings', route: 'orders?tab=bookings', state: DEMO },
      { name: 'Requests · empty', route: 'orders', state: EMPTY },
      { name: 'Requests · offline', route: 'orders', state: OFFLINE },
      ...(ids.order ? [{ name: 'FOM order', route: ids.order, state: DEMO }] : []),
      { name: 'New FOM order', route: 'orders/fom/new', state: DEMO },
      { name: 'New FOM order · number not verified', route: 'orders/fom/new', state: UNVERIFIED },
      ...(ids.booking ? [{ name: 'Booking', route: ids.booking, state: DEMO }] : []),
      { name: 'Book a service', route: 'bookings/new', state: DEMO },
    ]],
    ['Field records', [
      { name: 'Field records', route: 'forms', state: DEMO },
      { name: 'Field records · empty', route: 'forms', state: EMPTY },
      { name: 'Season record', route: 'forms/fc-cotton', state: DEMO },
      ...(ids.step ? [{ name: 'Season step', route: ids.step, state: DEMO }] : []),
    ]],
    ['Fields', [
      { name: 'My fields', route: 'lands', state: DEMO },
      { name: 'My fields · empty', route: 'lands', state: EMPTY },
      { name: 'Field', route: 'lands/l-paddy', state: DEMO },
      { name: 'Add a field', route: 'lands/new', state: DEMO },
    ]],
    ['Notifications', [
      { name: 'Notifications', route: 'notifications', state: DEMO },
      { name: 'Notifications · empty', route: 'notifications', state: EMPTY },
    ]],
    ['Me', [
      { name: 'Me', route: 'account', state: DEMO },
      { name: 'Me · log out', route: 'account', state: DEMO, setup: role('button', 'Log out') },
      { name: 'My profile', route: 'account/profile', state: DEMO },
      { name: 'Language', route: 'account/language', state: DEMO },
      { name: 'Change password', route: 'account/password', state: DEMO },
      { name: 'Farm machinery', route: 'account/machinery', state: DEMO },
      { name: 'Help & FAQs', route: 'account/help', state: DEMO },
      { name: 'Contact us', route: 'account/contact', state: DEMO },
      { name: 'About', route: 'account/about', state: DEMO },
      { name: 'Privacy policy', route: 'account/legal/privacy', state: DEMO },
      { name: 'Terms & conditions', route: 'account/legal/terms', state: DEMO },
      { name: 'Verify your number', route: 'account/verify', state: UNVERIFIED },
      { name: 'Prototype controls', route: 'account/prototype', state: DEMO },
    ]],
    ['System', [
      { name: 'Page not found', route: 'no-such-page', state: DEMO },
    ]],
  ];
}

/* Components taken from real screens (in addition to the component kit). */
const HARVEST = [
  { route: 'home', state: DEMO, sel: 'nav[aria-label="Main"]', name: 'Navigation/Active=Home' },
  { route: 'learn', state: DEMO, sel: 'nav[aria-label="Main"]', name: 'Navigation/Active=Learn' },
  { route: 'orders', state: DEMO, sel: 'nav[aria-label="Main"]', name: 'Navigation/Active=Requests' },
  { route: 'account', state: DEMO, sel: 'nav[aria-label="Main"]', name: 'Navigation/Active=Me' },
  { route: 'home', state: DEMO, sel: '[class*="panel"]', name: 'Weather card' },
  { route: 'home', state: DEMO, sel: '[class*="quickTile"]', name: 'Quick action tile' },
  { route: 'home', state: DEMO, sel: 'a[href$="/lands/new"]', name: 'Card/Kind=add field' },
  { route: 'account', state: DEMO, sel: 'section[aria-label="Profile"]', name: 'Profile card' },
  { route: 'auth/otp', state: ONBOARDED, flow: { purpose: 'signup', phone: '9876543210' }, sel: '[class*="otpBoxes"]', name: 'OTP input' },
  { route: 'profile/setup/1', state: SETUP(0), sel: '[role="group"][aria-label="Profile progress"]', name: 'Profile progress' },
  { route: 'auth', state: ONBOARDED, setup: role('button', 'Get OTP'), sel: '#fj3-overlay [class*="toast"]', name: 'Toast/Tone=error' },
];

/* ---------- run ---------- */
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1200 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const extractSrc = fs.readFileSync(path.join(__dirname, 'extract.js'), 'utf8');

  async function open(s) {
    await page.goto(BASE_URL + '#/d3/welcome');
    await page.evaluate(({ state, flow, FLOW }) => {
      localStorage.clear();
      sessionStorage.clear();
      if (state) localStorage.setItem('kisani-urjaa:state', JSON.stringify(state));
      if (flow) sessionStorage.setItem(FLOW, JSON.stringify(flow));
    }, { state: s.state, flow: s.flow, FLOW });
    await page.goto(BASE_URL + '#/d3/' + s.route);
    await page.reload();
    await page.waitForTimeout(1700);
    await page.evaluate(extractSrc);
    if (s.setup) {
      await s.setup(page);
      await page.waitForTimeout(s.wait ?? 900);
    }
  }

  async function expandAndExtract(name) {
    await page.evaluate(() => {
      const f = document.getElementById('fj3-frame');
      let extra = 0;
      for (const el of f.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 300) {
          el.scrollTop = 0;
          extra = Math.max(extra, el.scrollHeight - el.clientHeight);
        }
      }
      // sheets and dialogs keep the screen height
      if (document.querySelector('#fj3-overlay [role="dialog"]')) extra = 0;
      f.style.height = 852 + extra + 'px';
    });
    await page.waitForTimeout(500);
    if (process.env.FIGMA_SHOTS) {
      fs.mkdirSync(process.env.FIGMA_SHOTS, { recursive: true });
      const box = await page.locator('#fj3-frame').boundingBox();
      await page.setViewportSize({ width: 1600, height: Math.max(1200, Math.ceil(box.y + box.height + 20)) });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(process.env.FIGMA_SHOTS, name.replace(/[^\w·-]+/g, '_') + '.png'), clip: await page.locator('#fj3-frame').boundingBox() });
      await page.setViewportSize({ width: 1600, height: 1200 });
    }
    return page.evaluate((n) => window.__figExtract(document.getElementById('fj3-frame'), { name: n }), name);
  }

  // IDs that are generated from today's date.
  await open({ route: 'orders', state: DEMO });
  const ids = {};
  ids.order = (await page.evaluate(() => [...document.querySelectorAll('a[href*="/orders/fom/"]')].map((a) => a.getAttribute('href')).find((h) => !/new$/.test(h))))?.replace(/^#\/d3\//, '');
  await open({ route: 'orders?tab=bookings', state: DEMO });
  ids.booking = (await page.evaluate(() => [...document.querySelectorAll('a[href*="/bookings/"]')].map((a) => a.getAttribute('href')).find((h) => !/new$/.test(h))))?.replace(/^#\/d3\//, '');
  await open({ route: 'forms/fc-cotton', state: DEMO });
  ids.step = (await page.evaluate(() => [...document.querySelectorAll('a[href*="/steps/"]')].map((a) => a.getAttribute('href'))[0]))?.replace(/^#\/d3\//, '');
  console.log('ids', ids);

  const images = {};
  const pages = [];
  for (const [section, list] of screens(ids)) {
    const frames = [];
    for (const s of list) {
      try {
        if (s.splash) {
          const c2 = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
          const p2 = await c2.newPage();
          await p2.goto(BASE_URL + '#/d3/welcome');
          await p2.evaluate(() => localStorage.clear());
          await p2.reload();
          await p2.waitForTimeout(1250);
          await p2.evaluate(extractSrc);
          const res = await p2.evaluate((n) => window.__figExtract(document.getElementById('fj3-frame'), { name: n }), 'Splash');
          Object.assign(images, res.images);
          frames.push(res.node);
          await c2.close();
        } else {
          await open(s);
          const res = await expandAndExtract(s.name);
          Object.assign(images, res.images);
          frames.push(res.node);
        }
        process.stdout.write(`✓ ${section} / ${s.name}\n`);
      } catch (e) {
        process.stdout.write(`✗ ${section} / ${s.name}: ${e.message.split('\n')[0]}\n`);
      }
    }
    pages.push({ name: section, frames });
  }

  // Components: the kit, then the ones taken from screens.
  const components = [];
  await open({ route: 'figma-kit', state: DEMO });
  await page.evaluate(() => {
    const f = document.getElementById('fj3-frame');
    const sc = f.querySelector('[data-scroll-root]');
    f.style.height = 852 + (sc.scrollHeight - sc.clientHeight) + 'px';
  });
  await page.waitForTimeout(800);
  const kit = await page.evaluate(() => {
    const out = [], imgs = {};
    for (const el of document.querySelectorAll('[data-figma-component]')) {
      const res = window.__figExtract(el, { name: el.getAttribute('data-figma-component') });
      Object.assign(imgs, res.images);
      out.push({ name: el.getAttribute('data-figma-component'), group: el.closest('[data-figma-group]')?.getAttribute('data-figma-group') || 'Components', node: res.node });
    }
    return { out, imgs };
  });
  Object.assign(images, kit.imgs);
  components.push(...kit.out);
  for (const h of HARVEST) {
    try {
      await open(h);
      const res = await page.evaluate(({ sel, name }) => {
        const el = document.querySelector('#fj3-frame ' + sel) || document.querySelector(sel);
        return el ? window.__figExtract(el, { name }) : null;
      }, { sel: h.sel, name: h.name });
      if (!res) throw new Error('not found: ' + h.sel);
      Object.assign(images, res.images);
      components.push({ name: h.name, group: h.name.startsWith('Navigation') ? 'Navigation' : h.name.startsWith('Card') ? 'Cards' : 'Patterns', node: res.node });
      process.stdout.write(`✓ component ${h.name}\n`);
    } catch (e) {
      process.stdout.write(`✗ component ${h.name}: ${e.message.split('\n')[0]}\n`);
    }
  }

  // Tokens.
  await open({ route: 'home', state: DEMO });
  const tokens = await page.evaluate(() => window.__figTokens(document.querySelector('.fj3')));
  await browser.close();

  /* ---------- images → JPEG/PNG base64 ---------- */
  const list = Object.entries(images).map(([url, sz], i) => {
    const key = 'img' + String(i).padStart(3, '0');
    let file = null, data = null;
    if (url.startsWith('data:')) data = url;
    else {
      const p = decodeURIComponent(new URL(url, BASE_URL).pathname);
      for (const cand of [path.join(ROOT, p), path.join(ROOT, 'public', p)]) if (fs.existsSync(cand)) { file = cand; break; }
    }
    return { key, url, file, data, w: sz.w, h: sz.h };
  });
  const tmp = path.join(require('os').tmpdir(), 'figma-images.json');
  fs.writeFileSync(tmp, JSON.stringify(list));
  const conv = JSON.parse(execFileSync('python3', ['-I', path.join(__dirname, 'images.py'), tmp], { maxBuffer: 1 << 30 }).toString());
  const refMap = Object.fromEntries(list.map((l) => [l.url, l.key]));

  /* ---------- styles from tokens ---------- */
  const styles = require('./tokens.cjs').buildStyles(tokens);

  /* ---------- tidy nodes: refs, style links, screen roots ---------- */
  const colorKey = (c) => c && [c.r, c.g, c.b, c.a].map((v) => Math.round(v * 1000)).join(',');
  const colorStyleByKey = {};
  for (const c of styles.colors) if (!colorStyleByKey[colorKey(c.color)]) colorStyleByKey[colorKey(c.color)] = c.name;
  const textStyleFor = (st) => styles.text.find((t) => t.fontWeight === st.fontWeight && Math.abs(t.fontSize - st.fontSize) < 0.1 && (t.lineHeight == null || st.lineHeight == null || Math.abs(t.lineHeight - st.lineHeight) < 0.6));
  let count = 0;
  function tidy(n) {
    if (!n) return;
    count++;
    delete n._abs;
    for (const f of n.fills || []) {
      if (f.type === 'IMAGE') f.ref = refMap[f.ref] || f.ref;
      if (f.type === 'SOLID') f.style = colorStyleByKey[colorKey(f.color)];
    }
    for (const s of n.strokes || []) if (s.type === 'SOLID') s.style = colorStyleByKey[colorKey(s.color)];
    if (n.type === 'TEXT') {
      const ts = textStyleFor(n.style);
      if (ts) n.textStyle = ts.name;
      n.style.colorStyle = colorStyleByKey[colorKey(n.style.color)];
    }
    (n.children || []).forEach(tidy);
  }
  for (const pg of pages) for (const f of pg.frames) {
    f.radius = undefined;
    f.clip = true;
    tidy(f);
  }
  for (const c of components) tidy(c.node);

  const out = {
    schema: 'kisani-urjaa.figma/1',
    meta: { title: 'Kisani Urjaa · Ver 3', generated: new Date().toISOString(), device: { width: 393, height: 852, name: 'iPhone 15 / 393 × 852' }, screens: pages.reduce((a, p) => a + p.frames.length, 0), components: components.length, nodes: count, notes: 'Photos: Kisani Urjaa (client) and AI concept images (replace before launch). Hindi and Marathi strings need native-speaker review.' },
    styles,
    images: Object.fromEntries(conv.map((c) => [c.key, { mime: c.mime, width: c.width, height: c.height, base64: c.base64 }])),
    pages,
    components,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`\n${out.meta.screens} screens, ${components.length} components, ${count} nodes, ${conv.length} images → ${OUT} (${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB)`);
  if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 5));
})();
