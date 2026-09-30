import type { jsPDF } from "jspdf";

import { getDayOfWeek } from "./hoursService";
import { buildScheduleWeeks } from "./scheduleService";

import type { Employee, Shift, StoreHours } from "../types/planning";

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
] as const;
const SHORT_MONTH_NAMES = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export interface ScheduleExportColumn {
    date: string;
    label: string;
    inSelectedMonth: boolean;
}

export interface ScheduleExportRow {
    employeeName: string;
    cells: string[][];
}

export interface ScheduleExportWeek {
    label: string;
    columns: ScheduleExportColumn[];
    rows: ScheduleExportRow[];
}

export interface ScheduleExportDocument {
    productName: "PricePocket Crew";
    periodLabel: string;
    filename: string;
    weeks: ScheduleExportWeek[];
}

function dateParts(date: string): { month: number; day: number } {
    const [, month, day] = date.split("-").map(Number);
    return { month, day };
}

function formatWeekRange(start: string, end: string): string {
    const startParts = dateParts(start);
    const endParts = dateParts(end);
    if (startParts.month === endParts.month) {
        return `${SHORT_MONTH_NAMES[startParts.month - 1]} ${startParts.day} - ${endParts.day}`;
    }
    return `${SHORT_MONTH_NAMES[startParts.month - 1]} ${startParts.day} - ` +
        `${SHORT_MONTH_NAMES[endParts.month - 1]} ${endParts.day}`;
}

export function scheduleExportFilename(year: number, month: number): string {
    return `pp-crew-schedule-${year}-${String(month).padStart(2, "0")}.pdf`;
}

export function buildScheduleExportDocument(
    shifts: readonly Shift[],
    employees: readonly Employee[],
    storeHours: StoreHours,
    year: number,
    month: number,
): ScheduleExportDocument {
    const weeks = buildScheduleWeeks(shifts, employees, year, month, null, storeHours);

    return {
        productName: "PricePocket Crew",
        periodLabel: `${MONTH_NAMES[month - 1]} ${year}`,
        filename: scheduleExportFilename(year, month),
        weeks: weeks.map((week) => ({
            label: formatWeekRange(week.displayStart, week.displayEnd),
            columns: week.columns.map((column) => ({
                date: column.date,
                label: `${DAY_NAMES[getDayOfWeek(column.date)]} ${dateParts(column.date).day}`,
                inSelectedMonth: column.inSelectedMonth,
            })),
            rows: week.rows.map((row) => ({
                employeeName: row.employeeName,
                cells: row.cells.map((cell) =>
                    cell.shifts.map((shift) => `${shift.start}-${shift.end}`)),
            })),
        })),
    };
}

export async function createSchedulePdf(model: ScheduleExportDocument): Promise<jsPDF> {
    const { jsPDF: PdfDocument } = await import("jspdf");
    const pdf = new PdfDocument({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 12;
    const contentWidth = pageWidth - margin * 2;
    const bottomLimit = pageHeight - 16;
    const employeeWidth = 48;
    let y = 0;

    const drawDocumentHeader = (): void => {
        pdf.setTextColor(37, 99, 235);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(model.productName.toUpperCase(), margin, 14);
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(20);
        pdf.text("Team Schedule", margin, 23);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(71, 85, 105);
        pdf.text(model.periodLabel, pageWidth - margin, 22, { align: "right" });
        pdf.setDrawColor(213, 221, 232);
        pdf.line(margin, 28, pageWidth - margin, 28);
        y = 35;
    };

    const addPage = (): void => {
        pdf.addPage("a4", "landscape");
        drawDocumentHeader();
    };

    const drawWeekHeader = (week: ScheduleExportWeek, continued = false): void => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.setTextColor(37, 99, 235);
        pdf.text(`${week.label}${continued ? " (continued)" : ""}`, margin, y);
        y += 4;

        const dayWidth = (contentWidth - employeeWidth) / week.columns.length;
        pdf.setFillColor(238, 242, 247);
        pdf.setDrawColor(213, 221, 232);
        pdf.rect(margin, y, contentWidth, 10, "FD");
        pdf.setTextColor(51, 65, 85);
        pdf.setFontSize(8);
        pdf.text("TEAM MEMBER", margin + 3, y + 6.5);
        week.columns.forEach((column, index) => {
            const x = margin + employeeWidth + dayWidth * index;
            pdf.line(x, y, x, y + 10);
            if (!column.inSelectedMonth) {
                pdf.setFillColor(229, 234, 240);
                pdf.rect(x, y, dayWidth, 10, "F");
            }
            pdf.text(column.label, x + dayWidth / 2, y + 6.5, { align: "center" });
        });
        y += 10;
    };

    const drawWeek = (week: ScheduleExportWeek): void => {
        if (y + 24 > bottomLimit) addPage();
        drawWeekHeader(week);
        const dayWidth = (contentWidth - employeeWidth) / week.columns.length;

        for (const row of week.rows) {
            const nameLines = pdf.splitTextToSize(row.employeeName, employeeWidth - 6) as string[];
            const lineCount = Math.max(1, nameLines.length, ...row.cells.map((cell) => cell.length));
            const rowHeight = Math.max(13, 6 + lineCount * 4);
            if (y + rowHeight > bottomLimit) {
                addPage();
                drawWeekHeader(week, true);
            }

            pdf.setDrawColor(226, 232, 240);
            pdf.setFillColor(255, 255, 255);
            pdf.rect(margin, y, contentWidth, rowHeight, "FD");
            pdf.setTextColor(15, 23, 42);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8.5);
            pdf.text(nameLines, margin + 3, y + 5.5);

            row.cells.forEach((cell, index) => {
                const x = margin + employeeWidth + dayWidth * index;
                pdf.line(x, y, x, y + rowHeight);
                if (!week.columns[index]!.inSelectedMonth) {
                    pdf.setFillColor(245, 247, 250);
                    pdf.rect(x, y, dayWidth, rowHeight, "F");
                    return;
                }
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(8);
                pdf.setTextColor(cell.length ? 15 : 148, cell.length ? 23 : 163, cell.length ? 42 : 184);
                pdf.text(cell.length ? cell : ["—"], x + dayWidth / 2, y + 5.5, {
                    align: "center",
                });
            });
            y += rowHeight;
        }
        y += 8;
    };

    drawDocumentHeader();
    if (model.weeks.length === 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(15, 23, 42);
        pdf.text("No shifts scheduled for this month.", margin, y + 10);
    } else {
        model.weeks.forEach(drawWeek);
    }

    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(`${model.productName} | ${model.periodLabel}`, margin, pageHeight - 7);
        pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: "right" });
    }

    pdf.setProperties({
        title: `${model.productName} - ${model.periodLabel}`,
        subject: "Team schedule",
        creator: model.productName,
    });
    return pdf;
}

export async function downloadSchedulePdf(model: ScheduleExportDocument): Promise<void> {
    const pdf = await createSchedulePdf(model);
    pdf.save(model.filename);
}
