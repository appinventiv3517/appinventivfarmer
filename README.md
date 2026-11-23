# Kisani Urjaa farmer app, redesigned

A working, mobile-first rebuild of the Kisani Urjaa farmer app: React 18, TypeScript and Vite. Every feature from the 80 original design frames is kept. Missing screens and states (OTP, bookings list, add land, profile, help, loading, empty, offline and error) were added.

- **Two design directions:** Direction 01 (illustrated, at `#/`) and **Direction 02 “Field Journal”** (editorial, photography-led, at `#/d2`). They share data and logic; only the typeface and corner radii are common to both visual layers. See [`docs/direction-02.md`](docs/direction-02.md).
- **Ver 3** (at `#/d3`): an independent copy of Direction 02, for the next round of design changes. See [Ver 3](#ver-3).
- **Audit of the original designs:** [`docs/audit.md`](docs/audit.md)
- **Living design system:** in the app at Account → Design system (`#/design-system`)

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (phone-sized frame on desktop)
```

| Script | What it does |
|---|---|
| `npm run build` | Type-check, then production build to `dist/` (hash routing, static hosting) |
| `npm run build:demo` | Self-contained build to `dist-demo/` with in-memory routing, for embedding in hosts that don't allow URL routing |
| `npm run build:demo2` | The same, to `dist-demo2/`, opening on Direction 02 |
| `npm run build:demo3` | The same, to `dist-demo3/`, opening on Ver 3 |
| `npm run build:standalone` | One self-contained HTML file, `dist-standalone/kisani-urjaa-app.html`, opening on Direction 02 |
| `npm run build:standalone3` | The same for Ver 3: `dist-standalone/kisani-urjaa-app-v3.html` |
| `npm run build:mobile3` | Ver 3 only, as a phone app: `dist-mobile/kisani-urjaa-ver3.html` (opens on Ver 3, no switching to other directions) |
| `npm run build:mobile` | Phone preview files in `dist-mobile/`, one per direction (01, 02 and Ver 3) |
| `npm run typecheck` | TypeScript only |
| `npm test` | Unit tests for pricing, validation, formatting, weather advice, filtering, season-record totals |

**Demo tips:** the OTP is `123456`. Account → Prototype controls switches verified/unverified, normal/slow/offline network and empty states, and resets data. Everything you create is stored on your device only.

## What's inside

| Module | Screens |
|---|---|
| Brand | Client logo on a splash screen (tap to skip; shorter with reduced motion), welcome, sign-in, About, app icons and favicon |
| Onboarding | Welcome carousel, phone sign-up and log-in, OTP, continue without verifying, location permission |
| Home | Weather card with a spray advisory, quick actions with live counts, Kisani Didi contact, next event, fields, news, videos, guides |
| Learn | News / Videos / Articles in one hub: search, categories, date filter (90-day cap), bookmarks, sharing, reading progress, custom video player |
| Events | Upcoming / past, date strip, live status, interest, map link, photo viewer |
| Orders | FOM orders and bookings with status filters; order creation with live price and review; three-step booking flow; success screens |
| My forms | Season cycles, 8-step timeline, step records with the calculation shown for each total |
| Fields | List, detail, active toggle, add/edit crops, add-a-field flow |
| Notifications | Grouped by day, unread markers, categories, mark all read with undo |
| Account | Profile, language, password, farm machinery, help, contact, legal, verification |

## Ver 3

Ver 3 starts as an exact copy of Direction 02 “Field Journal” and is where the Ver 3 design changes go. It lives in `src/d3/` and is mounted at `#/d3/...`; Direction 01 (`src/features`, `src/components`) and Direction 02 (`src/d2`) are not affected by changes there.

- **Its own copy:** screens, UI kit, layout, motion, Lottie, styles, routes (`src/d3/routes.tsx`), paths (`src/d3/paths.ts`, `isD3Path`) and tests (`src/d3/__tests__`). Global styles are scoped to `.fj3` and `--fj3-*` tokens so the two Field Journal layers never collide.
- **Shared, not forked:** store, services, i18n, `src/lib`, `src/data` and `src/components/home`.
- **Photos:** Ver 3 shows Direction 02's AI concept images (with their credit lines) from `src/d2/photo/files`; a file dropped into `src/d3/photo/files` with the same slot id replaces it for Ver 3 only.
- **Review chrome:** the desktop switcher has a third option, “03 · Field Journal v3”; Reset prototype returns to `#/d3`; the OTP is `123456`; prototype controls are at Me → Prototype controls.
- **Sign-up and log-in (Ver 3 flow):** intro screens → Choose language → Get started (Sign up or Log in). Sign up: Set up account (mobile → OTP) → Create User ID → Create password → “Thanks for joining us!” → Profile details in 3 steps (personal and ID document, address, additional details) → Home. Log in with OTP or with User ID & password; Forgot password and Forgot User ID both go through an OTP. OTP: 60 s resend timer, 3 tries per code. The account lives on the device only, with the password stored as a salted hash; ID scans are never stored. Screens are in `src/d3/screens/onboarding` and `src/d3/screens/profile-setup`; reference place names in `src/data/places.ts`.
- **Demo:** `npm run build:standalone3` writes `dist-standalone/kisani-urjaa-app-v3.html`, which opens on Ver 3.

## Architecture

```
src/
  app/             router, page transitions, app frame, shared sheets (create, verify gate, contact)
  components/ui/   design-system components (Button, fields, Sheet, Toast, badges, lists, timeline…)
  components/      layout (Screen, TabBar), media (Scene, Lottie, VideoPlayer), content cards
  features/        one folder per module (Direction 01)
  d2/              Direction 02 “Field Journal”, mounted at /d2
  d3/              Ver 3, a copy of Direction 02, mounted at /d3
  services/        api.ts (the only backend seam), store.ts (persisted state), query.ts (cache)
  data/            sample data, dated relative to today
  lib/             formatting, pricing, validation, weather, dates
  scenes/          procedural landscape illustrations
  lottie/          Lottie animations authored in code
  styles/          tokens.css (light + dark), base.css
```

- **Connecting a real backend:** replace the functions in `src/services/api.ts`; screens only call `api.*`. Writes made in the prototype are marked `origin: 'device'`, and the UI says they were not sent.
- **Weather:** live from Open-Meteo, with a clearly labelled sample forecast when offline or blocked.
- **Imagery:** image hosts were unreachable from the build environment, so `src/scenes` draws Indian farmland scenes in SVG. Set `scene.src` on any item to use a licensed photo instead.
- **Sample videos:** `public/media/*.mp4` are short clips rendered from the scenes (labelled "Sample clip" in the player).

## Assumptions to confirm

FOM = fermented organic manure at ₹100/kg + ₹100 shipping (from the designs). Bookings are field-service requests that need approval. Machinery details describe machines the farmer owns. Kisani Didis fill the season forms. Hindi and Marathi are shown as "coming soon". Details: [`docs/audit.md`](docs/audit.md).

## Credits

Plus Jakarta Sans (SIL OFL), Lucide icons (ISC), lottie-web (MIT), Framer Motion (MIT), React Router (MIT).
