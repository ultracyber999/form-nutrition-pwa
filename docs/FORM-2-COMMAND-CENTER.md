# FORM 2 — Command Center preview

Base: edfaa2092f2e9c19be64458b6ba26a62bf28c45b. Existing deployed release stays unchanged.

Implemented: daily focus prioritizes data safety and missing context, not automatic goal changes; date-scoped journey with actual measurements and existing goal arithmetic; seven-day recorded training days, nutrition completeness and measurements; activity/recovery overview; explicitly quantified local food search; coherent inline SVG navigation; Today is the default landing page. No dependencies, data schema, cloud or external model changes.

Training count is recorded strength days, not a count of workouts. Partial and missing data stay distinct. The food parser only understands a single explicitly quantified food; users must choose a catalog result and confirm amount. No photo/AI estimates or external database claims.

Release gates: full CI, mobile visual review at 320/390px in both themes, screen-reader navigation, offline regression and physical iPhone acceptance. Preview must use synthetic data; no promotion until owner acceptance. Next product phases: dedicated strength log with versioned backup migration, Israeli food catalog with license/provenance, opt-in AI food draft and privacy review, Apple Health via native integration, and cross-device sync after security design.
