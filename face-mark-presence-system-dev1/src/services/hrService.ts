import { apiRequest } from "@/lib/api";
import type { LeaveType } from "@/services/leaveService";

export interface Holiday {
  id: string;
  name: string;
  holidayDate: string;
  holidayType: string;
  appliesTo: string;
  departmentId?: string | null;
  employmentType?: string | null;
  isPaid: boolean;
  workCompensation: string;
  isActive: boolean;
}

export interface WeekOffPolicy {
  id: string;
  name: string;
  code: string;
  policyType: string;
  weekOffDays: number[];
  isPaid: boolean;
  workCompensation: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface MonthlyDayStatusSummary {
  userId: string;
  month: number;
  year: number;
  calendarDays: number;
  workingDays: number;
  present: number;
  paidLeave: number;
  unpaidLeave: number;
  holidays: number;
  weekOffs: number;
  workedHoliday: number;
  workedWeekOff: number;
  payableDays: number;
  lopDays: number;
  expectedMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  days: Array<{
    workDate: string;
    attendanceStatus: string;
    payableDayFraction: number;
    lopDayFraction: number;
    presentFraction: number;
    paidLeaveFraction: number;
    unpaidLeaveFraction: number;
    isHoliday: boolean;
    isWeekOff: boolean;
    notes?: string | null;
  }>;
}

export const getHolidays = (year?: number) => {
  const q = year ? `?year=${year}` : "";
  return apiRequest<Holiday[]>(`/api/hr/holidays${q}`, {}, "admin");
};

export const createHoliday = (payload: {
  name: string;
  holidayDate: string;
  holidayType?: string;
  appliesTo?: string;
  departmentId?: string | null;
  employmentType?: string | null;
  isPaid?: boolean;
  workCompensation?: string;
}) =>
  apiRequest<Holiday>(
    "/api/hr/holidays",
    { method: "POST", body: JSON.stringify(payload) },
    "admin"
  );

export const deleteHoliday = (id: string) =>
  apiRequest<void>(`/api/hr/holidays/${id}`, { method: "DELETE" }, "admin");

export const getWeekOffPolicies = () =>
  apiRequest<WeekOffPolicy[]>("/api/hr/weekoff-policies", {}, "admin");

export const createWeekOffPolicy = (payload: {
  name: string;
  code: string;
  policyType?: string;
  weekOffDays?: number[];
  isPaid?: boolean;
  workCompensation?: string;
  isDefault?: boolean;
}) =>
  apiRequest<WeekOffPolicy>(
    "/api/hr/weekoff-policies",
    { method: "POST", body: JSON.stringify(payload) },
    "admin"
  );

export const updateWeekOffPolicy = (
  id: string,
  payload: Partial<{
    name: string;
    code: string;
    policyType: string;
    weekOffDays: number[];
    isPaid: boolean;
    workCompensation: string;
    isDefault: boolean;
    isActive: boolean;
  }>
) =>
  apiRequest<WeekOffPolicy>(
    `/api/hr/weekoff-policies/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    "admin"
  );

export const getAdminLeaveTypes = () =>
  apiRequest<LeaveType[]>("/api/hr/leave-types", {}, "admin");

export const createLeaveType = (payload: {
  name: string;
  code: string;
  maxDaysPerYear?: number;
  isPaid?: boolean;
  carryForward?: boolean;
  allowHalfDay?: boolean;
  requiresApproval?: boolean;
  maxConsecutiveDays?: number | null;
  isCompOff?: boolean;
}) =>
  apiRequest<LeaveType>(
    "/api/hr/leave-types",
    { method: "POST", body: JSON.stringify(payload) },
    "admin"
  );

export const updateLeaveType = (id: string, payload: Record<string, unknown>) =>
  apiRequest<LeaveType>(
    `/api/hr/leave-types/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    "admin"
  );

export const regenerateDayStatus = (month: number, year: number, userId?: string) => {
  const params = new URLSearchParams({ month: String(month), year: String(year) });
  if (userId) params.set("userId", userId);
  return apiRequest(`/api/hr/day-status/regenerate?${params}`, { method: "POST" }, "admin");
};

export const getMonthlyDayStatus = (month: number, year: number, userId?: string) => {
  const params = new URLSearchParams({ month: String(month), year: String(year) });
  if (userId) params.set("userId", userId);
  return apiRequest<MonthlyDayStatusSummary>(
    `/api/hr/day-status/summary?${params}`,
    {},
    userId ? "admin" : "user"
  );
};

export const getTimesheetFromDayStatus = (month: number, year: number) =>
  apiRequest<{ month: number; year: number; rows: import("@/lib/timesheetUtils").TimesheetRow[] }>(
    `/api/hr/day-status/timesheet?month=${month}&year=${year}`,
    {},
    "admin"
  );

export const updateHoliday = (id: string, payload: Record<string, unknown>) =>
  apiRequest<Holiday>(
    `/api/hr/holidays/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    "admin"
  );

export const assignWeekOffPolicy = (userId: string, policyId: string) =>
  apiRequest(
    "/api/hr/weekoff-policies/assign",
    {
      method: "POST",
      body: JSON.stringify({ userId, policyId }),
    },
    "admin"
  );
