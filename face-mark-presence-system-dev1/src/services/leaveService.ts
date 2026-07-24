import { apiRequest } from "@/lib/api";

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  maxDaysPerYear: number;
  isPaid: boolean;
  carryForward?: boolean;
  isActive?: boolean;
  allowHalfDay?: boolean;
  requiresApproval?: boolean;
  maxConsecutiveDays?: number | null;
  documentAfterDays?: number | null;
  isCompOff?: boolean;
}

export interface LeaveBalance {
  id?: string;
  userId?: string;
  leaveTypeId: string;
  leaveTypeCode?: string;
  leaveTypeName?: string;
  isPaid?: boolean;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays?: number;
  availableDays?: number;
  balanceDays?: number;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName?: string;
  leaveTypeId: string;
  leaveTypeCode?: string;
  leaveTypeName?: string;
  isPaid?: boolean;
  startDate: string;
  endDate: string;
  totalDays: number;
  duration?: string;
  reason: string;
  attachmentUrl?: string | null;
  status: string;
  rejectionReason?: string | null;
  createdAt?: string;
  attendanceConflicts?: string[];
}

export const getLeaveTypes = () =>
  apiRequest<LeaveType[]>("/api/leaves/types", {}, "user");

export const getLeaveBalances = (userId: string, year?: number) => {
  const q = year ? `?year=${year}` : "";
  return apiRequest<LeaveBalance[]>(`/api/leaves/balance/${userId}${q}`, {}, "user");
};

export const applyLeave = (payload: {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  duration?: string;
  attachmentUrl?: string;
}) =>
  apiRequest<LeaveRequest>(
    "/api/leaves/apply",
    { method: "POST", body: JSON.stringify(payload) },
    "user"
  );

export const getLeaveRequests = (status?: string, auth: "user" | "admin" = "user") => {
  const q = status ? `?status=${status}` : "";
  return apiRequest<LeaveRequest[]>(`/api/leaves/requests${q}`, {}, auth);
};

export const approveLeave = (
  requestId: string,
  approved: boolean,
  rejectionReason?: string
) =>
  apiRequest<LeaveRequest>(
    `/api/leaves/${requestId}/approve`,
    {
      method: "PUT",
      body: JSON.stringify({ approved, rejectionReason }),
    },
    "admin"
  );

export const carryForwardLeave = (fromYear: number, toYear?: number) => {
  const params = new URLSearchParams({ fromYear: String(fromYear) });
  if (toYear != null) params.set("toYear", String(toYear));
  return apiRequest<{ balancesUpdated: number; fromYear: number; toYear: number }>(
    `/api/leaves/carry-forward?${params}`,
    { method: "POST" },
    "admin"
  );
};
