# Employee Access and Absence Architecture

This document describes the implementation currently present in PP_Crew. It is a reference
for future development, not a proposal for a broader HR or workflow system.

## System flow

```text
Supabase Auth
      ↓
manager membership or employee access
      ↓
manager application or /my-schedule
      ↓
employee schedule, time-off requests, and sick reports
      ↓
canonical shifts, vacations, and sickness
      ↓
Planner, Day Planning, validation, and Generate Planner
```

Pages collect and present information. Repositories, database functions, RLS, and database
constraints own authorization and canonical state transitions.

## Identity model

Three identities have different responsibilities:

| Identity | Responsibility |
|---|---|
| `auth.users.id` | Supabase authentication identity |
| `Employee.id` | Immutable Crew-owned identity referenced by shifts, vacations, sickness, and employee access |
| `employeeNumber` | Business-facing identifier, unique case-insensitively within one business |

Employee-facing operations do not accept an Employee ID from the browser. They resolve it as:

```text
auth.uid()
   ↓
enabled employee_access
   ↓
active Employee.id
```

The composite business/Employee foreign keys prevent records from referring to an Employee in
another business.

## Independent manager and employee capabilities

Manager and Employee access are independent capabilities on one Auth identity:

```text
manager application → business_membership
/my-schedule        → employee_access
```

An identity may have either capability or both. Employee access never grants manager authority.
Manager membership alone does not grant Employee portal access.

`src/main.ts` performs route-aware presentation:

- the manager surface requires resolved manager membership;
- an employee-only identity opening the manager surface is redirected to `/my-schedule`;
- `/my-schedule` shows an unavailable state when the Auth identity has no active Employee access;
- a dual-capability identity can use either surface.

Routing is not the security boundary. PostgreSQL functions derive `auth.uid()`, manager operations
call `is_manager_of_business`, RLS scopes manager reads, and employees have no direct access to
manager-facing canonical tables.

## Employee access provisioning

An Employee email does not grant access. A manager explicitly enables access from Team.

The trusted `enable-employee-access` Edge Function:

1. authenticates the manager;
2. reads the Employee through manager-scoped RLS;
3. requires an active Employee with an email;
4. reuses a matching verified Auth identity or securely invites one;
5. writes the `employee_access` binding with the service-role client.

Service-role credentials exist only in the Edge Function environment and never in Vite/browser
configuration. Enabling is idempotent. One Auth identity can be linked to only one Employee record.

While access is enabled, Team treats the Employee email as read-only. Changing it requires
disable → edit/save → enable. Disabling immediately prevents portal operations. Making an Employee
inactive automatically disables access; reactivation does not restore it.

Authoritative implementation: `supabase/functions/enable-employee-access/index.ts`,
`SupabaseEmployeeAccessRepository.ts`, and the employee-access migration.

## `/my-schedule`

My Schedule is primarily the Employee's answer to **“When am I working?”** It is not a general HR
portal.

It currently provides:

- the authenticated Employee's month-scoped canonical shifts;
- previous/next month navigation;
- empty-month presentation and sign-out;
- Time-Off Request submission/history;
- Sick Report submission/history.

`get_my_schedule(year, month)` accepts no Employee identity. The database derives the Employee
from the authenticated user and returns only business name, Employee display identity, period,
and that Employee's shifts. Saved shifts are immediately visible; draft/publish does not exist.

The portal application boundary is `EmployeePortalController.ts`, with projections provided by
the employee schedule, time-off, and sickness repositories.

## Employee Time-Off Requests

Time-off workflow records and approved scheduling state are intentionally separate:

```text
TimeOffRequest = employee intent and decision history
Vacation       = current canonical approved scheduling state
```

The lifecycle is:

```text
pending → approved
        → declined
approved → superseded
```

Employees submit dates and an optional note through an identity-derived RPC. Pending requests do
not affect scheduling or targets. Managers read requests only for their business and can approve
or decline a pending request.

Approval is one database transaction: authorize manager, lock and verify the pending request,
resolve overlap/supersession, create the canonical Vacation, mark the request approved, and record
decision identity/time. A failure rolls back every part. Decline records the decision and creates
no Vacation. Repeating the same decision is idempotent and cannot duplicate Vacation.

Existing shifts are never rewritten. An approved Vacation can therefore expose a conflict with an
existing shift; validation reports it and the manager repairs the plan.

Vacation participates in the existing vacation-adjusted weekly/monthly target calculations.

### Future vacation supersession

An approved request-backed Vacation may be superseded only when:

- it belongs to the same Employee and business;
- it has not begun (`start_date > current_date`);
- the new pending request fully contains its date range.

Example:

```text
old approved request: Oct 5
new pending request:  Oct 2–7
manager approves

old request → superseded, linked to the new request
new request → approved
canonical Vacation → Oct 2–7
```

The original request dates, creation data, manager decision, and decision time remain historical
facts. Its obsolete future Vacation is removed and the new Vacation becomes canonical.

The transaction rejects automatic supersession when an overlap is partial, has already begun, or
belongs to a manual Vacation without an approved request relationship. Adjacent periods remain
independent. Multiple fully contained eligible future approvals can be superseded together. The
database performs the complete transition atomically.

## Canonical-state reconciliation

The database/repository is authoritative for canonical scheduling state.

After approval, Team does not append or calculate Vacation changes. It asks
`CrewApplicationStore.refreshVacations()` to reload authoritative workspace data through the
repository and replaces the Vacation collection with the confirmed database collection. This is
essential for supersession, where the transaction can both remove old Vacation records and create
a new one.

Sickness follows the same rule. Team loads or acknowledges reports and then calls
`refreshSicknesses()`. Pages do not reproduce database transition rules.

## Sick Reports

Sickness is not Vacation and is not a permission request:

```text
Employee reports sickness
        ↓
canonical SickReport immediately
        ↓
manager acknowledges awareness
```

The lifecycle is `reported → acknowledged`. Employees submit a date range and optional scheduling
note. Acknowledgement records `acknowledged_at` and `acknowledged_by`; it does not approve the
absence, create a second record, change dates, or change scheduling semantics. Repeated
acknowledgement is safe.

Canonical sickness immediately:

- removes the Employee from Day Planning choices for covered dates;
- prevents Generate Planner placement on covered dates;
- makes a new shift on a covered date invalid;
- produces a hard availability conflict for an existing shift while preserving that shift.

Sickness does **not** reduce weekly or monthly target hours. Sick-pay and contractual treatment are
deliberately undecided.

### Non-overlap invariant

For one business and Employee, canonical sickness date ranges cannot overlap. PostgreSQL enforces
this with a GiST exclusion constraint over `(business_id, employee_id, daterange(..., '[]'))`.
The inclusive range means:

```text
Oct 5–6 + Oct 6–7 → conflict
Oct 5–6 + Oct 7–8 → allowed
```

The submission RPC performs a preliminary overlap check for a clear normal error. The exclusion
constraint is authoritative and also prevents concurrent check-then-insert races. The repository
maps a constraint race back to the same user-facing overlap message.

## Vacation and sickness interaction

Vacation and Sickness remain independent canonical concepts. Reporting sickness during Vacation
does not convert, delete, merge, or supersede either record. PP_Crew currently assigns no payroll,
leave-credit, or medical meaning to that overlap. Either absence independently blocks scheduling.

## Existing plans and later absence

```text
existing Shift + new canonical absence ≠ delete Shift
```

The original plan remains visible. Validation exposes the conflict, allowing the manager to see
the resulting operational and coverage problem and deliberately repair the schedule.

## Scheduling behavior matrix

| Behavior | Vacation | Sickness |
|---|---:|---:|
| Blocks new/manual scheduling | Yes | Yes |
| Excluded from Day Planning | Yes | Yes |
| Blocks Generate Planner placement | Yes | Yes |
| Existing conflicting Shift remains | Yes | Yes |
| Existing conflict is reported by validation | Yes | Yes |
| Reduces weekly/monthly target | Yes | No |
| Requires manager approval | Yes, for Employee requests | No |
| Manager acknowledgement | No | Yes |

Manual Vacation creation in Team remains available independently of Employee request workflow.

## Security boundaries

- Employee schedule, request, and sickness RPCs derive Employee identity from `auth.uid()`.
- Employee clients cannot select another Employee or business.
- Employees can read only their own employee-facing projections.
- Employees cannot approve/decline time off or acknowledge sickness.
- Employees cannot directly create Vacation or read canonical Team, Shift, Vacation, Settings, or
  access tables merely because they have portal access.
- Manager reads and decisions are restricted to authorized businesses by RLS and explicit
  membership checks in security-definer functions.
- Tenant-integrity foreign keys prevent cross-business Employee relationships.
- Privileged Auth administration is confined to the trusted Edge Function.

Database authorization is covered by `supabase/tests/database/tenant_authorization.test.sql`,
`time_off_requests.test.sql`, and `sick_reports.test.sql`.

## Important PostgreSQL guarantees

- case-insensitive Employee-number uniqueness within a business;
- immutable UUID Employee references and same-business composite foreign keys;
- one Auth identity per employee-access binding;
- identity-derived Employee portal operations;
- atomic time-off decisions and Vacation supersession;
- preserved TimeOffRequest history and explicit supersession relationship;
- non-overlapping canonical sickness under concurrent writes;
- manager decision/acknowledgement scope enforced independently of UI filtering.

## Intentional limitations

PP_Crew currently has no:

- schedule draft/publish or Employee schedule acknowledgement;
- time-off cancellation, withdrawal, editing, or partial approval;
- sickness approval/decline, cancellation, partial days, medical certificates, or sick-pay rules;
- shift swaps or shift-change/availability-change requests;
- automatic deletion of conflicting shifts or replacement-worker scheduling;
- notifications, email, push, or messaging;
- generalized absence, workflow, or RBAC engine;
- Time Clock.

These are intentional MVP boundaries, not implied behavior.

## Key implementation locations

- Portal and routing: `src/main.ts`, `src/auth/EmployeePortalController.ts`,
  `src/pages/EmployeeSchedulePage.ts`
- Team presentation: `src/pages/EmployeePlanningPage.ts`
- Repository/store boundary: `src/repositories/`, `src/infrastructure/`,
  `src/state/CrewApplicationStore.ts`
- Scheduling effects: `src/services/validationService.ts`, `dayPlanningService.ts`,
  `generationService.ts`, `hoursService.ts`
- Database ownership: `supabase/migrations/20261005000000_add_employee_schedule_access.sql`
  through the time-off and sickness migrations
- Security regression tests: `supabase/tests/database/`

## Principles to preserve

- Authentication identity is not Employee identity.
- Manager and Employee access are independent capabilities.
- Workflow/history records are not automatically canonical scheduling state.
- Canonical scheduling state comes from the database and repository.
- Employee-originated operations derive Employee identity from authentication.
- Existing plans remain visible when later facts make them invalid.
- Validation exposes conflicts instead of silently rewriting schedules.
- Vacation and sickness retain different business meanings even when infrastructure is shared.
- Pages collect and present; domain, repository, and database boundaries own state transitions.
