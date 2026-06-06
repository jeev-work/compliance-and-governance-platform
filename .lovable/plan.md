Four independent changes. All scoped to existing files; no schema or backend work.

## 1. Reassign → dropdown of people with phone numbers

**File:** `src/components/DrilldownPanel.tsx`

- Replace `onReassign` (line 271, currently picks a random name silently) with `openReassignModal` that opens a new dialog.
- Add `reassignModal` state next to existing `execModal`/`depModal`: `{ assignee, reason, step }`.
- Build dialog (same overlay/card pattern as the Executive-Flag modal at ~line 597). Contents:
  - Header: "Reassign Ticket"
  - Current assignee line with existing `ContactPhone` chip
  - `<select>` labelled "Reassign To" populated from `ASSIGNEES` (already exported from `mockData.ts`, 10 people with name + role + phone). Current assignee filtered out. Option label: `Name — Role`.
  - To the right of the dropdown render the selected person's phone as a `tel:` link with the `Phone` icon (reuse `ContactPhone`), so the user can call them before confirming.
  - Optional "Handover note" textarea.
  - Footer: Cancel + Confirm Reassignment.
- `commitReassign` mutates `assignee` to the full `ASSIGNEES` record (so role + phone propagate), pushes a `Notified` chase event, appends a `Reassigned` ledger entry including the note, toasts confirmation. Executive-Flag modal is left untouched.

## 2. SPOC view — disable buttons after use

**File:** `src/components/DrilldownPanel.tsx` (action buttons live in the drilldown, used by SPOC)

- `Acknowledge` button: disabled when `row.resolutionStatus !== 'Open'` OR `row.stateFlags.includes('Acknowledged')`. Already-acknowledged rows show the button greyed with label "Acknowledged".
- `Deploy Resolution` button: disabled when `row.resolutionStatus` is `Verifying` or `Resolved`, or the row is `CLEAN`.
- `Enable Multi-Team Dependency` button (opens `depModal` `enable`): disabled when `row.resolutionStatus` is `Verifying`/`Resolved` OR a dependency is already open. Label switches to "Dependency Active" when one exists.
- Disabled state uses existing `ActionBtn` styling — add a `disabled` prop that applies `opacity-50 cursor-not-allowed pointer-events-none` and skips the `onClick`.

No business-logic change — same handlers, just gated.

## 3. Per-role notification panel on the home page

**File:** new `src/components/NotificationPanel.tsx`, mounted in `src/pages/Index.tsx` above the role view (after `KpiHistoryPanel`).

The panel reads `useFilters()` and renders a compact, collapsible card whose contents change per role:

| Role | Notification feed contents (top 5, scroll for more) |
| --- | --- |
| executive   | New RED breaches in last 24h + any `executiveFlag` rows + escalations to HOD |
| lobManager  | Unacknowledged breaches in scoped LoB + countdown-overdue rows + cross-functional forks needing visibility |
| spoc        | Unacknowledged + Investigating rows assigned to current scope (chase-timer red zone first) |
| compliance  | Newly-Resolved rows pending ledger sign-off + any GREY-state rows (data integrity) |
| analyst     | Top 5 KPIs by 7-day breach trend delta (drives investigation) |
| admin       | Connector outages (GREY clusters) + verification-pending rows + most recent ledger writes |

Each notification is a row with: icon (severity tone), KPI id (mono), system/process, short reason, timestamp ("12m ago"), assignee + phone via `getContactPhone`. Click → existing `openDrilldown('breach', row.id, row)`. Empty state: "All clear — no notifications for this role." Toggle button collapses the panel; state lives in local React state (no persistence needed).

## 4. Fix unrealistic countdowns ("OVERDUE · -13h 35m" etc.)

**File:** `src/lib/mockData.ts`, `generateMockData` (lines 169–260)

Root cause: `baseDate` is hard-coded to `May 14, 2026` while today is `June 6, 2026`, and `hoursAgo` spans 90 days. Every open breach is therefore weeks past its 30–240-minute SLA budget, so `escalationCountdown` shows huge negative values.

Changes (data generation only — no logic change in `utils.ts`):

- `const baseDate = new Date();` (current time at generation).
- Keep the 90-day window for **historical** rows (`Resolved`, `CLEAN`, `Verifying`), so trend charts still have depth.
- For rows that will end up `Open`, `Investigating`, `Escalated to HOD`, or `Unacknowledged`, clamp `ts` to within the last `severity` budget × 2 (i.e. Critical within 60 min, High within 120 min, Medium within 4 h, Low within 8 h). Implementation: after the row is shaped, if `status === 'BREACHED'` and `resolutionStatus` is one of the open states, recompute `ts = new Date(now - rand() * budget*2 * 60000)` and propagate to `timestamp`, ledger seed, and chase-timeline offsets.
- Grey-outage cluster anchor (`greyOutageStart`) repointed to `baseDate - 2d` so it stays inside the visible window.
- Blue maintenance window: change the Saturday filter to "within the last completed Saturday window" so it doesn't bunch into a single ancient date.
- Resolved rows keep their actual age (chips already show "resolved in 4h 12m" — that's fine and stays).

Result: most open breaches show realistic countdowns ("23m left", "1h 04m left", at worst "OVERDUE · -45m") instead of "-13h 35m".

## Out of scope

- Persisting notification dismissals or panel collapsed-state across reloads.
- Changing role-based access for the Reassign button (still gated by `ROLE_ACTIONS`).
- Editing the separate Executive-Flag reassignment dialog.
