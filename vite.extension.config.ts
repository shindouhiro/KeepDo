import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  root: fileURLToPath(new URL('./extension', import.meta.url)),
  base: './',
  plugins: [tailwindcss()],
  build: {
    outDir: '../dist-extension',
    emptyOutDir: true,
  },
})
