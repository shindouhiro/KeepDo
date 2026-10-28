import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'
export default defineConfig(environment => mergeConfig(base(environment), { server: { host: '127.0.0.1', port: 5175, strictPort: true, proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false } } } }))
