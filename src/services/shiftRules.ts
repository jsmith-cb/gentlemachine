import { getShiftDurationMinutes } from "./hoursService";
import type { Shift } from "../types/planning";

/** Standard shift ceiling until an explicit overtime policy exists. */
export const MAXIMUM_STANDARD_SHIFT_MINUTES = 8 * 60;

export function exceedsMaximumStandardShift(shift: Shift): boolean {
    return getShiftDurationMinutes(shift) > MAXIMUM_STANDARD_SHIFT_MINUTES;
}
