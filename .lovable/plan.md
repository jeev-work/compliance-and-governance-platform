# Make actions real + global search

## 1. Global search in filter ribbon

**File:** `src/lib/filterContext.tsx`
- Add `searchQuery: string` to `FilterState` (default `''`).
- In `filteredData` memo, when `searchQuery` is non-empty (case-insensitive trim), keep rows where any of these contain the query: `id`, `system`, `process`, `lob`, `assignee?.name`, `auditLedgerId`, `resolutionStatus`.

**File:** `src/components/GlobalFilterBar.tsx`
- Add a compact `<input>` with a `Search` icon (lucide) on the left side of the ribbon, ~220px wide, `h-7 text-xs`, placeholder `Search KPI, system, LoB, assignee, hash…`.
- Debounce-free, bound directly to `filters.searchQuery`.
- Show a small `×` clear button when non-empty.
- Matches existing ribbon styling tokens (`bg-secondary border border-border rounded`).

All 6 role views automatically benefit since they consume `filteredData`.

## 2. Action buttons → real mutations + toast (already wired via `mutateRow`)

Audit `DrilldownPanel.tsx` and ensure each role-gated action both calls `mutateRow(id, patch)` AND `toast.success(...)`. Patches:

| Action | Role | Patch applied to row |
|---|---|---|
| Acknowledge | SPOC | `stateFlags: [...flags, 'Acknowledged']`, append chase event `{ ts: now, kind: 'Acknowledged', by: 'SPOC' }` |
| Tag Dependency | SPOC | `stateFlags: [...flags, 'Cross-Functional']`, push a sub-ticket card into `dependencies` |
| Deploy Resolution | SPOC | Two-step: immediately `resolutionStatus: 'Verifying'`, `stateFlags: [...flags, 'Verifying']`, chase event `Deployed`. After 3s `setTimeout`, second `mutateRow` → `resolutionStatus: 'Resolved'`, `status: 'CLEAN'`, `ragState: 'Green'`, chase event `Verified & Closed`. Toast on each step. |
| Reassign | LOB Manager | `assignee: { name: <picked>, team: … }`, chase event `Reassigned to <name>` |
| Escalate | LOB Manager | `resolutionStatus: 'Escalated to HOD'`, `stateFlags: [...flags, 'Escalated']`, chase event `Escalated to HOD` |
| Executive Flag | Executive | `executiveFlag: true`, `severity: 'Critical'`, chase event `Executive Flagged` |
| Export Audit | Compliance | No mutation; `toast.success("Exported · hash <auditLedgerId>")` only (already correct) |

Each action closes/keeps drilldown open per current behaviour. The `mutateRow` already syncs the open drilldown row, so timeline + badges update live without manual reopen.

## 3. Visible UI updates that ripple from mutations

These already re-render off `allData` / `filteredData`, but confirm:
- Executive view: `executiveFlag` banner appears immediately; flagged tile gets pulse via existing `exec-pulse` class.
- LOB Manager matrix counts shift when severity / status changes.
- SPOC inbox row disappears from "Unacknowledged" group after Acknowledge.
- Compliance Kanban: card moves between columns (`Investigating` → `Verifying` → `Resolved`) live.
- Drilldown chase timeline gets a new line for every action.

No animation polish in this pass beyond the already-defined `exec-pulse`.

## 4. Tech notes

- `setTimeout` for Deploy Resolution stored in a `useRef` so the panel can clear it if user closes the drilldown mid-flight.
- All mutations are pure in-memory via the existing `mutateRow` in `filterContext`. No persistence, no backend.
- Search trims and lowercases once per render; perf fine at 30k rows since `filteredData` already iterates the whole set.

## Out of scope

- No new fields on `KPIRow` beyond what the rewritten `mockData.ts` already exposes (`chaseTimeline`, `dependencies`, `executiveFlag`, `assignee`, `auditLedgerId`, `slaVersion`).
- No backend, no real audit hashing, no animations beyond existing tokens.
