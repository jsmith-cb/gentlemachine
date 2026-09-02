import {
    createDateKey,
    getDayOfWeek,
    minutesToTime,
    timeToMinutes,
} from "./hoursService";

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

        if (
            getDayOfWeek(
                date,
            ) === 0
        ) {
            continue;
        }

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
    const storeOpen =
        timeToMinutes(
            state.storeHours.open,
        );

    const storeClose =
        timeToMinutes(
            state.storeHours.close,
        );

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
                    state.storeHours.open,
                end:
                    state.storeHours.close,
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
                state.storeHours.close,
        });
    }

    return gaps;
}