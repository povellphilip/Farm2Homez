/// <reference types="vitest/config" />
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://127.0.0.1:8000';

/** robots.txt must reference the sitemap by absolute URL, which is only known per deployment. */
function absoluteSitemap(siteUrl: string | undefined): Plugin {
  return {
    name: 'farm2home-absolute-sitemap',
    apply: 'build',
    writeBundle(options) {
      if (!siteUrl) return;
      const file = `${options.dir}/robots.txt`;
      const robots = readFileSync(file, 'utf8').replace('Sitemap: /', `Sitemap: ${siteUrl.replace(/\/$/, '')}/`);
      writeFileSync(file, robots);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), absoluteSitemap(loadEnv(mode, process.cwd(), 'VITE_').VITE_SITE_URL)],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Same-origin API in development, mirroring CloudFront routing /api/* to the backend in production.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
      '/media': { target: API_TARGET, changeOrigin: false },
    },
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'] },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
}));
