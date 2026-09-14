We are evolving the new **Schedule Assistant** concept into a first-class PricePocket Crew domain.

This is a planning and architecture task only.

Do not modify files.

The Schedule Assistant should eventually help a manager build better schedules in real time. It should not simply be a renamed Validation UI.

## Domain responsibility

Preserve clear domain authority.

**Validation**
- Owns schedule rule evaluation.
- Determines violations, warnings, constraints, and validation severity.
- Remains authoritative for whether scheduling rules are satisfied.

**Schedule Assistant**
- Consumes information produced by other domains.
- Interprets that information for the user.
- Provides positive, actionable schedule guidance.
- May prioritize, summarize, and combine information from multiple domains.
- Must not duplicate or alter the business rules owned by those domains.

The Schedule Assistant should eventually be able to consume information from domains such as:

- Validation
- Coverage
- Employees
- Schedule
- Planning KPIs

Do not implement those future integrations unless they already exist and are needed for the first version.

## Planning KPIs

We want to explore a dedicated planning-KPI capability.

KPIs are measurable planning objectives rather than validation rules.

Examples might include:

- target weekly/monthly labor hours;
- employee contract-hours fulfillment;
- preferred double-coverage hours;
- weekend staffing distribution;
- coverage targets;
- labor-hour budgets;
- other measurable scheduling objectives.

A KPI may have:

- a target;
- a current planned value;
- progress toward the target;
- status;
- enough information for Schedule Assistant to provide useful guidance.

Do not assume this exact data model is correct. Inspect the existing architecture first.

Planning KPIs should own their definitions and measurements. Schedule Assistant may consume KPI results but should not become authoritative for calculating every KPI.

## Reports

We also want this architecture to support future Crew reporting.

The same KPI concepts that help during schedule planning should eventually be usable for historical reporting.

Conceptually:

Plan → Assist → Operate → Report

For example, a future report might compare:

- KPI target;
- planned result;
- actual result;
- target achievement;
- historical trend.

Reports should consume authoritative domain information. Reports should not own scheduling, validation, employee, coverage, or KPI business rules.

Do not implement Reports in this task.

## Current Schedule Assistant UI

The current direction for the planner header is:

**SCHEDULE**
September 2026

**SCHEDULE ASSISTANT**
Schedule overview
26 to review · 12 suggestions

The terminology should remain positive and helpful.

Avoid exposing raw `errors` and `warnings` as the primary Schedule Assistant language.

The underlying Validation domain may still use precise validation terminology internally.

The Schedule Assistant will eventually open a modeless panel providing real-time schedule guidance.

Do not implement the modeless panel yet.

## Your task

Inspect only the existing files necessary to understand:

- Validation;
- Coverage;
- scheduling state;
- employee information;
- the current Schedule Assistant implementation, if present;
- existing service/domain organization.

Then propose the smallest coherent architecture that supports:

1. Schedule Assistant as its own domain.
2. Validation remaining authoritative for validation.
3. Future Planning KPIs as their own responsibility.
4. Schedule Assistant consuming KPI results and validation results.
5. Future Reports consuming KPI and historical schedule information.
6. Growth without turning Schedule Assistant into a catch-all service.

Identify:

- domain responsibilities;
- boundaries between the domains;
- information flow;
- any types/services that should eventually exist;
- what should be implemented now;
- what should explicitly remain future work;
- the smallest next implementation step.

Do not design an enterprise framework.

Do not introduce abstractions merely because they might be useful someday.

Do not modify files.

Do not commit.

Finish with a concise, implementation-ready recommendation and wait for approval.



Thats the real product.

Yes. That is the product.

Not “employee scheduling with validation.”

It is a planning system for merchants that helps them build schedules against real operating goals, then shows them whether those plans actually worked.

The core loop becomes:

Set goals → build schedule → get guidance → operate → compare results → improve next schedule

That is much stronger than a calendar.

The differentiator is the combination of:

scheduling constraints;
employee availability and target hours;
configurable planning KPIs;
real-time Schedule Assistant guidance;
planned vs. actual reporting;
eventually business-performance context from PricePocket.

So Crew starts answering questions like:

Are we covering the right periods?

Are employees getting the hours we intended?

Are we hitting our overlap target?

Are we staying within our labor-hour budget?

Did the schedule we planned actually perform the way we expected?

And then the Schedule Assistant can move from merely detecting problems to helping the merchant achieve those objectives while they are still building the schedule.

That also fits PricePocket's broader philosophy extremely well: the software shouldn't demand that the merchant understand scheduling theory or stare at dashboards. They define what matters to the business, and Crew helps them get there.

The calendar is the interface.

The product is operational planning and continuous improvement.