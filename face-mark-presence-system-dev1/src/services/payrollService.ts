import { apiRequest } from "@/lib/api";

export type PayrollRunStatus =
  | "draft"
  | "calculated"
  | "under_review"
  | "approved"
  | "paid"
  | "cancelled";

export interface PayrollCycleStep {
  key: string;
  label: string;
  state: "done" | "current" | "pending";
}

export interface PayrollEmployeeRow {
  id: string | null;
  userId: string;
  userName?: string | null;
  employeeCode?: string | null;
  department?: string | null;
  employmentType?: string | null;
  monthlySalary?: number | null;
  calendarDays?: number | null;
  workingDays?: number | null;
  presentDays?: number | null;
  paidLeaveDays?: number | null;
  unpaidLeaveDays?: number | null;
  lopDays?: number | null;
  weekOffDays?: number | null;
  holidayDays?: number | null;
  expectedHours?: number | null;
  workedHours?: number | null;
  overtimeHours?: number | null;
  grossEarnings?: number | null;
  lopDeduction?: number | null;
  totalDeductions?: number | null;
  netPay?: number | null;
  month?: number;
  year?: number;
  status: string;
  flags?: string[];
  payslipUrl?: string | null;
}

export interface PayrollEmployeeDetail extends PayrollEmployeeRow {
  pan?: string | null;
  bankAccount?: string | null;
  bankIfsc?: string | null;
  bankName?: string | null;
  earnings?: Array<{ code: string; label: string; amount: number; source: string }>;
  deductions?: Array<{ code: string; label: string; amount: number; source: string }>;
  adjustments?: Array<{
    id: string;
    type: string;
    code: string;
    label: string;
    amount: number;
    reason: string;
    createdAt?: string | null;
  }>;
  breakdown?: Record<string, number>;
}

export interface PayrollPrecheck {
  month: number;
  year: number;
  employeeCount: number;
  withSalary: number;
  missingSalary: Array<{ userId: string; userName: string; employeeCode?: string | null }>;
  pendingLeaves: number;
  pendingAttendance: number;
  canCalculate: boolean;
  checks: Array<{ level: "ok" | "warn" | "error"; message: string }>;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: PayrollRunStatus;
  salaryCalcBasis: string;
  attendanceLocked: boolean;
  employeeCount: number;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  calculatedAt?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  paymentDate?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  cycle: PayrollCycleStep[];
  employees?: PayrollEmployeeRow[];
}

export interface PayrollDashboard {
  run: PayrollRun;
  kpis: {
    employeeCount: number;
    grossPayroll: number;
    totalDeductions: number;
    netPayable: number;
    status: string;
  };
  cycle: PayrollCycleStep[];
  precheck: PayrollPrecheck;
  employees: PayrollEmployeeRow[];
  history: PayrollRun[];
}

export const getPayrollDashboard = (month: number, year: number) =>
  apiRequest<PayrollDashboard>(`/api/payroll/dashboard?month=${month}&year=${year}`, {}, "admin");

export const calculatePayrollRun = (runId: string) =>
  apiRequest<PayrollRun>(`/api/payroll/runs/${runId}/calculate`, { method: "POST" }, "admin");

export const submitPayrollReview = (runId: string) =>
  apiRequest<PayrollRun>(`/api/payroll/runs/${runId}/submit-review`, { method: "POST" }, "admin");

export const approvePayrollRun = (runId: string) =>
  apiRequest<PayrollRun>(`/api/payroll/runs/${runId}/approve`, { method: "POST" }, "admin");

export const markPayrollPaid = (
  runId: string,
  payload: { paymentDate?: string; paymentMethod?: string; paymentReference?: string }
) =>
  apiRequest<PayrollRun>(
    `/api/payroll/runs/${runId}/mark-paid`,
    { method: "POST", body: JSON.stringify(payload) },
    "admin"
  );

export const reopenPayrollRun = (runId: string) =>
  apiRequest<PayrollRun>(`/api/payroll/runs/${runId}/reopen`, { method: "POST" }, "admin");

export const updatePayrollSettings = (runId: string, salaryCalcBasis: string) =>
  apiRequest<PayrollRun>(
    `/api/payroll/runs/${runId}/settings`,
    { method: "PUT", body: JSON.stringify({ salary_calc_basis: salaryCalcBasis }) },
    "admin"
  );

export const getPayrollRecord = (recordId: string) =>
  apiRequest<PayrollEmployeeDetail>(`/api/payroll/records/${recordId}`, {}, "admin");

export const recalculatePayrollRecord = (recordId: string) =>
  apiRequest<PayrollEmployeeDetail>(
    `/api/payroll/records/${recordId}/recalculate`,
    { method: "POST" },
    "admin"
  );

export const addPayrollAdjustment = (
  recordId: string,
  payload: {
    component_type: string;
    component_code: string;
    label: string;
    amount: number;
    reason: string;
  }
) =>
  apiRequest<PayrollEmployeeDetail>(
    `/api/payroll/records/${recordId}/adjustments`,
    { method: "POST", body: JSON.stringify(payload) },
    "admin"
  );

export const getMyPayslips = () =>
  apiRequest<PayrollEmployeeRow[]>("/api/payroll/my-payslips", {}, "user");

/** @deprecated Prefer getPayrollDashboard */
export const processMonthlyPayroll = (month: number, year: number) =>
  apiRequest("/api/payroll/process-monthly", {
    method: "POST",
    body: JSON.stringify({ month, year }),
  }, "admin");

/** @deprecated Prefer getPayrollDashboard */
export const getPayrollReport = (month: number, year: number) =>
  apiRequest(`/api/payroll/report?month=${month}&year=${year}`, {}, "admin");

export const getDashboardStats = () =>
  apiRequest("/api/dashboard/stats", {}, "admin");
