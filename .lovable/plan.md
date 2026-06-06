## Root cause

`escalationCountdown` (`src/lib/utils.ts`) has early returns for `CLEAN`, `Resolved`, `Escalated to HOD`, and `paused dependency` rows. Anything else falls through to a live `budget - elapsedMin` calculation. The previous fix in `mockData.ts` clamped `ts` only for `Open` / `Investigating` / `Escalated to HOD` rows — but **`Verifying` rows were left with their original 0-90-day-old `ts`**. Those rows are still `BREACHED` and have no early return, so they render as `OVERDUE · -628h 1m`.

KPI-35513 is one of those Verifying-state rows.

## Fix

**Single file: `src/lib/mockData.ts`**

Extend the `isOpen` clamp to also cover `Verifying`:

```ts
const isOpen =
  resolutionStatus === 'Open'
  || resolutionStatus === 'Investigating'
  || resolutionStatus === 'Escalated to HOD'
  || resolutionStatus === 'Verifying';
```

For Verifying rows we want the countdown chip to read like "12m left" / "OVERDUE · -8m" — same realistic range as the other open states — so we reuse the same `budget × 1.4` window.

Also tighten `timeToResolveMin` for `Verifying` rows so the "Time to Resolve" tile doesn't claim 47 hours on a ticket that just deployed: cap it at `budget` minutes (`Math.floor(rand() * budget) + 5`). `Resolved` rows keep the existing 30–2910 min range — those reflect historical resolution time and the chip just shows "resolved in Xh Ym", which is fine.

## Defensive belt-and-braces in `src/lib/utils.ts`

To make sure no future regression can produce a multi-hour `OVERDUE` chip, clamp the displayed remaining to a sane floor inside `escalationCountdown`:

```ts
const displayRemaining = Math.max(remaining, -budget); // never worse than 1× budget overdue
if (remaining < 0) {
  return { label: `OVERDUE · ${fmtMinutes(displayRemaining)}`, tone: 'red', overdue: true };
}
```

This is purely cosmetic — operational logic (auto-escalate trigger) still uses `remaining`, only the label is bounded.

## Verification

- Reload preview; KPI-35513 (and any other `Verifying` row) should show a countdown in minutes/single-digit hours, not -628h.
- `Resolved` rows still show their existing "resolved in 4h 12m" chip unchanged.
- Trend charts spanning 90 days are unaffected (clamping only touches the small subset of currently-open rows).

## Out of scope

- Changing the auto-escalate logic itself.
- Reshuffling historical resolved-row timestamps (those drive trend depth and should stay).
