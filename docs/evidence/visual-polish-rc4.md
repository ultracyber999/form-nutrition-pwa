# RC4 Visual Polish Evidence

## Scope

Focused UI/UX refinement only. No feature expansion, persistence/model rewrite, provider integration, deployment infrastructure, or new dependency was introduced. Validated RC3 architecture, domain behavior, local-first privacy posture, security controls, and regression tests were preserved.

## Material design improvements

1. **Today visual hierarchy** — the calorie/macro hero now appears before secondary metric tiles, uses a larger dominant ring, stronger numeric hierarchy, clearer consumed/target context, and a more intentional two-panel desktop composition.
2. **Mobile quick-entry ergonomics** — primary **הוספת אוכל** precedes check-in in the first hero action row, both actions use a compact two-column mobile layout, labels remain on one line, and actions remain visible near the first viewport instead of requiring lower-page navigation.
3. **Consumer-grade ring semantics** — over-budget state now switches from positive-green progress to warning color and presents `חריגה` plus positive excess calories rather than a negative remaining number; accessible labels describe the same state non-visually.
4. **Truthful incomplete macro presentation** — partial macro totals now carry `+` and accessible `לפחות` wording when additional nutrient values are unknown, avoiding a visually implied exact zero/complete total. Domain null/unknown semantics were not changed.
5. **Premium visual identity** — refined ambient background, brand isolation for the Latin FORM mark, stronger card radius/elevation, accent glow, reduced administrative flatness, and consistent focus/interaction emphasis.
6. **Typography and numerics** — stronger display sizing for key calories/weights, more deliberate spacing, bidi-isolated numerals preserved, and improved pill/label hierarchy.
7. **Weight-trend visualization** — trend chart now uses an accent gradient area, clearer line weight, endpoint emphasis, current-value annotation, and valid seeded measurement data (`value`) in the visual harness. The earlier flat chart was a harness field mismatch, not an application regression.
8. **Light-theme differentiation** — light surfaces/elevated cards/ring tracks now use separate token values rather than insufficiently distinct color-mix surfaces.
9. **Coaching hierarchy** — raw machine status text was replaced with Hebrew semantic status wording (`מסלול יציב`, `לבדיקה`, `דורש תשומת לב`); evidence tables are explicitly horizontally contained on narrow screens.
10. **Reduced card-density emphasis** — primary daily energy/progress information is visually dominant while lower metrics remain secondary; no data or control was removed.

## Evidence inventory

- Full-resolution final matrix: `docs/evidence/visual-matrix/` — six routes × 320/390/768/1440 × dark/light (48 PNGs).
- Before comparison set: `docs/evidence/visual-before-rc4/` — key route/mobile before images preserved from RC3.
- Realistic state captures: `docs/evidence/design-states-rc4/` — populated dark/light, quick-add, empty, incomplete, and over-budget.
- Accessibility automation: `docs/evidence/accessibility-rc4.json`.
- UX workflow timing smoke: `docs/evidence/ux-workflows-rc4.json`.

## Validation results after RC4 polish

| Gate | Status | Evidence |
|---|---|---|
| Full CI | PASS | `pnpm run ci`, exit 0 — lint, strict typecheck, tests, production build |
| Production visual matrix capture | PASS | 48 final exact-width screenshots updated |
| Populated/empty/incomplete/over-budget/quick-add captures | PASS | `design-states-rc4`; script exit 0 |
| axe core routes | PASS | 0 violations on `/today`, `/nutrition/2026-11-26`, `/progress`, `/check-in/2026-11-26`, `/coach`, `/settings` |
| Dialog focus trap/restore | PASS | `accessibility-rc4.json` |
| Keyboard visibility/order smoke | PASS | 30/30 visible stops |
| Target-size smoke | PASS | 12 checked, 0 small |
| 320px reflow approximation | PASS | no horizontal overflow |
| 200% text/zoom approximations | PASS | no horizontal overflow; emulation limitations recorded |
| Reduced motion | PASS | transition duration effectively disabled |
| UX workflow lower-bound timing | MEASURED/PASS | machine-speed timings; not human completion claims |
| Screen reader | NOT RUN | no supported screen reader on Linux VM; VoiceOver remains physical-device acceptance |
| Physical iPhone/Safari acceptance | NOT RUN | owner-dependent private HTTPS/device workflow unchanged |

## Visual inspection notes

Full-resolution screenshots were inspected directly, including mobile Today, Progress, incomplete, empty, and over-budget states. The final mobile Today composition keeps the calorie ring dominant, macro bars legible, and primary food entry visible in the first viewport. Progress now renders a meaningful descending weight trend. Over-budget state is semantically distinct without relying on color alone. Incomplete state visibly marks macro values as partial known subtotals.

## Constraints preserved

- No cloud sync, external food provider, auth, SaaS, M4 scope, native integration, or public deployment.
- No automatic calorie recommendation or coaching behavior change.
- No persistence schema migration or data-model rewrite.
- Missing nutrient values remain unknown in domain data; UI labels only clarify known subtotals.
- Physical-device acceptance is not claimed.

## Final reproducibility check

A clean clone restored from the RC4 source bundle at implementation commit `4f0d0c6` completed `pnpm install --frozen-lockfile && pnpm run ci` with exit 0. The resulting production build fingerprint matched the local build assets and service-worker cache token `form-shell-build-7716d34edd0c`.
