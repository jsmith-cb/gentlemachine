# Scheduling Rules Architecture

PP_Crew generates a deterministic draft schedule using three distinct layers:

```text
Scheduling boundaries
        ↓
Required planning-rule passes
        ↓
Ordered preferred planning rules
        ↓
Schedule Guidance
```

This is a bounded, explainable heuristic. It does not exhaustively search every possible schedule
and does not claim that an unfulfilled requirement is theoretically impossible.

## Canonical configuration

`SchedulingRuleSettings` is canonical business data stored in
`business_settings.scheduling_rules` through the existing repository and application-store
boundary. Browser-local state is not authoritative.

The configuration contains:

- `minimumGeneratedShiftMinutes`, in 30-minute increments;
- Prefer/Require modes for supported configurable planning rules; and
- the complete saved preferred-rule order.

Rules moved to Require remain in the saved preferred order so returning them to Prefer restores
their previous position.

## Scheduling boundaries

Boundaries are never traded away for a planning objective. Their authoritative owners remain:

| Boundary | Owner |
|---|---|
| Store/planning hours | Store Hours |
| Default/legal availability | Team Employee configuration |
| Maximum paid hours per day | Crew default plus lower Team Employee override |
| Maximum days per week | Team Employee configuration |
| Vacation | Canonical Vacation data |
| Sickness | Canonical SickReport data |
| Vacation-adjusted weekly target ceiling / no generated overtime | Hours domain |
| Minimum generated standalone shift | Scheduling Rules business setting |

Minimum generated shift duration is a generator boundary only. It does not prevent a manager
from manually creating a shorter Shift where existing manual validation permits it. Extensions
may continue using the established 30-minute generation increment.

Sickness blocks placement without reducing target hours. Vacation uses the authoritative adjusted
weekly target calculation.

## Required planning rules

The configurable rules supporting Require are:

- One Saturday off per month;
- Maximize opening-hours coverage; and
- Schedule contracted hours.

Require promotes the rule into a stable product-owned priority and invokes the deterministic
fulfillment behavior supported by the current generator.
Failure means only that PP_Crew could not fully satisfy the requirement within the generated plan
and configured boundaries—not that no possible schedule exists.

The stable product-owned execution order is:

```text
1. Protect one applicable Saturday off
2. Fill opening-hours coverage
3. Fulfill vacation-adjusted weekly contracted targets
```

This order is tested and is not manager-configurable. The mechanisms are deliberately not a
generic pass engine: Saturday is a protected-date placement exclusion, coverage is the primary
construction loop, and contracted hours are fulfilled through extensions and additional shifts
after coverage construction. The contracted-hours behavior only adds or extends work, so it does
not remove achieved coverage, and it continues to respect a required protected Saturday. In an
infeasible requirement set, boundaries remain intact and Schedule Guidance reports each remaining
deficiency.

## Ordered preferred planning rules

Preferred rules are evaluated lexicographically in the manager's saved order:

```text
compare preference #1
if tied → compare preference #2
if tied → continue
if still tied → stable deterministic generator tie-breaker
```

Lower-ranked improvements cannot compensate for a worse higher-ranked result. Dragging and the
Move up/Move down controls update the same canonical order.

During a concrete candidate choice, the initial comparison measures are:

| Preferred rule | Initial deterministic comparison |
|---|---|
| Schedule contracted hours | Most useful paid minutes toward the applicable weekly target |
| Opening-hours coverage | Most covered configured opening minutes |
| Provide overlapping shifts | Most useful minutes with at least two Employees scheduled |
| Prefer employee hours | Most paid minutes within day-specific preferred windows |
| One Saturday off per month | Avoid work on the deterministically protected applicable Saturday |
| Prefer longer, consolidated shifts | Prefer a longer useful candidate when a shift is already being placed |

These are comparison measures, not weighted scores. They are intentionally a bounded local
heuristic and may be refined from observed schedules without changing the configuration model.
The generator does not compare every possible completed schedule. In particular, the
fragmentation preference is not a global minimum-shift solver: candidate construction prefers the
longer useful placement, and contracted-hours fulfillment extends an existing generated shift
before it creates another standalone shift.

Some objectives are additive under the current boundaries. Coverage work also contributes to an
Employee's contracted target, and extending a shift outside a preferred window does not erase the
preferred minutes already achieved. Reordering such rules may therefore produce the same result
when both can be improved together. Order changes behavior only at a genuine competing choice; it
does not manufacture a trade-off where none exists.

## Saturday-off eligibility

An Employee is eligible when:

- Saturday is an open Store day;
- Saturday is normally available for the Employee; and
- the Employee also has a normally workable open weekday.

Saturday-only and weekend-only Employees are therefore not eligible. Vacation or sickness on a
Saturday cannot be credited as the deliberate Saturday off; an eligible, otherwise workable
Saturday must remain unscheduled by generation. Require always protects that Saturday. Prefer
protects it against a placement pass only when the Saturday rule ranks above the objective that
would place the work; otherwise the higher-ranked objective may use it.

## Contracted-hours accounting

Contracted-hours fulfillment uses the authoritative vacation-adjusted weekly target. Full-week
accounting includes canonical shifts outside the selected month when a week crosses a month
boundary, while newly generated shifts remain inside the selected month. Monthly totals are an
aggregate Guidance/reporting view rather than a simultaneous exact generation requirement.

## Guidance and manual planning

Hard boundary violations remain validation errors. Unfulfilled required rules are displayed as
**Requirement conflicts**. Missed preferred rules are displayed as Guidance.

Planning rules primarily govern Generate Planner. They do not turn preferences into manual-edit
blockers. Guidance may still compare a manually edited schedule with configured objectives.

Coverage currently evaluates scheduled Shift spans; break coverage is not yet included.

## Implementation locations

- Types and defaults: `src/types/planning.ts`, `src/services/schedulingRulesService.ts`
- Generation: `src/services/generationService.ts`
- Hard validation: `src/services/validationService.ts`
- Guidance presentation: `src/pages/PlannerPage.ts`, `src/pages/PlannerCalendar.ts`
- Settings: `src/pages/SettingsPage.ts`
- Canonical persistence: `src/repositories/`, `src/infrastructure/SupabaseCrewRepository.ts`,
  `supabase/migrations/20261008000000_add_configurable_scheduling_rules.sql`
