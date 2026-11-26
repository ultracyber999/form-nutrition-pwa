# Vercel private deployment preparation

Status: prepared only. Nothing has been published, provisioned or uploaded.

## What is configured

`vercel.json` at the repository root configures:

- pnpm monorepo install with `corepack pnpm install --frozen-lockfile`.
- production build with `corepack pnpm --filter @form/web build`.
- static output from `apps/web/dist`.
- SPA fallback rewrites to `/index.html` while preserving static assets.
- security headers equivalent to the local production server: CSP, nosniff, no-referrer, restrictive permissions policy, COOP/CORP and HSTS.
- `no-cache` for HTML/application shell routes, `no-store` for `sw.js`, immutable caching for content-hashed `/assets/*` files and short caching for icons.
- no backend, database, analytics, external data transmission, environment variables or secrets.

Vercel terminates HTTPS. The application remains local-first: IndexedDB and service-worker data stay in the visitor's browser origin.

## Owner deployment procedure

Use one stable HTTPS origin before installing on iPhone; IndexedDB, service-worker registration and installed-PWA storage are origin-bound.

1. Push this repository to a private Git repository or use the Vercel CLI from a trusted machine. Do not make the source public merely for deployment.
2. Create/import the Vercel project privately. Keep the root directory as the monorepo root; `vercel.json` supplies install/build/output settings.
3. Choose the final stable hostname before device acceptance. Prefer a custom domain you control; a project `vercel.app` hostname is technically stable but still binds all local data to that exact origin.
4. Enable the strongest available Vercel deployment protection for a private beta: Vercel Authentication, password protection or equivalent workspace access control. Document any protection-bypass token nowhere in the repository.
5. Deploy. Verify response headers and cache behavior on `/`, `/today`, `/sw.js`, `/manifest.webmanifest`, one `/assets/*` file and one unknown SPA route.
6. Run the synthetic golden slice online: create/keep plan, add 180 g cooked chicken, verify 297 kcal and 55.8 g protein, reload, export, delete/re-import or restore in a separate browser profile, and verify identical totals.
7. Verify service-worker install, airplane-mode/offline relaunch, an update deployment, and rollback at the same origin using `docs/runbooks/private-device-preview.md` and `docs/runbooks/rollback.md`.
8. Only then install on the physical iPhone and execute the owner acceptance checklist.

## Deployment regressions that must remain true

- `/sw.js` must never be immutable-cached; otherwise updates can become stuck.
- `/index.html`, `/` and SPA routes must not be immutable-cached.
- `/assets/*` files are content-hashed and may be immutable.
- `connect-src 'self'` intentionally prevents external transmission. Do not weaken it for analytics or cloud sync in P0.
- Do not add environment variables, serverless functions, a database, external food providers, real health records or analytics for this private P0 deployment.
