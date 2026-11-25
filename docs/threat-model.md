# FORM threat model and security review baseline

## Assets

Food diary, measurements, notes, goal/plan history, local backups, future account/session credentials, future health-derived samples, and the integrity of deterministic coach evidence.

## P0 threats and controls

| Threat | Control | Status |
|---|---|---|
| Destructive import | schema validation, size limit, dry-run preview, transaction, pre-import export returned to caller | implemented local |
| Food edit corrupting completion semantics | food mutation revision invalidates completion atomically | implemented/tested |
| Retrospective plan mutation | immutable effective-dated revisions | implemented/tested |
| Unknown nutrients coerced to zero | nullable nutrient contract and completeness counts | implemented/tested |
| XSS through food/provider/import strings | React escaped rendering; no `dangerouslySetInnerHTML` in application code | implemented for P0 UI; audit ongoing |
| Secrets in client bundle | no server credentials or external service keys in P0 | implemented by scope |
| Browser storage eviction | disclosed; versioned export/backup flow | partially implemented |
| Malicious oversized JSON | 20 MiB application-level limit before parse acceptance | implemented |
| Automatic unsafe calorie reduction | no mutation pathway in coach; explicit confirmation only | implemented in domain |

## P1 threats deferred until auth/sync milestone

Cross-account IDOR/RLS bypass, leaked service keys, stale outbox replay, conflict overwrite, tombstone resurrection, account switching leakage, CSRF/session theft, provider-key exposure, server log leakage. These are release blockers for M4–M6, not claims of current functionality.

## Operational rules

No real personal health data in tests, source control, logs, screenshots or CI artifacts. No public deployment, paid infrastructure, provider credentials or health-data access without explicit approval. Dependency review is required before release; lockfile is committed.
