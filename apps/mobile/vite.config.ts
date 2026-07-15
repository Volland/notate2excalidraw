import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base so assets resolve when served from the Capacitor WebView.
  base: './',
  plugins: [react()],
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
    'process.env.IS_PREACT': JSON.stringify('false'),
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 4096,
  },
});
