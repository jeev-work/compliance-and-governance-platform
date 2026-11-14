# Architecture Decisions

- Keep multi-agent dashboards presentation-focused; label seeded scores and randomized health as illustrative demo telemetry, preserve distinctions between platform records and agent signals, and never imply mock values are live execution evidence.
- Keep each Control Tower agent register backed by its own named catalogue, with section totals and the estate summary derived consistently from those catalogues.