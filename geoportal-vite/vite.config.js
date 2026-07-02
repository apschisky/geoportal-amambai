
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  server: {
    port: 5195,
    strictPort: true,
    proxy: {
      '/api/internal/': {
        target: 'https://geoserver.amambai.ms.gov.br',
        changeOrigin: true,
        secure: true
      },
      '/api/public/': {
        target: 'https://geoserver.amambai.ms.gov.br',
        changeOrigin: true,
        secure: true
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        interno: resolve(__dirname, 'interno/index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  optimizeDeps: {
    exclude: ['ol/interaction/Snap.js']
  }
});
