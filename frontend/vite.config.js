import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split big vendor libraries so the first page load downloads less
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase')) return 'firebase'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('leaflet')) return 'maps'
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router') || id.includes('@reduxjs') || id.includes('react-redux')) return 'react-vendor'
        }
      }
    }
  }
})
