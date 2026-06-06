## Issue

Preview is blank because `generateMockData` throws:

```
TypeError: Cannot read properties of null (reading 'name')
  at src/lib/mockData.ts:409
```

`assignee` is typed `{ name; role } | null` and stays `null` for CLEAN / unassigned rows, but the new `makeLedgerFromChase(...)` call passes `assignee.name` unconditionally.

## Fix

In `src/lib/mockData.ts` line 409, guard the access:

```ts
ledgerEntries: makeLedgerFromChase(
  rand,
  chaseTimeline,
  ragState,
  severity,
  assignee?.name ?? 'Unassigned',
  !!dependency,
  !!executiveFlag,
),
```

No other files need changes. `makeLedgerFromChase` already returns an empty array when `chaseTimeline` is empty, so unassigned CLEAN rows will continue to show an empty ledger.
