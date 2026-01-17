/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/web-client',
  server: {
    port: 4200,
    // Allow access from any host (localhost, acme.localhost, etc.)
    host: true,
    // Proxy API requests through dev server to avoid cross-origin cookie issues
    // Service ports: svc-identity=3001, svc-data=3002, svc-metadata=3003, svc-ava=3004
    proxy: {
      // Service-prefixed routes (primary pattern)
      '/api/identity': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/identity/, '/api'),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              proxyRes.headers['set-cookie'] = setCookie.map((cookie) =>
                cookie.replace(/Path=\/[^;]*/i, 'Path=/').replace(/Domain=[^;]*/i, '')
              );
            }
          });
        },
      },
      '/api/data': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/data/, '/api'),
      },
      '/api/metadata': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/metadata/, '/api'),
      },
      '/api/ai': {
        target: 'http://localhost:3004',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai/, '/api'),
      },
      // Studio routes go to svc-data
      '/api/studio': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/studio/, '/api/studio'),
      },
      // Admin routes (roles, permissions, groups) go to svc-identity
      '/api/admin': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/admin/, '/api/admin'),
      },
      // Direct API routes (for pages using simple /api/... paths)
      // Collections & Properties & Themes → svc-metadata
      '/api/collections': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/api/properties': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/api/themes': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/api/views': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/api/navigation/resolve': {
        target: 'http://localhost:3006',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
      '/api/navigation': {
        target: 'http://localhost:3003',
        changeOrigin: true,
      },
      '/api/view-engine': {
        target: 'http://localhost:3006',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/view-engine/, '/api'),
      },
      // User management & Auth → svc-identity
      '/api/tenant-users': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const setCookie = proxyRes.headers['set-cookie'];
            if (setCookie) {
              proxyRes.headers['set-cookie'] = setCookie.map((cookie) =>
                cookie.replace(/Path=\/[^;]*/i, 'Path=/').replace(/Domain=[^;]*/i, '')
              );
            }
          });
        },
      },
      '/api/iam': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // AVA governance → svc-ava
      '/api/ava': {
        target: 'http://localhost:3004',
        changeOrigin: true,
      },
      '/api/workflows': {
        target: 'http://localhost:3007',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/workflows/, '/api/workflows'),
      },
      '/api/insights': {
        target: 'http://localhost:3007',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/insights/, '/api/insights'),
      },
      '/api/notifications': {
        target: 'http://localhost:3008',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/notifications/, '/api/notifications'),
      },
      // Phase 7 AI endpoints → svc-ava
      '/api/phase7': {
        target: 'http://localhost:3004',
        changeOrigin: true,
      },
    },
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
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: false, // Use our custom manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/api\/(identity|data|metadata)\//i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'local-api-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            urlPattern: /\.(woff|woff2|ttf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
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
