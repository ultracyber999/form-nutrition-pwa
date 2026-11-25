# ADR 0001: Local-first modular TypeScript monorepo

Status: accepted

## Context

The blueprint requires a production-grade local-first application, shared deterministic domain logic across future web/native clients, and optional cloud sync only after P0 gates. The legacy prototype couples UI, persistence and policy in one mutable object.

## Decision

Use a pnpm TypeScript monorepo with strict compiler settings. React/Vite is the first client. Domain modules are pure and cannot import storage, React, platform SDKs or wall-clock services. Dexie/IndexedDB is the web persistence adapter. Zod schemas validate trust boundaries. Repository operations that mutate diary entries and day completion are transactional.

## Consequences

- Web can ship before backend/native adapters.
- Sync can later consume the durable outbox without changing domain behavior.
- Some repository code is web-specific and must be ported carefully to SQLite rather than shared blindly.
- Package boundaries are enforced by imports and review rather than a separate build-time boundary initially.
