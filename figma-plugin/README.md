# Kisani Urjaa · App importer (Figma plugin)

This plugin rebuilds the whole Kisani Urjaa farmer app inside Figma as **editable layers**: every screen, flow and UI state, plus the design system they're made from. Nothing is a screenshot. Frames, auto-sized text, vector icons and illustrations, and image fills all come from the running React app. The plugin works offline (no network access).

## Import and run

1. Open the Figma desktop app and open (or create) a Design file.
2. Go to **Plugins → Development → Import plugin from manifest…**.
3. Choose `figma-plugin/manifest.json` from this repository.
4. Run **Plugins → Development → Kisani Urjaa · App importer**.
5. Pick pages (all are ticked by default) and options, then click **Build in Figma**.

A full build creates about 160 frames and takes a few minutes. The panel shows progress screen by screen. **Stop** finishes the current screen and then wraps up cleanly.

> **Font:** screens use **Plus Jakarta Sans**, the app's font. It's on Google Fonts, so Figma has it. If it's ever missing, the plugin falls back to Inter and says so in the log.

## What it builds

| Page | Contents |
|---|---|
| Cover | Logo, summary and page index; also set as the file thumbnail |
| Foundations | Variable collections, text and effect styles, plus swatch boards (see below) |
| Components | 75+ icon components and four variant sets: Status bar, Dynamic Island, Home indicator, Tab bar |
| 01–09 | Every app module: Onboarding, Home, Learn, Events, Orders & bookings, My forms, Fields, Notifications, Account |
| 10–14 | UI states: Empty, Loading (skeletons and in-progress buttons), Error & offline, Success (confirmations and toasts), Permission (verification gating, location) |
| 15 Dark mode | Main screens, sheets, empty and offline states in the dark theme |
| 16 Design system | The app's own design-system screen |

The Foundations page holds:

- **`Kisani Urjaa · Colour`** variable collection: 81 colour variables with **Light** and **Dark** modes. Semantic tokens alias the palette.
- **`Kisani Urjaa · Shape & space`** variable collection: radius and spacing as number variables.
- **13 text styles**: the type scale, from Display down to Overline.
- **4 elevation effect styles**.
- **Swatch boards** for Light and Dark.

`INVENTORY.md` lists every frame with its route and size.

### What's editable

- **Text** is real text in Plus Jakarta Sans, with mixed styles kept per character range. Line clamps use Figma's truncation, and text that matches the type scale uses the text style.
- **Colours** are bound to variables wherever a token matches. Dark-mode frames set the collection's Dark mode explicitly, so you can flip any frame between Light and Dark from the Layer panel.
- **Icons** are instances of `Icon/<name>` components, recoloured and resized per use with the stroke weight kept.
- **Status bar, Dynamic Island, home indicator and tab bar** are instances. Edit the component once and every screen follows.
- **Illustrations** (landscapes, Lottie artwork) are vector layers. Tick **Bitmap illustrations** if you'd rather have lighter image fills.
- **Shadows, blur and borders** are real effects and strokes. CSS ring shadows become inside strokes, and elevation tokens use effect styles.
- **Prototype:** links between screens use Smart Animate, back buttons go Back, and each section has a flow starting point.

## How it works

```
React app ──(Playwright)──► capture/serialize.js ──► data/*.json + data/assets/*
                                                              │
                         scripts/build.mjs  ◄─────────────────┘
                                │  inlines CSS, JS, screens, SVG & images
                                ▼
                    ui.html  ──postMessage──►  main.js  ──►  Figma nodes
```

- **`capture/`** opens the app in Chromium and drives it into each scenario. Scenarios include typing a short phone number to get the validation error, opening sheets, switching the prototype controls to *slow*, *offline* or *empty* data, and running the app in the dark theme. The full list is in `capture/scenarios.cjs`.
  - Long screens are captured at full scroll height.
  - Each screen is serialised into a compact node tree: boxes, gradients, borders, radii, shadows, blur, text runs with per-range styles, inline SVG with resolved colours, and images.
  - CSS-module class names are kept, so layers carry names like `Home/weather` or `Button/btn.primary.lg`.
- **`scripts/build.mjs`** bundles everything into `ui.html`, because Figma loads exactly one UI file. It also writes `INVENTORY.md`.
- **`main.js`** is the plugin's main thread. It receives one screen at a time (each message is acknowledged, so Figma is never flooded) and builds the nodes:
  - fonts first, then variables and styles, then components;
  - prototype links and component sets are wired at the end.
  - Errors are caught per layer and per screen, then reported in the panel, so one bad layer never stops a build.

## Regenerate after the app changes

```bash
# 1. Start the capture dev server (same app; readable CSS-module class names)
npx vite --config figma-plugin/capture/vite.capture.config.ts

# 2. Capture every scenario (about 10 minutes); add --only id1,id2 to redo a few
node figma-plugin/capture/run.cjs

# 3. Refresh tokens, bundle the plugin, validate
node figma-plugin/capture/tokens.cjs
node figma-plugin/scripts/build.mjs
node figma-plugin/scripts/validate.mjs
```

There are two checks:

- **`scripts/validate.mjs`** checks the manifest and the bundle. It then runs `main.js` end to end against a strict mock of the Figma Plugin API, which rejects what Figma rejects: colours outside 0–1, alpha inside paint colours, unloaded fonts, bad enum values, zero sizes and so on.
- **`scripts/preview.cjs`** re-renders every captured screen the way the plugin rebuilds it and diffs it against screenshots of the real app.

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Plugin manifest (Design files, dynamic page loading, no network) |
| `main.js` | Plugin main thread: builds pages, variables, styles, components, screens and prototype links |
| `ui.html` | Generated plugin UI with all screens and assets inlined |
| `src/ui.template.html`, `src/ui.css`, `src/ui.js` | UI sources |
| `capture/` | Capture pipeline: serializer, scenarios, runner, token extractor, dev-server config |
| `data/` | Captured screens (`screens/*.json`), de-duplicated assets (`assets/*`), `tokens.json` |
| `scripts/` | `build.mjs`, `validate.mjs`, `preview.cjs` |
| `INVENTORY.md` | Every frame the plugin creates, by page and flow |

## Known limits

- **Sample data:** screens show the prototype's sample data, with the clock fixed at 9:41 on 4 November 2026.
- **Effects that don't carry over:** CSS animations and the illustrations' film-grain overlay don't come across. Grayscale on inactive fields is reproduced with a Saturation-blend layer.
- **Layout:** screens use absolute positioning, so they match the app pixel for pixel. Component masters keep the app's structure. Turning screens into auto layout is a manual design step.
