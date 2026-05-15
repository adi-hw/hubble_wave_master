/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { VitePWA } from 'vite-plugin-pwa';

const rewriteDevSetCookieHeader = (setCookie: string | string[] | undefined) => {
  if (!setCookie) return setCookie;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((cookie) =>
    cookie.replace(/Path=\/[^;]*/i, 'Path=/').replace(/Domain=[^;]*/i, '')
  );
};

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web-client',
  server: {
    port: 4200,
    // Allow access from any host (localhost, acme.localhost, etc.)
    host: true,
    // TRANSITIONAL (Phase 3 Prelude → finalized in a later wave):
    // The strip-prefix rewrites below bridge the web client's per-service
    // URL convention (VITE_*_API_URL = '/api/identity', etc.) to apps/api's
    // unified URL space. This proxy stays as dev convenience until the web
    // client's VITE_*_API_URL defaults are aligned with apps/api's routes
    // directly (a later wave decides timing).
    //
    proxy: {
      '/api/identity': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/identity/, '/api'),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            proxyRes.headers['set-cookie'] = rewriteDevSetCookieHeader(setCookie);
          });
        },
      },
      '/api/metadata': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/metadata/, '/api'),
      },
      '/api/ai': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, '/api/ava'),
      },
      '/api/view-engine': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        // Web client posts `/api/view-engine/views/resolve` (baseURL
        // `/api/view-engine` + `/views/resolve`). apps/api views module
        // serves at `/api/views/resolve` via @Controller('views'). Strip
        // `/api/view-engine` (don't add `/api/views`) so the suffix
        // `/views/resolve` lands on the right route.
        rewrite: (path) => path.replace(/^\/api\/view-engine/, '/api'),
      },
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            proxyRes.headers['set-cookie'] = rewriteDevSetCookieHeader(setCookie);
          });
        },
      },
    },
  },
  define: {
    'process.env': {},
  },
  preview: {
    port: 4200,
    host: true,
  },
  plugins: [
    react(),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    VitePWA({
      // injectManifest compiles src/service-worker.ts as the source of truth.
      // The hardened SW (auth-gated cache, CLEAR_USER_CACHE, notification URL
      // validation) runs in production — generateSW would discard it.
      strategies: 'injectManifest',
      registerType: 'autoUpdate',
      srcDir: 'src',
      filename: 'service-worker.ts',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: false, // Use our custom manifest.json
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
      },
      devOptions: {
        enabled: false, // Disable in dev mode for easier debugging
      },
    }),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  build: {
    outDir: '../../dist/apps/web-client',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
