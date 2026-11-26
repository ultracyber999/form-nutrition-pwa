# RC4 independent audit corrective patch — defect resolution report

Baseline implementation: `4f0d0c6`; baseline evidence/source HEAD: `c3f0758`.

Corrective implementation commit: `a1c4843e6e53c0d4f62ad57d35e4db2c7061b837` (`a1c4843`). Evidence/source HEAD is the following documentation commit on `main`.

## Validation summary

- Full workspace CI (`pnpm run ci`): PASS — lint, strict typecheck, 56 Vitest tests, coverage thresholds and production build.
- Critical domain coverage after patch: coach 93.33% branches; nutrition 90%; plan 91.3%; analytics 94.54%; dates 95.65%.
- Corrective browser/application validation: 9/9 PASS in Chromium against the exact final production service-worker build `form-shell-build-707cb94dc352` (`docs/evidence/corrective-validation-results.json`).
- Production durability validation: install, offline CRUD/persistence, upgrade activation, stale shell update, concurrent access, backup/restore, interrupted restart, failed-update recovery and rollback compatibility PASS; deterministic quota failure remains BLOCKED; schema migration remains NOT APPLICABLE because the production schema is still version 1 (`docs/evidence/durability-validation-results.json`).
- WebKit/WPE golden slice and offline persistence: PASS at exact final build; this remains Linux WebKit/WPE, not Safari/physical iPhone (`docs/evidence/webkit-validation-results.json`).
- Accessibility regression: axe reported 0 violations on six core routes; dialog/keyboard/target/reduced-motion/text-scaling/zoom/reflow checks PASS; text-and-semantic output is INFO; screen reader remains NOT RUN on this Linux VM (`docs/evidence/accessibility-corrective-results.json`).

## F01 — coaching safety integration

- Reproducibility/severity: valid, high severity. RC4 rendered `reviewCoach` in `apps/web/src/screens/Coach.tsx` without loading the current/paused goal or passing `safety.paused`; therefore a paused user could still receive the “consider small adjustment” branch. The domain also lacked the blueprint's >20% activity-shift gate because evidence windows carried weight/adherence but not step means.
- Root cause: UI integration omitted the existing safety argument; policy evidence omitted activity history needed by the blueprint.
- Smallest correction: load the current goal (including paused), pass `safety: { paused: goal?.status === 'paused' }`, compute per-window mean steps, and force `review-logging-and-context` with reason `major-activity-shift-requires-review` when the latest/prior 7-day step means change by more than 20%.
- Regression: `packages/domain/src/coach.test.ts` covers the major activity-shift branch; `scripts/validate-corrective-rc4.mjs` exercises the real production application workflow for both the active adjustment branch and paused-goal safety override. Both PASS.
- Blueprint cross-check: paused/safety states now short-circuit before reductions; recovery concerns already overrode reductions; insufficient activity context already blocked reductions. Waist remains descriptive only, consistent with the blueprint prose; the pseudocode phrase “waist context reviewed” is not interpreted as inventing a mandatory waist measurement gate.

## F02 — historical plan integrity

- Reproducibility/severity: valid, high severity. `createPlanRevision` accepted arbitrary past `effectiveFrom` values. Although revisions were immutable rows and diary resolution was effective-dated, an ordinary new revision dated into the past would become the active plan for historical days and retrospectively alter evaluation.
- Root cause: temporal validity was only indirectly constrained by UI defaults; the repository had no authoritative guard or audited correction path.
- Smallest correction: repository now computes “today” in the configured profile timezone, rejects ordinary past-effective revisions with `historical-plan-revision`, and requires the explicit repair workflow `createPlanRevision(..., { allowHistoricalCorrection: true })` plus a reason beginning `historical-correction:`. Same-date revisions continue to fail clearly with `duplicate-plan-date`; no existing revision is overwritten.
- Regression: repository tests cover ordinary rejection, explicit correction, reason enforcement and duplicate-date behavior; browser IndexedDB validation confirms `historical-plan-revision` in the production application runtime. PASS.
- Blueprint cross-check: effective-dated immutable plan history is preserved; corrections are explicit/auditable; timezone uses the configured profile timezone.
- Operational documentation: `docs/runbooks/rollback.md` now defines the correction workflow.

## F03 — runtime data validation

- Reproducibility/severity: valid, high severity. Repository writes trusted caller-shaped objects and could persist negative measurements, fractional step counts or otherwise malformed rows despite Zod contracts existing. A paused goal was also omitted from exports because `exportBundle` queried only the active goal.
- Root cause: contract validation was concentrated at import/preview boundaries rather than all repository write paths; export selected the wrong goal row.
- Smallest correction: apply the shared Zod schemas immediately before repository writes for profile, goal, plan, food, entry, measurement, check-in, template, recipe and coach review; validate complete export bundles with `exportBundleSchema`; export the current goal even when paused.
- Regression: repository tests reject negative measurements, fractional steps and negative manual calories without persistence; browser validation confirms fractional steps fail as `invalid-checkin`; existing import/export round-trip suites still PASS.
- Blueprint cross-check: null/unknown semantics and domain invariants are preserved; normal application records can be exported/restored through the same schemas.

## F04 — atomic check-in persistence

- Reproducibility/severity: valid, high severity. The Check-in screen first saved measurements and then saved the daily check-in as separate repository operations. A failure between them could leave a measurement without the complete operation/check-in state, and preferred-demotation writes had no matching outbox update.
- Root cause: the UI composed two independent transactions rather than a domain-level atomic operation.
- Smallest correction: add `saveDailyCheckinBundle`, which writes check-in, associated measurements, preferred-day demotions and all required outbox records in one Dexie transaction; switch the screen to that operation.
- Regression: repository failure injection at outbox write verifies zero check-in and zero measurements remain after interruption; production-browser failure injection using a patched IndexedDB object-store add verifies the real UI flow rolls back completely. PASS.
- Blueprint cross-check: local-first transactional integrity is preserved; outbox rows remain local-only placeholders for the deferred sync milestone and are not fake sync behavior.

## F05 — unknown calorie semantics

- Reproducibility/severity: valid, medium-high severity. The calorie ring computed exact “remaining” from a known subtotal even when consumed entries had unknown calories, potentially understating intake as exact truth.
- Root cause: domain totals exposed unknown counts, but presentation did not propagate them to the ring, macro bars or CSV export.
- Smallest correction: ring and macro bars receive `incomplete` state; visible calorie remainder is labeled “נותרו לכל היותר” and prefixed with `≤` only while non-negative; accessible labels state “הערכה חלקית”; Today consumed calories and CSV exports use `+` when unknown calories exist. Negative overage is explicitly labeled as a lower-bound overage (“חריגה של לפחות” / `≥`) when data are incomplete.
- Regression: production-browser validation creates an unknown-calorie entry and verifies the exact upper-bound accessible label. PASS.
- Blueprint cross-check: unknown nutrient values remain unknown and are never coerced to zero.

## F06 — time-accurate charts

- Reproducibility/severity: valid, medium severity. Measurement chart x positions were derived from array index, so sparse points were evenly spaced and gaps in calendar time were visually compressed; a continuous line implied continuity across missing periods.
- Root cause: chart geometry used ordinal positions rather than dates and a single continuous polyline.
- Smallest correction: pure `buildTrendGeometry` maps x positions by actual calendar-day difference and splits consecutive-day groups into separate line/area segments; missing dates remain gaps. The accessible table alternative is unchanged.
- Regression: `trendGeometry.test.ts` verifies calendar spacing and gap segmentation; browser validation verifies separated segments on the production Progress screen. PASS.
- Blueprint cross-check: raw values remain preserved and chart display remains descriptive.

## F07 — time zone consistency

- Reproducibility/severity: valid, high severity for correctness near midnight/time-zone changes. UI screens passed hardcoded `Asia/Jerusalem`; `AppShell` initialized a module-level date once at bundle load; repository fallback and caller timezone were not systematically connected to the profile.
- Root cause: no single authoritative runtime timezone source; stale module initialization survived long-running sessions.
- Smallest correction: profile timezone is exposed through application context, pushed into the repository, and used by shell, Today, Nutrition, Check-in, Progress, Coach, Settings and Onboarding. Navigation dates are computed inside render rather than at module initialization. Repository methods accept explicit zones but default to the configured repository timezone.
- Regression: date tests cover UTC/local boundaries, DST transition and Auckland; browser validation changes the profile timezone and verifies the production UI date; repository validation verifies configured timezone reaches diary rows. PASS.
- Blueprint cross-check: date-dependent operations are interpreted in the configured user timezone; long-running stale dates are eliminated.

## F08 — import and backup safety

- Reproducibility/severity: valid, high severity. RC4 exported a backup object before replacement but the only user-recoverable copy depended on a download initiated after successful replacement. A failed/interrupted download left no durable local recovery copy, even though the import transaction itself was atomic.
- Root cause: backup creation was conflated with browser download delivery; no persistent local recovery artifact was stored.
- Smallest correction: the complete pre-import export is written to local metadata inside the same destructive import transaction before table replacement. Settings exposes “שחזור גיבוי זה” and still offers a downloaded copy as an additional layer. Failed import validation or transaction failure still prevents replacement.
- Regression: repository and browser validations verify backup metadata exists, replacement leaves zero current entries for an empty import bundle, and restore control is present. PASS.
- Blueprint cross-check: versioned import, dry-run validation, atomic replacement and rollback expectations are preserved; browser IndexedDB eviction/quota risk remains explicitly documented rather than claimed solved.

## F09 — service-worker robustness

- Reproducibility/severity: partially valid, medium severity. Valid defects: navigation responses were cached regardless of HTTP status, and compiled assets were only runtime-cached rather than install-precached. Invalid/not reproduced as defects: failed-install recovery and mixed-version cache transitions were already covered by RC3/RC4 durability validation and continued PASS.
- Root cause: navigation cache write lacked `response.ok`; the build-time precache placeholder was compiled to an empty list.
- Smallest correction: cache navigation shell copies only for OK responses; `finalize-sw.mjs` now enumerates actual compiled assets/routes into the service worker precache manifest. Existing versioned cache cleanup and failed-install behavior are unchanged.
- Regression: final durability validation PASS for install, offline CRUD, upgrade activation/cache transition, stale shell update, failed-update installation recovery, backup restore after upgrade and rollback compatibility. Offline persistence remains PASS in Chromium and WebKit/WPE.
- Blueprint cross-check: offline shell/data availability is preserved without expanding scope.

## Remaining open acceptance gates

Physical iPhone/Safari acceptance, VoiceOver/manual assistive-technology review, actual trusted private HTTPS deployment and unemulated storage-quota/durability acceptance remain OPEN. This patch is an engineering corrective release candidate, not production approval or independent certification.
