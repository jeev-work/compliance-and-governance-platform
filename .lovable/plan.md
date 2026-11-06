# Plan: Multi-agent performance review dashboards

## Goal
Add two demo dashboards to the left scenario menu without changing the top role filter. Use the uploaded 18-agent catalogue and derive every displayed measure from the platform's existing KPI, chase-timeline, configuration, and ledger data.

## 1. Add dashboard 9: Agent Monitoring Performance
- Add a sidebar launch item for an executive/business review of the 18 monitoring agents.
- Show a summary of monitored KPIs, active exceptions, acknowledgement/notification coverage, resolution outcomes, and time-to-resolution where the source data supports it.
- Provide a scannable agent table with each catalogue description and relevant operational workload/coverage indicators derived from current KPI and ledger records.
- Keep any metric that cannot be supported by current data clearly unavailable rather than inventing runtime telemetry.

## 2. Add dashboard 10: Agent Compliance Review
- Add a separate sidebar launch item for compliance review of the same 18 agents.
- Summarize configuration coverage, ledger/evidence coverage, traceable case activity, unconfigured controls, and unresolved exceptions using existing records.
- Show agent-by-agent oversight/evidence coverage and link relevant rows into the existing KPI drilldown.
- Clearly distinguish data-derived demo indicators from live agent execution telemetry; do not fabricate audit events or claims of actual AI-agent runs.

## 3. Fit the existing app
- Follow the existing scenario-launch pattern in `AppSidebar` and `Index`; preserve the role selector and all current scenarios.
- Add focused view components and a shared agent catalogue/data-aggregation helper based on the uploaded table.
- Reuse the existing dashboard tokens, table/chart patterns, and KPI drilldown interactions.
- Add focused tests for aggregation rules using concrete cases.

## Technical approach
- Treat the uploaded list as the canonical set of 18 agent names and descriptions.
- Derive review metrics from `allData`, per-row `ledgerEntries`, `chaseTimeline`, `slaHistory`, `ragState`, and resolution status. The UI will state that these are platform-data proxies, not live agent run/latency telemetry.
- Launch the new dashboards as sidebar-selected full views, consistent with the KPI Lifecycle view; do not alter top-level role state.
