# Plan: Severity model, drilldown polish, and platform-wide UX fixes

Batch of ~13 changes across the dashboard. Grouped by area; each item maps to specific files.

---

## 1. Severity model — answer & implementation

**Your question:** does severity come from KPI importance, or from predicted likelihood of breach?

**Answer: both, on two separate axes.** Collapsing them into one number is what causes the confusion. Industry standard (ITIL / ServiceNow / PagerDuty) splits them:

- **Impact (static, set at KPI creation):** how much it hurts the business if this KPI breaches. Driven by the KPI's role — e.g. "UPI auth success rate" = Tier-1, "internal report freshness" = Tier-4. Set once by Admin, lives on the KPI definition. Doesn't change tick to tick.
- **Urgency (dynamic, computed live):** how close this specific breach is to going critical right now. Driven by failure-rate trend, time-since-detection, and the existing `riskScore`.
- **Severity = Impact × Urgency** via a 4×4 matrix → Critical / High / Medium / Low. This is what you already display, but right now it's derived ad-hoc from `failureRate` only (`mockData.ts` L298-300).

**Code changes:**
- `KPIRow` gets `impactTier: 'T1' | 'T2' | 'T3' | 'T4'` and `urgencyScore: 1 | 2 | 3 | 4`.
- `severity` becomes a pure function `sevMatrix(impact, urgency)` — no more inline ternary.
- Drilldown header shows both chips: `Impact: T1 (Customer-facing payments)` and `Urgency: 3/4 ↑ trending`. Combined Severity badge stays as the headline.
- **Impact tiers hardcoded per your decision:** Payments LoB → T1; Cards/Lending → T2; Operations/Risk → T3; Internal reporting/back-office → T4. Seeded deterministically in `generateMockData`.

**UI — new filter tab in the top bar:**
- Add a **Severity** chip group to `GlobalFilterBar.tsx` (Critical / High / Medium / Low) alongside existing RAG and State chips. Filter logic already exists in `filterContext.tsx` L259 (`filters.severities`) — currently no UI. Wire it up.
- Add a small **Impact** dropdown (T1–T4) next to it for "show me only Tier-1" auditor flows.

---

## 2. Export buttons — consolidate & relocate

- **Remove** the global Export pill from `GlobalFilterBar.tsx` (top-right).
- Inside every drilldown modal (BreachDetail, MatrixCellDrilldown, GroupDrilldown), place a single button in the **bottom-left footer**: `↓ Export` (icon `Download` + the word "Export", nothing else). No more "Export Regulatory Audit" / "Export Ledger" variants.
- One button = exports the current scope as CSV. Filename encodes scope.
- Where a modal has multiple exportable things (ledger + chase timeline + comments), the button opens a tiny popover with checkboxes — defaults all checked.

---

## 3. CSV-only exports everywhere

- `exportMasterLedger` currently emits JSON → switch to CSV using existing `csvCell`/`csvRow` helpers in `exportLedger.ts`.
- Keep JSON **only** for KPI-creation config-file *imports* (Admin panel).
- Remove the JSON download path from `exportLedger.ts`.

---

## 4. Back button fix

`BackButton` currently hides when `canGoBack=false`, so a single drilldown has nowhere to go and the button vanishes mid-flow. Fix:

- BackButton always renders. If stack > 0 → pop. If stack empty but drilldown open → close (same as ×). Tooltip changes accordingly.
- Back never "disappears" — it always goes one step back, ending at the main view.

---

## 5. Dynamic control chart — `Time to Escalate`

When `row.resolutionStatus === 'Resolved'`, render `Time to Escalate: Not applicable` (muted) instead of a live timer.

---

## 6. Reassign modal — richer search + filters

In the reassign dialog (`DrilldownPanel.tsx` L846+):
- Search box matches name, LoB, system, AND department/designation.
- Three filter dropdowns above the list: **LoB**, **Department/System**, **Designation** (SPOC / Lead / Manager). Multi-select. Default: pre-filter to current ticket's LoB+system so "someone else on the same team" is one click.
- Show LoB + dept under each candidate's name so the auditor sees why they matched.

---

## 7. SPOC diagnostic modal — live Activity Log mirror

Add an **Activity Log** card to the BreachDetail SPOC view that mirrors `row.ledgerEntries` in human-readable form, newest-first. Same data source, friendly render: icons per action type, relative timestamps ("3m ago"), actor avatar. So users don't need to export the ledger to see what happened.

---

## 8. Comment box on Resolve

When the user clicks **Resolve** / **Verify & Close**, open a small inline form instead of closing immediately:
- Required textarea: "What was resolved?"
- Optional media upload (item 10).
- Submit → writes comment + media refs into the ledger entry's `details` and into the Activity Log.

Same flow for the cascade close button.

---

## 9. LoB-view diagnostic modal — Escalation Trail

Add a vertical timeline card **Escalation Trail** in the LoB drilldown showing every assignee this ticket has had: name → role → assigned-at → handed-off-at → reason. Derived from existing `row.escalations` + ledger entries (filter `Reassigned` / `Escalated`). No new state.

---

## 10. "Add media" everywhere there's a comment box

Add an upload control (image/screenshot, multiple, max 5MB each) to:
- Escalation comment
- Resolve comment (item 8)
- Cross-functional dependency comment (item 11)
- Any future comment input

Implementation: file read as data URL client-side (prototype, no backend yet), stored on the ledger entry as `attachments: string[]`. Render as thumbnails in the Activity Log. One shared `<CommentBoxWithMedia>` component used everywhere.

---

## 11. Cross-functional dependency tag — dropdown + comment **(revised per your note)**

When the user clicks the cross-functional dependency tag action, open a small modal with:
- **Team dropdown** — `DEPENDENCY_TEAMS` (Network Ops, Vendor Settlement, Identity, etc.)
- **System dropdown** — from `registries.systems`
- **LoB dropdown** — from `registries.lobs`
- **Comment textarea** (plain placeholder "Add a note", no leading question)
- **Add media** button (item 10)
- Submit → appends a ledger entry with the routing + comment + attachments to the parent (and to the child SUB-ticket once spawned).

No "why does this team own it?" prompt — just an open field.

---

## 12. Admin configuration panel — more outage examples

In `AdminHealthView.tsx`, the connector-health section only models "Connector Outage". Add varied failure examples (text-only, no RAG tile, no green/amber):
- "Schema drift detected on `payments_v2.metric_alerts` — 3 new columns ignored"
- "Auth token rotated upstream; last successful poll 18m ago"
- "Rate limit hit on metrics API (429) — backing off"
- "Webhook signature mismatch from incident provider"
- "Stale heartbeat: ServiceNow connector idle 42m (threshold 15m)"

Render as a plain list with severity dot + timestamp + recommended action. No traffic-light styling.

---

## 13. Compliance view heading

Change the page heading to `Compliance Auditor / System Analyst` so the same view reads for both personas.

---

## Out of scope (not in this build)
- Real predictive ML for urgency — using existing `riskScore` as proxy.
- Backend storage for uploaded media — data-URL only, prototype-grade.
- Calendar-aware SPOC escalation (C3) and GREY/BLUE exit criteria (C2) — still open from earlier.

## Files touched
- `src/lib/mockData.ts` — impactTier, urgencyScore, sevMatrix, hardcoded tier mapping
- `src/lib/filterContext.tsx` — Back button fallback
- `src/lib/exportLedger.ts` — JSON → CSV, single export entrypoint
- `src/components/GlobalFilterBar.tsx` — remove export pill, add Severity + Impact chips
- `src/components/DrilldownPanel.tsx` — footer export, back fix, NA escalate, reassign search, activity log, resolve comment, escalation trail, dependency modal
- `src/components/views/ComplianceView.tsx` — heading
- `src/components/views/AdminHealthView.tsx` — outage examples
- `src/components/CommentBoxWithMedia.tsx` — **new**, shared
