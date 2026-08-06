import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  define: { __APP_URL__: JSON.stringify(process.env.CONTENT_LIBRARY_URL || 'http://localhost:3000') },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' }
})
