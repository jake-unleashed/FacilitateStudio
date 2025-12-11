import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react()],
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
    // Source maps for production debugging (can be disabled for smaller builds)
    sourcemap: false,
    // Rollup-specific options
    rollupOptions: {
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
    // Remove console.log in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});

