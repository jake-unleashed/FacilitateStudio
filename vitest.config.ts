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
      // Restrict coverage to actual source files only. Without this, v8 can
      // report 0% for root configs or built assets (e.g. dist/), which skews
      // the overall "All files" metric.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/vite-env.d.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

