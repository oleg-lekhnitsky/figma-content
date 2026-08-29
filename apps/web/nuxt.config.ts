export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/image', '@nuxt/eslint'],
  css: [
    '~/assets/css/global.css',
    // Shared drawer controls used by Filters, View, and settings panels.
    '~/assets/css/filters.css'
  ],
  app: {
    head: {
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#fafafa' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Content Library' }
      ],
      style: [{
        key: 'pwa-splash-critical',
        innerHTML: `@media (display-mode: standalone) {
          html, body { background: #fafafa; }
          .app-splash { position: fixed; z-index: 2147483647; inset: 0; display: block; overflow: hidden; background: #fafafa; }
          .app-splash-center { position: absolute; top: 0; right: 0; left: 0; height: calc(100svh + env(safe-area-inset-top, 0px) + env(safe-area-inset-bottom, 0px)); display: grid; place-items: center; }
          .app-splash-art { width: min(87vw, 70rem); height: auto; display: block; }
        }`
      }],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png?v=3' },
        { rel: 'preload', href: '/pwa-mark.svg?v=6', as: 'image', type: 'image/svg+xml' },
        { rel: 'preload', href: '/fonts/ABCDiatypeCyrillicTrial-Medium.otf', as: 'font', type: 'font/otf', crossorigin: 'anonymous' },
        { rel: 'preload', href: '/fonts/ABCDiatypeCyrillicTrial-Bold.otf', as: 'font', type: 'font/otf', crossorigin: 'anonymous' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1320x2868-v6.png', media: '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1206x2622-v6.png', media: '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1290x2796-v6.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1179x2556-v6.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1284x2778-v6.png', media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1170x2532-v6.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1242x2688-v6.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-828x1792-v6.png', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1125x2436-v6.png', media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1242x2208-v6.png', media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-750x1334-v6.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-2048x2732-v6.png', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1668x2388-v6.png', media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1640x2360-v6.png', media: '(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1620x2160-v6.png', media: '(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2)' },
        { rel: 'apple-touch-startup-image', href: '/apple-splash-1536x2048-v6.png', media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)' },
        { rel: 'apple-touch-startup-image', href: '/pwa-launch-v6.png' }
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
    sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 2_592_000),
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
