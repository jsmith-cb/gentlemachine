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

## MVP and Iteration

Prefer a working MVP that can be tested and reviewed over trying to achieve initial task perfection through exhaustive investigation.

Inspect enough of the repository to understand the relevant architecture and make a sound implementation. Once you have sufficient context for a feasible implementation, stop exploring and implement it.

We can iterate on working software. Do not spend time reading additional files solely to eliminate every possible uncertainty before making the first implementation.

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
│   ├── EmployeePlanningPage.ts
│   └── PlannerPage.ts
├── services/
│   ├── coverageService.ts
│   ├── hoursService.ts
│   ├── storageService.ts
│   └── validationService.ts
├── state/
│   └── plannerState.ts
├── types/
│   └── planning.ts
└── styles.css
```

Automated tests are colocated with the code they exercise where appropriate.

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

## Investigation Scope

Inspect only the files necessary to establish the implementation path.

Once the relevant data model, persistence path, target UI, and direct consumers are understood, stop expanding repository exploration and implement the change.

Do not inspect additional consumers or adjacent components merely to build a complete architectural picture unless the task requires changing them or existing evidence indicates they may be affected.

# Planning and Implementation

For non-trivial changes, planning and implementation may be separate phases.

## Planning phase

When explicitly asked to plan:

1. Inspect the relevant repository state.
2. Trace the existing implementation and architecture.
3. Identify the files and responsibilities affected.
4. Propose the smallest coherent implementation.
5. Identify genuine ambiguities, conflicts, or risks.
6. Do not modify files.

Finish the planning phase with a concrete implementation plan.

Do not continue into implementation until explicitly instructed.

## Approved implementation

Once a plan has been approved, treat its decisions as settled.

During implementation:

* execute the approved plan directly;
* do not repeatedly reconsider settled alternatives;
* do not restart architectural exploration without a concrete reason;
* do not expand the approved scope;
* continue through implementation, validation, and self-review.

Only deviate from the approved plan when the repository reveals a concrete technical contradiction or the approved implementation cannot safely work as specified.

If that happens, stop and explain the specific contradiction before changing direction.

For small, unambiguous tasks, implement directly unless planning was explicitly requested.

## Repository Inspection

Inspect only the files and directories relevant to the current task.

Avoid broad recursive repository dumps such as:

```bash
ls -R
```

when targeted inspection is sufficient.

Prefer focused commands such as:

```bash
find src -maxdepth 2 -type f
find src/pages -maxdepth 1 -type f
find src/services -maxdepth 1 -type f
```

or read the specific files identified by the task and architecture.

Do not consume context by listing dependency directories, generated output, archives, temporary working directories, or unrelated project files unless they are relevant to the task.

When inspecting reference material, start with the files most likely to contain the required information and expand the inspection only when necessary.

Do not repeat directory listings or reread files unless the additional inspection serves a concrete purpose.

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

Temporary files or directories created for inspection must not become part of the implementation unless explicitly required.

If you extract archives, generate comparison files, or create temporary working directories:

* keep them outside the implementation where practical;
* remove them before completion;
* verify with Git status that they are not included in the final change.

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

# Tool Reliability

Tool output and filesystem state are authoritative.

Do not assume an operation succeeded because you attempted it.

## File editing

Use the simplest reliable method appropriate for the change.

Prefer:

1. a precise file edit when the tool call is simple and reliable;
2. a full-file rewrite for small or medium files when safer;
3. a straightforward shell-based transformation when appropriate.

Do not repeatedly retry malformed or failing structured edit calls.

If a structured edit fails because of malformed arguments, schema validation, or an inability to apply the requested edit:

1. inspect the failure;
2. correct the invocation once if the cause is obvious;
3. if it fails again, use another reliable editing method.

Do not enter repeated edit-failure-retry loops.

Before performing a full-file rewrite:

* read the current file;
* preserve unrelated content;
* do not reconstruct the file from memory.

After a significant file modification:

* inspect the resulting file;
* verify that the intended change exists;
* check for accidental deletion, duplication, malformed syntax, or truncation.

The actual contents of the repository take precedence over your recollection of what you intended to write.

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
npm test
npx tsc --noEmit
npm run build
```

Run additional targeted tests when appropriate.

If you add or modify business logic with an established test suite, update the relevant tests.

If a validation command fails because of your changes:

* diagnose the failure;
* fix it;
* run the command again.

Do not report successful completion while validation is failing.

If validation cannot run because of an environment or dependency problem unrelated to your changes, report the exact limitation rather than claiming success.

---

# Evidence and Verification

Never report an action, result, or validation as completed unless you observed evidence that it completed successfully.

Examples:

* A file change is complete only after the resulting file or diff confirms it.
* A test passed only when the test command reports success.
* A build passed only when the build command reports success.
* A dependency was installed only when package state or command output confirms it.
* A file was removed only when repository or filesystem state confirms it.

Do not infer successful execution from intent.

When your previous statement conflicts with current repository state or command output, trust the repository and command output.

---

# Self-Review

Before finishing:

1. Inspect the complete diff.
2. Verify the requested behavior is actually implemented.
3. Look for accidental changes.
4. Check for duplicated business logic.
5. Check for obvious edge cases introduced by the change.
6. Verify automated tests.
7. Verify TypeScript compilation.
8. Verify the production build.

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
npm test
npx tsc --noEmit
npm run build
```

and any additional targeted tests that were run.

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

Plan before implementing when planning is requested.

Once a plan is approved, execute it instead of reconsidering it.

Verify repository state instead of trusting intent.

Validate before declaring success.

Keep PricePocket Crew simple.