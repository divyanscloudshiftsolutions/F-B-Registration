import React, { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
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
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { compressAndUploadFile } from "@/services/fileUploadService";
import {
  applyLeave,
  getLeaveBalances,
  getLeaveRequests,
  getLeaveTypes,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveType,
} from "@/services/leaveService";

const LeavePage = () => {
  const { user } = useAuth();
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    duration: "full_day",
    reason: "",
    attachmentUrl: "",
  });

  const selectedType = types.find((t) => t.id === form.leaveTypeId);
  const estimatedDays = (() => {
    if (!form.startDate || !form.endDate) return 0;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const diff = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    if (diff < 1) return 0;
    if (form.duration !== "full_day") return 0.5;
    return diff;
  })();
  const needsDocument =
    !!selectedType?.documentAfterDays && estimatedDays >= selectedType.documentAfterDays;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [t, b, r] = await Promise.all([
        getLeaveTypes(),
        getLeaveBalances(user.userId),
        getLeaveRequests(undefined, "user"),
      ]);
      setTypes(t);
      setBalances(b);
      setRequests(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load leave data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.userId]);

  const submit = async () => {
    if (!form.leaveTypeId || !form.startDate || !form.endDate || !form.reason.trim()) {
      toast.error("Fill all required fields");
      return;
    }
    if (needsDocument && !form.attachmentUrl) {
      toast.error(
        `Attachment required for leaves of ${selectedType?.documentAfterDays}+ days`
      );
      return;
    }
    setSubmitting(true);
    try {
      const result = await applyLeave({
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.endDate,
        duration: form.duration,
        reason: form.reason.trim(),
        attachmentUrl: form.attachmentUrl || undefined,
      });
      toast.success(`Leave requested (${result.totalDays} day(s))`);
      if (result.attendanceConflicts?.length) {
        toast.warning(
          `Note: attendance exists on ${result.attendanceConflicts.join(", ")}`
        );
      }
      setOpen(false);
      setForm({
        leaveTypeId: "",
        startDate: "",
        endDate: "",
        duration: "full_day",
        reason: "",
        attachmentUrl: "",
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="container px-4 py-8 flex-1 max-w-4xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Leave</h1>
            <p className="text-sm text-muted-foreground">
              Balances and requests. Only approved leave affects attendance & payroll.
            </p>
          </div>
          <Button className="attendance-gradient" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Request Leave
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-attendance-primary" />
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              {balances.map((b) => (
                <Card key={b.leaveTypeId}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      {b.leaveTypeName || b.leaveTypeCode}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {b.availableDays ?? b.balanceDays ?? b.totalDays - b.usedDays}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / {b.totalDays}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Used {b.usedDays}
                      {b.pendingDays ? ` · Pending ${b.pendingDays}` : ""}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">My requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No leave requests yet</p>
                ) : (
                  requests.map((r) => (
                    <div
                      key={r.id}
                      className="border rounded-md p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {r.leaveTypeName || r.leaveTypeCode} · {r.totalDays} day(s)
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(r.startDate), "dd MMM yyyy")}
                          {r.startDate !== r.endDate &&
                            ` → ${format(parseISO(r.endDate), "dd MMM yyyy")}`}
                        </div>
                        <div className="text-xs mt-1">{r.reason}</div>
                      </div>
                      <Badge variant="outline">{r.status}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Leave</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Leave type</Label>
              <Select
                value={form.leaveTypeId}
                onValueChange={(v) => setForm((f) => ({ ...f, leaveTypeId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      startDate: e.target.value,
                      endDate: f.endDate || e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label>To</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Duration</Label>
              <Select
                value={form.duration}
                onValueChange={(v) => setForm((f) => ({ ...f, duration: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_day">Full day</SelectItem>
                  <SelectItem value="first_half">First half</SelectItem>
                  <SelectItem value="second_half">Second half</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div>
              <Label>
                Attachment{needsDocument ? " (required)" : " (optional)"}
              </Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const url = await compressAndUploadFile(file, "leave-attachments", "user");
                    setForm((f) => ({ ...f, attachmentUrl: url }));
                    toast.success("Attachment uploaded");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Upload failed");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
              {needsDocument && (
                <p className="text-xs text-amber-700 mt-1">
                  Document required for {selectedType?.documentAfterDays}+ day leave requests.
                </p>
              )}
              {form.attachmentUrl && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Attached: {form.attachmentUrl}
                </p>
              )}
              {uploading && (
                <p className="text-xs text-muted-foreground mt-1">Uploading…</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="attendance-gradient"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeavePage;
