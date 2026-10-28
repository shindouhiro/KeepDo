import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// Cloudflare 在根路径托管，原有构建保留相对路径以兼容 GitHub Pages。
export default defineConfig(({ mode }) => ({
  base: mode === 'cloudflare' ? '/' : './',
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
}))
