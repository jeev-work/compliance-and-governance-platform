
# Dependency cascade — auto-suggest close (Option 2)

When a child sub-ticket resolves, post a ledger note on the parent and surface a one-click "Verify & close parent?" banner. Human stays in the loop; the link is impossible to miss.

## 1. Data model (`src/lib/mockData.ts`)

Extend `DependencyFork` so the parent knows the child resolved and when:

```text
DependencyFork {
  team, timestamp, linkedId,
  status: 'open' | 'resolved',
  resolvedAt: string | null     // NEW — ISO ts when child closed
  resolvedBy: string | null     // NEW — actor on the child side
}
```

In `generateMockData`, the existing ~50/50 `open|resolved` split for seeded dependencies stays; when `status === 'resolved'` we now also seed `resolvedAt = ts + 1–4h` and `resolvedBy = pick(DEPENDENCY_TEAMS) + ' on-call'`.

Seed a handful (3–5) of demo rows where:
- parent KPI is still in `Investigating` / `Escalated to HOD`
- `dependency.status === 'resolved'` with a recent `resolvedAt`
- so the banner shows up immediately in the demo without any clicks.

## 2. Simulated child-resolution sweep (`src/lib/filterContext.tsx`)

Same pattern as the exec-flag expiry sweep: a 60s interval scans rows whose `dependency.status === 'open'`. With low probability per tick (~3%), flip a random open dependency to `resolved` with `resolvedAt = now`, `resolvedBy = '<team> on-call'`, and append a ledger entry:

> `"Linked child <SUB-id> resolved by <team>"` — actor: `System · Dependency Bridge`

This makes the cascade visible during a live demo without anyone touching the other team's queue. Skips Resolved/Clean parents.

## 3. Banner on the parent (`src/components/DrilldownPanel.tsx`)

In `BreachDetail`, just above the existing Dependency fork card, render a banner when:

```text
row.dependency?.status === 'resolved'
  && row.resolutionStatus !== 'Resolved'
  && row.status !== 'CLEAN'
```

Banner content:

```text
┌─────────────────────────────────────────────────────────────┐
│ ✓ Dependency SUB-12345 resolved by Network Ops · 14:32      │
│                                                              │
│ The blocking child ticket is closed. Verify telemetry and   │
│ close this parent KPI?                            [ Verify & Close ]
└─────────────────────────────────────────────────────────────┘
```

Styling: `bg-rag-green/8` border, `border-rag-green`, `CheckCircle2` icon. Not pulsing — calm, not alarming.

The **Verify & Close** button reuses the existing `onDeploy` path (Resolution Deployed → 3s telemetry hold → Closed) but with a different ledger phrasing:

- `"Parent closure suggested by cascade rule"` (actor: SPOC · You)
- followed by the existing Resolution Deployed / Ticket Closed entries
- adds detail: `"Triggered by child resolution: SUB-12345 (Network Ops)"`

After click, the banner disappears (parent is now Verifying → Resolved).

## 4. Dismiss / ignore path

A small `Dismiss` link on the banner (right side, muted) lets the SPOC say "no, I have more work to do here." Clicking it:
- sets a local `dismissedCascade` flag on the row (`dependency.cascadeDismissed: true`)
- writes ledger: `"Cascade suggestion dismissed"` (actor: SPOC · You)
- banner hides for this row until something changes

Auditors get the negative trail too — important for "why didn't you close it?" reviews.

## 5. Surface the link elsewhere

- **GroupDrilldown row chips** (the system/process/lob list): rows with `dependency.status === 'resolved'` get a small `↩ child resolved` badge so SPOCs can spot them without opening each one.
- **NotificationPanel**: add a "Cascade ready" group that lists every parent whose child resolved and which hasn't been closed/dismissed. One-click jumps into the drilldown.

## 6. Out of scope

- Hard cascade (auto-close without click) — explicitly rejected.
- Multi-level cascades (grandchild → child → parent) — current model only has one fork depth, leaving it that way.
- Reverse cascade (parent resolution closing children) — sub-tickets live on the other team's system; we only model the inbound signal.

## Files touched

- `src/lib/mockData.ts` — extend `DependencyFork`, seed resolvedAt/resolvedBy, seed demo banner rows
- `src/lib/filterContext.tsx` — child-resolution sweep + cascade-aware mutate helpers
- `src/components/DrilldownPanel.tsx` — banner, Verify & Close handler, dismiss link, GroupDrilldown chip
- `src/components/NotificationPanel.tsx` — Cascade-ready group

## Still pending your decision (not in this plan)

- **C2** GREY / BLUE exit criteria (heartbeat-driven recovery)
- **C3** Calendar-aware SPOC escalation (on-call roster vs. business calendar vs. full ITIL)

Want me to fold C2 + C3 into the same build, or ship cascade first and pick those up after?
