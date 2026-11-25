# FORM

FORM is a local-first Hebrew RTL nutrition and weight-management application. This repository implements the production blueprint supplied in the private handoff: effective-dated plans, immutable nutrition snapshots, deterministic coaching, portable backups, and explicit user confirmation for plan changes.

## Status

Current implementation scope: M0 foundation and M1 domain/persistence vertical slice are implemented; P0 UI routes and PWA hardening are in progress. See `docs/evidence/` for exact verified commands and honest limitations.

No real personal data, cloud credentials, health-record fixtures, or production secrets are stored in this repository. Bundled foods are generic estimates and must be verified against labels where relevant.

## Requirements

- Node.js 24+ (developed with v24.22.2)
- pnpm 12.23.0 (managed by Corepack)

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm ci
pnpm --filter @form/web dev
```

## Workspace

- `apps/web` — React/Vite Hebrew RTL local-first PWA
- `packages/contracts` — Zod runtime contracts and portable export schema
- `packages/domain` — pure date, nutrition, plan, analytics and coach policy modules
- `packages/data` — Dexie/IndexedDB repositories, transactions, import/export and legacy migration
- `packages/design` — machine-readable semantic tokens and CSS custom properties
- `packages/test-data` — synthetic fixtures only
- `docs/adr` — architecture decision records
- `docs/runbooks` — recovery, migration and operational notes
- `docs/evidence` — milestone evidence reports

## Safety and privacy posture

FORM is not a medical diagnostic system and does not automatically change calorie targets. The deterministic coach explains evidence and can only present a non-binding suggestion for explicit user confirmation. Local-only mode does not transmit diary data. IndexedDB persistence can be evicted by the browser; use exports for backup. Cloud sync/auth, external food providers, barcode scanning, native health integrations, public deployment and commercial analytics are deferred and intentionally hidden in P0.

## Verification

The critical golden case is covered by automated tests: 180 g cooked chicken at 165 kcal / 31 g protein per 100 g produces 297 kcal and 55.8 g protein, persists across IndexedDB reopen, exports, and restores identical totals. Run:

```bash
pnpm --filter @form/domain test
pnpm --filter @form/data test
```
