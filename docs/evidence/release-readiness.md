# FORM release-readiness report — RC4 corrective authoritative

Date: 2026-11-26  
Corrective implementation commit: `a1c4843e6e53c0d4f62ad57d35e4db2c7061b837` (`a1c4843`)  
Baseline implementation/evidence: `4f0d0c6` / `c3f0758`  
Authoritative status: this file supersedes conflicting stale readiness claims. Older RC2/RC3/RC4-visual sections remain archival evidence only; the corrective-patch addendum is the current gate summary.

## Verdict

**PRIVATE-BETA ENGINEERING CANDIDATE: GO for owner-controlled local/private-device acceptance preparation.**  
**UNRESTRICTED PRODUCTION RELEASE: NO-GO.**  
**PHYSICAL DEVICE ACCEPTANCE: NOT RUN.**

This distinction is deliberate. The locally actionable engineering gates are now strongly evidenced, including real-browser durability, real-browser scale benchmarks, accessibility automation, security headers, production build reproducibility, and visual regression evidence. FORM must not be claimed as physically accepted, independently certified, or production-deployed until the owner-dependent checks below are completed.

## Exact validation environment

- OS: Ubuntu 22.04 Linux VM, headless browser automation.
- Node: `v24.22.2`; pnpm: `12.16.1`.
- Chromium: local `/home/ubuntu/.local/bin/google-chrome`, production static server, real browser IndexedDB persistent profiles.
- WebKit: Playwright WebKit/WPE 26.0 on Linux. This is WebKit-engine validation only, **not** Safari, iOS Simulator, or physical iPhone; `pointer: coarse` was false in RC2 WebKit validation.
- No cloud service, public deployment, external food provider, health-data access, paid infrastructure, secrets, or real personal data used.
- Independent child-session verification was unavailable because organization child-session creation returned `out_of_quota`; final review therefore used reproducible local validation passes, browser automation, and clean-clone verification rather than claiming independent certification.

## Release-gate matrix

| Gate | Status | Exact evidence, command/artifact, and limitation |
|---|---|---|
| Frozen dependency install | PASS | Clean local clone of `630b983`: `pnpm install --frozen-lockfile && pnpm run ci` exit 0. |
| Lint | PASS | `pnpm run ci` → `eslint .` exit 0 at `630b983`. |
| Strict TypeScript | PASS | `pnpm run ci` → recursive `tsc --noEmit` exit 0 at `630b983`. |
| Unit/property/integration tests | PASS | `pnpm run ci`: 49 tests passed across design/contracts/test-data/domain/data/web at `630b983`. |
| Critical branch coverage | PASS | Domain v8 coverage: statements 97.92%, branches 92.96%; analytics branches 94.54%, coach 94.89%, dates 95.65%, nutrition 90.0%, plan 91.3%. |
| Production build | PASS | `pnpm run ci` → Vite production build exit 0; bundle gzip: JS 174.86 kB, CSS 4.93 kB; service-worker cache `form-shell-build-e170cfdd3030`. |
| Production dependency audit | PASS | `pnpm audit --prod` exit 0: no known vulnerabilities. |
| Golden vertical slice | PASS | RC2 WebKit validation: 180 g cooked chicken → 297 kcal and 55.8 g protein, persistence/export/restore/completion invalidation; `webkit-validation-results.json`. RC3 browser benchmark revalidated create/edit/query at scale but did not repeat the exact screenshot-oriented golden slice. |
| Chromium/WebKit production scale benchmark | PASS with limitations | `docs/evidence/browser-performance-results.json`; 365 days, 9,855 entries, real browser IndexedDB persistent profiles. Chromium cold 851.6ms, warm median 784.9ms; WebKit/WPE cold 879.2ms, warm median 764.8ms. Import replace-all: Chromium 1,749.9ms, WebKit/WPE 3,703ms. Navigation includes network-idle plus fixed 250ms settle; not pure navigation timing. |
| Service-worker install/offline persistence | PASS | `docs/evidence/durability-validation-results.json`; install/controller/cache PASS and offline render/write/reload PASS in Chromium real IndexedDB. |
| Upgrade/cache activation transition | PASS | Same artifact: content-hashed cache transition `form-shell-build-e170cfdd3030` → `form-shell-build-upgradev2`; old cache removed; logical equivalence true. |
| Stale cached shell/update behavior | PASS | Same artifact: stale cached shell does not override update. |
| Failed update installation recovery | PASS | Same artifact: broken service-worker deployment did not delete prior working cache/data. |
| Concurrent tab data access | PASS | Same artifact: concurrent tab logical snapshot equivalence. |
| Interrupted browser restart persistence | PASS | Same artifact. |
| Backup/restore before/after upgrade | PASS | Same artifact; export/import logical equivalence and entries retained. |
| Application rollback/schema compatibility | PASS at schema v1 | Same artifact; rollback to v1 build retained IndexedDB version 10 / Dexie schema v1. |
| Database schema migrations beyond v1 | NOT APPLICABLE | No production v2 schema exists. Legacy import migration and failed-import rollback remain covered in repository tests. Do not claim untested future migration compatibility. |
| Storage quota failure | BLOCKED | No deterministic supported browser automation for quota failure on this VM. Visible recovery/backup guidance is implemented, but quota behavior is not claimed tested. |
| Offline UX communication | PASS | `ux-workflow-results.json`: offline status communication PASS. |
| UX workflow efficiency | MEASURED / PASS for automation | `ux-workflow-results.json`: morning weight 3 interactions/0.29s machine lower bound; recent food 3/0.29s; unfamiliar manual food 6/0.56s; full check-in 9/0.22s. These are not human completion-time claims. |
| Quick-add ergonomics refinement | PASS | Recent prioritization/preselection PASS; small-screen scrolling fix verified in UX and benchmark scripts. |
| Visual matrix | PASS with self-review limitation | Final 48 exact-width screenshots at 320/390/768/1440 dark/light in `visual-matrix/`; contact sheet `visual-contact-sheets/rc3-final-contact-sheet.jpg`; inspected without horizontal overflow or obvious clipping. Not a physical-device screenshot matrix. |
| axe accessibility | PASS | `accessibility-validation-results.json`: 0 violations on six core routes in production Chromium. |
| Keyboard/focus interaction | PASS | Same artifact: dialog initial focus, focus trap, Escape restoration, 30/30 visible keyboard stops. |
| Target size / reflow / zoom approximations | PASS with limitations | Same artifact: checked target sizes PASS, exact 320 CSS px reflow PASS, browser-approximated 200% text/zoom PASS. Not physical OS dynamic type. |
| Reduced motion | PASS | Same artifact: computed duration `1e-05s`. |
| Screen reader / VoiceOver | NOT RUN | No supported screen reader on Linux VM. Do not infer screen-reader compatibility from axe. Physical VoiceOver acceptance remains owner-dependent. |
| Security headers/static deployment config | PASS locally | `scripts/serve-production.mjs`; curl-verified CSP, nosniff, no-referrer, restrictive permissions policy, COOP/CORP, HSTS guidance, no-cache shell/SW/manifest and immutable hashed assets. HTTPS termination itself not performed locally. |
| Private-device preview preparation | PREPARED / NOT RUN on device | `docs/runbooks/private-device-preview.md` contains trusted HTTPS/stable-origin/iPhone workflow. No certificate provisioned and no physical device test performed. |
| Public production deployment | NOT APPLICABLE / NOT PERFORMED | Explicitly unauthorized and not done. |

## Performance interpretation

Real-browser scale results are strong enough for local engineering readiness: sub-second cold/warm workflow proxy loads at 9,855 entries, repository search/create/edit/query in milliseconds, and no observed long tasks in either browser engine. Full export/import is necessarily heavier because it serializes and validates the complete logical dataset: approximately 1.75s in Chromium and 3.70s in Linux WebKit/WPE for a 5.15MB export. This is evidence, not a guarantee of low-end physical iPhone performance.

## Defects and recovery posture

The RC3 defect register is `docs/evidence/defect-register-rc3.md`. Fixed defects include quick-add small-screen operability, recent-food prioritization/preselection, check-in reachability, offline-status communication, visible storage recovery guidance, static service-worker cache names, unsupported permissions-policy token, and two harness false failures. Open owner-dependent items are physical device acceptance and storage-quota verification.

## Owner-dependent acceptance actions

1. Create a stable trusted HTTPS origin on a private network/host; do not use a changing hostname/port because IndexedDB and installed-PWA storage are origin-bound.
2. Serve the final `form-production-dist.tar.gz` behind that HTTPS origin with the documented headers/cache policy.
3. On the physical iPhone, trust the private certificate if required, open the exact origin in Safari, and Add to Home Screen.
4. Execute the runbook first-launch/offline/relaunch checks using synthetic data.
5. Export a backup before upgrade; deploy a changed build to the same origin; verify upgrade activation, data retention, and rollback using the runbook.
6. Manually verify VoiceOver order/names, dynamic type/200% zoom, reduced motion, contrast in real lighting, touch target ergonomics, one-handed use, Hebrew/mixed-number reading, and safe-area behavior.
7. Manually test browser storage/quota recovery or accept that risk explicitly; never clear site data before validating a backup restore.
8. Only after those checks decide whether private daily use is accepted. Unrestricted production remains NO-GO without separate release authorization and review.

## Remaining deferred scope

M4+, cloud sync/auth, external food providers, barcode scanning, native integrations, health-data import, notifications, AI features, SaaS features, public deployment, and real personal-data migration remain deferred and intentionally hidden/inactive in P0.

## RC4 visual-polish addendum — 2026-11-26

RC4 performed a focused visual/product-design refinement without architectural rewrite, feature expansion, new dependencies, persistence changes, cloud scope, or deployment. Detailed evidence and exact validation results are in `docs/evidence/visual-polish-rc4.md`.

Post-polish local automated gates that were rerun: full `pnpm run ci` PASS (lint, strict typecheck, tests, production build); production visual matrix capture PASS (48 exact-width screenshots); realistic-state capture PASS; axe PASS with 0 violations on six core routes; dialog focus/keyboard/target/reflow/zoom/reduced-motion automated checks PASS subject to documented emulation limitations; UX workflow timing smoke PASS/MEASURED. Screen reader and physical iPhone acceptance remain NOT RUN and owner-dependent. A clean clone restored from the RC4 source bundle completed frozen installation and full CI with exit 0. This addendum does not convert the prior physical-device NO-GO into device acceptance.


## RC4 corrective-patch addendum — 2026-11-26

Corrective implementation commit: `a1c4843e6e53c0d4f62ad57d35e4db2c7061b837` (`a1c4843`). Baseline implementation was `4f0d0c6`; baseline evidence/source HEAD was `c3f0758`.

The independent-audit findings F01–F09 were reproduced or explicitly scoped as documented in `docs/evidence/defect-resolution-rc4-corrective.md`. The patch preserved the RC4 architecture, visual design, feature scope, dependency graph and deferred milestones. It corrected coaching safety integration, historical plan revision control, runtime write validation, atomic check-in persistence, unknown-calorie semantics, calendar-accurate chart geometry, configured-timezone propagation, durable pre-import backup retention, navigation response caching and install-time compiled-asset precaching.

Corrective local automated gates at the exact production service-worker build `form-shell-build-707cb94dc352`: full `pnpm run ci` PASS (lint, strict typecheck, 56 tests, coverage thresholds, production build); domain branches 92.41% overall with coach 93.33%, nutrition 90%, plan 91.3%, analytics 94.54%, dates 95.65%; production dependency audit PASS; corrective Chromium application validation 9/9 PASS; durability validation PASS except quota BLOCKED and future-schema NOT APPLICABLE; WebKit/WPE golden slice and offline write/reload PASS; automated accessibility regression PASS except screen reader NOT RUN. Exact evidence files are `corrective-validation-results.json`, `durability-validation-results.json`, `webkit-validation-results.json` and `accessibility-corrective-results.json`.

This addendum does not close physical iPhone/Safari acceptance, VoiceOver/manual assistive-technology review, actual trusted HTTPS deployment, or unemulated storage-quota/durability acceptance. They remain owner-dependent open gates. No production approval or independent certification is claimed.
