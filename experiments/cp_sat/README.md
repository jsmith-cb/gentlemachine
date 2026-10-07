# CP-SAT scheduling feasibility spike

This experiment compares PP_Crew's existing deterministic greedy generator with
an isolated OR-Tools CP-SAT model. It is not connected to production UI or persistence.

TypeScript owns all PP_Crew interpretation: active employees, legal availability,
absences, breaks/paid minutes, weekly targets, store slots, preferred windows,
and applicable Saturdays. Python receives normalized facts and selects candidate IDs only.

## Reproduce

```bash
python3.12 -m venv experiments/cp_sat/.venv
experiments/cp_sat/.venv/bin/pip install -r experiments/cp_sat/requirements.txt
npx tsx experiments/cp_sat/run.ts
```

Generated raw output is written below `experiments/cp_sat/output/` and is ignored.
The reviewed evidence is recorded in `RESULTS.md`.

The solver uses one worker, a fixed seed, stable candidates, and lexicographic stages.
An `OPTIMAL` stage is frozen before the next objective. A merely `FEASIBLE` stage
is retained but stops the ladder. `INFEASIBLE` and `UNKNOWN` stay distinct.
