import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const hasSentryUploadConfig = Boolean(
    env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT
  );

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        // Local dev API server for SOP uploads (AI or nothing).
        // This makes `/api/*` requests work under `npm run dev`.
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      ...(hasSentryUploadConfig
        ? [
            sentryVitePlugin({
              org: env.SENTRY_ORG,
              project: env.SENTRY_PROJECT,
              authToken: env.SENTRY_AUTH_TOKEN,
            }),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // ============================================================================
    // Build Optimizations for Performance
    // ============================================================================
    build: {
      // Target modern browsers for smaller bundles
      target: 'es2020',
      // Enable minification
      minify: 'esbuild',
      // Source maps are required for Sentry upload.
      sourcemap: hasSentryUploadConfig,
      // Rollup-specific options
      rollupOptions: {
        plugins:
          mode === 'analyze'
            ? [
                visualizer({
                  filename: 'dist/bundle-analysis.html',
                  gzipSize: true,
                  brotliSize: true,
                  open: false,
                }),
              ]
            : [],
        output: {
          // Code splitting - separate vendor chunks for better caching
          manualChunks: {
            // Core React runtime
            'vendor-react': ['react', 'react-dom'],
            // Three.js core (large library, separate chunk)
            'vendor-three': ['three'],
            // React-Three ecosystem
            'vendor-react-three': ['@react-three/fiber', '@react-three/drei'],
            // UI icons
            'vendor-icons': ['lucide-react'],
          },
        },
      },
      // Increase chunk size warning limit for 3D libraries
      chunkSizeWarningLimit: 1000,
    },
    // ============================================================================
    // Optimization settings
    // ============================================================================
    optimizeDeps: {
      // Pre-bundle these heavy dependencies for faster dev server startup
      include: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
    },
    // ============================================================================
    // ESBuild options for faster builds
    // ============================================================================
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
      pure: process.env.NODE_ENV === 'production' ? ['console.log'] : [],
    },
  };
});

