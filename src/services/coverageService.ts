import {
    createDateKey,
    minutesToTime,
    timeToMinutes,
} from "./hoursService";
import { getOperatingHoursForDate } from "./storeHoursService";

import type {
    CoverageGap,
    PlannerState,
} from "../types/planning";

interface CoverageInterval {
    start: number;
    end: number;
}

export function getCoverageGapsForMonth(
    state: PlannerState,
): CoverageGap[] {
    const gaps:
        CoverageGap[] = [];

    const daysInMonth =
        new Date(
            Date.UTC(
                state.selectedYear,
                state.selectedMonth,
                0,
            ),
        ).getUTCDate();

    for (
        let day = 1;
        day <= daysInMonth;
        day += 1
    ) {
        const date =
            createDateKey(
                state.selectedYear,
                state.selectedMonth,
                day,
            );

        if (!getOperatingHoursForDate(state.storeHours, date)) continue;

        gaps.push(
            ...getCoverageGapsForDate(
                state,
                date,
            ),
        );
    }

    return gaps;
}

export function getCoverageGapsForDate(
    state: PlannerState,
    date: string,
): CoverageGap[] {
    const operating = getOperatingHoursForDate(state.storeHours, date);
    if (!operating) return [];
    const storeOpen = timeToMinutes(operating.open);
    const storeClose = timeToMinutes(operating.close);

    const intervals:
        CoverageInterval[] =
        state.shifts
            .filter(
                (shift) =>
                    shift.date ===
                    date,
            )
            .map(
                (shift) => ({
                    start:
                        Math.max(
                            timeToMinutes(
                                shift.start,
                            ),
                            storeOpen,
                        ),

                    end:
                        Math.min(
                            timeToMinutes(
                                shift.end,
                            ),
                            storeClose,
                        ),
                }),
            )
            .filter(
                ({ start, end }) =>
                    end > start,
            )
            .sort(
                (left, right) =>
                    left.start -
                    right.start,
            );

    if (
        intervals.length === 0
    ) {
        return [
            {
                date,
                start:
                    operating.open,
                end:
                    operating.close,
            },
        ];
    }

    const gaps:
        CoverageGap[] = [];

    let coveredUntil =
        storeOpen;

    for (
        const interval
        of intervals
    ) {
        if (
            interval.start >
            coveredUntil
        ) {
            gaps.push({
                date,
                start:
                    minutesToTime(
                        coveredUntil,
                    ),
                end:
                    minutesToTime(
                        interval.start,
                    ),
            });
        }

        coveredUntil =
            Math.max(
                coveredUntil,
                interval.end,
            );
    }

    if (
        coveredUntil <
        storeClose
    ) {
        gaps.push({
            date,
            start:
                minutesToTime(
                    coveredUntil,
                ),
            end:
                operating.close,
        });
    }

    return gaps;
}
