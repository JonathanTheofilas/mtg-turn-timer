import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`        → installable PWA in dist/
// `npm run build:single` → one self-contained HTML file in dist-single/ (for sharing/hosting anywhere)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    plugins: [
      react(),
      single
        ? viteSingleFile()
        : VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['icon.svg'],
            // Cache card art once seen, so backgrounds still show offline at the table.
            workbox: {
              runtimeCaching: [
                {
                  urlPattern: ({ url }) => url.hostname === 'cards.scryfall.io',
                  handler: 'CacheFirst',
                  options: { cacheName: 'card-art', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
                },
              ],
            },
            manifest: {
              name: 'MTG Turn Timer',
              short_name: 'Turn Timer',
              description: 'Life counter with a rotating turn clock',
              theme_color: '#0e0f12',
              background_color: '#0e0f12',
              display: 'fullscreen',
              orientation: 'any',
              start_url: '.',
              scope: '.',
              icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
            },
          }),
    ],
    // GitHub Pages serves from /<repo>/; the deploy workflow sets BASE_PATH.
    base: single ? './' : process.env.BASE_PATH ?? '/',
    build: { outDir: single ? 'dist-single' : 'dist' },
    test: { environment: 'node' },
  };
});
