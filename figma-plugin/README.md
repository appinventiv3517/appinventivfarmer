# Kisani Urjaa · Ver 3 importer (Figma plugin)

Builds the Ver 3 design in Figma from `kisani-urjaa-ver3.figma.json`.

## Install (Figma desktop app)

1. Unzip `kisani-urjaa-ver3-figma-plugin.zip` anywhere.
2. In Figma desktop: **Plugins → Development → Import plugin from manifest…** and pick `manifest.json`.
3. Optional but recommended: install the **Plus Jakarta Sans** font (Google Fonts) and, for Indian-language
   text, **Noto Sans Devanagari / Gurmukhi / Gujarati / Oriya / Telugu**. Without them the importer uses Inter.

## Import

1. Open a new, empty Figma design file.
2. **Plugins → Development → Kisani Urjaa · Ver 3 importer**.
3. Choose `kisani-urjaa-ver3.figma.json` and click **Import into this file**. It takes a minute or two.

## What you get

| Page | Contents |
|---|---|
| Cover | Title and notes |
| Style guide | Colours (semantic and palette), type scale, corner radii, spacing, elevation, motion and the photo treatment |
| Components | Every component as a Figma component; variants combined into component sets (Button, Text field, Navigation…) |
| Screens · … | Every screen and state, grouped by area, in a grid (393 × 852 iPhone width; long screens are full length) |

- Every frame uses **Auto Layout** (direction, padding, gaps and alignment measured from the app). Icons are SVG.
- Colours, text and shadows are **local styles**; colours, radii and spacing are also **variables** (collection
  “Ver 3 tokens”). Screen layers are linked to those styles.
- Photos carry the brand grade as image filters plus the soft-light apricot wash layer.

Re-running the import updates the styles and variables in place and adds the pages again.

## Regenerate the JSON

```bash
npm install
npx vite --port 5199 &                 # the component kit is dev-only
node scripts/figma/capture.cjs         # → dist-figma/kisani-urjaa-ver3.figma.json
node scripts/figma/mock-figma.cjs dist-figma/kisani-urjaa-ver3.figma.json   # importer test without Figma
```
