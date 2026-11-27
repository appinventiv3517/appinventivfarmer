import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import postcssEven from './scripts/postcss-even.mjs';

// `--mode demo` produces a self-contained build for sharing as a hosted demo:
// in-memory routing (no URL dependence) and fonts/small assets inlined.
// `--mode demo2` is the same build, opening on Direction 02 (/d2); `--mode demo3`
// opens on Ver 3 (/d3).
// STANDALONE=1 bundles demo2 into one script with every asset inlined, for
// scripts/make-standalone.mjs to fold into a single downloadable HTML file.
const STANDALONE = process.env.STANDALONE === '1';
// VITE_MOBILE=1 (with STANDALONE=1) makes the phone preview build: real
// safe-area insets, hash routing so the phone's back button and swipe work,
// and app-like head tags added by make-standalone.mjs. See npm run build:mobile.
const MOBILE = process.env.VITE_MOBILE === '1';
const ONLY_D3 = process.env.VITE_ONLY_D3 === '1';
// VITE_APP=didi builds the Kisani Didi app on its own shell (src/app/AppDidi.tsx).
const DIDI = process.env.VITE_APP === 'didi';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'direction-title',
      transformIndexHtml: (html) =>
        mode === 'demo2' ? html.replace('<title>Kisani Urjaa</title>', '<title>Kisani Urjaa Field Journal</title>') : mode === 'demo3' ? html.replace('<title>Kisani Urjaa</title>', '<title>Kisani Urjaa Ver 3</title>') : DIDI ? html.replace('<title>Kisani Urjaa</title>', '<title>Kisani Urjaa – Kisani Didi App</title>') : html,
    },
  ],
  // Kisani Didi only: font sizes, line heights, spacing and corner radii become even whole pixels.
  css: DIDI ? { postcss: { plugins: [postcssEven()] } } : undefined,
  base: './',
  resolve: {
    alias: [
      // Ver 3-only builds (VITE_ONLY_D3=1) use their own shell, so Directions 01 and 02 are not bundled.
      ...(DIDI ? [{ find: /^\.\/app\/App$/, replacement: fileURLToPath(new URL('./src/app/AppDidi.tsx', import.meta.url)) }] : []),
      ...(ONLY_D3 && !DIDI ? [{ find: /^\.\/app\/App$/, replacement: fileURLToPath(new URL('./src/app/AppV3.tsx', import.meta.url)) }] : []),
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
  },
  build: {
    outDir: STANDALONE ? (MOBILE ? 'dist-mobile/build' : 'dist-standalone') : DIDI ? 'dist-didi' : mode === 'demo' ? 'dist-demo' : mode === 'demo2' ? 'dist-demo2' : mode === 'demo3' ? 'dist-demo3' : 'dist',
    target: 'es2020',
    assetsInlineLimit: STANDALONE ? 100_000_000 : mode.startsWith('demo') ? 160_000 : 4096,
    cssCodeSplit: !STANDALONE,
    rollupOptions: STANDALONE ? { output: { inlineDynamicImports: true } } : undefined,
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
}));
