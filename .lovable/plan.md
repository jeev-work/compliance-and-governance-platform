# Demo Navigation: 7-Screen Launcher

The top role filter stays untouched. The left collapsible rail is rebuilt into a **guided demo launcher** with exactly the 7 screens you listed. Each item drives the existing platform (sets role, filters, opens drilldown) so you don't have to click around mid-demo.

## Screen → existing view mapping

| # | Demo screen | Drives |
|---|---|---|
| 1 | Macro-Control Board | Executive view, all filters cleared, 5-state donut + system grid visible |
| 2 | Dynamic Control Chart | Opens drilldown on a representative AMBER KPI — trendline + SLA line + debounce label already live in `DrilldownPanel` |
| 3 | Diagnostic Modal — SPOC | Switches role to SPOC, opens drilldown on a RED incident — Acknowledge / RCA / Dependency toggle become active |
| 4 | Diagnostic Modal — Exec/LoB | Switches role to Executive, opens drilldown on an exec-flagged incident — SPOC inputs locked, Executive Flag prominent |
| 5 | Compliance Auditor | Compliance view, scrolls to Audit Ledger; per-row Export + SHA-256 already render |
| 6 | Admin Configuration | Admin view — SLA editor, API keys, connector health already render |
| 7 | NOC Wallboard (blackout) | **New** full-screen overlay with red flash, RED count tiles, OOB-SMS banner, siren indicator, network status row |

## What gets built

### 1. New `AppSidebar` (rewrite)
Seven items, each with icon + label + one-line blurb (shown on hover-expand). Clicking an item runs a small "scenario script":
- Sets `filters.role`, clears irrelevant filters, applies any RAG/severity scoping.
- Picks a representative row from `allData` matching the scenario (RED + Critical, exec-flagged, AMBER with debounce, KPI with dependency, etc.).
- Opens the drilldown on that row (Screens 2/3/4) **or** triggers the wallboard overlay (Screen 7).
- Active scenario gets a left-border + chip highlight so the audience sees where you are.

### 2. New `NocWallboard.tsx` overlay
Fixed full-screen component, mounted in `Index.tsx`, visibility controlled by local state on the sidebar trigger. Contents:
- Red pulsing background (`exec-pulse` token reused) with `CRITICAL — SLA BREACH DETECTED` heading.
- Tiles: `# RED KPIs` and `# Systems Affected` computed from `allData`.
- Banner: `OOB SMS Dispatched — Fallback Group Notified`.
- Siren indicator: speaker icon + `Un-mutable siren active` label.
- Network status row: `Corporate IP ✗ / GSM Modem ✓ / Heartbeat → 503`.
- `Esc` or a close button to dismiss.

### 3. Light wiring in `Index.tsx`
- Lift a `wallboardOpen` boolean (or co-locate in `FilterContext` if cleaner) so the sidebar can toggle it and the overlay can read it.

## What we are NOT changing
- Top role filter in `GlobalFilterBar` (your request).
- `DrilldownPanel`, all six role views, `NotificationPanel`, `mockData.ts` — they already cover Screens 1–6's "MUST SHOW" items. We are only routing to them.
- Realistic countdown logic from the previous turn stays as-is.

## Technical notes
- Files touched: `src/components/AppSidebar.tsx` (rewrite), `src/components/NocWallboard.tsx` (new), `src/pages/Index.tsx` (mount overlay + shared state).
- Scenario picks use `allData.find(...)` against existing fields (`ragState`, `severity`, `executiveFlag`, `dependency`).
- All colors via existing `rag-*` and `sidebar-*` semantic tokens — no new design system entries needed.

Approve to build.
