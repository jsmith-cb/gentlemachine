# Schedule PDF Export Behavior

This document defines the intended behavior of PP Crew Schedule PDF exports.

The underlying Schedule screen and shared month/week projection are documented in
[Schedule Behavior](./SCHEDULE_BEHAVIOR.md).

## Purpose

Schedule export creates a deterministic, downloadable PDF from the canonical
Schedule projection. Export is a read-only representation and must not modify
Planner shifts, Team records, Store Hours, or other canonical planning data.

## Shared schedule semantics

Team and employee exports use the same:

- persisted shifts;
- Team employee identities;
- configured Store Hours;
- visible operating-day columns; and
- month and boundary-week semantics

as the Schedule screen.

The export service must not independently reconstruct these behaviors.

The selected calendar month remains the document period. The PDF includes complete
scheduling weeks that intersect that month, including planned adjacent-month days
at either boundary. Weeks that do not intersect the selected month are excluded.

For example, `28 Sep – 3 Oct` may appear in both September and October exports when
planned shifts exist in that intersecting week.

## Export scope

The single **Export PDF** action uses the current Schedule projection explicitly:

- **All employees selected** produces a complete team schedule.
- **One employee selected** produces an employee-specific schedule.

An unknown employee ID must fail explicitly. Export must never silently fall back
from an employee request to a team schedule.

## Team schedule

The team PDF contains the complete team projection for the selected month and its
intersecting boundary weeks.

Filename:

```text
pp-crew-schedule-YYYY-MM.pdf
```

## Employee schedule

The employee PDF contains only the selected employee's schedule. It must not expose
other employees' shifts or identities.

Employee contact details, including email address and telephone number, are not
part of the schedule export model and must not appear in the PDF.

Filename:

```text
pp-crew-schedule-<employee-name>-YYYY-MM.pdf
```

The employee-name component is converted to a safe, predictable lowercase slug.

## Employee with no shifts

For a known employee with no shifts in the selected scope, PP Crew still generates
an employee-specific document identifying:

- PricePocket Crew;
- the employee; and
- the selected schedule period.

The document states:

> No shifts scheduled for this month.

It must not fall back to a team schedule.

## Document presentation

- The document period remains the selected calendar month even when an intersecting
  week contains adjacent-month days.
- Weekly headings display the complete scheduling-week range, including cross-month
  ranges.
- Weeks should remain visually intact when page space permits.
- Pagination may place multiple weeks on one page, but must not alter schedule scope
  or data.
- Generated output is deterministic for the same canonical schedule projection.

## Architectural boundary

Export receives the shared Schedule projection and converts it into either a team
or employee document projection before rendering the PDF.

Conceptually:

```text
Canonical shifts + Team identities + Store Hours
                    ↓
          shared Schedule projection
                    ↓
            PDF export service
              ├── Team PDF
              └── Employee PDF
```

Privacy filtering belongs to the employee document projection, not to PDF drawing
code. Rendering must represent the prepared export model without rediscovering or
expanding its scope.

Changes to export scope, privacy, filenames, or presentation should be covered by
focused export tests.
