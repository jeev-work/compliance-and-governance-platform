# Plan

## 1. Remove the Generic Viewer / Analyst role

The `analyst` role is a duplicate of `compliance` in practice — `ComplianceView` is rendered for both, and there are no analyst-only actions in `rbac.ts`. We'll delete it everywhere.

- **`src/lib/filterContext.tsx`** — remove `'analyst'` from the `Role` union.
- **`src/lib/rbac.ts`** — drop the `analyst` entries from `ROLE_ACTIONS`, `ROLE_LABEL`, `ROLE_PURPOSE`.
- **`src/pages/Index.tsx`** — change the gate to just `filters.role === 'compliance'`.
- **`src/components/NotificationPanel.tsx`** — drop the `analyst` notification preset and its `case 'analyst'` branch (compliance preset continues to cover this audience).
- **`src/components/KpiHistoryPanel.tsx`** — remove the `isAnalyst` branch (history is always shown).
- **`src/components/views/ComplianceView.tsx`** — local `analystOpen` UI state stays (it's just a section toggle name); no role check needed. We'll leave it as-is unless cleanup is requested.

## 2. Rename "Compliance & Audit" → "Compliance, Audit, Analyst"

- **`src/lib/rbac.ts`** — `ROLE_LABEL.compliance = 'Compliance, Audit, Analyst'`. Update `ROLE_PURPOSE.compliance` to mention the merged analyst audience (e.g. "Immutable ledger query · hashed regulatory export · historical SLA trends").
- **`src/components/AppSidebar.tsx`** — update the Screen 5 label/blurb to "Compliance, Audit, Analyst".

## 3. New sidebar entry: "KPI Lifecycle"

Add an 8th item in `AppSidebar.tsx` that opens a dedicated full-screen view walking through the complete lifecycle of a single KPI: **Configured → Monitored → Breached → Acknowledged → RCA → Resolution Deployed → Verifying → Resolved → Back to Green** (plus optional Executive Flag and Audit Export side-rails).

### Behavior
- Sidebar click sets a new `lifecycleOpen` boolean (lifted state in `Index.tsx`, same pattern as `wallboardOpen`). When open, main content is replaced by `<KpiLifecycleView />`; sidebar item is highlighted.
- The view picks a representative KPI by default: the first one with `resolutionStatus === 'Resolved'` and a populated ack/RCA/resolve history, so all stages render. A small KPI picker (search/select) lets the user choose any KPI.
- Renders a horizontal stage timeline with:
  - Stage label, timestamp from the row's event history, actor, and the resulting RAG colour at that moment.
  - The active stage is highlighted; future stages are dimmed.
  - Each stage card shows the relevant artifacts already in the data model (ack note, RCA snippet, deployed-resolution hash, verification timer, ledger entry hash).
- Below the timeline: a "Rules that govern this lifecycle" panel summarising the auto-revert-to-GREEN rules implemented earlier in `filterContext.tsx` (resolution + cool-down + executive-flag clear), so the demo narrates the logic.

### Files
- **Create `src/components/views/KpiLifecycleView.tsx`** — pure presentation, reads `useFilters()` for `allData`, accepts a `kpiId` query-like local state.
- **Edit `src/components/AppSidebar.tsx`** — add the 8th scenario object (`id: 's8'`, icon: `Workflow` from lucide-react, num: 8, label: "KPI Lifecycle", blurb: "Configured → Resolved → Green · full timeline"), plus an `onLaunchLifecycle` prop and `activeLifecycle` highlight, mirroring the wallboard pattern.
- **Edit `src/pages/Index.tsx`** — add `lifecycleOpen` state, wire the prop, render `<KpiLifecycleView />` in place of the role views when open.

## Out of scope
- No changes to mock data, ledger logic, or auto-revert-to-GREEN rules — the lifecycle view only visualises existing state.
- No new persistence; KPI picker state lives in component memory.
- No edits to `ComplianceView.tsx` beyond what's required (its internal "Analyst" section toggle stays — it's a UI section, not the role).
