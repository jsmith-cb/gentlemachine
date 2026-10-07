import unittest
from solver import solve

def fixture(candidates, target=120, mode="require", timeout=2):
    return {"label":"fixture","year":2026,"month":10,"timeoutSeconds":timeout,"seed":7,
      "modes":{"contracted-hours":mode,"opening-hours-coverage":"prefer","one-saturday-off-per-month":"prefer"},
      "preferredOrder":["contracted-hours","minimize-fragmentation"],
      "employees":[{"id":"e","name":"Employee","weeklyTargetMinutes":target,"maxDaysPerWeek":5,"maxScheduledMinutesPerDay":480,"applicableSaturdays":[]}],
      "candidates":candidates,"weekTargets":[{"employeeId":"e","weekStart":"2026-10-05","targetMinutes":target,"fixedScheduledMinutes":0,"fixedDates":[]}],
      "openSlots":[],"fixedSlotOccupancy":{},"fixedShifts":[]}

def candidate(identity,date,scheduled):
    end_hour=10+scheduled//60;end_minute=scheduled%60
    return {"id":identity,"employeeId":"e","date":date,"weekStart":"2026-10-05","start":"10:00","end":f"{end_hour:02d}:{end_minute:02d}","spanMinutes":scheduled,"scheduledMinutes":scheduled,"preferredSpanMinutes":scheduled,"coverageSlots":[]}

class SolverRegressionTests(unittest.TestCase):
    def test_exact_scheduled_target_is_not_reduced_by_inferred_breaks(self):
        result=solve(fixture([candidate("exact","2026-10-10",300)],300))
        self.assertEqual(result["status"],"OPTIMAL")

    def test_portal_test_target_is_reevaluated_as_scheduled_time(self):
        values=[candidate(f"portal-{day}",f"2026-10-{day:02d}",300) for day in range(5,9)]
        result=solve(fixture(values,1200,"require"))
        self.assertEqual(result["status"],"OPTIMAL")
        self.assertEqual(len(result["selectedCandidateIds"]),4)

    def test_wanda_exact_target_is_representable_without_break_deductions(self):
        values=[candidate(f"wanda-{day}",f"2026-10-{day:02d}",300) for day in range(5,8)]
        result=solve(fixture(values,900,"require"))
        self.assertEqual(result["status"],"OPTIMAL")

    def test_mini_exact_target_is_representable_without_break_deductions(self):
        values=[candidate(f"mini-{day}",f"2026-10-{day:02d}",300) for day in range(5,8)]
        result=solve(fixture(values,900,"require"))
        self.assertEqual(result["status"],"OPTIMAL")

    def test_later_day_can_win_neutral_distribution_instead_of_chronological_fill(self):
        values=[candidate("mon","2026-10-05",60),candidate("tue","2026-10-06",60),candidate("fri","2026-10-09",60)]
        result=solve(fixture(values,120,"require",5))
        self.assertEqual(result["status"],"OPTIMAL")
        self.assertIn("fri",result["selectedCandidateIds"])
        self.assertEqual(len(result["selectedCandidateIds"]),2)

if __name__=="__main__":unittest.main()
