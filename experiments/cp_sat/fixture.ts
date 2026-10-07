import type { Employee, PlannerState, SchedulingRuleSettings, Shift } from "../../src/types/planning";
import { DEFAULT_STORE_HOURS } from "../../src/services/storeHoursService";

export const CANONICAL_ORDER = ["one-saturday-off-per-month","employee-preferred-hours","opening-hours-coverage","overlapping-shifts","contracted-hours","minimize-fragmentation"] as const;
export const STRICT_RULES: SchedulingRuleSettings={minimumGeneratedShiftMinutes:120,modes:{"contracted-hours":"require","opening-hours-coverage":"require","one-saturday-off-per-month":"require"},preferredOrder:[...CANONICAL_ORDER]};
export const employees:Employee[]=[
 {id:"eb5b5d31-d8f6-4e80-9a82-4fc5b4ca65ac",employeeNumber:"001",status:"active",firstName:"Finn",lastName:"guy",weeklyTargetMinutes:2100,maxDaysPerWeek:5,availability:{days:[1,2,3,4,5,6],earliestStart:"10:00",latestEnd:"20:30",dayHours:Object.fromEntries([1,2,3,4,5,6].map(d=>[d,{earliestStart:"10:00",latestEnd:"20:30"}]))}},
 {id:"27d9d823-76df-4c32-8129-8bc7a497b2d8",employeeNumber:"005",status:"active",firstName:"Tina",lastName:"her",weeklyTargetMinutes:1200,maxDaysPerWeek:5,availability:{days:[1,2,3,4,5,6],dayHours:{}}},
 {id:"e756832e-981d-465b-8a08-f314869745db",employeeNumber:"004",status:"active",firstName:"Wanda",lastName:"Her",weeklyTargetMinutes:900,maxDaysPerWeek:5,availability:{days:[1,2,3,4,5],earliestStart:"09:00",latestEnd:"15:30",dayHours:{}}},
 {id:"d32d948e-6ab8-4d00-9e92-bbce4de27479",employeeNumber:"002",status:"active",firstName:"Mini",lastName:"Job",weeklyTargetMinutes:900,maxDaysPerWeek:5,maximumPaidMinutesPerDay:300,availability:{days:[1,2,3,4,5,6],earliestStart:"10:00",latestEnd:"17:00",dayHours:Object.fromEntries([1,2,3,4,5,6].map(d=>[d,{earliestStart:"10:00",latestEnd:"17:00"}]))}},
 {id:"d56770c4-6745-4bd0-b25e-1bd3fb335d17",employeeNumber:"003",status:"active",firstName:"Lacey",lastName:"Intern",weeklyTargetMinutes:300,maxDaysPerWeek:1,maximumPaidMinutesPerDay:300,availability:{days:[6],dayHours:{}}},
 {id:"7d5c0000-0000-4000-8000-000000000001",employeeNumber:"SM-001",status:"active",firstName:"AJ",lastName:"Smith",weeklyTargetMinutes:0,maxDaysPerWeek:5,availability:{days:[1,2,3,4,5],dayHours:{}}},
];

export const octoberBoundaryShifts:Shift[]=[
 ["68","e756832e-981d-465b-8a08-f314869745db","2026-10-26","10:30","15:30"],["56","d32d948e-6ab8-4d00-9e92-bbce4de27479","2026-10-26","10:30","15:30"],["57","eb5b5d31-d8f6-4e80-9a82-4fc5b4ca65ac","2026-10-26","12:30","20:30"],
 ["69","e756832e-981d-465b-8a08-f314869745db","2026-10-27","10:30","15:30"],["58","d32d948e-6ab8-4d00-9e92-bbce4de27479","2026-10-27","10:30","15:30"],["59","eb5b5d31-d8f6-4e80-9a82-4fc5b4ca65ac","2026-10-27","12:30","20:30"],
 ["70","e756832e-981d-465b-8a08-f314869745db","2026-10-28","10:30","15:30"],["60","d32d948e-6ab8-4d00-9e92-bbce4de27479","2026-10-28","10:30","15:30"],["61","eb5b5d31-d8f6-4e80-9a82-4fc5b4ca65ac","2026-10-28","12:30","20:30"],
 ["62","eb5b5d31-d8f6-4e80-9a82-4fc5b4ca65ac","2026-10-29","10:30","18:30"],["63","27d9d823-76df-4c32-8129-8bc7a497b2d8","2026-10-29","14:00","20:30"],["64","eb5b5d31-d8f6-4e80-9a82-4fc5b4ca65ac","2026-10-30","10:30","18:30"],["65","27d9d823-76df-4c32-8129-8bc7a497b2d8","2026-10-30","12:30","20:30"],["66","27d9d823-76df-4c32-8129-8bc7a497b2d8","2026-10-31","10:30","18:30"],["67","d56770c4-6745-4bd0-b25e-1bd3fb335d17","2026-10-31","15:30","20:30"],
].map(([n,employeeId,date,start,end])=>({id:`generated-shift-2026-10-${n}`,employeeId,date,start,end}));

export function benchmarkState(year:number,month:number,rules:SchedulingRuleSettings=STRICT_RULES):PlannerState{return{selectedYear:year,selectedMonth:month,storeHours:structuredClone(DEFAULT_STORE_HOURS),schedulingRules:structuredClone(rules),employees:structuredClone(employees),shifts:month===11?structuredClone(octoberBoundaryShifts):[],vacations:[],sicknesses:[]};}
