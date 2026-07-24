import React, { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/api";

interface OtRow {
  id: string;
  userId: string;
  userName?: string;
  employeeCode?: string;
  workDate: string;
  calculatedMinutes: number;
  approvedMinutes: number;
  calculatedHours: number;
  approvedHours: number;
  status: string;
  notes?: string | null;
}

const OvertimeApprovals = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<OtRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<OtRow[]>(
        `/api/overtime?month=${month}&year=${year}`,
        {},
        "admin"
      );
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load OT");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [month, year]);

  const sync = async () => {
    try {
      const result = await apiRequest<{ created: number; updated: number }>(
        `/api/overtime/sync?month=${month}&year=${year}`,
        { method: "POST" },
        "admin"
      );
      toast.success(`Synced OT (${result.created} new, ${result.updated} updated)`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    }
  };

  const review = async (id: string, approved: boolean, calculatedMinutes: number) => {
    setBusyId(id);
    try {
      await apiRequest(`/api/overtime/${id}/review`, {
        method: "PUT",
        body: JSON.stringify({
          approved,
          approvedMinutes: approved ? calculatedMinutes : 0,
        }),
      }, "admin");
      toast.success(approved ? "OT approved" : "OT rejected");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container px-4 py-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Overtime Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Only approved OT minutes are paid in payroll.
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <div>
            <label className="text-xs">Month</label>
            <Input
              type="number"
              min={1}
              max={12}
              className="w-20"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs">Year</label>
            <Input
              type="number"
              className="w-24"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <Button variant="outline" onClick={sync}>
            <RefreshCw className="h-4 w-4 mr-1" /> Sync from Day Status
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">OT queue</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Calculated</TableHead>
                  <TableHead className="text-right">Approved</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No OT rows. Click Sync to pull from day status.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.userName}</div>
                        <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
                      </TableCell>
                      <TableCell>{format(parseISO(r.workDate), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right">{r.calculatedHours}h</TableCell>
                      <TableCell className="text-right">{r.approvedHours}h</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              disabled={busyId === r.id}
                              onClick={() => review(r.id, true, r.calculatedMinutes)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === r.id}
                              onClick={() => review(r.id, false, 0)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OvertimeApprovals;
