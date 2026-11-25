# Version compatibility record

Date: 2026-11-25

| Component | Pinned version | Verification |
|---|---:|---|
| Node.js | 24.22.2 local / 24 CI | local typecheck/tests pass |
| pnpm | 12.23.0 | lockfile generated locally |
| TypeScript | 5.9.3 | strict typecheck passes |
| React | to be pinned with web implementation | pending M2 |
| Vite | to be pinned with web implementation | pending M2 |
| Vitest | 3.2.4 | domain/data tests pass |
| Zod | 4.6.7 | contract parse tests pass through repository tests |
| Dexie | 4.4.7 | fake-indexeddb integration tests pass |
| fast-check | 4.11.0 | nutrition property test passes |
| ESLint | 9.39.1 | configured; full lint evidence in M0 report |

Versions are pinned in package manifests and `pnpm-lock.yaml`. They are selected for local compatibility, not as a claim of absence of vulnerabilities; run audit/osv review before release.
