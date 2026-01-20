import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for GitHub Pages deployment
  // Replace 'puppet-master' with your actual repository name
  base: '/puppet-master/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Ensure assets are correctly referenced
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})
