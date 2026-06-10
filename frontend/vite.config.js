import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: null,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'EduManage',
        short_name: 'EduManage',
        description: 'EduManage — Student portal, teacher portal, parent portal, and school management.',
        theme_color: '#00b4d8',
        background_color: '#0f1f3d',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/logo-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icons/logo-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html'
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
