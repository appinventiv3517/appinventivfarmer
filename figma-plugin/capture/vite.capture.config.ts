// Dev server used only by the Figma capture: same app, but CSS-module class
// names keep their file and class name (e.g. "Button-module__primary") so the
// capture can name layers and recognise components.
import { defineConfig, mergeConfig } from 'vite';
import base from '../../vite.config';

export default defineConfig((env) =>
  mergeConfig(typeof base === 'function' ? base(env) : base, {
    css: {
      modules: {
        generateScopedName: (local: string, filename: string) => {
          const file = filename.split(/[\\/]/).pop()!.replace(/\.module\.css.*$/, '').replace(/[^A-Za-z0-9]/g, '');
          return `${file}__${local}`;
        },
      },
    },
    server: { port: 5199, strictPort: true },
  }),
);
