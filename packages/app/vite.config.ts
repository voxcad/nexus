import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      '@nexus/kernel': path.resolve(__dirname, '../kernel/pkg/nexus_kernel.js')
    }
  },
  optimizeDeps: {
    exclude: ['@nexus/kernel']
  },
  server: {
    fs: {
      allow: ['../..']
    }
  }
});
