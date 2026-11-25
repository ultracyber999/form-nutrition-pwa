# ADR 0004: Local-only privacy default

Status: accepted

## Context

The user did not authorize cloud upload, paid infrastructure, real health-data access or public deployment. The blueprint requires explicit opt-in before any diary synchronization.

## Decision

P0 is local-only. No account, sync, external provider, barcode, health-permission or analytics controls are shown as if functional. A durable outbox schema exists to preserve future compatibility, but no network transmission occurs. Synthetic catalog data is generic and test fixtures are non-personal. Personal baseline/target values are entered in onboarding or imported privately.

## Consequences

- P0 avoids the largest privacy and compliance risks.
- IndexedDB eviction remains a local durability risk and is disclosed in settings/runbooks.
- P1 sync must implement auth, RLS, idempotency, conflicts and deletion before activation.
