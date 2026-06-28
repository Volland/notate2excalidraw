import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      // Test against the codec source so no build step is required.
      '@notate/codec': fileURLToPath(
        new URL('../notate-codec/src/index.ts', import.meta.url),
      ),
    },
  },
});
