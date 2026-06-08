# Demo data reset + export overhaul

## 1. Reset mock data to realistic, "live now" state
File: `src/lib/mockData.ts`

**RAG mix rebalance** (`pickRagState`, currently 78% GRN / 9% AMB / 6% RED):
- GREEN ~88%, AMBER ~7%, RED ~3%, GREY ~1%, BLUE ~0.8%, UNCONFIGURED ~0.2%
- Cap RED breaches per row: `5–80` (was `50–1550`) so totals look like a few hundred, not 179,625

**Per-system bias** so the System Health card is visually mixed (not all RED):
```text
Core Banking    → mostly GREEN (BLUE during maint window)
Payment Gateway → GREEN, occasional AMBER (GREY cluster stays)
CRM             → GREEN
Document Cloud  → AMBER-leaning (one of the warning systems)
Data Warehouse  → AMBER/RED-leaning (the hot system)
Auth Engine     → GREEN
```
Implement via a `SYSTEM_BIAS` table that perturbs `pickRagState` per row.

**Lifecycle freshness — close old, open new:**
- Any breach older than 24 h → force `resolutionStatus = 'Resolved'`, populate `timeToResolveMin`, append `Closed` chase step + ledger entry. No stale "Investigating" rows from 3 weeks ago.
- Open breaches (Open / Investigating / Verifying / Escalated) only generated for rows within the last 8 h, clamped to severity budget so countdowns read "12m left", "OVERDUE -4m" etc.
- New "fresh tickets" cohort: ~15 RED + ~25 AMBER created within the last 2 h, spread across the AMBER/RED-biased systems above.

**Ledger correctness** — `makeLedgerFromChase` already derives entries from `chaseTimeline`, so forcing closure above automatically gives every closed KPI a full Generated → Notified → Acknowledged → Resolved → Verifying → Closed micro-ledger.

## 2. Micro-ledger exports → CSV everywhere
File: `src/lib/exportLedger.ts`
- Add `exportMicroLedgerCsv(scope, entries, snapshots, context?)` that emits one row per ledger entry with columns:
  `timestamp, actor, action, details, hash, kpi_id, lob, system, process, sla_version_at_event, config_snapshot_id, threshold_at_event, current_sla_version, current_rag`
- CSV-escape (quote, double-quote internal quotes, CRLF line endings).
- Keep `exportMasterLedger` as JSON (it's a bundle of snapshots + master ledger — CSV would lose structure). Master export label still changes (see §3).
- Replace every `exportMicroLedger(...)` call site with `exportMicroLedgerCsv(...)`:
  - `src/components/views/ComplianceView.tsx` (row-level Export button)
  - `src/components/views/AdminHealthView.tsx` (LoB ledger, System ledger, KPI-level Micro Ledger)
  - `src/components/DrilldownPanel.tsx` (the `onExport` regulatory audit handler — wire it to CSV of the current row's `ledgerEntries`)

## 3. Simplify all export labels to "Export"
- `ComplianceView.tsx` L55: `Export Master Ledger` → `Export`
- `AdminHealthView.tsx` L213: `Export Micro Ledger` → `Export`
- `AdminHealthView.tsx` L69 (master ledger button label) → `Export`
- `DrilldownPanel.tsx` L539: `Export Regulatory Audit` → `Export`; toast message L296 → `Audit exported · hash: …` (keep hash for trust signal)

## 4. "br" → "breaches" (display strings only)
- `src/components/views/SpocView.tsx` L85
- `src/components/DrilldownPanel.tsx` L124
- `src/components/views/LobManagerView.tsx` L100
(Internal variable names `br` in ExecutiveView/AnalystView aggregations stay — they're not user-visible.)

## 5. System Health card — sort by breaches desc
`src/components/views/ExecutiveView.tsx` L79 — append `.sort((a, b) => b.breaches - a.breaches)` to `systemGrid`.

## 6. Export-button UX consolidation (proposal — pick one)

Right now the platform has ~6 export buttons scattered across Compliance, Admin Health (×3 cards + per-KPI), and the Drilldown panel. For a demo this reads as clutter. Three options:

**Option A — Single global "Export" menu in the top bar (recommended)**
One button in `GlobalFilterBar`. Opens a dropdown:
- Current view (CSV)
- Filtered KPIs + ledgers (CSV)
- Master ledger bundle (JSON, snapshot-stamped)
- Selected KPI micro-ledger (only enabled when drilldown is open)

Pros: one mental model, respects the active filter (so "what you see is what you export"), removes 5 buttons.
Cons: per-row Export in the Compliance ledger table is genuinely useful for auditors — keep that one inline, remove the rest.

**Option B — Contextual export only in Drilldown + Compliance row**
Remove the three card-level export buttons in Admin Health and the master-ledger button in Compliance. Move "Export Master" into the Admin Health header as a single overflow `…` menu. Keep per-row export in Compliance.

Pros: minimal change, still discoverable.
Cons: master-ledger export becomes one click deeper.

**Option C — Keep all, unify visual treatment**
Standardize every export trigger to the same icon-only button (`FileDown`) with tooltip, drop the text labels entirely. Same surface area, less visual weight.

Pros: zero IA change, lowest risk before the demo.
Cons: doesn't solve the "too many buttons" feeling, just makes them quieter.

**Recommendation: A**, with the Compliance per-row Export retained. Want me to wire that up after the data reset?

## Technical notes
- All changes are presentation + mock-data layer; no schema, no backend.
- `generateMockData` is deterministic (seeded 42) — same seed will regenerate the new realistic dataset on every refresh, so the demo is reproducible.
- Reusing existing `makeChaseTimeline` + `makeLedgerFromChase` means ledger consistency is preserved for free once `resolutionStatus` is corrected.

## Open question
Confirm you want Option A for the export consolidation, or pick B / C — I'll implement the rest regardless.
