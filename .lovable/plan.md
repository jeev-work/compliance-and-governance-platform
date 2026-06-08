
# Revised plan

Right-rail dock dropped per your call — Notifications + KPI History stay as today's always-on overlays.

## A. Core fixes

**A1. Donut legend: GREY vs UNCONFIGURED look identical.**
Both currently render as grey hues in `ExecutiveView.tsx`. Promote UNCONFIGURED to a real token in `src/index.css` (`--rag-unconfigured: 265 20% 55%` — desaturated violet, distinct from GREY and BLUE). Point `RAG_HSL.UNCONFIGURED` at the token. Add a dashed ring on the UNCONFIGURED legend chip as a second cue for colour-blind users.

**A2. "Since Last Update 1651h 53m" on KPI 11242.**
`DrilldownPanel.tsx` computes time-since from the last chase event, but historical/closed rows carry timestamps up to 90 days old.
- Hide the stat when `resolutionStatus === 'Resolved'` or `status === 'CLEAN'`; render `—` with caption "ticket closed".
- Cap active-row display at `72h+`.
- In `mockData.ts`, anchor `makeChaseTimeline` for any non-Resolved row to `now − rand(5m..7h)` so demo "open/investigating/verifying" tickets always read fresh.
- Same hide-on-closed treatment for `escalationCountdown`.

## B. Accepted PM items

**B1. Back button on the drilldown panel.**
Keep a small drilldown stack (last 3 entries) in `filterContext`. `openDrilldown` pushes; the panel header gets a `←` button (top-left) that pops and re-opens the previous entry. Disabled when stack is empty. No breadcrumbs in the main view — keeps the surface clean.

**B2. Executive Flag expiry + Un-flag action.**
- Add `executiveFlagSetAt: string | null` to `KPIRow`.
- Auto-expire after 24h: a sweep clears `executiveFlag` when `now − setAt > 24h` and writes a ledger entry `"Executive Flag auto-expired (24h)"`.
- Add an **Un-flag** button next to Raise Flag in `DrilldownPanel`. Clicking writes `"Executive Flag cleared"` to the row's ledger + master ledger.

**Dropped:** right-rail dock, export-hint copy, role-switch audit (all per your call).

## C. Decisions needed — pick one per item

**C1. Dependency-fork cascade (parent ↔ child)**

1. **Soft link + notify.** Child resolution posts a comment + ledger entry on the parent (`"Linked child KPI-XXX resolved"`). Parent stays open. SPOC decides. Lowest risk.
2. **Auto-suggest close.** Same as above + a banner on the parent: *"Linked dependency resolved · Close parent?"*. Human-in-the-loop. **Recommended** — mirrors ServiceNow/Jira behaviour.
3. **Hard cascade.** When all child forks resolve, parent auto-moves Verifying → Resolved with system actor. Fast but risky — parent may have its own root cause.

Needs a `parentId` on `DependencyFork` either way. The cascade event always hits the ledger.

**C2. GREY / BLUE exit criteria**

- **GREY → GREEN** when *N* consecutive heartbeats arrive within the expected interval (e.g. 3 polls). Add `lastHeartbeatAt` + `expectedPollIntervalSec` per KPI; a sweep promotes GREY rows once the last 3 timestamps land within tolerance.
- **BLUE → previous state** when `maintenanceWindow.end` passes. Re-evaluate RAG from the next sample (not from the pre-maintenance state — the world may have changed). If no fresh sample arrives within 1 poll interval after window end, drop to GREY instead — telemetry must prove recovery.
- In mock data, a `setInterval` scans GREY/BLUE rows and flips them using synthetic heartbeats. In production the same rule lives in the ingest worker.
- Surface the rule in a donut tooltip so users see *why* a row is grey.

**C3. Calendar-aware SPOC escalation**

1. **On-call roster only.** Per system, store `oncallSchedule: { day: 0–6, fromHHMM, toHHMM, assignee }[]`. Escalation timer pauses outside the current SPOC's window and routes alerts to whoever is on-call. Cheap, covers 80%.
2. **Roster + business calendar.** Add `holidays: string[]` + an `escalationProfile` (`business-hours` | `24x7` | `follow-the-sun`). Timer respects working hours and skips holidays. **Recommended baseline.**
3. **Full ITIL service-hours.** Per-KPI `serviceWindow` (KYC = 24×7, DB Backup = business hours only) combined with the SPOC roster. SLA clock only runs during the service window AND only escalates when an on-call exists.

All three need a small `Schedule` registry surfaced in the Admin view. For the demo we ship #1 with seeded rosters and show the *clock state* (`Running` / `Paused — out of hours` / `Paused — holiday`) on the drilldown so the pause behaviour is visible.

## D. Files touched (A + B only)

- `src/index.css` — UNCONFIGURED token
- `src/components/views/ExecutiveView.tsx` — legend colour + dashed cue
- `src/components/DrilldownPanel.tsx` — sinceLast hide-on-closed, cap, back button, Un-flag action
- `src/lib/mockData.ts` — fresh chase timestamps for non-Resolved rows, `executiveFlagSetAt` field
- `src/lib/filterContext.tsx` — drilldown stack, flag-expiry sweep

Section C is decision-only — once you pick options I'll fold the chosen approach into the implementation.

## Open questions

1. Dependency cascade — go with **option 2 (auto-suggest close)**?
2. Calendar-aware escalation — ship **option 1 (on-call roster)** for the demo and list the rest as roadmap?
