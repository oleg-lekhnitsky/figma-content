import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig(({ mode }) => {
  const defaultAppUrl = mode === 'development'
    ? 'http://localhost:3000'
    : 'https://figma-content-web.vercel.app'

  return {
    plugins: [vue(), viteSingleFile()],
    define: { __APP_URL__: JSON.stringify(process.env.CONTENT_LIBRARY_URL || defaultAppUrl) },
    build: { outDir: 'dist', emptyOutDir: true, target: 'es2020' }
  }
})
