# Rollback and recovery notes

## Local application rollback

The P0 app is static/local-first. Roll back by serving the prior immutable build artifact. Because IndexedDB schema migrations can be forward-only, do not deploy a destructive schema version without an export prompt and compatibility review. Current schema version: Dexie v1.

## Data rollback

Use the newest pre-import versioned JSON export. Import into a clean browser profile first when possible and verify counts/totals before replacing the active browser dataset. Preserve failed import files privately for diagnosis; do not attach real personal data to issues or CI.

## Future cloud rollback (deferred)

M4+ must add additive database migrations, backward-compatible sync schema versions, backup/restore drills, tombstone retention and client compatibility windows. No cloud rollback is currently claimed.

## Historical plan corrections

Ordinary plan revisions may only take effect today or in the future in the configured profile timezone. They must not rewrite the interpretation of earlier diary days. A same-effective-date revision is rejected as `duplicate-plan-date` rather than silently replacing the prior immutable revision.

The only supported historical correction path is the explicit repository workflow `createPlanRevision(input, { allowHistoricalCorrection: true })`; it requires a reason beginning with `historical-correction:` so the correction is auditable. This path is intended for exceptional data repair, not ordinary coaching or settings edits. Historical corrections still create a new immutable revision and never mutate prior plan rows.
