# Deployment

## Prerequisites

- A Supabase project with all files in `supabase/migrations` applied in filename order.
- A private `assets` Storage bucket (the migration creates it).
- A Figma OAuth app whose callback exactly matches `FIGMA_REDIRECT_URI`.
- A Node 22 container host with HTTPS and persistent environment secrets.

## Web service

Build the included image from the repository root:

```bash
docker build -t content-library .
docker run --env-file .env.production -p 3000:3000 content-library
```

The service listens on `PORT` and exposes `GET /api/health` for readiness checks. Configure the platform health check to that path. Terminate TLS at the hosting platform and set `NUXT_PUBLIC_APP_URL`, `FIGMA_REDIRECT_URI`, and `PLUGIN_CALLBACK_URL` to the final HTTPS origin before building and starting the service.

Store `SUPABASE_SECRET_KEY`, `FIGMA_CLIENT_SECRET`, and `SESSION_SECRET` in the platform secret manager. Never inject them as public build arguments. Use at least 32 random bytes for `SESSION_SECRET`; rotating it invalidates encrypted OAuth state that is currently in flight.

## Database and initial administrator

For a new environment, change the seed administrator email before applying `supabase/seed.sql`. For an existing environment, create the first allowlist entry directly in Supabase with role `admin`; it binds to the matching Figma email on first login.

Back up Postgres and the private Storage bucket together. Asset metadata and stored images are only consistent as a pair.

## Figma plugin

Build the plugin against the production service:

```bash
CONTENT_LIBRARY_URL=https://library.example.com npm run build --workspace=@content-library/figma-plugin
```

Replace the example production domain in `apps/figma-plugin/manifest.json` with the same origin before distribution. Import that manifest in Figma Desktop. The plugin bundle contains only the public application origin; OAuth, Supabase, and session secrets remain server-side.

## Release checks

Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. After deployment, verify health, web OAuth, allowlist rejection, plugin code exchange, one upload, approval, signed download, and session revocation. Do not expose Supabase Storage paths through a public bucket or permanent URL.
