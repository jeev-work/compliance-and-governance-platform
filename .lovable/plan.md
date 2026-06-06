## 1. LoB Manager · Clickable RAG matrix tiles

`src/components/views/LobManagerView.tsx`
- Each non-empty matrix cell currently opens nothing concrete. Wire each cell to open a new drilldown type `'matrixCell'` carrying `{ system, process }`.
- Extend `DrilldownState['type']` in `filterContext.tsx` to include `'matrixCell'`, and update `DrilldownPanel.tsx` to render a new "Cell KPI Status" view listing every KPI in that system×process intersection with its live RAG, assignee, escalation countdown, and a row click that opens the existing breach drilldown.

## 2. Fix GRE/GRY collision across the app

Audit and rename the 3-letter RAG abbreviations everywhere they appear:
- `GlobalFilterBar.tsx` chip labels — `GREEN → GRN`, `GREY → GRY` (currently both render `GRE`).
- `LobManagerView.tsx` matrix cell label (`w.slice(0, 3)`) — replace with a `RAG_SHORT` map: `{GREEN:'GRN', AMBER:'AMB', RED:'RED', GREY:'GRY', BLUE:'BLU', UNCONFIGURED:'UNC'}`.
- Search other views (`ExecutiveView`, `SpocView`, `AnalystView`, `AdminHealthView`, `KpiHistoryPanel`) for any `.slice(0,3)` or hard-coded "GRE" usages and replace with the same map.
- Centralize the map in `src/lib/mockData.ts` (or `utils.ts`) as `export const RAG_SHORT` so it can't drift.

## 3. Per-KPI SLA version history

Today `slaVersion` is a single string per row and the vault in `AdminHealthView.tsx` aggregates by version across rows. Change the model so each KPI carries its own version trail.

`src/lib/mockData.ts`
- Add `slaHistory: { version: string; activeFrom: string; changedBy: string; threshold: number; changeNote: string }[]` on `KPIRow`. Seed each row with 1–3 prior versions so the trail is non-empty.
- Keep `slaVersion` as the current active pointer (last item in `slaHistory`).

`AdminHealthView.tsx`
- Replace the aggregated vault table with a two-pane layout: left = KPI search/picker (reuses `filteredData`), right = that KPI's full version history table (version, activeFrom, changedBy, threshold, note, currently-active badge).
- Keep an "All versions in scope" summary chip strip above for the previous bird's-eye view.

`KpiHistoryPanel.tsx` — also surface the per-KPI SLA history alongside the existing malfunction history (gated by role as today).

## 4. Admin authoring — KPIs, LoBs, departments

`AdminHealthView.tsx` (new "Authoring" tab/section)
- Three "Add new…" dialogs: **KPI**, **LoB**, **Department/System**. Each writes into a new in-memory registry exposed by `filterContext.tsx` (`registries: { lobs, systems, kpis }` + `addLob`, `addSystem`, `addKpi`).
- New KPI form fields: id (auto `KPI-…`), LoB, system, process, source, target SLA threshold, severity defaults, SPOC owner, attached config-file name (free text or upload stub).
- On create, append a `LedgerEntry` to that KPI's `ledgerEntries` array (`action: 'KPI Created'`) and also write to a new top-level `masterLedger` (see §5).
- Every new LoB / department gets its own independent ledger stored on a `lobLedgers: Record<string, LedgerEntry[]>` and `systemLedgers: Record<string, LedgerEntry[]>` in `filterContext`.

## 5. Master + micro ledger export with config-snapshot integrity

`src/lib/filterContext.tsx`
- Introduce `masterLedger: LedgerEntry[]` aggregating every mutation (already routed through `mutateRow`, plus the new admin authoring actions).
- Add `configSnapshots: { version: string; capturedAt: string; thresholds: Record<string, number>; ragRules: ... }[]`. Each time an SLA threshold changes (admin authoring or a new `slaHistory` entry), snapshot the current rules.
- Every `KPIRow` already carries `slaVersion`; persist alongside it the `configSnapshotId` that was active when the row was evaluated, so historic rows always reference the rules they were judged under.

Export mechanism (new `src/lib/exportLedger.ts` helper, button in `AdminHealthView` and `ComplianceView`):
- **Export Master Ledger** → CSV/JSON of `masterLedger` + the full `configSnapshots` table.
- **Export Micro Ledger** → per-KPI / per-LoB / per-system download of that entity's `ledgerEntries`, each row stamped with its `configSnapshotId` and the snapshot's thresholds inlined.
- Add an "Integrity guarantee" notice in the dialog: re-evaluation always uses the snapshot active at incident time, so RAG/breach counts in the export match the configuration of that moment, never the current config.

## Technical notes

- All new state lives in `FilterProvider` so existing `useFilters` consumers pick it up; no backend changes.
- New drilldown type `'matrixCell'` requires a small switch in `DrilldownPanel.tsx`'s render block — reuse existing list styles.
- The RAG short-label map is the single source of truth; remove every ad-hoc `slice(0,3)` to prevent regressions.
- Export uses a client-side blob download (`Blob` + `URL.createObjectURL`), no server needed.
- Ledger entries continue to use the existing `fakeHash`/`LedgerEntry` shape so the immutable-chain UX stays consistent.
