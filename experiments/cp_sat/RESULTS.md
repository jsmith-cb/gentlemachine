# CP-SAT feasibility spike results

## Control boundaries

- Production generation was not replaced or wired to CP-SAT.
- The benchmark fixture is immutable and excludes inactive Portal Test.
- Both engines use full scheduled-span minutes for weekly targets and daily limits.
- Both engines use the identical Test B SchedulingRuleSettings for the schedule
  comparison: coverage Require, Saturday off Require, contracted hours Prefer.
- Both engines use the prescribed two-hour minimum, eight-hour maximum, canonical
  availability/absence/store boundaries, and the same November boundary shifts.
- Test A requires contracted hours, coverage, and one Saturday off.
- Test B relaxes only contracted hours to Prefer. Its restored preferred position is
  after overlap and before consolidation.
- Test C is run only if Test B is proven infeasible.

## October historical evidence

**HISTORICAL - PRE-SCHEDULED-HOURS-SEMANTICS**

`pp-crew-schedule-2026-10 (2).pdf` and `.txt` are preserved unchanged. They document
the repetitive early-week schedule and target/coverage Guidance that motivated this
investigation. Their generating configuration cannot be established reliably, and
their totals were calculated before the scheduled-hours decision. They are not used
as quantitative Greedy-vs-CP-SAT evidence.

The clean October CP-SAT reconstruction still proves strict Test A infeasible; removing
only contracted-hours equality makes the model feasible. This is diagnostic context,
not an A/B score.

## November 2026 controlled A/B

Both engines started from the same immutable canonical snapshot. Existing October
26-31 shifts were retained only for the cross-month week.

### Strict feasibility

Test A is **INFEASIBLE**, not timed out. Removing contracted-hours equality makes the
model feasible. Exact full-week equality cannot coexist with the immutable boundary
facts/partial-month allocation for every Employee; coverage and Saturday protection
are not the independently identified cause.

### Test B comparison

| Metric | Greedy | CP-SAT (5 s) |
|---|---:|---:|
| Generated shifts | 79 | 81 |
| Generated scheduled hours | 386:00 | 295:30 |
| Uncovered 30-minute store slots | 31 | 0 |
| Coverage gap groups | 4 | 0 |
| Slots with 2+ Employees | 266 | 69 |
| Weekly target deficit | 64:00 | 154:30 |
| Weekly targets exactly met | 29 / 36 | 16 / 36 |
| Saturday preference achieved | 3 / 3 | 3 / 3 |
| Pre-existing cross-month overage | 7:30 | 7:30 |

The CP-SAT result is deliberately reported as **FEASIBLE**, not optimal. At five seconds
the first configured preference (Employee hours) returned a feasible incumbent but did
not prove optimality. Per the approved lexicographic contract, overlap, contracted hours,
consolidation, and neutral distribution were therefore **NOT EVALUATED**. The lower
contracted-hours priority could not repair the incumbent.

Runtime behavior for the same normalized Test B model:

| Per-stage limit | Result |
|---:|---|
| 1 second | UNKNOWN; no safe incumbent returned for the first objective |
| 2 seconds | UNKNOWN; no safe incumbent returned for the first objective |
| 5 seconds | FEASIBLE; first objective only |

## Corrected regression fixtures

- Lacey: a 10:30-15:30 candidate contributes exactly 300 scheduled minutes and can
  exactly satisfy a 300-minute target.
- Portal Test (isolated): four 300-minute scheduled candidates exactly satisfy 1,200.
- Wanda: three 300-minute scheduled candidates exactly satisfy 900.
- Mini Job: three 300-minute scheduled candidates exactly satisfy 900.
- Chronological bias: the neutral distribution fixture selects a separated later day
  instead of simply filling the earliest adjacent days.
- The independent break helper still returns a 15-minute break for an exact five-hour
  span; scheduling does not consume that result.

## Recommendation

CP-SAT is **promising but not ready to replace the greedy generator**. It demonstrates
the most valuable new capability immediately: it proves strict requirement sets
infeasible and can eliminate coverage gaps while preserving hard boundaries. However,
the current candidate model does not reach even the first lexicographic optimum inside
the practical five-second limit, so it cannot yet evaluate the manager's lower-ranked
preferences. The greedy generator remains materially better at weekly target fulfillment
in this controlled run, while CP-SAT is materially better at coverage.

The next iteration should optimize/model-reduce the experimental candidate set or use a
two-level construction that finds a strong incumbent quickly. Keep A/B testing; do not
integrate this solver into production generation yet.
