import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './', // Use relative paths for GitHub Pages
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
      },
      manifest: {
        name: 'Expense Tracker',
        short_name: 'Expenses',
        start_url: './',
        display: 'standalone',
        background_color: '#1B2A41',
        theme_color: '#1B2A41',
        icons: [
          {
            src: 'pwa-icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ],
      },
    }),
  ],
})
