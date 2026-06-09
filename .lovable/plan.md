## Scope

A coordinated set of changes across Compliance, Executive, Admin, LoB Manager, Drilldown, Notification, and Add-entity flows. Grouped so each area is one cohesive edit. The truncated macro-control item is now folded in as the **Severity Summary + Pinned KPI Rail** at the top of every view.

---

## 1. Role unification — Compliance / Auditor / Analyst → one view

- In `src/lib/rbac.ts`: remove `analyst` role from the `Role` union usage (keep the type-safe enum if widely referenced, but route its label to the compliance view). Update `ROLE_LABEL.compliance` to **"Compliance Officer / Auditor / Analyst"** and `ROLE_PURPOSE.compliance` to reflect the merged scope (immutable ledger + historical trend + SLA% MoM + hashed regulatory export, no PII).
- `src/components/AppSidebar.tsx`: drop the "Generic Viewer / Analyst" entry; the analyst sidebar blurb is folded into compliance.
- `src/components/views/AnalystView.tsx`: delete from routing. `ComplianceView.tsx` absorbs its two read-only widgets (SLA% trend, historical aggregates) as collapsible sections below the ledger table.
- `src/pages/Index.tsx` (or wherever the role switcher renders): remove the Analyst option.

## 2. Compliance view — SLA version transparency

In `src/components/views/ComplianceView.tsx`:

- Side panel heading → **"Compliance Officer / Auditor / Analyst View"**.
- In the SLA version table, add an `ⓘ` icon button in front of each `SLA_vX.Y` cell. Click opens a small popover showing: `Deployed at` (ISO), `Reason / change note`, `Actor`, `Supersedes`, `Replaced by`. Data comes from `configSnapshots` (`src/lib/filterContext.tsx`) and `slaHistory[]` already on each row (`src/lib/mockData.ts`).
- Add a new column **Actor** between *Version* and *Threshold*, sourced from `slaHistory[i].changedBy`.

## 3. Executive view — severity summary + time-of-day + pinned tiles

In `src/components/views/ExecutiveView.tsx`:

- Add a **Severity Summary strip** at the top with five compact tiles: Critical / High / Medium / Low / Info counts, each clickable to filter.
- Add a **System × Hour Heatmap** card (24 columns × N systems): cell shade = breach intensity for that hour bucket. Generate hour-of-day data in `mockData.ts` by deriving `hourOfDay` from existing breach timestamps (or synthesise per-row hourly buckets if absent).
- Macro dashboard already aggregates — extend it to also display "Worst window" callouts under the heatmap (e.g., "Payments — peak breaches 17:00–19:00").

## 4. System drilldown — sparklines + peak windows

In `src/components/DrilldownPanel.tsx` (SystemDrilldown / GroupDrilldown branch):

- Add a per-system 24h sparkline (recharts `LineChart`, height 60) showing breaches by hour.
- Auto-detect the top-3 peak hours and render badges: `Peak 17:00–19:00 · 42 breaches`.
- Source the same hourly buckets added in step 3.

## 5. Pinned KPI rail + drilldown "Pin" action + severity bucket counts in notifications

- New component `src/components/PinnedKpiRail.tsx`: horizontal strip of compact RAG tiles rendered between the notification panel and the main view content, per role. Persist pins in `localStorage` keyed by role (`pinned-kpis:{role}`). Each tile shows KPI id, system, current RAG, click → opens breach drilldown.
- In `DrilldownPanel.tsx` BreachDetail header, add a **Pin** icon button next to the existing header controls — toggles membership in the role's pinned list.
- `src/components/NotificationPanel.tsx`: add a top summary row with severity-bucket counts (Critical / High / Medium / Low) and a per-bucket count of currently-breaching KPIs. Allow pinning a *group* (e.g., all Critical) via a small pin icon per bucket.

## 6. Admin Health — major restructure

In `src/components/views/AdminHealthView.tsx`:

- **Remove** the top-right "Config Snapshots" card (L94–112).
- **Remove** the Master Ledger block at the bottom (L257–274). Per-KPI export already covers it.
- **Remove** the "Read-only role · no actions available" banner from `DrilldownPanel.tsx` L796 when role is `admin`. Admin gets full actions.
- **Per-KPI SLA Version History (L162–255)** becomes the unified panel:
    - Left: KPI picker (unchanged).
    - Right: existing version table, with new columns ordered as **Version · Active From · Active Till · Changed By · Threshold · Change Note**. `Active Till` = next version's `activeFrom` or "—" if active. Each version row gets a hoverable `ⓘ` against `SLA_vX.Y` showing the snapshot metadata (same popover content as compliance step 2).
    - Below the version table, render an inline **Configuration Snapshot** detail card for the currently active version (deployment date, RAG rules summary, actor, change note) — replaces the removed top card.

- **Grey-State Pipeline Alerts (L142–159)**:
    - Tiles are now clickable → open the existing breach drilldown for that KPI.
    - Show **"Connection lost X ago"** (compute from a new `connectionLostAt` field on grey rows in `mockData.ts`).
    - Add 6–8 fresh dummy grey rows representing recently lost connections.

- **LoB / Systems registry cards (L83–93)**:
    - Remove the per-row Export buttons.
    - LoB name and System/Dept name become clickable → opens a new **summary drilldown modal** listing all KPIs from that LoB/Dept ordered by breach count (descending, greens included). Reuses `openDrilldown('lob' | 'system', name)`.
    - From this list, clicking a KPI opens the standard diagnostic drilldown with an additional **"Change Config"** action button offering: *Add new configuration file* (file picker) or *Switch existing* (dropdown of versioned configs like `Festival-Season-v2`, `Winter-2024`).

## 7. Unconfigured KPI lifecycle

Platform-wide, treat `ragState === 'UNCONFIGURED'` as visible to viewers but actionable in Admin:

- Notification panel + view tables: render unconfigured KPIs with their existing dashed treatment plus a small "Needs configuration" tag.
- `DrilldownPanel.tsx`: for unconfigured KPIs, surface an **Escalation Trail** card with chase entries (who was nudged, when, response) — even when the connection is dead. Show **"Connection dead for X"**.
- Admin view: under Grey-State Pipeline Alerts (or a sibling card), add an **"Unconfigured KPIs — needs setup"** list with an **"Add Configuration"** button per row, plus a **"Contact {owner} at {org} to restore connection"** message for dead-connection rows. Action also writes to escalation trail.
- Add 5–6 dummy unconfigured KPIs with chase history in `mockData.ts`.

## 8. LoB Manager view polish

In `src/components/views/LobManagerView.tsx`:

- Fix typo: header "Escalation Rail" stays, but body label uses "Escalation Trail" — and seed 8–10 dummy escalations so the rail is never empty (push synthetic rows into `rail` when `filteredData` yields none).
- Add a new **Recent Escalation Trails** card below the matrix: timeline of last 10 escalation events (who escalated, KPI, to whom, when, current status).
- Aggregated matrix cell label: replace `br.` with the full word `breaches` (L100).

## 9. Add KPI / LoB / Department — richer authoring

In `AdminHealthView.tsx` `AuthoringModal` (L276+):

- For **Add KPI**, **Add LoB**, **Add Department**, add tabs at top of the modal:
    1. **Manual** (existing form).
    2. **Import config (JSON)** — file input. Parses uploaded `.json` against the existing KPI config shape (`AddKpiInput`). On valid parse, shows a **"Ready to Import"** badge and enables the primary Add button.
    3. **Clone from existing** — searchable dropdown of existing KPIs/LoBs/Depts; selecting one pre-fills the form for editing before save.
- **Add LoB form** additional fields:
    - Owner / Head name, contact (email + phone), escalation chain (HOD, deputy).
    - Region / geography, business criticality tier (T1–T4).
    - Parent LoB, cost center, regulatory scope (multi-select: RBI, SEBI, IRDAI, Internal).
    - Linked systems (multi-select from registry), default SLA template (dropdown of existing `SLA_vX.Y`).
- **Add Department form** mirrors the LoB fields (owner, region, tier, linked systems, default SLA).
- Persist new fields on the registry entries in `filterContext.tsx` (`registries.lobs` / `registries.systems` shapes get extended; downstream usages only read `name`, so additive).

---

## Technical notes

- **Hour-of-day data**: extend `KpiRow` in `src/lib/mockData.ts` with `hourlyBreaches: number[24]` and populate during generation. All hour-of-day visuals derive from this single field.
- **Pin persistence**: `localStorage`, no backend; keyed per role to avoid leakage between role switches.
- **SLA info popover**: small `Popover` from existing shadcn components, reusable across compliance and admin.
- **No backend changes** required — all data lives in `mockData.ts` and `filterContext.tsx`.
- **Out of scope**: changing existing severity matrix logic, redesigning the global filter bar, touching the role switcher styling.
