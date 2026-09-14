Implement the next PricePocket Crew feature: introduce a dedicated **Planning Assistant** domain.

The Planning Assistant is not a rename of Validation.

It is its own domain with a separate responsibility:

- **Validation** remains authoritative for determining whether schedule rules, constraints, or requirements are satisfied.
- **Planning Assistant** consumes validation results and other planning information and translates them into helpful, user-facing guidance.
- Planning Assistant may interpret validation output, prioritize it, summarize it, and present recommendations.
- Planning Assistant must not duplicate, replace, or alter validation rules.

Follow the existing project architecture and domain boundaries.

## UI change

Move the current user-facing **Validation / Schedule status** presentation out of its existing standalone section.

At the same hierarchy level as:

**Schedule**  
**September 2026**

add:

**Planning assistant**  
**<current assistant status>**

For example:

- `Looking good`
- `1 suggestion`
- `2 suggestions`

Keep the language positive and helpful rather than presenting the entry point as an error report.

The top-level area should conceptually become:

Schedule                              Planning assistant
September 2026                        Looking good

or:

Schedule                              Planning assistant
September 2026                        2 suggestions

## Domain structure

Create the smallest coherent Planning Assistant domain needed to support this feature.

The Planning Assistant should own things such as:

- assistant-facing status;
- suggestion count;
- transformation of validation findings into planning guidance;
- future planning-assistant presentation models.

Validation should continue to own:

- rule evaluation;
- violations;
- warnings;
- scheduling constraints;
- validation severity and underlying validation results.

Do not move validation logic into the Planning Assistant.

Prefer a dedicated service/module such as:

`src/services/planningAssistantService.ts`

if that fits the existing architecture.

Do not introduce unnecessary framework abstractions, dependency injection, state-management infrastructure, or additional layers.

## Future direction

The Planning Assistant will eventually open a modeless contextual-help panel that helps the user configure the schedule in real time.

That future assistant may combine information from multiple domains, including:

- validation;
- employee availability;
- contract/target hours;
- coverage;
- preferred overlap;
- other planning guidance.

Do not implement that modeless panel in this task.

Do not implement speculative future features.

Structure the Planning Assistant domain so the current status/suggestion model can naturally grow into that functionality later.

## Current behavior

For this task:

- derive Planning Assistant guidance from the existing validation results;
- show `Looking good` when there are no relevant suggestions;
- show `1 suggestion` for one relevant item;
- show `<n> suggestions` for multiple items;
- preserve the existing validation functionality underneath.

If the existing validation detail/filter UI is still useful, preserve it where appropriate, but it should no longer be presented as the primary top-level "Validation / Schedule status" experience.

## Constraints

Do not change:

- validation rules;
- scheduling rules;
- persistence behavior;
- employee rules;
- coverage calculations;
- domain types unless a Planning Assistant-specific type is genuinely needed.

Do not redesign unrelated UI.

Inspect only the files necessary for this feature.

Do not commit. I will review all changes before any commit.

After implementation:

- inspect the diff;
- verify the Planning Assistant domain does not duplicate validation logic;
- run `npm test`;
- run `npx tsc --noEmit`;
- run `npm run build`;
- report only results actually observed.