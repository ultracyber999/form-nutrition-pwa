# Local backup and restore runbook

## Export

1. Open Settings → Data portability.
2. Export the versioned JSON bundle. It includes profile, active goal, plan revisions, food versions, food entries, diary completion state, measurements, check-ins, templates, recipes and coach reviews.
3. Store the file somewhere the user controls. Treat it as sensitive personal data.

## Restore drill

1. Keep a copy of the current export before importing anything.
2. Choose the JSON file and inspect the dry-run validation: schema, counts, duplicates and byte size.
3. Choose merge-skip-duplicates for additive restore or replace-all only when intentionally replacing this browser's local dataset.
4. Confirm. The transaction either applies all valid entities or preserves the previous dataset.
5. Verify table counts, one known day total, latest measurement and plan history.
6. Record the date, browser/device, file size, counts and any skipped duplicates.

## Failure handling

Invalid JSON/schema or an over-limit file must make no mutation. If a transaction fails after confirmation, use the pre-import export captured by the application flow. IndexedDB eviction, browser profile deletion or device loss can destroy local-only data; recurring export is required until opt-in sync exists.

## Durable pre-import backup (RC4 corrective patch)

Before any `replace-all` import transaction mutates entity tables, the repository stores the complete pre-import export under the local metadata key `last-pre-import-backup` inside the same transaction. This backup therefore exists even if the post-import browser download fails or is interrupted. Settings exposes **שחזור גיבוי זה** for restoring that latest local pre-import backup.

This is an additional recovery layer, not a substitute for user-exported backups. IndexedDB itself may still be evicted by the browser; export a JSON file before upgrades, imports, browser-profile changes or device migration.
