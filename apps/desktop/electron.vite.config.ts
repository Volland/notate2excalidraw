import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve(__dirname, 'src/main/index.ts') },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve(__dirname, 'src/preload/index.ts') },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
    resolve: {
      alias: {
        '@notate/codec': resolve(__dirname, '../../packages/notate-codec/src/index.ts'),
        '@notate/excalidraw': resolve(
          __dirname,
          '../../packages/notate-excalidraw/src/index.ts',
        ),
        '@notate/ui': resolve(__dirname, '../../packages/notate-ui/src/index.ts'),
      },
    },
    define: {
      // @excalidraw/excalidraw reads this; required when bundling.
      'process.env.IS_PREACT': JSON.stringify('false'),
    },
    plugins: [react()],
  },
});
