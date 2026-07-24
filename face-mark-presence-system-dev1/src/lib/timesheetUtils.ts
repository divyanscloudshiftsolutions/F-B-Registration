import { format, parseISO, isSameMonth } from "date-fns";

export type HoursStatus = "overtime" | "under" | "normal" | "incomplete";

export interface TimesheetRow {
  id: string;
  userId: string;
  userName: string;
  employeeCode?: string;
  employmentType?: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  workHours: number | null;
  expectedHours: number;
  overtimeThreshold: number;
  overtimeHours: number;
  hoursStatus: HoursStatus;
  dayStatus?: string;
  payableDayFraction?: number;
  lopDayFraction?: number;
  isHoliday?: boolean;
  isWeekOff?: boolean;
}

/** Rows already come from Day Status Engine — pass-through / light normalize. */
export function normalizeTimesheetRows(rows: TimesheetRow[]): TimesheetRow[] {
  return [...rows].sort((a, b) => {
    const dateCmp = (b.date || "").localeCompare(a.date || "");
    if (dateCmp !== 0) return dateCmp;
    return (a.userName || "").localeCompare(b.userName || "");
  });
}

export function filterTimesheetRows(
  rows: TimesheetRow[],
  filters: {
    month: Date;
    date?: Date;
    search: string;
    status?: string;
  }
): TimesheetRow[] {
  return rows.filter((row) => {
    const rowDate = parseISO(row.date);
    if (!isSameMonth(rowDate, filters.month)) return false;
    if (filters.date && format(rowDate, "yyyy-MM-dd") !== format(filters.date, "yyyy-MM-dd")) {
      return false;
    }
    if (filters.status && filters.status !== "all") {
      if ((row.dayStatus || "").toUpperCase() !== filters.status.toUpperCase()) return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (
        !row.userName.toLowerCase().includes(q) &&
        !row.employeeCode?.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });
}

export function hoursStatusClass(status: HoursStatus): string {
  switch (status) {
    case "overtime":
      return "text-blue-700 bg-blue-50 font-semibold";
    case "under":
    case "incomplete":
      return "text-red-700 bg-red-50 font-semibold";
    default:
      return "text-gray-900";
  }
}

export function dayStatusClass(status?: string): string {
  const s = (status || "").toUpperCase();
  if (s.includes("LEAVE") || s === "HOLIDAY" || s === "WEEK_OFF") return "bg-emerald-50 text-emerald-800";
  if (s === "ABSENT" || s.includes("LOP") || s === "UNPAID_LEAVE") return "bg-red-50 text-red-800";
  if (s.includes("WORKED")) return "bg-blue-50 text-blue-800";
  if (s === "PRESENT" || s === "LATE") return "bg-slate-100 text-slate-800";
  return "bg-gray-50 text-gray-700";
}
