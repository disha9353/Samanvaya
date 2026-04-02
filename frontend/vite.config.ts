import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'EcoBarter+',
        short_name: 'EcoBarter+',
        description: 'Reuse + Barter + Waste Collection',
        theme_color: '#0f766e',
        background_color: '#052e2b',
        display: 'standalone',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Offline feed caching (GET) + background sync (POST)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/items'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'feed-items',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/chat/messages'),
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'sync-chat-messages',
              },
            },
            method: 'POST',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/waste/requests'),
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'sync-waste-requests',
              },
            },
            method: 'POST',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
})

