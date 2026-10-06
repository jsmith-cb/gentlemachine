import { describe,expect,it } from "vitest";
import { createInitialPlannerState } from "../state/plannerState";
import { availableTeamForDay } from "./dayPlanningService";
import { generateShifts } from "./generationService";
import { getAdjustedMonthlyTargetMinutes } from "./hoursService";

describe("canonical sickness scheduling boundary",()=>{
 it("blocks manual and generated scheduling without reducing target hours",()=>{
  const state=createInitialPlannerState();const employee=state.employees[0];
  state.employees=[employee];state.sicknesses=[{id:"sick",employeeId:employee.id,startDate:"2026-10-05",endDate:"2026-10-05"}];
  expect(availableTeamForDay(state,"2026-10-05")).toEqual([]);
  const generated=generateShifts(state.employees,state.vacations,state.storeHours,2026,10,[],state.schedulingRules,state.sicknesses);
  expect(generated.shifts.some(shift=>shift.employeeId===employee.id&&shift.date==="2026-10-05")).toBe(false);
  expect(getAdjustedMonthlyTargetMinutes(employee,state.vacations,2026,10))
   .toBe(getAdjustedMonthlyTargetMinutes(employee,[],2026,10));
 });
});
