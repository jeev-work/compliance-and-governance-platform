## Goal
Make the top search bar in `GlobalFilterBar.tsx` proactive: as the user types, a dropdown shows matching KPIs, systems, LoBs, processes, and assignees (e.g. typing `108` surfaces `KPI-10817`, `KPI-10842`, …). When the input is empty/focused, show recent searches.

## Behaviour
- **Dropdown opens** when the input is focused AND either has a query or has stored recents.
- **Empty query (focused):** show "Recent" section (up to 6 entries, most-recent-first, deduped).
- **Non-empty query:** show grouped suggestions, max ~8 total, ordered by group:
  1. **KPI** (id match — `KPI-108…` style; show id · system · resolutionStatus · RAG dot)
  2. **System / LoB / Process / Source** (registry/value match)
  3. **People** (assignee names)
  4. **Hash** (audit ledger hash prefix)
- Each row has a small left icon hinting the type and a faint right-aligned tag (KPI / System / LoB / Person / Hash).
- Matching is case-insensitive substring; KPI numeric shortcuts auto-prefix `kpi-` when user types digits only.
- **Keyboard:** ↑ / ↓ to move, Enter to commit (sets `searchQuery` and, for KPI rows, opens the drilldown), Esc closes.
- **Mouse:** click commits the same way.
- **Recents:** persisted in `localStorage` under `globalSearch.recents` (max 10). A recent stores the raw query string + optional `kpiId` if it was a KPI selection. Each recent row has an `×` to remove it; a "Clear recents" footer link clears all.
- Dropdown closes on outside click or Esc; selecting a KPI also closes it.

## Files touched
- **New:** `src/components/GlobalSearchSuggest.tsx` — the dropdown panel + keyboard logic. Receives `query`, `recents`, `onPick`, `onClearRecent`, `onClearAll`, `activeIndex`, `setActiveIndex`. Pure presentational + small hook for outside-click.
- **Edit:** `src/components/GlobalFilterBar.tsx` — wrap the existing input in a relatively-positioned container, add focus/blur state, mount `<GlobalSearchSuggest />` below the input, wire keyboard handlers on the input. Replace the static placeholder hint to mention "type KPI id, system, LoB…".
- **Edit:** `src/lib/filterContext.tsx` — expose `openDrilldown` is already available; no schema changes. Add a tiny helper `findKpiById(id)` exported from context (or compute inline in `GlobalSearchSuggest` using `allData` already exposed via `useFilters`).

## Suggestion source (no new data)
Use what `useFilters()` already exposes:
- `allData` → KPI rows (id, system, lob, process, assignee, auditLedgerId)
- `registries` → lobs, systems, processes
- Distinct assignee names derived from `allData` (memoized)

## Edge cases
- Numeric-only input like `108` → treat as KPI prefix; show KPIs whose id contains `108`.
- No matches → show single muted row "No matches for "<q>"" plus recents below.
- Recent that references a now-missing KPI → still selectable as a text search; if KPI exists, opening the drilldown takes priority.
- Long lists are capped (8 suggestions / 6 recents) to keep the panel compact and consistent with the existing dense bar.

## Out of scope
- Fuzzy ranking beyond substring + group order.
- Server-side search or analytics on search usage.
- Changing the existing `searchQuery` filtering pipeline in `filterContext` — suggestions are an additive layer.
