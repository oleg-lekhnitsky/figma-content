# Content Library

A private, image-first content library whose source of truth is Supabase. A Nuxt server owns authentication, authorization, metadata, and signed storage access; a Figma plugin exports selected frames and uploads them through that server.

## Repository structure

```text
figma-library/
├── apps/
│   ├── web/                 # Nuxt 3/4-compatible web UI and server API
│   └── figma-plugin/        # Figma controller and iframe UI (Phase 4)
├── packages/
│   └── shared/              # Roles, permissions, Zod schemas, API types
├── supabase/
│   ├── migrations/          # Postgres schema and private bucket
│   ├── config.toml
│   └── seed.sql
├── .env.example
└── package.json             # npm workspaces (retains the existing package manager)
```

The final application adds web pages and server endpoints under `apps/web`, the plugin manifest/controller/UI under `apps/figma-plugin`, and tests beside the code they cover. The database includes an `organization_id` boundary now so every protected query can be tenant-scoped.

## Architecture

The browser and plugin call only the Nuxt API. Nuxt validates input with the shared Zod schemas, resolves the application session, checks the allowlisted user and role, scopes queries to their organization, and accesses Supabase with server-only credentials. Supabase Storage's `assets` bucket is private; authorized downloads use short-lived signed URLs. Figma files hold only an asset ID in plugin data and are never treated as the database.

Session and plugin authorization tokens are random application credentials. Only hashes are persisted. OAuth state and plugin exchange codes are short-lived and single-use. The initial migration enables RLS on every application table and deliberately grants no anonymous policies; server authorization remains mandatory even when controls are hidden in the UI.

## Authentication flow

1. The plugin asks the Nuxt server to start a plugin Figma OAuth flow.
2. Nuxt creates a hashed, expiring OAuth state plus PKCE verifier and redirects the browser to Figma with the minimum identity scope.
3. Figma redirects to the Nuxt callback. Nuxt atomically consumes and validates state, exchanges the code server-side, and calls Figma `/v1/me`.
4. Nuxt matches an active allowlist record by Figma user ID. Only an unbound invitation may fall back to normalized email; a successful first match permanently binds its Figma user ID. Display names are never authorization keys.
5. Nuxt creates a short-lived, single-use plugin code and sends the browser to the configured plugin success page. The Figma access token is not used as an app session.
6. The plugin exchanges that code once for an application-scoped session token. Only its hash is stored. Every protected endpoint rechecks session expiry/revocation, active membership, role, and organization.

Web login follows the same identity and allowlist checks but finishes with a Secure, HttpOnly, SameSite cookie. Rejected users see only the access-denied message and never the allowlist.

## Environment

Copy `.env.example` to `.env`. Required variables are:

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NUXT_PUBLIC_APP_URL` | Public | Canonical browser origin |
| `SUPABASE_URL` | Server | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Server | Low-privilege project key (reserved for later browser use) |
| `SUPABASE_SECRET_KEY` | Server secret | Database, private storage, signed URLs |
| `FIGMA_CLIENT_ID` | Server | OAuth application identifier |
| `FIGMA_CLIENT_SECRET` | Server secret | OAuth code exchange |
| `FIGMA_REDIRECT_URI` | Server | Exact registered callback URL |
| `SESSION_SECRET` | Server secret | At least 32 random bytes |
| `PLUGIN_CALLBACK_URL` | Server | Plugin authentication completion page |
| `SESSION_TTL_SECONDS` | Server | Application session lifetime, default `2592000` (30 days) |
| `MAX_UPLOAD_BYTES` | Server | Upload limit, default `104857600` |

Never prefix a secret with `NUXT_PUBLIC_`. Production values belong in the deployment platform's secret store.

## Local setup

Requirements: Node 20+, npm 10+, Supabase CLI, and Docker for local Supabase.

```bash
npm install
cp .env.example .env
supabase start
supabase db reset
npm run dev
```

Before `supabase db reset`, replace `admin@example.com` in `supabase/seed.sql` with the initial administrator's Figma account email. This invitation binds to their Figma user ID after the first verified login. Configure the same redirect URI in the Figma OAuth app; secrets remain in the Nuxt server environment.

## Quality commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Production container, secret configuration, migration, backup, health-check, and release instructions are documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

Phases 1 and 2 provide the schema, shared contracts, real OAuth endpoints, application sessions, and server authorization helpers. Asset APIs/pages and the functioning plugin are implemented in subsequent phases; mock authentication is not used.

## Phase 2 authentication endpoints

- `GET /api/auth/figma/start?flow=web|plugin` starts Figma OAuth with state and PKCE.
- `GET /api/auth/figma/callback` consumes state, exchanges the short-lived Figma code, verifies `/v1/me`, and checks the allowlist.
- `GET /api/auth/session` returns the current sanitized web-session identity.
- `POST /api/auth/logout` revokes the current session and requires a same-origin request.
- `POST /api/plugin/auth/exchange` atomically exchanges a one-time code for an application token.
- `GET /api/plugin/session` validates an application token sent as `Authorization: Bearer …`.

Create and publish a Figma OAuth app at `figma.com/developers/apps`, register `FIGMA_REDIRECT_URI` exactly, and enable only `current_user:read`. OAuth testing needs a reachable HTTPS callback; use a trusted development tunnel when Figma cannot reach localhost. The in-memory login rate limiter is suitable for one MVP server instance; use a shared store before horizontally scaling.

## Phase 3 assets

Authenticated users can browse `/library` and open `/assets/:id`. The API stores originals and generated WebP thumbnails in the private `assets` bucket, returns only short-lived signed URLs, validates MIME type against decoded image contents, enforces the configured byte limit, and scopes all records and storage paths to the session organization. Contributors can upload drafts through `POST /api/assets`; editor/admin status controls arrive with the Phase 5 workflow.

## Phase 5 workflow and administration

Asset details expose server-enforced actions based on the signed-in role. Contributors may edit or archive their own uploads, editors may manage and approve every asset, and admins may permanently delete assets. Selecting a previously uploaded Figma node now defaults to **Upload new version**; every replacement gets an immutable storage path and `asset_versions` record, increments the current version, and returns the asset to draft for review.

Admins can manage the allowlist at `/admin/users`, change roles, enable or disable access, and revoke active sessions. `/admin/audit-log` records login, upload, edit, approval, archive, deletion, invitations, role/access changes, and session revocation. All queries remain scoped to the administrator's organization.

## Figma plugin development

1. Replace `REPLACE_WITH_FIGMA_PLUGIN_ID` in `apps/figma-plugin/manifest.json` with the ID Figma assigns when you create a development plugin.
2. For local development, run the web app with `npm run dev` and build the plugin with `CONTENT_LIBRARY_URL=http://localhost:3000 npm run build --workspace=@content-library/figma-plugin`.
3. In the Figma desktop app, choose **Plugins → Development → Import plugin from manifest…** and select `apps/figma-plugin/manifest.json`.
4. Run **Content Library** from the Development menu, select one or more frames, and authenticate. The browser provides a one-minute code to paste back into the plugin.

For production, set `CONTENT_LIBRARY_URL` to the deployed HTTPS origin before building and replace `https://library.example.com` in the manifest's `allowedDomains` with that exact origin. Keep localhost only in `devAllowedDomains`. The build creates a single-file `dist/index.html` iframe and `dist/code.js` sandbox controller; neither contains OAuth, Supabase, or application session secrets.
