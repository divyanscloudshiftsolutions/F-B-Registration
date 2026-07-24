import React, { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  approveLeave,
  carryForwardLeave,
  getLeaveRequests,
  type LeaveRequest,
} from "@/services/leaveService";
import { regenerateDayStatus } from "@/services/hrService";

const statusClass = (status: string) => {
  if (status === "approved") return "bg-green-100 text-green-800";
  if (status === "rejected") return "bg-red-100 text-red-800";
  if (status === "cancelled") return "bg-gray-100 text-gray-700";
  return "bg-amber-100 text-amber-800";
};

const Leaves = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLeaveRequests(
        filter === "pending" ? "pending" : undefined,
        "admin"
      );
      setRequests(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leaves");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (id: string, approved: boolean) => {
    setActingId(id);
    try {
      await approveLeave(id, approved, approved ? undefined : "Rejected by admin");
      toast.success(approved ? "Leave approved" : "Leave rejected");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActingId(null);
    }
  };

  const handleRebuildMonth = async () => {
    const now = new Date();
    try {
      const result = await regenerateDayStatus(now.getMonth() + 1, now.getFullYear());
      toast.success(
        `Day status rebuilt (${(result as { processedDays?: number }).processedDays ?? "ok"} days)`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rebuild failed");
    }
  };

  const handleCarryForward = async () => {
    const fromYear = new Date().getFullYear() - 1;
    try {
      const result = await carryForwardLeave(fromYear);
      toast.success(
        `Carried forward ${result.balancesUpdated ?? 0} balance(s) from ${fromYear}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Carry-forward failed");
    }
  };

  return (
    <div className="container px-4 py-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Leave Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Approve or reject employee leave. Approved leave feeds the Attendance Day Status Engine.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "pending" ? "default" : "outline"}
            onClick={() => setFilter("pending")}
          >
            Pending
          </Button>
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button variant="outline" onClick={handleCarryForward}>
            Carry-forward balances
          </Button>
          <Button variant="outline" onClick={handleRebuildMonth}>
            <RefreshCw className="h-4 w-4 mr-1" /> Rebuild day status
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filter === "pending" ? "Pending requests" : "All requests"} ({requests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-attendance-primary" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No leave requests</div>
          ) : (
            <div className="space-y-4">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="border rounded-lg p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-semibold">{r.userName || r.userId}</div>
                    <div className="text-sm mt-1">
                      {r.leaveTypeName || r.leaveTypeCode} ·{" "}
                      {format(parseISO(r.startDate), "dd MMM yyyy")}
                      {r.startDate !== r.endDate &&
                        ` → ${format(parseISO(r.endDate), "dd MMM yyyy")}`}{" "}
                      · {r.totalDays} day{r.totalDays === 1 ? "" : "s"}
                      {r.duration && r.duration !== "full_day" ? ` · ${r.duration.replace("_", " ")}` : ""}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{r.reason}</div>
                    {r.attendanceConflicts && r.attendanceConflicts.length > 0 && (
                      <div className="text-xs text-amber-700 mt-2">
                        ⚠ Attendance already exists on: {r.attendanceConflicts.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={statusClass(r.status)}>
                      {r.status}
                    </Badge>
                    {r.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actingId === r.id}
                          onClick={() => handleAction(r.id, false)}
                        >
                          <X className="h-4 w-4 mr-1" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          className="attendance-gradient"
                          disabled={actingId === r.id}
                          onClick={() => handleAction(r.id, true)}
                        >
                          {actingId === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-1" /> Approve
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Leaves;
