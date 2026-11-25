# FORM 2.0 migration runbook

## Source handling

Treat `form.cut.v1` exports and `legacy-form-v2.html` as read-only private inputs. Never commit real personal backups. Use synthetic fixtures in CI.

## Migration semantics

- Validate `version:1`, date keys, settings bounds, entry nutrient bounds and meal names before mutation.
- Map the single settings snapshot to one active goal and one effective-dated plan revision. Earlier unknown history is not fabricated.
- Built-in food IDs map to the generic catalog where possible; custom foods become immutable personal food versions.
- Entries use deterministic IDs derived from legacy date + legacy entry identity + quantity + meal so repeated imports skip duplicates.
- Water remains mL, sleep hours convert to minutes, weight/waist become preferred daily manual legacy measurements.
- Empty days marked complete are ambiguous and not treated as complete; the report counts them.

## Required verification

Run a dry run first. Confirm record counts, date range, skipped/repaired rows, warnings, duplicate count and one nutrient reconciliation (for example 180 g cooked chicken = 297 kcal / 55.8 g protein). Apply in one transaction. Re-run the same file and verify counts do not increase.
