# Schedule Behavior

This document defines the intended behavior of the PP Crew Schedule screen and its
shared schedule projection.

## Purpose

Schedule is a read-only communication view of planned work. It presents canonical
Planner shifts in a weekly employee-by-day matrix. It does not create, modify, or
reinterpret shifts.

Shift creation and editing remain Planner responsibilities.

## Sources of truth

Schedule consumes the canonical:

- persisted shifts;
- Team employee records; and
- configured Store Hours.

Employee names are resolved from Team data. Inactive employees must remain
resolvable when existing displayed shifts reference them.

## Month and scheduling-week scope

The selected calendar month is the primary navigation period. A scheduling week
provides the context in which that month is displayed.

The shared rule is:

> Show complete scheduling weeks that intersect the selected month, including
> planned adjacent-month days in those weeks. Exclude weeks that do not intersect
> the selected month.

This rule is symmetric at both month boundaries.

For example, if the scheduling week is `28 Sep – 3 Oct`:

- the September view may show planned shifts from 28 September through 3 October;
- the October view may show the same complete scheduling week; and
- neither view includes an unrelated week such as `21 Sep – 26 Sep` merely because
  it is close to the boundary.

The overlapping week intentionally appears in both months. This gives the manager
a complete operational week rather than splitting one workweek across two views.

Only persisted shifts are shown. Adjacent dates are not populated with inferred or
generated shifts.

## Visible day columns

Day columns come from the authoritative Store Hours configuration:

- only configured open operating days are shown;
- days remain in chronological weekday order within the scheduling week; and
- Schedule must not independently hard-code Monday–Saturday or any other fixed set
  of days.

Changing Store Hours should therefore change the visible Schedule columns without
requiring Schedule-specific operating-day configuration.

## Employee selection

- **All employees** shows the team projection.
- Selecting an employee shows only that employee's projection.
- Active employees are available for normal selection.
- An inactive employee remains visible when an existing displayed shift references
  them.
- Employees scheduled only on an adjacent day in an intersecting boundary week are
  included where necessary.

## Empty state

If no persisted shifts fall within the selected month or its intersecting boundary
weeks, Schedule shows its empty state.

## Shared projection responsibility

The shared Schedule projection owns:

- selected-month and boundary-week scoping;
- Store Hours-derived columns;
- employee identity resolution; and
- employee filtering.

The Schedule page consumes this projection rather than independently rebuilding
these rules.

Conceptually:

```text
Canonical shifts + Team identities + Store Hours
                    ↓
          shared Schedule projection
                    ↓
              Schedule screen
```

The PDF export service also consumes this shared projection. Its additional rules
are documented in [Schedule PDF Export Behavior](./SCHEDULE_EXPORT_BEHAVIOR.md).

Changes to Schedule scope should be made in the shared projection and covered by
focused Schedule tests.
