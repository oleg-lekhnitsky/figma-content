export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/image', '@nuxt/eslint'],
  css: ['~/assets/css/global.css'],
  routeRules: {
    '/**': { headers: {
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Cross-Origin-Opener-Policy': 'same-origin'
    } },
    '/api/**': { headers: { 'Cache-Control': 'no-store' } }
  },
  runtimeConfig: {
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? '',
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? '',
    figmaClientId: process.env.FIGMA_CLIENT_ID ?? '',
    figmaClientSecret: process.env.FIGMA_CLIENT_SECRET ?? '',
    figmaRedirectUri: process.env.FIGMA_REDIRECT_URI ?? '',
    sessionSecret: process.env.SESSION_SECRET ?? '',
    pluginCallbackUrl: process.env.PLUGIN_CALLBACK_URL ?? '',
    sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 28_800),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 10_485_760),
    public: { appUrl: process.env.NUXT_PUBLIC_APP_URL ?? 'http://localhost:3000' }
  },
  typescript: { strict: true }
})
