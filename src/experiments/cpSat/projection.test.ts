import { describe,expect,it } from "vitest";
import { projectSolverInput } from "./projection";
import { benchmarkState } from "../../../experiments/cp_sat/fixture";

describe("CP-SAT canonical projection",()=>{
 it("excludes inactive people and keeps current domain semantics in TypeScript",()=>{const state=benchmarkState(2026,11);state.employees.push({...state.employees[0],id:"portal",status:"inactive"});const input=projectSolverInput(state,"test");expect(input.employees.some(e=>e.id==="portal")).toBe(false);expect(input.candidates.length).toBeGreaterThan(0);expect(input.fixedShifts.every(s=>s.date.startsWith("2026-10"))).toBe(true);});
 it("uses scheduled span for targets and preferred-window overlap",()=>{const input=projectSolverInput(benchmarkState(2026,10),"test");const finn=input.candidates.find(c=>c.employeeId.startsWith("eb5")&&c.spanMinutes===480);expect(finn?.scheduledMinutes).toBe(480);expect(finn?.preferredSpanMinutes).toBe(480);});
 it("counts Lacey's exact five-hour span as five scheduled hours",()=>{const input=projectSolverInput(benchmarkState(2026,10),"test");const lacey=input.candidates.filter(c=>c.employeeId.startsWith("d567")&&c.date==="2026-10-03");expect(lacey.some(c=>c.spanMinutes===300&&c.scheduledMinutes===300)).toBe(true);expect(lacey.some(c=>c.spanMinutes===330)).toBe(false);});
});
