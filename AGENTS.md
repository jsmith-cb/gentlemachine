# PricePocket Crew — Agent Instructions

## Project

PricePocket Crew (`pp_crew`) is a lightweight employee scheduling and workforce-planning application.

It is built with:

* TypeScript
* Vite
* HTML/CSS
* No frontend framework

The application is intended to remain simple, fast, understandable, and maintainable.

This repository is the canonical development project for PricePocket Crew.

A separate project, Gentlemachine, may later receive mature scheduling functionality from this project and be independently adapted or rebranded. Do not develop against Gentlemachine requirements unless explicitly instructed.

---

## Your Role

You are the implementation agent for PricePocket Crew.

Work directly in the repository and implement requested changes.

Your responsibility is to:

* understand the existing implementation before modifying it;
* make focused, production-safe changes;
* preserve established architecture and behavior;
* keep business logic separate from presentation logic;
* validate your work before declaring it complete.

Do not stop after producing a plan when the requested task can be implemented.

Do not invent product requirements.

If a product or architecture decision is genuinely ambiguous and cannot be resolved from the repository or task, stop and ask.

---

# Product Principles

PricePocket Crew should make employee planning easier without becoming enterprise workforce-management software.

Prefer:

* clear workflows;
* obvious behavior;
* simple interfaces;
* useful validation;
* understandable business rules;
* minimal configuration;
* predictable state.

Avoid:

* unnecessary complexity;
* speculative features;
* enterprise abstractions;
* configuration systems without a current requirement;
* abstractions created only because they might someday be useful.

Solve the problem currently being requested.

---

# Portability

PricePocket Crew is the source of truth for current development.

Some mature functionality may later be ported to Gentlemachine.

Keep reusable scheduling logic independent from product branding where practical.

Prefer:

* product-neutral domain types;
* product-neutral scheduling services;
* branding and product wording in UI/configuration layers.

However, do not introduce abstractions solely to support hypothetical reuse.

PricePocket Crew requirements always take priority.

---

# Current Architecture

The project currently follows approximately this structure:

```text
src/
├── app.ts
├── main.ts
├── pages/
│   └── PlannerPage.ts
├── services/
│   ├── coverageService.ts
│   ├── hoursService.ts
│   └── validationService.ts
├── state/
│   └── plannerState.ts
├── types/
│   └── planning.ts
└── styles.css
```

Respect the responsibility of each layer.

## `types/`

Contains domain types and shared data structures.

Types should describe the scheduling domain rather than UI implementation details whenever practical.

## `state/`

Owns application state creation and state-level defaults.

State should remain:

* simple;
* explicit;
* serializable;
* easy to inspect.

Do not introduce a state-management framework unless explicitly requested.

## `services/`

Owns business logic.

Examples include:

* working-hour calculations;
* break calculations;
* employee availability;
* schedule validation;
* store coverage;
* persistence;
* future scheduling calculations.

Business rules should generally be testable without rendering the UI.

Do not duplicate service logic inside page code.

## `pages/`

Owns application presentation and user interaction.

Pages may:

* render state;
* collect user input;
* call services;
* update state;
* respond to UI events.

Pages should not become the authoritative source of scheduling business rules.

## `styles.css`

Owns application styling.

Preserve existing visual conventions unless the task specifically requests a design change.

Do not perform unrelated visual redesigns while implementing functional work.

---

# Domain Model

The application uses calendar dates represented as:

```text
YYYY-MM-DD
```

Preserve this convention unless explicitly instructed otherwise.

Avoid converting the scheduling domain to timestamps unnecessarily.

Scheduling primarily concerns local calendar dates and local working times.

---

# Business-Rule Ownership

Keep domain responsibilities clear.

A service that owns a calculation or rule should remain authoritative for that rule.

Other parts of the application may consume the result but should not independently reimplement the same rule.

For example:

```text
hoursService
    → working-time calculations

coverageService
    → store coverage calculations

validationService
    → schedule and employee constraint validation
```

If new behavior clearly belongs to an existing service, extend that service instead of creating duplicate logic elsewhere.

Create a new service when it represents a genuinely distinct responsibility.

---

# Validation Philosophy

Distinguish between hard constraints and informational guidance.

## Hard constraints

Hard constraints represent schedules that should not be allowed.

Examples may include:

* invalid time ranges;
* scheduling an employee outside availability;
* overlapping shifts for the same employee;
* exceeding a hard maximum number of working days.

Hard constraints should be represented as errors.

Where appropriate, prevent an invalid operation rather than merely reporting the problem afterward.

## Warnings

Warnings represent schedules that are valid but potentially undesirable.

Examples may include:

* contract-hour differences;
* preferred staffing levels;
* recommended overlap;
* other planning guidance.

Warnings should generally not prevent the user from continuing.

Do not arbitrarily convert warnings into blocking errors.

---

# UI Philosophy

The planner should help users build a schedule rather than punish them for temporarily incomplete work.

A schedule under construction will naturally contain gaps.

For example, incomplete store coverage while the user is still creating the month is not necessarily a reason to prevent editing.

Validation should help the user reach a good final schedule while allowing normal intermediate states.

Avoid modal interruptions or blocking behavior unless the underlying condition genuinely prevents a valid operation.

---

# Dependencies

Do not add external dependencies unless:

1. the task explicitly requires one; or
2. the existing platform cannot reasonably implement the requirement.

Prefer browser APIs and existing project utilities for simple functionality.

Do not introduce:

* frontend frameworks;
* state-management libraries;
* utility libraries;
* date libraries;
* validation frameworks

merely for convenience.

If you believe a dependency is necessary, explain why before adding it unless the task explicitly authorized the dependency.

---

# Refactoring

Do not perform broad refactors while implementing unrelated features.

Refactor when:

* the requested change genuinely requires it;
* existing structure prevents a safe implementation;
* the task explicitly requests it.

When refactoring:

* preserve existing behavior unless instructed otherwise;
* keep the change scoped;
* avoid combining architectural cleanup with unrelated feature work.

Large files are not, by themselves, justification for a large refactor.

If a feature introduces a clear new responsibility, prefer creating an appropriate module rather than continuing to expand an unrelated module.

---

# Working With Existing Code

Before changing code:

1. Inspect the relevant files.
2. Trace dependencies that materially affect the requested behavior.
3. Search for existing implementations of related logic.
4. Understand existing types and state.
5. Preserve established project patterns unless there is a concrete reason not to.

Do not assume a function, service, type, or behavior does not exist before searching for it.

If the repository answers a question, use the repository as the source of truth.

---

# Scope Control

Implement the requested task completely, but do not expand its scope.

Do not:

* add adjacent features;
* redesign unrelated UI;
* rename unrelated code;
* reorganize unrelated files;
* introduce speculative abstractions;
* fix unrelated cosmetic issues;
* change business rules that were not part of the request.

If you notice an unrelated issue, mention it briefly in the final report only if it is materially important.

Do not silently fix unrelated behavior.

---

# Editing Rules

Prefer the smallest coherent set of changes that fully implements the requirement.

When modifying code:

* follow existing naming conventions;
* follow existing formatting;
* reuse existing utilities;
* reuse existing types;
* preserve existing public behavior unless the task changes it;
* keep TypeScript types explicit and meaningful;
* avoid `any` unless there is a concrete reason;
* avoid unnecessary type assertions;
* avoid dead code;
* remove temporary debugging output.

Do not leave placeholder implementations unless explicitly requested.

Do not comment obvious code.

Comments should explain non-obvious intent or constraints, not restate syntax.

---

# State and Persistence

Application state should remain serializable.

Do not persist values that can be reliably derived from authoritative state unless there is a specific requirement.

When reading persisted or external data:

* treat it as untrusted;
* handle missing data safely;
* handle malformed data safely;
* preserve reasonable backward compatibility when practical.

A persistence failure should not unnecessarily make the application unusable.

---

# Dates and Times

Scheduling code is particularly vulnerable to date and timezone mistakes.

Preserve existing date utilities and conventions where possible.

Before introducing native `Date` calculations, inspect the existing date/time implementation.

Do not casually mix:

* UTC dates;
* local dates;
* ISO timestamps;
* `YYYY-MM-DD` scheduling dates.

A calendar date should remain a calendar date unless an actual timestamp is required.

---

# Git

Do not commit unless explicitly instructed.

Do not:

* change branches;
* create branches;
* merge branches;
* rebase;
* reset;
* stash;
* force operations;
* modify Git history

unless explicitly requested.

You may inspect Git state and diffs as needed.

Before finishing, inspect your diff to ensure only intended changes remain.

Never modify or commit:

```text
node_modules/
dist/
.DS_Store
*.zip
```

or other ignored/generated artifacts unless explicitly requested.

---

# Validation

Every implementation must leave the project in a working state.

Before declaring a coding task complete, run:

```bash
npx tsc --noEmit
```

and:

```bash
npm run build
```

If the project contains relevant automated tests, run those as well.

If you add or modify business logic that has an established test suite, update the relevant tests.

If a command fails because of your changes:

* diagnose it;
* fix it;
* run the command again.

Do not report successful completion while validation is failing.

If validation cannot run because of an environment or dependency problem unrelated to your changes, report the exact limitation rather than claiming success.

---

# Self-Review

Before finishing:

1. Inspect the complete diff.
2. Verify the requested behavior is actually implemented.
3. Look for accidental changes.
4. Check for duplicated business logic.
5. Check for obvious edge cases introduced by the change.
6. Verify TypeScript compilation.
7. Verify the production build.
8. Run relevant tests if present.

Do not rely only on the absence of compiler errors.

A compiling implementation can still violate the requirement.

---

# Completion Report

Keep the final response concise.

Report:

## Implemented

Briefly state what changed.

## Changed files

List repository-relative paths, one per line.

For example:

```text
src/services/validationService.ts
src/pages/PlannerPage.ts
```

## Validation

Report the actual results of:

```text
npx tsc --noEmit
npm run build
```

and any tests that were run.

## Notes

Include this section only when there is a meaningful:

* architectural decision;
* unresolved ambiguity;
* limitation;
* follow-up concern.

Do not provide a long narrative of your reasoning.

---

# When to Stop and Ask

Do not ask questions that can be answered by inspecting the repository.

Stop and ask when implementation requires a genuine product or architecture decision that is not established by:

* the task;
* this file;
* existing code;
* existing project conventions.

Examples:

* two materially different behaviors are both plausible;
* a requested change conflicts with an existing business rule;
* implementing the task would require changing an established domain boundary;
* destructive migration of existing user data would be required;
* a new external dependency appears necessary;
* the requirement would significantly expand the requested scope.

When asking, explain the specific decision required and keep the question focused.

---

# Primary Rule

Inspect before assuming.

Implement before explaining.

Validate before declaring success.

Keep PricePocket Crew simple.
