import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: 'apps/web',
  base: process.env.APP_BASE || './',
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['favicon.svg', 'icon.svg', 'icon-192.png', 'icon-512.png'],
    manifest: {
      name: 'Património · Carteira pessoal', short_name: 'Património',
      description: 'A sua carteira, no seu dispositivo. Sem subscrições.',
      lang: 'pt-PT', theme_color: '#176455', background_color: '#f6f7f9',
      display: 'standalone', start_url: '.', scope: '.',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }]
    },
    workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], navigateFallback: 'index.html', cleanupOutdatedCaches: true }
  })],
  build: { outDir: '../../dist', emptyOutDir: true },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true }
});
