import { apiRequest } from "@/lib/api";

export interface ShiftTemplate {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

export interface RosterDayAssignment {
  id: string | null;
  userId: string;
  workDate: string;
  shiftId: string | null;
  shiftName: string | null;
  shiftCode: string | null;
  startTime: string | null;
  endTime: string | null;
  color: string | null;
  isWeekOff: boolean;
  notes: string | null;
}

export interface RosterEmployeeRow {
  userId: string;
  userName: string;
  employeeCode?: string;
  departmentName?: string;
  employmentType?: string;
  days: RosterDayAssignment[];
}

export interface WeeklyRoster {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: "draft" | "published";
  notes?: string | null;
  publishedAt?: string | null;
  dates: string[];
  employees: RosterEmployeeRow[];
}

export interface AssignmentPayload {
  userId: string;
  workDate: string;
  shiftId?: string | null;
  isWeekOff?: boolean;
  notes?: string | null;
}

export const getShifts = (activeOnly = true) =>
  apiRequest<ShiftTemplate[]>(
    `/api/rosters/shifts?activeOnly=${activeOnly}`,
    {},
    "admin"
  );

export const createShift = (payload: {
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  color?: string;
}) =>
  apiRequest<ShiftTemplate>(
    "/api/rosters/shifts",
    { method: "POST", body: JSON.stringify(payload) },
    "admin"
  );

export const updateShift = (
  id: string,
  payload: Partial<{
    name: string;
    code: string;
    startTime: string;
    endTime: string;
    color: string;
    isActive: boolean;
    sortOrder: number;
  }>
) =>
  apiRequest<ShiftTemplate>(
    `/api/rosters/shifts/${id}`,
    { method: "PATCH", body: JSON.stringify(payload) },
    "admin"
  );

export const deleteShift = (id: string) =>
  apiRequest<void>(`/api/rosters/shifts/${id}`, { method: "DELETE" }, "admin");

export const getWeekRoster = (weekStart: string, departmentId?: string) => {
  const params = new URLSearchParams({ weekStart });
  if (departmentId) params.set("departmentId", departmentId);
  return apiRequest<WeeklyRoster>(`/api/rosters/week?${params}`, {}, "admin");
};

export const saveAssignments = (rosterId: string, assignments: AssignmentPayload[]) =>
  apiRequest<WeeklyRoster>(
    `/api/rosters/week/${rosterId}/assignments`,
    { method: "PUT", body: JSON.stringify({ assignments }) },
    "admin"
  );

export const applyWeekShift = (
  rosterId: string,
  payload: {
    userId: string;
    shiftId?: string | null;
    isWeekOff?: boolean;
    skipDates?: string[];
  }
) =>
  apiRequest<WeeklyRoster>(
    `/api/rosters/week/${rosterId}/apply-week`,
    { method: "POST", body: JSON.stringify(payload) },
    "admin"
  );

export const publishRoster = (rosterId: string) =>
  apiRequest<WeeklyRoster>(
    `/api/rosters/week/${rosterId}/publish`,
    { method: "POST" },
    "admin"
  );

export const unpublishRoster = (rosterId: string) =>
  apiRequest<WeeklyRoster>(
    `/api/rosters/week/${rosterId}/unpublish`,
    { method: "POST" },
    "admin"
  );

export const copyPreviousWeek = (weekStart: string) =>
  apiRequest<WeeklyRoster>(
    `/api/rosters/week/copy-previous?weekStart=${weekStart}`,
    { method: "POST" },
    "admin"
  );

export const getMyWeekRoster = (weekStart?: string) => {
  const q = weekStart ? `?weekStart=${weekStart}` : "";
  return apiRequest<{
    weekStart: string;
    weekEnd: string;
    status: string;
    dates: string[];
    employee: RosterEmployeeRow | null;
  }>(`/api/rosters/my-week${q}`, {}, "user");
};
