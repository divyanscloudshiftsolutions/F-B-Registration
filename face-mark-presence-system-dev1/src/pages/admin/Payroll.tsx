import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  addPayrollAdjustment,
  approvePayrollRun,
  calculatePayrollRun,
  getPayrollDashboard,
  getPayrollRecord,
  markPayrollPaid,
  recalculatePayrollRecord,
  reopenPayrollRun,
  submitPayrollReview,
  updatePayrollSettings,
  type PayrollCycleStep,
  type PayrollDashboard,
  type PayrollEmployeeDetail,
  type PayrollEmployeeRow,
} from "@/services/payrollService";
import { resolveMediaUrl } from "@/lib/api";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const formatINR = (value?: number | null) => {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNum = (value?: number | null, digits = 1) => {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    ready: "bg-emerald-100 text-emerald-800",
    review: "bg-amber-100 text-amber-800",
    missing_salary: "bg-red-100 text-red-800",
    calculated: "bg-blue-100 text-blue-800",
    under_review: "bg-amber-100 text-amber-800",
    approved: "bg-indigo-100 text-indigo-800",
    paid: "bg-green-100 text-green-800",
  };
  return map[status] || "bg-gray-100 text-gray-700";
};

const CycleBar = ({ steps }: { steps: PayrollCycleStep[] }) => (
  <div className="flex flex-wrap items-center gap-2 md:gap-0">
    {steps.map((step, idx) => (
      <React.Fragment key={step.key}>
        <div className="flex items-center gap-2 min-w-[110px]">
          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold border",
              step.state === "done" && "bg-emerald-500 text-white border-emerald-500",
              step.state === "current" && "bg-attendance-primary text-white border-attendance-primary",
              step.state === "pending" && "bg-white text-muted-foreground border-muted"
            )}
          >
            {step.state === "done" ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
          </div>
          <div>
            <div className="text-xs font-medium leading-tight">{step.label}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {step.state}
            </div>
          </div>
        </div>
        {idx < steps.length - 1 && (
          <div className="hidden md:block h-px w-8 bg-border mx-2" />
        )}
      </React.Fragment>
    ))}
  </div>
);

const Payroll = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dash, setDash] = useState<PayrollDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<PayrollEmployeeDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [adjOpen, setAdjOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: format(now, "yyyy-MM-dd"),
    paymentMethod: "Bank Transfer",
    paymentReference: "",
  });
  const [adjForm, setAdjForm] = useState({
    component_type: "earning",
    component_code: "BONUS",
    label: "Bonus",
    amount: "",
    reason: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPayrollDashboard(month, year);
      setDash(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payroll");
      setDash(null);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    load();
  }, [load]);

  const run = dash?.run;
  const employees = dash?.employees ?? [];

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const q = search.trim().toLowerCase();
      const matchQ =
        !q ||
        e.userName?.toLowerCase().includes(q) ||
        e.employeeCode?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [employees, search, statusFilter]);

  const warnCount = dash?.precheck?.checks.filter((c) => c.level === "warn").length ?? 0;

  const withRun = async (fn: (runId: string) => Promise<unknown>, okMsg: string) => {
    if (!run?.id) return;
    setBusy(true);
    try {
      await fn(run.id);
      toast.success(okMsg);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const openEmployee = async (row: PayrollEmployeeRow) => {
    if (!row.id) {
      toast.message("Calculate payroll first to open employee detail");
      return;
    }
    try {
      const detail = await getPayrollRecord(row.id);
      setSelected(detail);
      setDrawerOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load detail");
    }
  };

  const handleRecalculateOne = async () => {
    if (!selected?.id) return;
    setBusy(true);
    try {
      const detail = await recalculatePayrollRecord(selected.id);
      setSelected(detail);
      toast.success("Recalculated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recalculate failed");
    } finally {
      setBusy(false);
    }
  };

  const handleAddAdjustment = async () => {
    if (!selected?.id || !adjForm.amount || !adjForm.reason.trim()) {
      toast.error("Amount and reason are required");
      return;
    }
    setBusy(true);
    try {
      const detail = await addPayrollAdjustment(selected.id, {
        ...adjForm,
        amount: Number(adjForm.amount),
      });
      setSelected(detail);
      setAdjOpen(false);
      toast.success("Adjustment added");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed");
    } finally {
      setBusy(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!run?.id) return;
    setBusy(true);
    try {
      await markPayrollPaid(run.id, paymentForm);
      toast.success("Payroll marked as paid");
      setPayOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark paid");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    if (!run?.id) return;
    const token = localStorage.getItem("adminToken");
    fetch(`/api/payroll/runs/${run.id}/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Export failed");
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll-${year}-${String(month).padStart(2, "0")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error("Export failed"));
  };

  const exportXlsx = () => {
    if (!run?.id) return;
    const token = localStorage.getItem("adminToken");
    fetch(`/api/payroll/runs/${run.id}/export.xlsx`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Excel export failed");
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `payroll-${year}-${String(month).padStart(2, "0")}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error("Excel export failed"));
  };

  const years = [year - 1, year, year + 1];

  return (
    <div className="container px-4 py-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payroll Management</h1>
          <p className="text-sm text-muted-foreground">
            Review → Calculate → Approve → Pay. Attendance feeds payroll; approved runs stay locked.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Month</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {run && (
            <div>
              <Label className="text-xs">Salary basis</Label>
              <Select
                value={run.salaryCalcBasis}
                onValueChange={async (v) => {
                  try {
                    await updatePayrollSettings(run.id, v);
                    toast.success("Salary basis updated");
                    load();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Update failed");
                  }
                }}
                disabled={run.status === "approved" || run.status === "paid"}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_30">Fixed 30 days</SelectItem>
                  <SelectItem value="calendar_days">Calendar days</SelectItem>
                  <SelectItem value="working_days">Working days</SelectItem>
                  <SelectItem value="attendance_hours">Attendance hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {loading && !dash ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-attendance-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Employees</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {dash?.kpis.employeeCount ?? 0}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Gross Payroll</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {formatINR(dash?.kpis.grossPayroll)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Deductions</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {formatINR(dash?.kpis.totalDeductions)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Net Payable</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold text-emerald-700">
                {formatINR(dash?.kpis.netPayable)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={cn("capitalize", statusBadge(dash?.kpis.status || "draft"))}>
                  {(dash?.kpis.status || "draft").replace(/_/g, " ")}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {MONTHS[month - 1]} {year} Payroll Cycle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CycleBar steps={dash?.cycle || []} />
            </CardContent>
          </Card>

          {dash?.precheck && (
            <Card className={cn(warnCount > 0 && "border-amber-300")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  {warnCount > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  Payroll Pre-check
                </CardTitle>
                <div className="flex gap-2">
                  {(run?.status === "draft" ||
                    run?.status === "calculated" ||
                    run?.status === "under_review") && (
                    <Button
                      className="attendance-gradient"
                      disabled={busy || !dash.precheck.canCalculate}
                      onClick={() =>
                        withRun(calculatePayrollRun, "Payroll calculated from attendance snapshot")
                      }
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Calculate Payroll"}
                    </Button>
                  )}
                  {run?.status === "calculated" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => withRun(submitPayrollReview, "Moved to HR review")}
                    >
                      Submit for Review
                    </Button>
                  )}
                  {(run?.status === "calculated" || run?.status === "under_review") && (
                    <Button
                      disabled={busy}
                      onClick={() => withRun(approvePayrollRun, "Payroll approved & locked")}
                    >
                      Approve Payroll
                    </Button>
                  )}
                  {run?.status === "approved" && (
                    <>
                      <Button disabled={busy} onClick={() => setPayOpen(true)}>
                        Mark as Paid
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => withRun(reopenPayrollRun, "Payroll reopened")}
                      >
                        Reopen
                      </Button>
                    </>
                  )}
                  {run?.id && (
                    <>
                      <Button variant="outline" onClick={exportCsv}>
                        <Download className="h-4 w-4 mr-1" /> CSV
                      </Button>
                      <Button variant="outline" onClick={exportXlsx}>
                        <Download className="h-4 w-4 mr-1" /> Excel
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {dash.precheck.checks.map((c, i) => (
                  <div key={i} className="text-sm flex items-start gap-2">
                    <span>{c.level === "ok" ? "✓" : "⚠"}</span>
                    <span className={c.level === "warn" ? "text-amber-800" : ""}>{c.message}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="gap-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <CardTitle className="text-base">Employee Payroll</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      className="pl-8 w-[220px]"
                      placeholder="Search employee..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="missing_salary">Missing salary</SelectItem>
                      <SelectItem value="under_review">Under review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                    <TableHead className="text-right">Present</TableHead>
                    <TableHead className="text-right">Leave</TableHead>
                    <TableHead className="text-right">LOP</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No employees found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((e) => (
                      <TableRow
                        key={e.userId}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => openEmployee(e)}
                      >
                        <TableCell>
                          <div className="font-medium">{e.userName}</div>
                          <div className="text-xs text-muted-foreground">
                            {e.employeeCode || e.department || e.userId.slice(0, 8)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatNum(e.calendarDays, 0)}</TableCell>
                        <TableCell className="text-right">{formatNum(e.presentDays)}</TableCell>
                        <TableCell className="text-right">{formatNum(e.paidLeaveDays)}</TableCell>
                        <TableCell className="text-right">{formatNum(e.lopDays)}</TableCell>
                        <TableCell className="text-right">
                          {e.overtimeHours != null ? `${formatNum(e.overtimeHours)}h` : "—"}
                        </TableCell>
                        <TableCell className="text-right">{formatINR(e.grossEarnings)}</TableCell>
                        <TableCell className="text-right">{formatINR(e.totalDeductions)}</TableCell>
                        <TableCell className="text-right font-medium">{formatINR(e.netPay)}</TableCell>
                        <TableCell>
                          <Badge className={cn("capitalize", statusBadge(e.status))}>
                            {e.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm border-t pt-3">
                <span>{filtered.length} employees shown</span>
                <div className="text-right space-y-0.5">
                  <div>Gross {formatINR(dash?.kpis.grossPayroll)}</div>
                  <div>Deductions {formatINR(dash?.kpis.totalDeductions)}</div>
                  <div className="font-semibold">Net {formatINR(dash?.kpis.netPayable)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Previous Payroll Runs</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Employees</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dash?.history || []).map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>
                        {MONTHS[h.month - 1]} {h.year}
                      </TableCell>
                      <TableCell className="text-right">{h.employeeCount}</TableCell>
                      <TableCell className="text-right">{formatINR(h.grossAmount)}</TableCell>
                      <TableCell className="text-right">{formatINR(h.totalDeductions)}</TableCell>
                      <TableCell className="text-right">{formatINR(h.netAmount)}</TableCell>
                      <TableCell>
                        <Badge className={cn("capitalize", statusBadge(h.status))}>
                          {h.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setMonth(h.month);
                            setYear(h.year);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.userName}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {selected.employmentType || "Employee"} · {selected.employeeCode || "—"}
                  {selected.department ? ` · ${selected.department}` : ""}
                </p>
              </SheetHeader>

              <div className="mt-6 space-y-6 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Monthly Salary</div>
                  <div className="text-xl font-semibold">{formatINR(selected.monthlySalary)}</div>
                </div>

                <section>
                  <h3 className="font-semibold mb-2">Attendance Summary</h3>
                  <dl className="grid grid-cols-2 gap-y-1 gap-x-4">
                    <dt className="text-muted-foreground">Working Days</dt>
                    <dd className="text-right">{formatNum(selected.workingDays)}</dd>
                    <dt className="text-muted-foreground">Present</dt>
                    <dd className="text-right">{formatNum(selected.presentDays)}</dd>
                    <dt className="text-muted-foreground">Paid Leave</dt>
                    <dd className="text-right">{formatNum(selected.paidLeaveDays)}</dd>
                    <dt className="text-muted-foreground">Week Off</dt>
                    <dd className="text-right">{formatNum(selected.weekOffDays)}</dd>
                    <dt className="text-muted-foreground">Holiday</dt>
                    <dd className="text-right">{formatNum(selected.holidayDays)}</dd>
                    <dt className="text-muted-foreground">LOP</dt>
                    <dd className="text-right">{formatNum(selected.lopDays)}</dd>
                    <dt className="text-muted-foreground">Expected Hours</dt>
                    <dd className="text-right">{formatNum(selected.expectedHours)}h</dd>
                    <dt className="text-muted-foreground">Worked Hours</dt>
                    <dd className="text-right">{formatNum(selected.workedHours)}h</dd>
                    <dt className="text-muted-foreground">Approved OT</dt>
                    <dd className="text-right">{formatNum(selected.overtimeHours)}h</dd>
                  </dl>
                </section>

                <section>
                  <h3 className="font-semibold mb-2">Earnings</h3>
                  <ul className="space-y-1">
                    {(selected.earnings || []).map((e) => (
                      <li key={e.code + e.label} className="flex justify-between">
                        <span>{e.label}</span>
                        <span>{formatINR(e.amount)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between font-semibold border-t pt-1">
                      <span>Gross Earnings</span>
                      <span>{formatINR(selected.grossEarnings)}</span>
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold mb-2">Deductions</h3>
                  <ul className="space-y-1">
                    {(selected.deductions || []).map((e) => (
                      <li key={e.code + e.label} className="flex justify-between">
                        <span>{e.label}</span>
                        <span>{formatINR(e.amount)}</span>
                      </li>
                    ))}
                    <li className="flex justify-between font-semibold border-t pt-1">
                      <span>Total Deductions</span>
                      <span>{formatINR(selected.totalDeductions)}</span>
                    </li>
                  </ul>
                </section>

                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4">
                  <div className="text-xs text-emerald-800 mb-1">Net Salary</div>
                  <div className="text-3xl font-bold text-emerald-900">
                    {formatINR(selected.netPay)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || run?.status === "paid"}
                    onClick={() => setAdjOpen(true)}
                  >
                    Edit Adjustment
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || run?.status === "approved" || run?.status === "paid"}
                    onClick={handleRecalculateOne}
                  >
                    Recalculate
                  </Button>
                  {selected.payslipUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={resolveMediaUrl(selected.payslipUrl)} target="_blank" rel="noreferrer">
                        Payslip PDF
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Payroll as Paid</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, paymentDate: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Input
                value={paymentForm.paymentMethod}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, paymentMethod: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Reference / Transaction ID</Label>
              <Input
                value={paymentForm.paymentReference}
                onChange={(e) =>
                  setPaymentForm((f) => ({ ...f, paymentReference: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} disabled={busy}>
              Mark as Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Adjustment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Type</Label>
              <Select
                value={adjForm.component_type}
                onValueChange={(v) => setAdjForm((f) => ({ ...f, component_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="earning">Earning</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Component</Label>
              <Select
                value={adjForm.component_code}
                onValueChange={(v) =>
                  setAdjForm((f) => ({
                    ...f,
                    component_code: v,
                    label: v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " "),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BONUS">Bonus</SelectItem>
                  <SelectItem value="INCENTIVE">Incentive</SelectItem>
                  <SelectItem value="REIMBURSEMENT">Reimbursement</SelectItem>
                  <SelectItem value="ARREAR">Arrear</SelectItem>
                  <SelectItem value="FINE">Fine</SelectItem>
                  <SelectItem value="LOAN_RECOVERY">Loan Recovery</SelectItem>
                  <SelectItem value="ADVANCE_RECOVERY">Advance Recovery</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={adjForm.amount}
                onChange={(e) => setAdjForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={adjForm.reason}
                onChange={(e) => setAdjForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddAdjustment} disabled={busy}>
              Add Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payroll;
