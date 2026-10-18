import { defineConfig } from 'vite';

// Relative asset URLs so the built site works at a domain root and at a
// GitHub Pages project subpath such as /criterion-recruits/.
export default defineConfig({
  base: './',
  server: {
    host: '0.0.0.0',
    port: 43123,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 43129,
    strictPort: true,
    allowedHosts: true,
  },
});
