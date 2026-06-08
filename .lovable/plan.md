## Move Export to bottom-right consistently across all drilldown modals

Right now `FooterExport` sits on the bottom-left of every drilldown footer. In the dynamic control / BreachDetail modal it also appears *before* the Actions row, which puts it ahead of Acknowledge / Resolve / Reassign / Escalate / Executive Flag. The user wants Export consistently anchored to the **bottom-right** corner of every modal footer.

### Target layout (BreachDetail / dynamic control)

```text
[ Actions: Acknowledge  Deploy  Reassign  Escalate  Executive Flag  …                Export ↓ ]
   left edge                                                                       right edge
```

- Actions label + all action buttons stay on the left, in current order.
- Executive Flag stays inside the Actions cluster (it is already the last action).
- `FooterExport` moves to the far right via `ml-auto`.
- Remove the divider (`w-px h-5 bg-border`) that currently separated Export from Actions on the left.

### Target layout (MatrixCellDrilldown + GroupDrilldown)

These modals have no action buttons — only Export. Push it to the right:

```text
[                                                                                   Export ↓ ]
```

- Same footer container, just `justify-end` (or `ml-auto` on the button) so Export hugs the right edge.

### Files & edits

`src/components/DrilldownPanel.tsx`

1. **BreachDetail footer (≈L748–L800)**
   - Remove the leading `<FooterExport …/>` and the `<div className="w-px h-5 bg-border mx-1" />` divider at the top of the footer.
   - Keep the `Actions` label + every `ActionBtn` exactly where they are.
   - After the last action button (and the read-only fallback span), append `<FooterExport onClick={onExport} />` wrapped with `ml-auto` so it sticks to the right edge.

2. **MatrixCellDrilldown footer (≈L189–L191)**
   - Change footer container to `justify-end` (or add `ml-auto` to the button) so Export sits on the right.

3. **GroupDrilldown footer (≈L1280–L1282)**
   - Same change: Export aligned right.

No logic, no styling-token, no data changes — purely footer alignment. Consistent rule: **Export is always the right-most element in any drilldown footer.**

### Out of scope
- Global filter-bar Export pill (already removed in the previous batch).
- Compliance view per-row Export link (table cell, not a modal footer — stays as-is).
