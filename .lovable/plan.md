# Per-KPI Ledger from Chase Timeline

Right now every KPI seed emits exactly one ledger entry — `KPI Generated` — even when the chase walked all the way through Acknowledged → Resolved → Verifying → Closed. The diagnostics modal therefore looks empty. Fix: derive the immutable ledger from the same chase timeline that already drives the modal, and correct the language ("ticket" lifecycle, not "KPI" lifecycle).

## Terminology fixes
| Old | New |
|---|---|
| `KPI Generated` | `Ticket Generated` |
| `Closed` (chase step label "Closed" → ledger) | `Ticket Closed` |

(`Notified`, `Acknowledged`, `Resolution Deployed`, `Verifying Fix` keep their names — they describe what happened, not "KPI lifecycle".)

## Generator change (`src/lib/mockData.ts`)
Replace the single-entry seed with a derived list built from `chaseTimeline`:

```text
for each chase event:
  Generated         → "Ticket Generated"   actor=System            details="RAG=<r> · sev=<s>"
  Notified          → "Notified"           actor="Notifier Bot"    details="SPOC=<assignee>"
  Acknowledged      → "Acknowledged"       actor=<event.actor>     details="Chase timer halted"
  Resolved          → "Resolution Deployed" actor=<event.actor>    details="RCA submitted"
  Verifying         → "Verifying Fix"      actor="System · Telemetry" details="Validation hold"
  Closed            → "Ticket Closed"      actor="System · Telemetry" details="RAG returned to GREEN"
```

Each entry gets its own `fakeHash('LDG')` so the SHA-style proof is per-event, not shared.

For CLEAN (non-breached) rows the chase timeline is empty → ledger stays empty (no "Generated" noise), matching "we only generate tickets when a breach happens".

For Exec-flagged or dependency rows, the existing extra chase events (`Dependency fork`, `Executive reassign`) are already in `chaseTimeline.actor`; we'll surface them as `Multi-Team Dependency` / `Reassigned` entries when the actor string contains those markers.

## Diagnostics modal (`src/components/DrilldownPanel.tsx`)
Already renders `row.ledgerEntries` — no template change needed. Live actions (`Acknowledge`, `Deploy Resolution`, `Enable Dependency`, etc.) already append entries with `newLedgerEntry(...)` and will continue to do so, so the ledger keeps growing in real-time during the demo. Only the labels of two future actions get aligned:
- `Acknowledged` (already correct)
- `Verified & Closed` → rename to `Ticket Closed` for consistency

## What we are NOT changing
- The chase timeline UI itself (already shows steps in order).
- Live-action append logic — still hash-stamped, still appears at the bottom of the ledger.
- Master / LoB / system ledgers shown in Compliance view.

## Files touched
- `src/lib/mockData.ts` — replace the single-entry seed with `makeLedgerFromChase(...)`; rename "KPI Generated" → "Ticket Generated".
- `src/components/DrilldownPanel.tsx` — rename `Verified & Closed` → `Ticket Closed` in the resolve flow.

Approve to build.
