/*
 * Every screen and UI state the Figma plugin recreates.
 *
 * page   Figma page the frame goes on
 * group  Figma section (flow) inside that page
 * route  app route the scenario opens
 * st     persisted app state (see lib.baseState)
 * act    interactions that bring the screen into the state
 * tall   capture the full scroll height (default true)
 * fast   capture straight after load (loading skeletons)
 */
const { baseState } = require('./lib.cjs');

const OUT = { version: 3, session: { onboarded: true, signedIn: false, verified: false, phone: '', location: 'unknown' }, prefs: { theme: 'light', motion: 'reduce' } };
const FRESH = { version: 3, session: { onboarded: false, signedIn: false, verified: false, phone: '', location: 'unknown' }, prefs: { theme: 'light', motion: 'reduce' } };
const U = baseState();
const UNVERIFIED = baseState({ session: { verified: false } });
const EMPTY = baseState({ demo: { emptyData: true } });
const SLOW = baseState({ demo: { network: 'slow' } });
const OFFLINE = baseState({ demo: { network: 'offline' } });
const DARK = baseState({ prefs: { theme: 'dark' } });

const wait = (p, ms = 500) => p.waitForTimeout(ms);
const btn = (p, name, exact) => p.getByRole('button', { name, exact }).first();
async function click(p, name, opts = {}) {
  await btn(p, name, opts.exact).click({ timeout: 6000 });
  await wait(p, opts.wait ?? 550);
}
async function tab(p, name) {
  await p.getByRole('tab', { name }).first().click({ timeout: 6000 });
  await wait(p, 700);
}
async function fill(p, label, value) {
  await p.getByLabel(label).first().fill(value);
  await wait(p, 200);
}

const S = [];
const add = (page, group, list) => list.forEach((x) => S.push(Object.assign({ page, group, st: U, tall: true }, x)));

/* ------------------------------------------------------------ 01 Onboarding */
add('Onboarding', 'Launch', [
  { id: 'splash', name: 'Splash', route: '/welcome', st: FRESH, splash: true, tall: false, desc: 'Logo, progress bar and footer. Shown on every launch; tap to skip.' },
]);
add('Onboarding', 'Welcome carousel', [
  { id: 'welcome-1', name: 'Welcome · 1 of 3', route: '/welcome', st: FRESH, tall: false },
  { id: 'welcome-2', name: 'Welcome · 2 of 3', route: '/welcome', st: FRESH, tall: false, act: (p) => click(p, 'Next', { wait: 1500 }) },
  { id: 'welcome-3', name: 'Welcome · 3 of 3', route: '/welcome', st: FRESH, tall: false, act: async (p) => { await click(p, 'Next', { wait: 1200 }); await click(p, 'Next', { wait: 1500 }); } },
]);
add('Onboarding', 'Sign up and log in', [
  { id: 'auth-signup', name: 'Sign up · Empty', route: '/auth', st: OUT },
  { id: 'auth-signup-filled', name: 'Sign up · Number entered', route: '/auth', st: OUT, act: (p) => fill(p, 'Mobile number', '9876543210') },
  { id: 'auth-error-short', name: 'Sign up · Error: number too short', route: '/auth', st: OUT, act: async (p) => { await fill(p, 'Mobile number', '12345'); await click(p, 'Get OTP'); } },
  { id: 'auth-error-prefix', name: 'Sign up · Error: invalid first digit', route: '/auth', st: OUT, act: async (p) => { await fill(p, 'Mobile number', '1234567890'); await click(p, 'Get OTP'); } },
  { id: 'auth-login', name: 'Log in', route: '/auth', st: OUT, act: (p) => click(p, 'Log in', { exact: true }) },
  { id: 'auth-skip-sheet', name: 'Sheet · Continue without verifying?', route: '/auth', st: OUT, tall: false, act: async (p) => { await fill(p, 'Mobile number', '9876543210'); await click(p, 'Continue without verifying', { wait: 900 }); } },
]);
add('Onboarding', 'OTP verification', [
  { id: 'otp', name: 'OTP · Waiting for code', route: '/auth', st: OUT, act: async (p) => { await fill(p, 'Mobile number', '9876543210'); await click(p, 'Get OTP', { wait: 1400 }); } },
  { id: 'otp-partial', name: 'OTP · Partly entered', route: '/auth', st: OUT, act: async (p) => { await fill(p, 'Mobile number', '9876543210'); await click(p, 'Get OTP', { wait: 1400 }); await p.getByLabel(/Verification code/).fill('123'); await wait(p, 300); } },
  { id: 'otp-error', name: 'OTP · Error: wrong code', route: '/auth', st: OUT, act: async (p) => { await fill(p, 'Mobile number', '9876543210'); await click(p, 'Get OTP', { wait: 1400 }); await p.getByLabel(/Verification code/).fill('111111'); await p.getByText('That code didn’t match').waitFor({ timeout: 6000 }); await wait(p, 300); } },
]);
add('Onboarding', 'Location permission', [
  { id: 'location', name: 'Location · Ask', route: '/auth/location', st: { ...OUT, session: { ...OUT.session, signedIn: true, verified: true } } },
  { id: 'location-denied', name: 'Location · Turned off', route: '/auth/location', st: { ...OUT, session: { ...OUT.session, signedIn: true, verified: true } }, act: async (p) => { await p.context().grantPermissions([]); await click(p, 'Allow location', { wait: 1500 }); } },
]);

/* ------------------------------------------------------------ 02 Home */
add('Home', 'Home', [
  { id: 'home', name: 'Home · Verified', route: '/home' },
  { id: 'home-unverified', name: 'Home · Verification pending', route: '/home', st: UNVERIFIED },
]);
add('Home', 'Home sheets', [
  { id: 'home-weather', name: 'Sheet · Weather forecast', route: '/home', tall: false, act: (p) => click(p, /^Weather:/, { wait: 900 }) },
  { id: 'home-create', name: 'Sheet · Create', route: '/home', tall: false, act: (p) => click(p, /^Create/, { wait: 800 }) },
  { id: 'home-contact', name: 'Sheet · Contact Kisani Didi', route: '/home', tall: false, act: (p) => click(p, 'Call', { exact: true, wait: 800 }) },
]);

/* ------------------------------------------------------------ 03 Learn */
add('Learn', 'Learn hub', [
  { id: 'learn-news', name: 'Learn · News', route: '/learn' },
  { id: 'learn-videos', name: 'Learn · Videos', route: '/learn?tab=videos' },
  { id: 'learn-articles', name: 'Learn · Articles', route: '/learn?tab=articles' },
  { id: 'learn-category', name: 'Learn · Category filter', route: '/learn', act: (p) => click(p, 'Soil health', { exact: true, wait: 900 }) },
]);
add('Learn', 'Search and filters', [
  { id: 'learn-search', name: 'Search · Results', route: '/learn', act: async (p) => { await fill(p, /Search news/, 'soil'); await wait(p, 1000); } },
  { id: 'learn-filter-sheet', name: 'Sheet · Filter by date (calendar)', route: '/learn', tall: false, act: (p) => click(p, 'Filters', { exact: true, wait: 900 }) },
  { id: 'learn-filter-range', name: 'Sheet · Date range selected', route: '/learn', tall: false, act: async (p) => { await click(p, 'Filters', { exact: true, wait: 900 }); await click(p, 'Last 30 days', { wait: 600 }); } },
  { id: 'learn-filter-applied', name: 'Learn · Date filter applied', route: '/learn', act: async (p) => { await click(p, 'Filters', { exact: true, wait: 900 }); await click(p, 'Last 30 days'); await click(p, /^Apply/, { wait: 1000 }); } },
]);
add('Learn', 'Details', [
  { id: 'news-detail', name: 'News detail', route: '/news/n-straw-collection' },
  { id: 'article-detail', name: 'Article detail', route: '/articles/a-soil-health-card' },
  { id: 'video-detail', name: 'Video detail', route: '/videos/v-baling' },
  { id: 'detail-share', name: 'Sheet · Share', route: '/news/n-straw-collection', tall: false, act: (p) => click(p, 'Share', { exact: true, wait: 900 }) },
]);
add('Learn', 'Bookmarks', [
  { id: 'bookmarks', name: 'Bookmarks · All', route: '/bookmarks' },
  { id: 'bookmarks-articles', name: 'Bookmarks · Articles', route: '/bookmarks', act: (p) => tab(p, /Articles/) },
]);

/* ------------------------------------------------------------ 04 Events */
add('Events', 'Events list', [
  { id: 'events', name: 'Events · Upcoming', route: '/events' },
  { id: 'events-past', name: 'Events · Past', route: '/events', act: (p) => tab(p, /^Past/) },
  { id: 'events-day', name: 'Events · Day selected', route: '/events', act: (p) => click(p, /Friday, 6 November 2026/, { wait: 800 }) },
]);
add('Events', 'Event detail', [
  { id: 'event-live', name: 'Event · Live now', route: '/events/e-baling-demo' },
  { id: 'event-upcoming', name: 'Event · Upcoming, interested', route: '/events/e-training' },
  { id: 'event-past', name: 'Event · Ended, with photos', route: '/events/e-fom-field-day' },
  { id: 'event-photo', name: 'Photo viewer', route: '/events/e-fom-field-day', tall: false, act: (p) => click(p, 'Open photo 2 of 5', { wait: 900 }) },
]);

/* ------------------------------------------------------------ 05 Orders & bookings */
add('Orders & bookings', 'Orders list', [
  { id: 'orders', name: 'Orders · FOM orders', route: '/orders' },
  { id: 'orders-filter', name: 'Orders · Status filter: Approved', route: '/orders', act: (p) => click(p, /^Approved/, { wait: 800 }) },
  { id: 'orders-bookings', name: 'Orders · Bookings', route: '/orders', act: (p) => tab(p, /^Bookings/) },
  { id: 'orders-date', name: 'Sheet · Orders date filter', route: '/orders', tall: false, act: (p) => click(p, 'Any date', { wait: 900 }) },
]);
add('Orders & bookings', 'Order detail', [
  { id: 'order-pending', name: 'Order · Pending approval', route: '/orders/fom/FOM2611014' },
  { id: 'order-approved', name: 'Order · Approved, dispatch', route: '/orders/fom/FOM2610009' },
  { id: 'order-rejected', name: 'Order · Rejected', route: '/orders/fom/FOM2610003' },
  { id: 'order-delivered', name: 'Order · Delivered', route: '/orders/fom/FOM2609021' },
]);
add('Orders & bookings', 'Order creation', [
  { id: 'new-order', name: 'New order · Empty', route: '/orders/fom/new' },
  { id: 'new-order-error', name: 'New order · Error: no quantity', route: '/orders/fom/new', act: (p) => click(p, /Review order/) },
  { id: 'new-order-filled', name: 'New order · Price calculated', route: '/orders/fom/new', act: (p) => fill(p, 'Quantity', '300') },
  { id: 'new-order-review', name: 'Sheet · Review your order', route: '/orders/fom/new', tall: false, act: async (p) => { await fill(p, 'Quantity', '300'); await click(p, /Review order/, { wait: 900 }); } },
]);
add('Orders & bookings', 'Booking detail', [
  { id: 'booking-pending', name: 'Booking · Pending approval', route: '/bookings/4581' },
  { id: 'booking-approved', name: 'Booking · Approved', route: '/bookings/8458' },
  { id: 'booking-rejected', name: 'Booking · Rejected', route: '/bookings/5848' },
]);
add('Orders & bookings', 'Book a field service', [
  { id: 'booking-step1', name: 'Booking · Step 1 Field', route: '/bookings/new' },
  { id: 'booking-step1-error', name: 'Booking · Step 1 Error', route: '/bookings/new', act: (p) => click(p, 'Continue', { exact: true }) },
  { id: 'booking-step1-filled', name: 'Booking · Step 1 Field chosen', route: '/bookings/new', act: async (p) => { await p.getByRole('radio', { name: /Paddy Field/ }).click(); await wait(p, 500); } },
  { id: 'booking-step2', name: 'Booking · Step 2 Date and time', route: '/bookings/new', act: async (p) => { await p.getByRole('radio', { name: /Paddy Field/ }).click(); await click(p, 'Continue', { exact: true, wait: 800 }); await p.locator('[aria-label*="2026"]').first().click(); await click(p, /9:00 AM/); } },
  { id: 'booking-step3', name: 'Booking · Step 3 Review', route: '/bookings/new', act: async (p) => { await p.getByRole('radio', { name: /Paddy Field/ }).click(); await click(p, 'Continue', { exact: true, wait: 800 }); await p.locator('[aria-label*="2026"]').first().click(); await click(p, /9:00 AM/); await click(p, 'Continue', { exact: true, wait: 900 }); } },
]);

/* ------------------------------------------------------------ 06 Forms */
add('Forms', 'My forms', [
  { id: 'forms', name: 'My forms', route: '/forms' },
  { id: 'form-cotton', name: 'Form · Cotton, in progress', route: '/forms/fc-cotton' },
  { id: 'form-wheat', name: 'Form · Wheat, all steps recorded', route: '/forms/fc-wheat' },
  { id: 'step-detail', name: 'Step · Records with calculation', route: '/forms/fc-wheat/steps/nutrients' },
  { id: 'step-detail-2', name: 'Step · Intercultivation', route: '/forms/fc-cotton/steps/intercultivation' },
]);

/* ------------------------------------------------------------ 07 Fields */
add('Fields', 'Fields', [
  { id: 'lands', name: 'My fields', route: '/lands' },
  { id: 'land-detail', name: 'Field · Active with crops', route: '/lands/l-paddy' },
  { id: 'land-inactive', name: 'Field · Inactive', route: '/lands/l-riverside' },
]);
add('Fields', 'Field editing', [
  { id: 'land-crop-sheet', name: 'Sheet · Add crop', route: '/lands/l-paddy', tall: false, act: (p) => click(p, 'Add crop', { wait: 900 }) },
  { id: 'land-edit-sheet', name: 'Sheet · Edit field', route: '/lands/l-paddy', tall: false, act: (p) => click(p, 'Edit field', { wait: 900 }) },
  { id: 'new-land', name: 'Add a field', route: '/lands/new' },
  { id: 'new-land-error', name: 'Add a field · Errors', route: '/lands/new', act: (p) => click(p, 'Continue', { exact: true, wait: 700 }) },
]);

/* ------------------------------------------------------------ 08 Notifications */
add('Notifications', 'Notifications', [
  { id: 'notifications', name: 'Notifications · Unread', route: '/notifications' },
  { id: 'notifications-read', name: 'Notifications · All read (undo toast)', route: '/notifications', act: (p) => click(p, 'Mark all read', { wait: 700 }) },
]);

/* ------------------------------------------------------------ 09 Account */
add('Account', 'Account', [
  { id: 'account', name: 'Account', route: '/account' },
  { id: 'account-unverified', name: 'Account · Unverified', route: '/account', st: UNVERIFIED },
  { id: 'account-logout', name: 'Sheet · Log out', route: '/account', tall: false, act: (p) => click(p, 'Log out', { exact: true, wait: 900 }) },
]);
add('Account', 'Profile and settings', [
  { id: 'profile', name: 'Edit profile', route: '/account/profile' },
  { id: 'language', name: 'Language', route: '/account/language' },
  { id: 'display', name: 'Display', route: '/account/display' },
  { id: 'password', name: 'Change password', route: '/account/password' },
  { id: 'password-error', name: 'Change password · Errors', route: '/account/password', act: async (p) => { await p.getByLabel('New password', { exact: true }).fill('abc'); await p.getByLabel('Confirm new password').fill('abd'); await click(p, 'Change password', { exact: true, wait: 700 }); } },
  { id: 'machinery', name: 'Farm machinery', route: '/account/machinery' },
]);
add('Account', 'Help and info', [
  { id: 'help', name: 'Help & FAQs', route: '/account/help' },
  { id: 'help-open', name: 'Help · Answer expanded', route: '/account/help', act: (p) => click(p, /How is my FOM order price/, { wait: 700 }) },
  { id: 'contact', name: 'Contact us', route: '/account/contact' },
  { id: 'about', name: 'About Kisani Urjaa', route: '/account/about' },
  { id: 'privacy', name: 'Privacy policy', route: '/account/legal/privacy' },
  { id: 'terms', name: 'Terms & conditions', route: '/account/legal/terms' },
]);
add('Account', 'Verification and prototype', [
  { id: 'verify', name: 'Verify number', route: '/account/verify', st: UNVERIFIED },
  { id: 'verify-done', name: 'Verify · Already verified', route: '/account/verify' },
  { id: 'prototype', name: 'Prototype controls', route: '/account/prototype' },
  { id: 'prototype-reset', name: 'Dialog · Reset prototype data', route: '/account/prototype', tall: false, act: (p) => click(p, 'Reset all prototype data', { wait: 900 }) },
]);

/* ------------------------------------------------------------ States: empty */
add('States · Empty', 'Lists with no data', [
  { id: 'empty-orders', name: 'Empty · No orders placed', route: '/orders', st: EMPTY },
  { id: 'empty-bookings', name: 'Empty · No bookings', route: '/orders', st: EMPTY, act: (p) => tab(p, /^Bookings/) },
  { id: 'empty-notifications', name: 'Empty · No notifications', route: '/notifications', st: EMPTY },
  { id: 'empty-learn', name: 'Empty · No news yet', route: '/learn', st: EMPTY },
  { id: 'empty-events', name: 'Empty · No upcoming events', route: '/events', st: EMPTY },
  { id: 'empty-forms', name: 'Empty · No forms', route: '/forms', st: EMPTY },
  { id: 'empty-lands', name: 'Empty · No fields', route: '/lands', st: EMPTY },
  { id: 'empty-home', name: 'Empty · Home with no data', route: '/home', st: EMPTY },
]);
add('States · Empty', 'Saved items and records', [
  { id: 'empty-bookmarks', name: 'Empty · No saved items', route: '/bookmarks', st: baseState({ bookmarks: [] }) },
  { id: 'empty-search', name: 'Empty · No search results', route: '/learn', act: async (p) => { await fill(p, /Search news/, 'tractor loan subsidy'); await wait(p, 1000); } },
  { id: 'empty-booking-fields', name: 'Empty · Book: add a field first', route: '/bookings/new', st: EMPTY },
  { id: 'empty-crops', name: 'Empty · Field with no crops', route: '/lands/l-riverside' },
  { id: 'empty-step', name: 'Empty · Step not recorded yet', route: '/forms/fc-cotton/steps/harvest' },
  { id: 'empty-notifications-read', name: 'Empty · All caught up', route: '/notifications', st: baseState({ unreadNotifications: [] }) },
]);

/* ------------------------------------------------------------ States: loading */
const loading = (id, name, route) => ({ id, name, route, st: SLOW, fast: true, tall: false });
add('States · Loading', 'Skeleton screens', [
  loading('loading-home', 'Loading · Home', '/home'),
  loading('loading-learn', 'Loading · Learn', '/learn'),
  loading('loading-detail', 'Loading · News detail', '/news/n-straw-collection'),
  loading('loading-events', 'Loading · Events', '/events'),
  loading('loading-event', 'Loading · Event detail', '/events/e-training'),
  loading('loading-orders', 'Loading · Orders', '/orders'),
  loading('loading-order', 'Loading · Order detail', '/orders/fom/FOM2611014'),
  loading('loading-booking', 'Loading · Booking detail', '/bookings/4581'),
  loading('loading-forms', 'Loading · My forms', '/forms'),
  loading('loading-form', 'Loading · Form detail', '/forms/fc-cotton'),
  loading('loading-lands', 'Loading · My fields', '/lands'),
  loading('loading-notifications', 'Loading · Notifications', '/notifications'),
]);
add('States · Loading', 'In-progress actions', [
  { id: 'loading-otp', name: 'Sending OTP (button loading)', route: '/auth', st: { ...OUT, demo: { network: 'slow' } }, tall: false, act: async (p) => { await fill(p, 'Mobile number', '9876543210'); await btn(p, 'Get OTP').click(); await wait(p, 300); } },
  { id: 'loading-place-order', name: 'Placing order (button loading)', route: '/orders/fom/new', st: SLOW, tall: false, act: async (p) => { await p.waitForSelector('input'); await fill(p, 'Quantity', '300'); await click(p, /Review order/, { wait: 900 }); await btn(p, /Place order/).click(); await wait(p, 300); } },
]);

/* ------------------------------------------------------------ States: error & offline */
add('States · Error & offline', 'No internet connection', [
  { id: 'offline-home', name: 'Offline · Home', route: '/home', st: OFFLINE },
  { id: 'offline-learn', name: 'Offline · Learn', route: '/learn', st: OFFLINE },
  { id: 'offline-detail', name: 'Offline · News detail', route: '/news/n-kharif-sowing', st: OFFLINE },
  { id: 'offline-orders', name: 'Offline · Orders', route: '/orders', st: OFFLINE },
  { id: 'offline-events', name: 'Offline · Events', route: '/events', st: OFFLINE },
  { id: 'offline-notifications', name: 'Offline · Notifications', route: '/notifications', st: OFFLINE },
  { id: 'offline-stale', name: 'Offline · Showing saved data', route: '/orders', stale: true },
  { id: 'offline-order-fail', name: 'Offline · Order not placed', route: '/orders/fom/new', tall: false, act: async (p) => { await fill(p, 'Quantity', '300'); await click(p, /Review order/, { wait: 900 }); await p.context().setOffline(true); await click(p, /Place order/, { wait: 1500 }); } },
]);
add('States · Error & offline', 'Not found', [
  { id: 'error-order', name: 'Error · Order not found', route: '/orders/fom/FOM0000000' },
  { id: 'error-content', name: 'Error · Story not found', route: '/news/does-not-exist' },
  { id: 'error-land', name: 'Error · Field not found', route: '/lands/l-missing' },
  { id: 'error-404', name: 'Error · Page doesn’t exist', route: '/nope' },
]);

/* ------------------------------------------------------------ States: success & feedback */
add('States · Success', 'Confirmations', [
  { id: 'order-placed', name: 'Success · Order placed', route: '/orders/fom/new', act: async (p) => { await fill(p, 'Quantity', '300'); await click(p, /Review order/, { wait: 900 }); await click(p, /Place order/); await p.getByRole('heading', { name: 'Order placed' }).waitFor({ timeout: 8000 }); await wait(p, 600); } },
  { id: 'booking-requested', name: 'Success · Booking requested', route: '/bookings/new', act: async (p) => { await p.getByRole('radio', { name: /Paddy Field/ }).click(); await click(p, 'Continue', { exact: true, wait: 800 }); await p.locator('[aria-label*="2026"]').first().click(); await click(p, /9:00 AM/); await click(p, 'Continue', { exact: true, wait: 900 }); await click(p, 'Request booking'); await p.getByRole('heading', { name: 'Booking requested' }).waitFor({ timeout: 8000 }); await wait(p, 600); } },
]);
add('States · Success', 'Toasts', [
  { id: 'toast-saved', name: 'Toast · Saved to bookmarks', route: '/articles/a-seeders', tall: false, act: (p) => click(p, 'Save to bookmarks', { wait: 500 }) },
  { id: 'toast-interest', name: 'Toast · Marked as interested', route: '/events/e-crop-health', tall: false, act: (p) => click(p, 'Interested', { exact: true, wait: 500 }) },
  { id: 'toast-profile', name: 'Toast · Profile saved', route: '/account', tall: false, act: async (p) => { await p.evaluate(() => { location.hash = '/account/profile'; }); await wait(p, 900); await fill(p, 'Village', 'Ratanpur Khurd'); await click(p, /^Save/, { wait: 500 }); } },
]);

/* ------------------------------------------------------------ States: permission & gating */
add('States · Permission', 'Verification gating', [
  { id: 'gate-sheet', name: 'Sheet · Verify to continue', route: '/home', st: UNVERIFIED, tall: false, act: async (p) => { await click(p, /^Create/, { wait: 800 }); await click(p, /Order FOM/, { wait: 900 }); } },
  { id: 'gate-orders', name: 'Orders · Verify to order', route: '/orders', st: UNVERIFIED },
  { id: 'gate-otp', name: 'Verify · OTP from gate', route: '/home', st: UNVERIFIED, tall: false, act: async (p) => { await click(p, /^Create/, { wait: 800 }); await click(p, /Order FOM/, { wait: 900 }); await click(p, 'Verify with OTP', { wait: 1400 }); } },
]);

/* ------------------------------------------------------------ Dark mode */
const dark = (id, name, route, extra = {}) => Object.assign({ id: 'dark-' + id, name: 'Dark · ' + name, route, st: DARK, theme: 'dark' }, extra);
add('Dark mode', 'Main screens', [
  dark('home', 'Home', '/home'),
  dark('learn', 'Learn', '/learn'),
  dark('news', 'News detail', '/news/n-straw-collection'),
  dark('video', 'Video detail', '/videos/v-baling'),
  dark('events', 'Events', '/events'),
  dark('event', 'Event detail', '/events/e-baling-demo'),
  dark('orders', 'Orders', '/orders'),
  dark('order', 'Order detail', '/orders/fom/FOM2610009'),
  dark('new-order', 'New order', '/orders/fom/new'),
  dark('forms', 'Form detail', '/forms/fc-cotton'),
  dark('lands', 'My fields', '/lands'),
  dark('notifications', 'Notifications', '/notifications'),
  dark('account', 'Account', '/account'),
  dark('empty', 'Empty state', '/orders', { st: baseState({ prefs: { theme: 'dark' }, demo: { emptyData: true } }) }),
  dark('offline', 'Offline', '/learn', { st: baseState({ prefs: { theme: 'dark' }, demo: { network: 'offline' } }) }),
  dark('create', 'Sheet · Create', '/home', { tall: false, act: (p) => click(p, /^Create/, { wait: 800 }) }),
]);

/* ------------------------------------------------------------ Design system (component specimens) */
add('Design system', 'Design system screen', [
  { id: 'design-system', name: 'Design system', route: '/design-system' },
]);

module.exports = S;
