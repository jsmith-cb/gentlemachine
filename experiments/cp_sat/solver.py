#!/usr/bin/env python3
"""Normalized candidate selector. PP_Crew business interpretation stays in TypeScript."""
from __future__ import annotations
import json, sys, time
from collections import defaultdict
from ortools.sat.python import cp_model

STATUS = {cp_model.OPTIMAL:"OPTIMAL",cp_model.FEASIBLE:"FEASIBLE",cp_model.INFEASIBLE:"INFEASIBLE",cp_model.MODEL_INVALID:"MODEL_INVALID",cp_model.UNKNOWN:"UNKNOWN"}

def build(data, disabled_required=frozenset()):
    model=cp_model.CpModel(); candidates=data["candidates"]; x=[model.NewBoolVar(f"x_{i}") for i in range(len(candidates))]
    by_emp_date=defaultdict(list); by_emp_week=defaultdict(list); by_slot=defaultdict(list)
    for i,c in enumerate(candidates):
        by_emp_date[(c["employeeId"],c["date"])].append(i);by_emp_week[(c["employeeId"],c["weekStart"])].append(i)
        for slot in c["coverageSlots"]:by_slot[slot].append(i)
    day_vars={}
    for key,idxs in by_emp_date.items():
        model.Add(sum(x[i] for i in idxs)<=1);d=model.NewBoolVar("day_"+"_".join(key));model.Add(d==sum(x[i] for i in idxs));day_vars[key]=d
    employees={e["id"]:e for e in data["employees"]}
    for target in data["weekTargets"]:
        emp=target["employeeId"];week=target["weekStart"];idxs=by_emp_week[(emp,week)]
        dates=sorted({candidates[i]["date"] for i in idxs}|set(target["fixedDates"]));worked=[]
        for date in dates:
            worked.append(1 if date in target["fixedDates"] else day_vars.get((emp,date),0))
        model.Add(sum(worked)<=employees[emp]["maxDaysPerWeek"])
        scheduled=target["fixedScheduledMinutes"]+sum(candidates[i]["scheduledMinutes"]*x[i] for i in idxs)
        # Generation cannot add overtime. Pre-existing fixed overage remains an
        # immutable input fact and must not make an otherwise valid plan impossible.
        if target["fixedScheduledMinutes"]<=target["targetMinutes"]:model.Add(scheduled<=target["targetMinutes"])
        else:model.Add(sum(x[i] for i in idxs)==0)
        if data["modes"]["contracted-hours"]=="require" and "contracted-hours" not in disabled_required:model.Add(scheduled==target["targetMinutes"])
    for slot in data["openSlots"]:
        occ=data["fixedSlotOccupancy"].get(slot,0)+sum(x[i] for i in by_slot[slot])
        if data["modes"]["opening-hours-coverage"]=="require" and "opening-hours-coverage" not in disabled_required:model.Add(occ>=1)
    for e in data["employees"]:
        sats=e["applicableSaturdays"]
        if sats and data["modes"]["one-saturday-off-per-month"]=="require" and "one-saturday-off-per-month" not in disabled_required:
            model.Add(sum(day_vars.get((e["id"],d),0) for d in sats)<=len(sats)-1)
    return model,x,day_vars,by_slot,by_emp_week

def objective(model,x,day_vars,by_slot,by_emp_week,data,rule):
    c=data["candidates"]
    if rule=="employee-preferred-hours":return "max",sum(c[i]["preferredSpanMinutes"]*x[i] for i in range(len(c)))
    if rule=="opening-hours-coverage":
        flags=[]
        for n,slot in enumerate(data["openSlots"]):
            b=model.NewBoolVar(f"covered_{n}");occ=data["fixedSlotOccupancy"].get(slot,0)+sum(x[i] for i in by_slot[slot]);model.Add(occ>=1).OnlyEnforceIf(b);model.Add(occ==0).OnlyEnforceIf(b.Not());flags.append(b)
        return "max",sum(flags)
    if rule=="overlapping-shifts":
        flags=[]
        for n,slot in enumerate(data["openSlots"]):
            b=model.NewBoolVar(f"overlap_{n}");occ=data["fixedSlotOccupancy"].get(slot,0)+sum(x[i] for i in by_slot[slot]);model.Add(occ>=2).OnlyEnforceIf(b);model.Add(occ<=1).OnlyEnforceIf(b.Not());flags.append(b)
        return "max",sum(flags)
    if rule=="contracted-hours":
        deficits=[]
        for n,t in enumerate(data["weekTargets"]):
            selected=sum(c[i]["scheduledMinutes"]*x[i] for i in by_emp_week[(t["employeeId"],t["weekStart"])])
            remaining=max(0,t["targetMinutes"]-t["fixedScheduledMinutes"])
            d=model.NewIntVar(0,remaining,f"deficit_{n}");model.Add(d==remaining-selected);deficits.append(d)
        return "min",sum(deficits)
    if rule=="one-saturday-off-per-month":
        satisfied=[]
        for n,e in enumerate(data["employees"]):
            sats=e["applicableSaturdays"]
            if not sats:continue
            b=model.NewBoolVar(f"sat_off_{n}");worked=sum(day_vars.get((e["id"],d),0) for d in sats);model.Add(worked<=len(sats)-1).OnlyEnforceIf(b);model.Add(worked==len(sats)).OnlyEnforceIf(b.Not());satisfied.append(b)
        return "max",sum(satisfied)
    if rule=="minimize-fragmentation":return "min",sum(x)
    raise ValueError(rule)

def neutral_objectives(model,day_vars,data):
    # Neutral tie-break 1: adjacent worked-day pairs. Tie-break 2: separation.
    adjacent=[];separation=[]
    for e in data["employees"]:
        by_week=defaultdict(list)
        for (emp,date),v in day_vars.items():
            if emp==e["id"]:by_week[next(t["weekStart"] for t in data["weekTargets"] if t["employeeId"]==emp and date>=t["weekStart"] and date<=add_days(t["weekStart"],6))].append((date,v))
        for values in by_week.values():
            values.sort()
            for i,(da,a) in enumerate(values):
                for db,b in values[i+1:]:
                    both=model.NewBoolVar(f"pair_{e['id']}_{da}_{db}");model.Add(both<=a);model.Add(both<=b);model.Add(both>=a+b-1)
                    distance=(parse_day(db)-parse_day(da));separation.append(distance*both)
                    if distance==1:adjacent.append(both)
    return [("neutral-adjacent-days","min",sum(adjacent)),("neutral-day-separation","max",sum(separation))]

def add_days(v,n):
    from datetime import date,timedelta
    return str(date.fromisoformat(v)+timedelta(days=n))
def parse_day(v):
    from datetime import date
    return date.fromisoformat(v).toordinal()

def diagnose(data):
    required=[r for r in ("contracted-hours","opening-hours-coverage","one-saturday-off-per-month") if data["modes"][r]=="require"]
    participating=[]
    for rule in required:
        model,*_=build(data,{rule});s=cp_model.CpSolver();s.parameters.max_time_in_seconds=min(2,data["timeoutSeconds"]);s.parameters.num_search_workers=1
        if s.Solve(model) in (cp_model.OPTIMAL,cp_model.FEASIBLE):participating.append(f"Removing {rule} makes the model feasible")
    return participating or ["No single required-rule relaxation was sufficient; infeasibility involves boundaries and/or multiple requirements"]

def solve(data):
    started=time.perf_counter();model,x,day_vars,by_slot,by_emp_week=build(data);solver=cp_model.CpSolver();solver.parameters.max_time_in_seconds=data["timeoutSeconds"];solver.parameters.num_search_workers=1;solver.parameters.random_seed=data["seed"]
    stages=[];status=solver.Solve(model);name=STATUS[status]
    if status not in (cp_model.OPTIMAL,cp_model.FEASIBLE):return {"label":data["label"],"status":name,"selectedCandidateIds":[],"stages":stages,"infeasibilityDiagnostics":diagnose(data) if status==cp_model.INFEASIBLE else [],"wallSeconds":time.perf_counter()-started}
    objectives=[]
    for rule in data["preferredOrder"]:objectives.append((rule,*objective(model,x,day_vars,by_slot,by_emp_week,data,rule)))
    objectives.extend(neutral_objectives(model,day_vars,data))
    for rule,direction,expr in objectives:
        model.ClearHints()
        for variable in x:model.AddHint(variable,solver.Value(variable))
        if direction=="min":model.Minimize(expr)
        else:model.Maximize(expr)
        stage_start=time.perf_counter();status=solver.Solve(model);name=STATUS[status];entry={"rule":rule,"direction":direction,"status":name,"seconds":time.perf_counter()-stage_start}
        if status in (cp_model.OPTIMAL,cp_model.FEASIBLE):entry["value"]=round(solver.ObjectiveValue())
        stages.append(entry)
        if status!=cp_model.OPTIMAL:break
        value=round(solver.ObjectiveValue());model.Add(expr==value)
    selected=[data["candidates"][i]["id"] for i,v in enumerate(x) if solver.Value(v)] if status in (cp_model.OPTIMAL,cp_model.FEASIBLE) else []
    return {"label":data["label"],"status":name,"selectedCandidateIds":selected,"stages":stages,"wallSeconds":time.perf_counter()-started}

if __name__=="__main__":
    data=json.load(open(sys.argv[1]));result=solve(data);json.dump(result,sys.stdout,indent=2);print()
