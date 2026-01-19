import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Running R3F/Three-related tests in parallel can be memory-intensive in jsdom,
    // especially on Windows. Use a single forked worker to reduce memory pressure
    // and avoid thread-pool deserialization/OOM issues.
    pool: 'forks',
    poolOptions: {
      forks: {
        minForks: 1,
        maxForks: 1,
      },
    },
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Exclude SelectionOutline.test.tsx - it hangs during module import due to
      // @react-three/postprocessing initialization in jsdom (WebGL context setup).
      // The component itself is well-tested through integration tests in MainCanvas.test.tsx
      'src/components/scene/SelectionOutline.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

