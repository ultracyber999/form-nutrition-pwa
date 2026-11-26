# Private-device preview and deployment preparation

FORM P0 is local-only and must be served from one stable HTTPS origin on the owner's trusted network or private host. Do not expose the preview publicly. No real personal data belongs in shared screenshots, CI, logs, or public deployments.

## Reproducible production artifact

```bash
export PATH=/home/ubuntu/.nvm/versions/node/v24.22.2/bin:$PATH
pnpm install --frozen-lockfile
pnpm run ci
node scripts/serve-production.mjs
```

The reference server in `scripts/serve-production.mjs` implements the deployment contract:

- `index.html`, `manifest.webmanifest`, and `sw.js`: `Cache-Control: no-cache` so updates are discovered.
- Hashed `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`.
- SPA fallback only for extensionless GET/HEAD routes.
- CSP: `default-src 'self'`; scripts restricted to same origin; no objects; no framing; form/base URI restricted.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, restrictive permissions policy, COOP/CORP.
- HSTS is emitted as deployment guidance, but browsers ignore it on plain HTTP localhost. Terminating HTTPS remains owner-dependent.

`test-utils.js` is a validation-only helper and must be absent from the final production archive unless explicitly injected for tests.

## Trusted HTTPS/private iPhone workflow (owner-dependent)

1. Choose a stable private hostname/origin, for example `https://form.local` or a private Tailscale/WireGuard host. IndexedDB, service-worker scope, exports, and installed PWA data are origin-bound; changing hostname or port starts a new empty storage origin.
2. Run the static production artifact behind a trusted HTTPS terminator (Caddy, nginx, or a private-network reverse proxy). Use a certificate trusted by the iPhone. A self-signed certificate requires installing and trusting the owner CA on the device; prefer a private CA or Tailscale certificate workflow.
3. Preserve exact headers above. If the proxy compresses responses, do not alter cache ownership or CSP.
4. On the iPhone, open the exact HTTPS origin in Safari, verify no certificate warning, then use Share → Add to Home Screen.
5. First-launch acceptance checks: app opens online; create/save a small synthetic entry; terminate the app/browser; disable connectivity; relaunch from the home-screen icon; verify shell/data; add another synthetic entry offline; restore connectivity and relaunch; verify both entries remain.
6. Upgrade acceptance check: deploy a changed build to the same origin, reload once, close/reopen, verify old records remain and no stale shell/assets are served. Export before upgrades; do not clear website data unless a validated backup has been restored in a separate test.
7. Physical accessibility acceptance remains manual: VoiceOver order/names, 200% text/zoom, reduced motion, contrast in daylight, touch targets, one-handed ergonomics, Hebrew/mixed-number reading.

## Backup and rollback boundary

Before any upgrade, export a JSON backup. Browser storage can be evicted and IndexedDB is not a backup system. P0 schema version is 1; there is no automatic downgrade path from a future schema. If rollback is needed, restore the prior static artifact and the pre-upgrade exported bundle. If migration fails, do not clear storage; preserve the origin profile and use the recovery/export guidance shown in the app.
