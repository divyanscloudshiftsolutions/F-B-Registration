import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  dayStatusClass,
  filterTimesheetRows,
  hoursStatusClass,
  normalizeTimesheetRows,
  type TimesheetRow,
} from "@/lib/timesheetUtils";
import { getTimesheetFromDayStatus } from "@/services/hrService";
import AttendanceFilters from "@/components/AttendanceFilters";
import ReactPaginate from "react-paginate";
import { Loader2 } from "lucide-react";

const Timesheet = () => {
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    date: undefined as Date | undefined,
    month: new Date(),
    type: undefined as string | undefined,
    method: undefined as string | undefined,
    search: "",
  });
  const [currentPage, setCurrentPage] = useState(0);
  const recordsPerPage = 15;

  const load = () => {
    const m = filters.month.getMonth() + 1;
    const y = filters.month.getFullYear();
    setLoading(true);
    getTimesheetFromDayStatus(m, y)
      .then((data) => setRows(normalizeTimesheetRows(data.rows || [])))
      .catch((err) => {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Failed to load timesheet");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filters.month]);

  const filtered = useMemo(
    () =>
      filterTimesheetRows(rows, {
        month: filters.month,
        date: filters.date,
        search: filters.search,
        status: filters.type,
      }),
    [rows, filters.month, filters.date, filters.search, filters.type]
  );

  const paginated = useMemo(() => {
    const start = currentPage * recordsPerPage;
    return filtered.slice(start, start + recordsPerPage);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [filters]);

  const formatTime = (iso?: string) =>
    iso ? format(parseISO(iso), "hh:mm a") : "—";

  return (
    <div className="container px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Employee Timesheet</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sourced from Attendance Day Status Engine (same truth as Payroll)
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-blue-100 border border-blue-300" />
            Overtime
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" />
            Under / Incomplete
          </span>
        </div>
      </div>

      <AttendanceFilters filters={filters} setFilters={setFilters} />

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            {format(filters.month, "MMMM yyyy")} · {filtered.length} day rows
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-attendance-primary" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead className="text-right">Worked</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">Payable</TableHead>
                    <TableHead className="text-right">LOP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No day-status rows for this month
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.userName}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.employeeCode || "—"}
                          </div>
                        </TableCell>
                        <TableCell>{format(parseISO(row.date), "dd MMM yyyy")}</TableCell>
                        <TableCell>
                          <Badge className={dayStatusClass(row.dayStatus)} variant="outline">
                            {(row.dayStatus || "—").replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatTime(row.checkIn)}</TableCell>
                        <TableCell>{formatTime(row.checkOut)}</TableCell>
                        <TableCell className={`text-right ${hoursStatusClass(row.hoursStatus)}`}>
                          {row.workHours != null ? `${row.workHours}h` : "—"}
                        </TableCell>
                        <TableCell className="text-right">{row.expectedHours}h</TableCell>
                        <TableCell className="text-right">
                          {row.overtimeHours ? `${row.overtimeHours}h` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.payableDayFraction ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">{row.lopDayFraction ?? "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {filtered.length > recordsPerPage && (
                <ReactPaginate
                  pageCount={Math.ceil(filtered.length / recordsPerPage)}
                  onPageChange={({ selected }) => setCurrentPage(selected)}
                  forcePage={currentPage}
                  containerClassName="flex gap-2 justify-center mt-4"
                  pageClassName="px-2"
                  activeClassName="font-bold text-attendance-primary"
                  previousLabel="‹"
                  nextLabel="›"
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Timesheet;
