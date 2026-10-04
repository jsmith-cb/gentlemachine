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
    inScheduleScope: boolean;
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
    scope: "team" | "employee";
    documentTitle: "Team Schedule" | "Employee Schedule";
    employeeName?: string;
    periodLabel: string;
    filename: string;
    emptyMessage: "No shifts scheduled for this month.";
    weeks: ScheduleExportWeek[];
}

export type ScheduleExportRequest =
    | { scope: "team" }
    | { scope: "employee"; employeeId: string };

export type WeekPaginationDecision = "current-page" | "next-page" | "split";

const PDF_LAYOUT = {
    documentHeaderEndY: 35,
    weekHeadingHeight: 4,
    tableHeaderHeight: 10,
    minimumRowHeight: 13,
    rowBaseHeight: 6,
    rowLineHeight: 4,
    weekBottomSpacing: 8,
} as const;

export function decideWeekPagination(
    currentY: number,
    bottomLimit: number,
    freshPageY: number,
    weekHeight: number,
): WeekPaginationDecision {
    if (weekHeight <= bottomLimit - currentY) return "current-page";
    if (weekHeight <= bottomLimit - freshPageY) return "next-page";
    return "split";
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

export function employeeScheduleExportFilename(
    employeeName: string,
    year: number,
    month: number,
): string {
    const slug = employeeName
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "employee";
    return `pp-crew-schedule-${slug}-${year}-${String(month).padStart(2, "0")}.pdf`;
}

export function buildScheduleExportDocument(
    shifts: readonly Shift[],
    employees: readonly Employee[],
    storeHours: StoreHours,
    year: number,
    month: number,
    request: ScheduleExportRequest,
): ScheduleExportDocument {
    const employee = request.scope === "employee"
        ? employees.find(({ id }) => id === request.employeeId)
        : undefined;
    if (request.scope === "employee" && !employee) {
        throw new Error(`Unknown employee: ${request.employeeId}`);
    }
    const employeeName = employee
        ? `${employee.firstName} ${employee.lastName}`
        : undefined;
    const weeks = buildScheduleWeeks(
        shifts,
        employees,
        year,
        month,
        request.scope === "employee" ? request.employeeId : null,
        storeHours,
        { includeBoundaryWeekShifts: true },
    );

    return {
        productName: "PricePocket Crew",
        scope: request.scope,
        documentTitle: request.scope === "employee" ? "Employee Schedule" : "Team Schedule",
        employeeName,
        periodLabel: `${MONTH_NAMES[month - 1]} ${year}`,
        filename: employeeName
            ? employeeScheduleExportFilename(employeeName, year, month)
            : scheduleExportFilename(year, month),
        emptyMessage: "No shifts scheduled for this month.",
        weeks: weeks.map((week) => ({
            label: formatWeekRange(week.displayStart, week.displayEnd),
            columns: week.columns.map((column) => ({
                date: column.date,
                label: `${DAY_NAMES[getDayOfWeek(column.date)]} ${dateParts(column.date).day}`,
                inScheduleScope: column.inScheduleScope,
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
    const documentHeaderEndY = model.scope === "employee" ? 41 : PDF_LAYOUT.documentHeaderEndY;
    let y = 0;

    const drawDocumentHeader = (): void => {
        pdf.setTextColor(37, 99, 235);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(model.productName.toUpperCase(), margin, 14);
        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(20);
        pdf.text(model.documentTitle, margin, 23);
        if (model.employeeName) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10);
            pdf.setTextColor(51, 65, 85);
            pdf.text(model.employeeName, margin, 29);
        }
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(71, 85, 105);
        pdf.text(model.periodLabel, pageWidth - margin, 22, { align: "right" });
        pdf.setDrawColor(213, 221, 232);
        const dividerY = model.scope === "employee" ? 34 : 28;
        pdf.line(margin, dividerY, pageWidth - margin, dividerY);
        y = documentHeaderEndY;
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
        y += PDF_LAYOUT.weekHeadingHeight;

        const dayWidth = (contentWidth - employeeWidth) / week.columns.length;
        pdf.setFillColor(238, 242, 247);
        pdf.setDrawColor(213, 221, 232);
        pdf.rect(margin, y, contentWidth, PDF_LAYOUT.tableHeaderHeight, "FD");
        pdf.setTextColor(51, 65, 85);
        pdf.setFontSize(8);
        pdf.text("TEAM MEMBER", margin + 3, y + 6.5);
        week.columns.forEach((column, index) => {
            const x = margin + employeeWidth + dayWidth * index;
            pdf.line(x, y, x, y + PDF_LAYOUT.tableHeaderHeight);
            if (!column.inScheduleScope) {
                pdf.setFillColor(229, 234, 240);
                pdf.rect(x, y, dayWidth, PDF_LAYOUT.tableHeaderHeight, "F");
            }
            pdf.text(column.label, x + dayWidth / 2, y + 6.5, { align: "center" });
        });
        y += PDF_LAYOUT.tableHeaderHeight;
    };

    const rowHeight = (row: ScheduleExportRow): number => {
        const nameLines = pdf.splitTextToSize(row.employeeName, employeeWidth - 6) as string[];
        const lineCount = Math.max(1, nameLines.length, ...row.cells.map((cell) => cell.length));
        return Math.max(
            PDF_LAYOUT.minimumRowHeight,
            PDF_LAYOUT.rowBaseHeight + lineCount * PDF_LAYOUT.rowLineHeight,
        );
    };

    const weekHeight = (week: ScheduleExportWeek): number =>
        PDF_LAYOUT.weekHeadingHeight +
        PDF_LAYOUT.tableHeaderHeight +
        week.rows.reduce((total, row) => total + rowHeight(row), 0) +
        PDF_LAYOUT.weekBottomSpacing;

    const drawWeek = (week: ScheduleExportWeek): void => {
        const pagination = decideWeekPagination(
            y,
            bottomLimit,
            documentHeaderEndY,
            weekHeight(week),
        );
        if (pagination === "next-page" || (
            pagination === "split" &&
            y + PDF_LAYOUT.weekHeadingHeight + PDF_LAYOUT.tableHeaderHeight +
                PDF_LAYOUT.minimumRowHeight > bottomLimit
        )) {
            addPage();
        }
        drawWeekHeader(week);
        const dayWidth = (contentWidth - employeeWidth) / week.columns.length;

        for (const row of week.rows) {
            const nameLines = pdf.splitTextToSize(row.employeeName, employeeWidth - 6) as string[];
            const renderedRowHeight = rowHeight(row);
            if (y + renderedRowHeight > bottomLimit) {
                addPage();
                drawWeekHeader(week, true);
            }

            pdf.setDrawColor(226, 232, 240);
            pdf.setFillColor(255, 255, 255);
            pdf.rect(margin, y, contentWidth, renderedRowHeight, "FD");
            pdf.setTextColor(15, 23, 42);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8.5);
            pdf.text(nameLines, margin + 3, y + 5.5);

            row.cells.forEach((cell, index) => {
                const x = margin + employeeWidth + dayWidth * index;
                pdf.line(x, y, x, y + renderedRowHeight);
                if (!week.columns[index]!.inScheduleScope) {
                    pdf.setFillColor(245, 247, 250);
                    pdf.rect(x, y, dayWidth, renderedRowHeight, "F");
                    return;
                }
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(8);
                pdf.setTextColor(cell.length ? 15 : 148, cell.length ? 23 : 163, cell.length ? 42 : 184);
                pdf.text(cell.length ? cell : ["—"], x + dayWidth / 2, y + 5.5, {
                    align: "center",
                });
            });
            y += renderedRowHeight;
        }
        y += PDF_LAYOUT.weekBottomSpacing;
    };

    drawDocumentHeader();
    if (model.weeks.length === 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.setTextColor(15, 23, 42);
        pdf.text(model.emptyMessage, margin, y + 10);
    } else {
        model.weeks.forEach(drawWeek);
    }

    const pageCount = pdf.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
        pdf.setPage(page);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        const footerIdentity = model.employeeName
            ? `${model.productName} | ${model.employeeName} | ${model.periodLabel}`
            : `${model.productName} | ${model.periodLabel}`;
        pdf.text(footerIdentity, margin, pageHeight - 7);
        pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: "right" });
    }

    pdf.setProperties({
        title: model.employeeName
            ? `${model.productName} - ${model.employeeName} - ${model.periodLabel}`
            : `${model.productName} - ${model.periodLabel}`,
        subject: "Team schedule",
        creator: model.productName,
    });
    return pdf;
}

export async function downloadSchedulePdf(model: ScheduleExportDocument): Promise<void> {
    const pdf = await createSchedulePdf(model);
    pdf.save(model.filename);
}
