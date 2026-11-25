# FORM P0 release-candidate hardening report

Date: 2026-11-26  
Hardening commits: `3d5e3be`, `4d0d873`, `c575fad`, `0bfe956`; clean-checkout validation commit: `c575fad`.

## Status legend

PASS / FAIL / BLOCKED / NOT RUN / NOT APPLICABLE are explicit. This is self-verification plus one testing-agent pass, not independent third-party certification.

| Gate | Status | Evidence |
|---|---|---|
| P0 requirements mapped | PASS | `docs/traceability.csv`, M0–M3 evidence |
| Critical branch coverage ≥90% | PASS | analytics 94.54, coach 94.89, dates 95.65, nutrition 90.14, plan 91.3 |
| Coaching safety paths | PASS locally | 13 deterministic coach tests include paused/symptom safety, hunger/energy recovery, sparse logs, calibration reset, plateau, fast loss, goal achievement, fingerprint stability |
| Historical data integrity | PASS locally | immutable snapshots and effective-dated plan tests; vertical slice and mutation tests |
| Backup/migration/recovery | PASS locally | corrupt import, duplicate legacy import, completion undo, export/reopen/restore tests |
| Chromium validation | PASS | production preview E2E smoke, offline navigation, zero axe violations on six routes |
| WebKit engine validation | PASS with platform caveat | Playwright WebKit/WPE launched after userland dependency provisioning. Golden slice, completion invalidation, check-in save, service-worker-controlled real-offline shell/write/reload, axe on six routes and 390px overflow checks PASS. This is WebKit-engine validation on Linux, **not** Safari or iOS Simulator certification; `pointer:coarse` remains false in the harness |
| Visual matrix | PASS with platform caveat | 48 exact-pixel WebKit/WPE screenshots at 320/390/768/1440 dark/light in `webkit-visual-matrix/`; contact sheets in `webkit-contact-sheets/` manually inspected. These are exact viewport-pixel WebKit captures, but WPE on Linux is not physical iPhone Safari and does not emulate coarse-pointer/safe-area behavior |
| Automated accessibility | PASS | axe WCAG 2A/2AA/21AA/22AA: 0 violations on Today, Nutrition, Check-in, Progress, Coach, Settings in both Chromium evidence and the WebKit validation run |
| Manual/assistive accessibility | PARTIAL | keyboard smoke PASS: 18 tab stops per six core routes remained visible; dialog focus trap and Escape close PASS. Screen reader, full zoom/reflow and exhaustive manual matrix remain NOT RUN |
| Performance realistic scale | PASS | 9,855 entries / 365 days: bulk write 216ms, read 68.2ms, analytics 0.7ms, export 29.9ms |
| Offline startup | PASS | production Chromium CDP offline navigation to `/progress` returned 200 and rendered app |
| Offline CRUD | PASS | scripted production-browser test: offline manual food write rendered immediately and persisted after offline reload |
| Service-worker update lifecycle | PARTIAL | network-first navigation and versioned asset caching implemented; upgrade/stale-cache matrix not exhaustively tested |
| Reproducible clean build | PASS | fresh `git clone` + `pnpm install --frozen-lockfile` + `pnpm run ci` exited 0 |
| Production dependency audit | PASS | `pnpm audit --prod`: no known vulnerabilities |
| Physical iPhone acceptance | NOT RUN | no physical device available; checklist below |
| Deployment security headers | BLOCKED | no authorized production host. Meta CSP present; server-header verification requires deployment authorization |

## Severity-ranked defect register

| Severity | Finding | Resolution |
|---|---|---|
| Critical | React Router production vulnerabilities in baseline | Fixed by upgrade to 7.18.7; prod audit passes |
| High | Workspace `pnpm test` failed because web package had no tests | Fixed with web utility tests |
| High | Domain critical branch coverage below 90% | Fixed with behavioral hardening tests; threshold now met per module |
| Medium | Weight/protein tile precision rounded 89.5kg to 90kg | Fixed with explicit decimal display and regression utility coverage |
| Medium | 320px date navigator flex overflow | Fixed input shrink/max-width; matrix recaptured |
| Medium | Mobile meal-row/grid min-content width caused horizontal overflow and clipped controls in narrow WebKit viewports | Fixed with `minmax(0, 1fr)` shell tracks, mobile single-column meal rows and wrapping row actions; WebKit 390px scrollWidth now exactly 390 and 320px screenshots show both date arrows |
| Medium | Desktop RTL sidebar rendered on the left although the design contract requires a right sidebar | Fixed desktop grid order/template; WebKit 1440px contact sheets show the sidebar on the right |
| Low | Nutrient progress-bar accessible names could be confused with manual nutrient inputs | Progress bars now use explicit `סיכום …` accessible names while input labels remain field-specific |
| Medium | Recipe workflow absent in first implementation | Implemented basic creation from gram-based diary rows with explicit final yield |
| Low | Chromium 320px screenshot exactness limited by headless scrollbar emulation | Superseded by exact-pixel WebKit/WPE matrix for layout inspection; physical browser inspection still required |

## Coverage report

From `pnpm --filter @form/domain test` after hardening:

| Module | Branch | Statements | Functions |
|---|---:|---:|---:|
| analytics.ts | 94.54% | 100% | 100% |
| coach.ts | 94.89% | 98.13% | 83.33% |
| dates.ts | 95.65% | 100% | 100% |
| nutrition.ts | 90.14% | 100% | 100% |
| plan.ts | 91.3% | 96.42% | 100% |

The blueprint requirement is branch coverage; all critical calculation/policy modules pass. Coach function coverage is below 90 but branch coverage passes; `entryEnergySnapshot` remains the main uncovered small helper.

## Performance benchmark

Automated IndexedDB/fake-indexeddb smoke, synthetic data only: 365 days × 27 entries/day = 9,855 entries. Results: bulk write 216.0ms, full repository read 68.2ms, analytics scan 0.7ms, full export 29.9ms. Production bundle: 572.34kB uncompressed JS / 174.26kB gzip, CSS 18.8kB / 4.88kB gzip. Bundle size is acceptable for local P0 but should be revisited before broader release.

## Security and data recovery

- No secrets, real personal data, external API endpoints, cookies, `eval`, `new Function`, direct `innerHTML`, or `dangerouslySetInnerHTML` found in the reviewed client source.
- Only theme preference uses localStorage; diary data uses IndexedDB.
- CSP meta is restrictive for scripts/objects/network but necessarily allows inline styles because React inline style attributes are in use.
- JSON imports are schema-validated, size-limited, dry-runnable, transactional and produce a pre-import backup. Legacy migration uses deterministic IDs to avoid duplicate imports.
- CSV formula-like cells are escaped.
- Server security headers remain NOT RUN/BLOCKED until an authorized host exists.

## WebKit/WPE validation — PASS with platform caveat

`node scripts/validate-webkit.mjs` validates the production build in Playwright WebKit/WPE. Latest results are machine-readable in `webkit-validation-results.json`:

- 180 g cooked chicken golden case: PASS (`297` kcal and `55.8` g protein rendered).
- Complete-day confirmation and mutation invalidation: PASS.
- Check-in save: PASS.
- Service worker API/controller/cache present online: PASS.
- Real offline test method: the script warms the cache, terminates the preview server, reloads, writes a manual food entry offline, reloads again and verifies persistence: PASS.
- axe WCAG scans on six routes: 0 violations.
- 390px layout: `innerWidth` 390, `scrollWidth` 390, no measured horizontal overflow after responsive fixes.
- Exact-pixel matrix: 48 screenshots covering six routes × 320/390/768/1440 × dark/light.

Important limitation: this is WebKit/WPE on Linux, not Safari, macOS, iOS Simulator, or a physical iPhone. The harness reports `pointer:coarse=false`, so touch/safe-area/inertial scrolling behavior remains unverified.

## Physical iPhone acceptance checklist — NOT RUN

1. Open the authorized local/HTTPS URL in Safari on a physical iPhone.
2. Add to Home Screen; confirm icon, title, splash/background and standalone launch.
3. Rotate/zoom and inspect safe areas, bottom navigation, touch targets and keyboard behavior at 320/390-class widths.
4. Create/edit/delete food offline after airplane-mode restart; reload and verify persistence.
5. Complete a day, mutate food, verify invalidation; undo deletion.
6. Save check-in measurements/habits; verify decimal precision.
7. Export JSON/CSV and confirm files are downloadable/shareable.
8. Upgrade the installed PWA without losing local data.
9. VoiceOver pass: navigation, dialogs, form labels, charts/table alternatives, announcements.
10. Verify reduced motion, contrast, dynamic type, scrolling and no horizontal overflow.
11. Restore a backup and verify identical totals.
12. Record exact device, iOS version, browser mode, failures and screenshots before release approval.

## Reproducible local validation

```bash
git clone <authorized-repo-or-bundle> form
cd form
export PATH="$HOME/.nvm/versions/node/v24.22.2/bin:$PATH"
pnpm install --frozen-lockfile
pnpm run ci
pnpm audit --prod
pnpm --filter @form/web build
pnpm --filter @form/web preview --port 4173
```

Visual matrix regeneration requires a populated synthetic backup and running preview:

```bash
FORM_IMPORT_FILE=/path/to/synthetic-backup.json node scripts/capture-visual-matrix.mjs
```

WebKit engine validation is self-contained and starts its own production preview:

```bash
pnpm --filter @form/web build
node scripts/validate-webkit.mjs
```

The script writes `docs/evidence/webkit-validation-results.json` and 48 screenshots. It requires Playwright WebKit host dependencies. On this Ubuntu VM they were provisioned without sudo by downloading/extracting the missing Jammy libraries into the Playwright WebKit cache; on a clean machine use the normal Playwright dependency installation path or an appropriately provisioned macOS/Linux host. This environment setup is not an application runtime dependency.

## Remaining release decision

Local engineering hardening is substantially improved, and WebKit-engine functional/offline/visual smoke now passes. Production acceptance remains **NO-GO** because physical iPhone/Safari, iOS Simulator or macOS Safari validation, full manual assistive-technology/zoom validation, exhaustive service-worker upgrade testing and deployment-header verification remain open. A macOS child session was attempted for the remaining platform validation but could not start because the organization quota returned `out_of_quota`.
