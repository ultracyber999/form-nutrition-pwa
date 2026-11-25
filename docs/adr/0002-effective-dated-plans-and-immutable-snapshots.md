# ADR 0002: Effective-dated plans and immutable nutrition snapshots

Status: accepted

## Context

The legacy app used one mutable settings object and copied current food constants indirectly through entries. Retrospective target changes and food edits could falsify history.

## Decision

Every plan target change creates a new immutable `NutritionPlan` revision with an explicit `effectiveFrom` date. Historical entries resolve the latest revision effective on their local date. Food entries store consumed nutrient snapshots at commit time. Custom/user food versions are immutable; editing a food creates a new version rather than mutating historical meaning. Diary completion is tied to a food mutation revision and invalidated atomically when entries change.

## Consequences

- Historical evaluations are reproducible.
- Storage volume is slightly higher because snapshots are duplicated.
- Import/export must preserve full snapshots, not only references.
