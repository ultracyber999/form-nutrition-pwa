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
| WebKit validation | NOT RUN | WebKit browser downloaded, but launch BLOCKED because the VM lacks required system libraries (`libgtk-4`, `libgraphene`, `libwoff2`, GStreamer/libavif dependencies) and no sudo authorization is available |
| Visual matrix | PASS with caveat | 48 CDP screenshot files at 320/390/768/1440 dark/light in `visual-matrix/`; manual contact-sheet inspection completed. Caveat: scrollable 320px Chromium pages laid out at 327 CSS px because headless Chromium subtracts scrollbar width despite mobile emulation, so the 320 captures are close visual evidence but not a certified exact mobile layout |
| Automated accessibility | PASS | axe WCAG 2A/2AA/22AA: 0 violations on Today, Nutrition, Check-in, Progress, Coach, Settings |
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
| Medium | Recipe workflow absent in first implementation | Implemented basic creation from gram-based diary rows with explicit final yield |
| Low | 320px screenshot exactness limited by Chromium scrollbar emulation | Documented; physical browser inspection still required |

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

## Remaining release decision

Local engineering hardening is substantially improved, but production acceptance remains **NO-GO** because physical iPhone, full manual assistive-technology validation, WebKit, exhaustive service-worker upgrade testing and deployment-header verification remain open.
