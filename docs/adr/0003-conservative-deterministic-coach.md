# ADR 0003: Conservative deterministic coaching boundary

Status: accepted

## Context

The blueprint forbids automatic calorie changes, fabricated safety validation, LLM decision-making in the critical path, and recommendations based on incomplete data.

## Decision

The coach is a pure deterministic policy module (`form-coach-v1.0`) using three non-overlapping complete 7-day windows ending yesterday. It outputs status, reason codes, evidence windows, deltas, coverage and a fingerprint. Safety/recovery/goal states override deficit suggestions. Any adjustment is only a 100–150 kcal discussion preview and requires explicit user confirmation with an effective date. Reviews are stored as immutable evidence records; changed inputs produce a different fingerprint and stale status rather than rewriting history.

## Consequences

- The product can explain why no recommendation is available.
- The policy is reproducible and testable without a server.
- Clinical validation remains a release prerequisite for commercialization.
