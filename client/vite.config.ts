import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

// GitHub Pages project sites live under /<repo>/ — set GITHUB_PAGES=true when building for that host.
const base = process.env.GITHUB_PAGES === 'true' ? '/web-ar/' : '/';

// iOS Safari only grants camera (getUserMedia) access on a "secure context":
// https + valid cert, or localhost. Since we need to test on a physical
// iPhone over the local network (not localhost), we generate a locally
// trusted certificate with mkcert so Safari treats the LAN dev server as
// secure. See README sections on local HTTPS / deploy.
export default defineConfig({
  base,
  server: {
    https: true,
    host: '0.0.0.0', // expose on LAN so the iPhone can reach it
    port: 5173,
    // SPA: /ar/:id must serve index.html so QR deep-links work in dev.
    // Optional Express API: only used when VITE_API_BASE_URL is set.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    https: true,
    host: '0.0.0.0',
    port: 4173,
  },
  plugins: [
    mkcert(),
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = req.url ?? '';
          if (url.startsWith('/ar/') && !url.includes('.')) {
            req.url = '/index.html';
          }
          next();
        });
      },
    },
  ],
  build: {
    target: 'es2020',
    sourcemap: true,
  },
  // MindAR ships pre-bundled UMD/ESM production files; avoid Vite trying
  // to pre-optimize its internal tfjs worker bundle in a way that breaks
  // web worker loading.
  optimizeDeps: {
    exclude: ['mind-ar'],
  },
});
