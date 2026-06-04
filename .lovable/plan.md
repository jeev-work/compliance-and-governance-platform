## 1. Fix dark-on-dark chart tooltips (all views)

Every `<Tooltip contentStyle={...}>` currently uses `background: 'hsl(222 44% 8%)'` and inherits dark text — values become illegible on the dark card.

Replace the inline `contentStyle` with semantic, readable tokens across every chart in:
- `ExecutiveView` (pie, line, bar — 3 tooltips)
- `AnalystView` (line + bar — 2 tooltips)
- `LobManagerView`, `SpocView`, `ComplianceView`, `AdminHealthView`, `DrilldownPanel` group view

New shared style (extract a `CHART_TOOLTIP` constant in `src/lib/utils.ts`):
```
{
  background: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  color: 'hsl(var(--popover-foreground))',
  fontSize: 11,
  boxShadow: '0 4px 12px hsl(0 0% 0% / 0.4)',
}
```
Also pass `labelStyle={{ color: 'hsl(var(--foreground))' }}` and `itemStyle={{ color: 'hsl(var(--foreground))' }}` so series labels stay legible.

## 2. Multi-Team Dependency — toggle Enable / Disable with confirm + ledger

In `DrilldownPanel.BreachDetail` (SPOC role):

- Replace the single `Tag Multi-Team Dependency` button with a dynamic control:
  - If `row.dependency == null`: button **"Enable Multi-Team Dependency"** → opens a small inline modal asking *which team to notify* (dropdown of `DEPENDENCY_TEAMS` from `mockData`) + optional reason. Confirm step: "Are you sure? This will pause the primary SLA timer." Cancel/Confirm.
  - If `row.dependency != null`: button **"Disable Multi-Team Dependency"** (variant=amber) → confirm "Are you sure? Primary SLA timer will resume." Cancel/Confirm.

- On Enable confirm: `mutateRow` sets `dependency = { team, timestamp, linkedId: SUB-xxxxx, status: 'open' }`, appends `Cross-Functional` flag, AND appends a new entry to `row.comments` of role `'System · Ledger'` with text `Dependency ENABLED → ${team} · ledger ${row.auditLedgerId}-D${seq}`. Toast success.
- On Disable confirm: `mutateRow` clears `dependency = null`, removes `Cross-Functional` flag, appends ledger comment `Dependency DISABLED · ledger ${row.auditLedgerId}-D${seq}`. Toast success.

Both events also append a `ChaseEvent` (`{ step: 'Notified', actor: 'Dependency Toggle' }`) so the chase timeline reflects them, and the existing **Activity Log** card surfaces the ledger entry (acts as the immutable trail for the demo).

## 3. Global search → full KPI history view

Today, when the global search matches a `KPI-xxxxx` id, the row appears in the active view's table but its **per-KPI lifecycle** is only visible by clicking. We add a dedicated history surface:

- Extend `filterContext`: when `searchQuery` exactly matches one or more rows by `id` prefix `KPI-`, expose a derived `historyView = { id, rows: KPIRow[] }` — rows sorted by `timestamp asc` across `allData` (ignoring date filter), where any row shares the same `id`. Since each `KPI-id` is unique in mock, also include rows with the same `(system, process, lob)` triple — that is the "API's lifetime log".
- New component `src/components/KpiHistoryPanel.tsx` rendered in `Index.tsx` above the role view whenever `historyView` is active (search bar shows a small "Showing lifetime history for KPI-xxxxx · clear" pill).
- Panel contents:
  - Header: KPI id, system/process/LoB, current RAG, current assignee + SPOC contact (name, role, email pattern `${first}.${last}@gov.demo`, on-call phone placeholder).
  - **Performance strip** (always shown): sparkline of `failureRate` over time, count of total events, current SLA%, MTTR, MTTD.
  - **Malfunction History timeline** (hidden for `analyst` role — see §4): chronological list of each historical breach with severity, RAG, resolutionStatus, assignee, actions taken (derived from each row's `chaseTimeline`, `escalations`, `comments`, `dependency`), and the ledger hash for that incident. Each entry expands to show the full chase timeline inline.
  - "Open latest incident" button → `openDrilldown('breach', latestRow.id, latestRow)`.

## 4. Analyst / Generic Viewer scope

- In `KpiHistoryPanel`, gate the Malfunction History section behind `filters.role !== 'analyst'`. Analyst sees only the **Performance strip** + a **"SPOC Contact"** card with:
  - SPOC name + role (from current assignee, or system-default mapping if null)
  - Email + phone (mocked) + Teams handle
  - "Request more details" button → `toast.success('Request sent to {SPOC}')` (no mutation)
- In `AnalystView`, add a small footer note "For incident-level details, contact the system SPOC" and surface the system→SPOC mapping table (read from a new constant `SYSTEM_SPOC_MAP` in `mockData.ts` so the same data feeds both views).

## Technical notes

- New file: `src/components/KpiHistoryPanel.tsx`.
- Edits: `src/lib/utils.ts` (add `CHART_TOOLTIP`), `src/lib/filterContext.tsx` (add `historyView` selector), `src/lib/mockData.ts` (add `SYSTEM_SPOC_MAP`), `src/pages/Index.tsx` (mount panel), `src/components/DrilldownPanel.tsx` (dependency toggle + confirm modal), and all 6 view files (swap tooltip styles).
- No backend, no new types beyond optional `ledgerEntries?: {ts; text; hash}[]` on `KPIRow` if we want stronger separation than reusing `comments` — default is to reuse `comments` to keep the diff small. Confirm preference if you'd rather have a dedicated `ledgerEntries` array.

## Out of scope

- No real cryptographic hashing — ledger hashes stay mocked.
- No backend/persistence — refresh resets state.
- No animations beyond existing `exec-pulse`.
