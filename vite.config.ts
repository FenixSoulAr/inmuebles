import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'sonner',
      'i18next',
      'react-i18next',
      'i18next-browser-languagedetector',
      '@radix-ui/react-tooltip',
    ],
  },
})
