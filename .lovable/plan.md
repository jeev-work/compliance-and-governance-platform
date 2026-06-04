## Goal

Evolve the current 3-view POC into a 6-role, 5-state RAG governance dashboard that visibly demonstrates the lifecycle the three documents describe — without rebuilding what already works. Every existing tile, chart, sidebar item, and drilldown stays; we extend.

## What changes vs. what stays

**Stays (the strengths)**
- Sidebar shell, sticky global filter ribbon, dense `text-[10px]` labels, mono numbers
- RAG tile pattern, control charts, trend lines, heatmap, exception log table, Kanban
- Right-side slide-in drilldown panel (480px)
- Dark theme, HSL token system, chart palette

**Changes**
- 3 personas → 6 roles
- 3-state RAG → 5-state (Green, Amber, Red, Grey, Blue) + Unconfigured visual
- Departments → LoB (B2B, B2C, Wheels) with tooltip
- Filter ribbon gains date-picker, operational state flags, severity & RAG state chips
- Drilldown panel gains Chase Mechanism timeline, Executive Flag, Multi-Team Dependency, Deploy Resolution → Verifying, Export Regulatory Audit, SLA version stamp
- Mock data simulates the full incident lifecycle described in Blueprint §2

## Six roles (sidebar items)

| Order | Role | View focus |
|---|---|---|
| 1 | Executive Leadership | Existing Leadership view + Executive Flag override action, 5-state donut, persistent pulse on flagged tiles |
| 2 | LOB Manager | NEW. Aggregated matrix scoped to selected LoB, escalation timeline rail, "Unacknowledged by SPOC" / "Escalated" secondary icons, manual reassignment |
| 3 | IT System SPOC | Rework of TechOps into an Actionable Alert Inbox — control chart + live exception log + Acknowledge / Deploy Resolution / Multi-Team Dependency actions |
| 4 | Compliance & Audit Officer | Existing Compliance view + direct Immutable Ledger query interface + Export Regulatory Audit (hashed) button per incident |
| 5 | Generic Viewer / Business Analyst | NEW. Historical aggregated trends, SLA % month-over-month, no live alerts, no PII |
| 6 | Platform Admin | NEW. Admin Health Console — connector health, Grey-state pipeline alerts, SLA Configuration Vault with version history |

## Filter ribbon additions (in this exact left-to-right order)

```text
Role · Date [1H 24H 7D 30D 60D 90D | Custom range w/ hour] · LoB(ⓘ) · Systems · Processes · State Flags · RAG · Severity · [breach count] [record count]
```

- **Date picker**: preset chips + shadcn Popover/Calendar with hour granularity (custom from/to)
- **LoB**: replaces Departments. Header label "LoB" with hover tooltip "Line of Business". Options: B2B, B2C, Wheels
- **State Flags** (multi): Acknowledged, Unacknowledged, Escalated, Cross-Functional, Verifying, Unconfigured
- **RAG** (multi-chip): Green, Amber, Red, Grey, Blue
- **Severity** (multi-chip): Critical, High, Medium, Low

## 5-state RAG system

Add to `index.css`:
- `--rag-grey` (neutral slate) — structural failure
- `--rag-blue` (calm blue) — planned maintenance
- `--rag-unconfigured` (dashed border + muted) — no SLA baseline mapped

All tiles, donut, heatmap, control chart bands, Kanban columns, and badges read from these tokens. Blue tiles render with a subtle "MUTED" badge; Grey tiles with a "DATA STARVED" badge that routes alerts to Platform Admin instead of SPOC.

## Drilldown panel additions

Existing Breach Detail + Group Drilldown stay. We add to Breach Detail:

- **Chase Mechanism timeline strip** (Generated → Notified → Acknowledged → Resolved → Verifying → Closed) with live countdown timer
- **SLA Version stamp** (e.g. `SLA_v1.2 · active since 2026-03-01`) with "evaluated against rule active at incident time"
- **Action row** (role-gated):
  - SPOC: `Acknowledge`, `Deploy Resolution` (→ Verifying state), `Tag Multi-Team Dependency` (forks sub-ticket)
  - LOB Manager: `Reassign`, `Escalate`
  - Executive: `Executive Flag` (pulses tile, nullifies timer)
  - Compliance: `Export Regulatory Audit` (downloads hashed JSON proof)
- **Dependency sub-ticket card** when forked, showing secondary team + linked timer
- **Executive Override badge** when flagged

## Mock data — full lifecycle simulation

Rewrite `mockData.ts` to seed realistic patterns rather than uniform randomness:

- 5 status states with weighted distribution (Green 78%, Amber 9%, Red 6%, Grey 2%, Blue 4%, Unconfigured 1%)
- LoB = B2B / B2C / Wheels (replaces 6 departments)
- For ~3% of rows: Amber → Red transition records (debounce trail, 3-min sustained breach)
- For ~1%: Grey clusters tied to a specific connector outage window (multiple KPIs in same system go Grey together)
- For ~1%: Blue rows inside named maintenance windows (e.g. "Core Banking quarterly patch — Sat 02:00–06:00")
- For ~2% of Red: Multi-Team Dependency forks with linked sub-incidents
- For ~0.5% of Red: Executive Flag stamped
- Each incident: chase timeline events (generated/notified/acknowledged/resolved/verifying timestamps), SLA version reference, hashed audit ledger ID
- Pending earlier requirements (LoB rename, B2B/B2C/Wheels) folded in here

## New role-specific views

**LOB Manager view** — aggregated matrix card grid by system, escalation rail showing all open Red+Amber with countdown chips, reassignment dropdown.

**Generic Viewer view** — month-over-month SLA % line chart per LoB, breach-by-system bar, no incident list, no actions.

**Platform Admin / Health Console** — connector health grid (status per source: AppDynamics, Datadog, etc.), Grey-state alert feed, SLA Configuration Vault table with versions (`SLA_v1.0 → v1.1` diff rows), Dead-Letter Queue counter.

## Technical structure

```text
src/
  components/
    GlobalFilterBar.tsx        (extend: date picker, state flags, RAG, severity)
    AppSidebar.tsx             (extend: 6 roles)
    DrilldownPanel.tsx         (extend: chase timeline, role actions, audit export)
    views/
      ExecutiveView.tsx        (rename from LeadershipView, +Executive Flag)
      LobManagerView.tsx       (NEW)
      SpocView.tsx             (rework of TechOpsView)
      ComplianceView.tsx       (extend: ledger query, audit export)
      AnalystView.tsx          (NEW)
      AdminHealthView.tsx      (NEW)
  lib/
    filterContext.tsx          (extend FilterState: dateFrom/dateTo, stateFlags[], ragStates[], severities[], role rename)
    mockData.ts                (rewrite: 5 states, LoB, lifecycle events, dependency forks, exec flags, SLA versions)
    rbac.ts                    (NEW: role → allowed actions map for drilldown buttons)
  index.css                    (add --rag-grey, --rag-blue, unconfigured utility)
```

## What I will NOT do this iteration

- Backend Pipeline Engineer and Frontend Engineer consoles (out per your answer)
- Real backend, real auth, real SLA vault writes (still POC mock)
- Bot voice calls, NOC sirens, GSM gateway (Layer 5 hardware fallbacks)
- Actual cryptographic hashing of audit exports (we render a realistic hashed-looking ID)

## Open question for after approval

Once you approve, only thing I'll need from you live is: should the Executive Flag and Deploy Resolution actions actually mutate the in-memory mock data so the user sees the tile change color during demo, or stay as toast-only confirmations? (Mutating is more impressive for a demo; toast is safer.)
