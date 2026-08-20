export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/image', '@nuxt/eslint'],
  css: [
    '~/assets/css/global.css',
    // Optional filter layout experiment: remove this entry to unplug it.
    '~/assets/css/filters.css'
  ],
  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#fafafa' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Content Library' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'preload', href: '/fonts/ABCDiatypeCyrillicTrial-Medium.otf', as: 'font', type: 'font/otf', crossorigin: 'anonymous' },
        { rel: 'preload', href: '/fonts/ABCDiatypeCyrillicTrial-Bold.otf', as: 'font', type: 'font/otf', crossorigin: 'anonymous' },
        { rel: 'apple-touch-startup-image', href: '/pwa-launch.png' }
      ]
    }
  },
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
    maxUploadBytes: Math.max(Number(process.env.MAX_UPLOAD_BYTES) || 0, 104_857_600),
    r2AccountId: process.env.R2_ACCOUNT_ID ?? '',
    r2AccessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    r2Bucket: process.env.R2_BUCKET ?? '',
    r2Endpoint: process.env.R2_ENDPOINT ?? '',
    public: { appUrl: process.env.NUXT_PUBLIC_APP_URL ?? 'http://localhost:3000' }
  },
  typescript: { strict: true }
})
