import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-router-dom') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react/')) {
            return 'react-vendor';
          }
          if (id.includes('node_modules/@tiptap/') ||
              id.includes('node_modules/marked') ||
              id.includes('node_modules/turndown')) {
            return 'editor';
          }
          if (id.includes('node_modules/qrcode')) {
            return 'qrcode';
          }
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5027',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/extension-color',
      '@tiptap/extension-text-style',
      '@tiptap/extension-text-align',
      '@tiptap/extension-underline',
      '@tiptap/extension-link',
      '@tiptap/extension-placeholder',
    ],
  },
})
