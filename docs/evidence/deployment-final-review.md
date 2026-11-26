# RC4 corrective deployment preparation — final review evidence

Frozen corrective baseline: `a1c4843e6e53c0d4f62ad57d35e4db2c7061b837` (`a1c4843`).  
Deployment implementation commit: `e5b4f2be9ba54c44e0e43f8b2a0df67258b72d4b` (`e5b4f2b`).  
Exact validated production service-worker build: `form-shell-build-a495fd989d1f`.

## Narrow final-review findings

### Concerning-symptoms workflow

- Verification result: confirmed defect in the frozen corrective candidate. `concerningSymptoms` existed in the deterministic coach safety contract and domain tests, but no application workflow allowed a user to record it; the Coach screen never supplied it.
- Minimal correction: added an optional backwards-compatible `concerningSymptoms` flag to daily check-ins, a clearly labeled check-in control with urgent-care guidance, and Coach wiring for the current day's saved check-in. Older exports/check-ins remain schema-valid because the field is optional.
- Regression evidence: contracts test covers old rows without the flag; production-browser validation checks the real checkbox/save/Coach workflow and PASSes (`deployment-targeted-validation-results.json`).

### Midnight rollover while continuously open

- Verification result: confirmed defect. Rendering-time date calculation removed stale module constants, but React state did not inherently rerender at midnight; Today also copied the initial today into component state.
- Minimal correction: application context now observes the configured-timezone date every 30 seconds and immediately on focus/visibility resume, changing context only when the calendar date changes. Today treats the default date as “current today” unless the user explicitly selected another date.
- Regression evidence: production-browser Playwright clock validation crossed 2026-11-25 23:59:20 Asia/Jerusalem to 2026-11-26 using `fastForward`, whose semantics explicitly model laptop close/reopen; PASS. Focus/visibility resume listeners are installed.

### Pre-import backup restoration

- Verification result: no additional defect found. The visible Settings restore control did execute `importBundle` with the durable local pre-import backup and refresh application state.
- Regression evidence strengthened: production-browser end-to-end validation inserted a sentinel food entry, performed the real file-picker replace-all import, verified the entry count dropped to zero while backup retained one entry, clicked “שחזור גיבוי זה”, and verified the sentinel entry count returned to one with a visible restore notice. PASS.
- Remaining architectural limitation: the internal recovery snapshot remains in IndexedDB and is subject to browser storage eviction/quota behavior. External exported backups remain essential; this is documented and is not a reason to add cloud storage.

## Deployment validation summary

- Full `pnpm run ci`: PASS — lint, strict typecheck, 57 tests, coverage thresholds and production build.
- Production dependency audit: PASS, no known vulnerabilities.
- Targeted final-review browser validation: 3/3 PASS.
- Vercel static deployment configuration validation: 6/6 PASS (`deployment-config-validation-results.json`).
- WebKit/WPE golden slice, completion invalidation, check-in save and offline write/reload: PASS at exact build `form-shell-build-a495fd989d1f`; still not Safari/physical iPhone.
- Chromium durability: install, offline CRUD/persistence, upgrade transition, stale-shell behavior, concurrent access, backup/restore, interrupted restart, failed-update recovery and rollback compatibility PASS; quota failure remains BLOCKED; future schema migration NOT APPLICABLE.
- Accessibility executable regression: PASS; axe 0 violations on six core routes; screen reader remains NOT RUN on Linux.

## Deployment artifacts

- `vercel.json` configures the pnpm monorepo/Vite static build, SPA fallback, security headers and cache policy.
- `docs/deployment/vercel-private.md` documents the private stable-origin deployment procedure.
- `docs/deployment/chatgpt-sites-assessment.md` documents Sites compatibility uncertainty, unsupported/unverified capabilities and synthetic-only boundary.
- `docs/deployment/physical-iphone-acceptance.md` is the owner acceptance checklist.

No deployment was published, no paid resource was provisioned, no backend/database/analytics/external transmission was added, and no real health records were used.
