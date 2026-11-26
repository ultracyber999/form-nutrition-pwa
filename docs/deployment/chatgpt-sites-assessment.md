# ChatGPT Sites compatibility assessment

Assessment date: 2026-11-26. Sources reviewed: OpenAI/ChatGPT Sites overview and data/connections documentation (`https://learn.chatgpt.com/docs/sites`, `https://learn.chatgpt.com/docs/sites/data-and-connections`, and the OpenAI Help Center Sites article).

## Verdict

**Not accepted as a production-compatible runtime for FORM without owner-run platform verification. Potentially useful only for a synthetic-data demonstration.**

FORM's compiled application is a static, self-contained React/Vite SPA with no backend requirement. That makes a first-page render plausible if ChatGPT Sites accepts the compiled artifact and serves `/index.html` for application routes. However, the reviewed public Sites documentation does not conclusively guarantee the runtime behaviors FORM depends on:

| Capability | FORM requirement | Sites evidence/status |
|---|---|---|
| IndexedDB | Required for all local nutrition, plan, measurement, backup and outbox data | Not documented as supported or unsupported; browser API may exist, but platform behavior is unverified |
| Service workers | Required for offline shell, controlled updates and offline persistence | Not documented; registration scope, update lifecycle and cache behavior are unverified |
| SPA routes | Required for `/today`, `/nutrition/:date`, `/check-in/:date`, etc. | Rewrite/fallback behavior for an imported prebuilt SPA is not documented sufficiently to claim support |
| Web manifest/installability | Required for iPhone Add to Home Screen acceptance | Not documented; may depend on Sites hosting/sandbox/frame model |
| Offline operation | Required PWA acceptance gate | Not documented; cannot be claimed |
| Local-first privacy | No server-side transmission | Sites documentation instead emphasizes platform features such as D1/R2 and connected accounts; FORM should not use those for P0 |
| Health-data policy | Synthetic demonstration only | OpenAI Sites documentation says not to process Protected Health Information; real personal nutrition/health data must not be placed there |

## Required owner smoke test if a synthetic demo is attempted

Use only synthetic data. After publishing a private/non-public demo, verify in a fresh browser profile:

1. First load renders Hebrew RTL without console errors.
2. Onboarding completes and reload preserves the profile.
3. 180 g cooked chicken produces 297 kcal and 55.8 g protein after reload.
4. Directly opening `/today`, `/nutrition/<date>` and `/check-in/<date>` does not produce a platform 404.
5. `indexedDB` contains `form-local` after writing and survives reload.
6. `navigator.serviceWorker.controller` becomes non-null, cache storage contains the FORM shell cache, and airplane-mode/offline reload works.
7. The manifest is reachable and the browser/platform exposes install/add-to-home-screen behavior.
8. Export and restore complete using synthetic data only.

If any item fails, do not simplify FORM or move real data to Sites storage. Treat Sites as a demonstrator-only host or do not use it.

## Explicit non-goals

No rebuild, backend conversion, D1/R2 migration, sign-in integration, analytics, real health records or reduced offline behavior is authorized for Sites compatibility. Vercel remains the preferred personal-PWA path.
