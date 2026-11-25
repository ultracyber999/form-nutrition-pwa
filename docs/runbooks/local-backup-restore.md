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
