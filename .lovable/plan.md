# Export placement + realistic numbers + mixed RAG

## 1. Where Option A lives in the UI

The top filter bar (`GlobalFilterBar.tsx`) already has a right-aligned status cluster (`{greyCount} GREY`, `{breachCount} breaches`, `{records}`). I'll add the **Export** control to the far right of that same row, *after* the records counter, separated by a `w-px h-5 bg-border` divider — same vertical rhythm as the rest of the bar, no new row added.

```text
[ search | role | date | LoB systems process | state | RAG | sev ]      … GREY  breaches  records │ ⬇ Export ▾
```

- Trigger: small `h-7` button, `FileDown` icon + "Export" label, matches existing chip styling.
- Opens a `Popover` (not full dropdown menu) with 4 items:
  1. **Current view (CSV)** — what the active role view shows
  2. **Filtered KPIs + ledgers (CSV)** — respects every active filter
  3. **Master ledger bundle (JSON)** — snapshot-stamped, existing `exportMasterLedger`
  4. **Selected KPI micro-ledger (CSV)** — enabled only when Drilldown is open; reads `filters.drilldown`
- Each item shows a tiny secondary line ("17 rows · current filter") so users know what they'll get.
- Per-row **Export** in the Compliance ledger table stays (auditor convenience).
- Removed: card-level Export buttons in Admin Health (×3), Compliance master-ledger header button, Drilldown "Export Regulatory Audit" button (subsumed into menu item 4 — drilldown stays open so users still hit it from one click).

If the filter bar wraps on narrow viewports, the Export pill wraps with the right-side cluster, which is fine — it already wraps today.

## 2. Realistic numbers fix

`generateMockData` currently produces 30,000 KPI rows with `baseVolume = rand × 500,000 + 1,000`. Even with capped breaches (5–80 RED, 1–20 AMBER), totals across 30k rows give:

- ~900 RED rows × ~40 avg = ~36k breaches
- ~2,100 AMBER × ~10 avg = ~21k breaches
- → still ~50–60k aggregate, and per-LoB ~17–20k each

Two changes:

**(a) Shrink the row count to demo-scale.** Drop from 30,000 → ~1,800 rows (90 days × ~20 KPI definitions × 1 row/day-bucket). Total breaches land at roughly 2–4k aggregate, ~600–1,300 per LoB, ~200–600 per system — readable in scorecards.

**(b) Shrink baseVolume to per-process realistic ranges.** Replace `rand × 500000 + 1000` with a per-process band:

```text
KYC Verification → 5k–25k          API Uptime      → 50k–200k
Ledger Sync      → 2k–8k           AML Screening   → 8k–40k
Ticket Routing   → 1k–5k           DB Backup       → 100–800
```

Failure-rate math stays meaningful (a 30-breach RED on 6,000 KYC volume = 0.5%, not 0.006%).

**(c) Tighten the SLA aggregate.** With smaller volumes the existing `(vol-br)/vol` math will naturally read 99.4–99.95% in green periods and dip into 97s during the fresh-breach window, instead of the artificial 99.99% it shows now.

## 3. Mixed RAG across LoBs in Executive view

Today every LoB ends up RED because:

- LoB bar color in `ExecutiveView.tsx` L186 is RED if **any** Critical exists, else AMBER. With 1,800+ rows per LoB, at least one Critical is essentially guaranteed.
- System Health uses `worst` ordering, same problem.

Fixes:

**(a) Per-LoB bias** — extend `SYSTEM_BIAS` with a parallel `LOB_BIAS` so:

- `B2C` → healthy (mostly green, occasional amber)
- `B2B` → mixed (green-dominant, recurring amber, rare red)
- `Wheels` → stressed (the demo "hot" LoB, more red/amber)

Picker becomes `pickRagState(rand, system, lob)` and multiplies the two bias vectors.

**(b) LoB bar color uses breach *intensity*, not "any Critical".** Switch L186 to:

```text
ratio = critical / totalRows
red    if ratio > 0.02
amber  if ratio > 0.005 or breaches > 0
green  otherwise
```

This way B2C/B2B render green or amber and only Wheels reads red — a realistic mix.

**(c) System Health worst-state stays, but with the new biases plus smaller row count it will naturally show Core Banking/Auth Engine = GREEN, Payment Gateway = GREEN/AMBER, Document Cloud = AMBER, Data Warehouse = RED, CRM = GREEN. Sort by breaches desc (already done).**

## 4. "All possibilities" demo strip

For the demo you need every state visible somewhere. Two parts:

**(a) Guaranteed-coverage seeding in `generateMockData`.** After the main loop, append 6 hand-crafted rows — one per RAG state (GREEN, AMBER, RED, GREY, BLUE, UNCONFIGURED) — pinned to recognizable system/LoB combos, each with a full chase timeline + micro-ledger so they look real in every view. These ride existing data structures, no schema change.

**(b) New "Demo: All States" strip on the Executive dashboard.** A thin row above the existing scorecards, 6 mini-tiles (one per RAG state) showing the seeded KPI's id, system, status, and a "View" link that calls `openDrilldown('kpi', id)`. Labelled `DEMO ROSTER · ALL 5+1 RAG STATES` in muted caption type so it's obviously a presenter aid, not production noise. Easy to toggle off later with one prop.

## 5. Out of scope for this pass

- "br" → "breaches" copy fixes and the export-label rename were shipped in the previous round; nothing to redo unless you spot a missed instance.
- No backend or schema changes — everything stays in `src/lib/mockData.ts`, `src/lib/exportLedger.ts`, `src/components/GlobalFilterBar.tsx`, `src/components/views/ExecutiveView.tsx`, plus button removals in `AdminHealthView.tsx`, `ComplianceView.tsx`, `DrilldownPanel.tsx`.

## Open questions

1. **Demo strip placement** — top of Executive (recommended, above scorecards) or a dedicated `?demo=1` overlay so it's hidden by default?  
No don't put demo strip, the left pane with all the 7 views is part of the demo navigator, and this whole platform is a wireframing prototype, so no reason to put the word demo anywhere
2. **Row count target** — 1,800 feels right for crisp numbers; want denser (~5,000) for a busier-looking grid?  
No, don't make it busy, make is just enough fot it to look good enough for a demo
3. **Wheels = stressed LoB** — happy with that, or pick a different LoB as the demo's hot zone?  
that's okay but it sin't about just the lob, i also sow that in the macro view dashboard everything was red, and were not ordered according to the number of breaches in descending order, if the sorting of the system health is not ordered, order that as well