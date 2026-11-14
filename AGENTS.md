# Architecture Decisions

- Keep multi-agent dashboards presentation-focused; label seeded scores and randomized health as illustrative demo telemetry, preserve distinctions between platform records and agent signals, and never imply mock values are live execution evidence.
- Keep each Control Tower agent register backed by its own named catalogue, with section totals and the estate summary derived consistently from those catalogues.
- Use the shared trust-score classifier for consistent GREEN (≥95), AMBER (90–94), and RED (<90) bands across agent dashboards.
- Keep Screen 12's Control Tower view and demo catalogue separate from Screen 11's originals so future Screen 12 edits do not alter Screen 11.