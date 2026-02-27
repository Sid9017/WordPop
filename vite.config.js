import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/youdao-api': {
        target: 'https://dict.youdao.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/youdao-api/, ''),
      },
    },
  },
})
