import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays,
  format,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Plus,
  Save,
  Send,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getDepartments } from "@/services/settingsService";
import type { Department } from "@/services/settingsService";
import {
  applyWeekShift,
  copyPreviousWeek,
  createShift,
  getShifts,
  getWeekRoster,
  publishRoster,
  saveAssignments,
  unpublishRoster,
  type AssignmentPayload,
  type ShiftTemplate,
  type WeeklyRoster,
} from "@/services/rosterService";

const OFF_VALUE = "__off__";
const CLEAR_VALUE = "__clear__";

function toMonday(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 });
}

function dayLabel(iso: string): string {
  return format(parseISO(iso), "EEE dd");
}

const Roster = () => {
  const [weekStart, setWeekStart] = useState(() =>
    format(toMonday(new Date()), "yyyy-MM-dd")
  );
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<ShiftTemplate[]>([]);
  const [roster, setRoster] = useState<WeeklyRoster | null>(null);
  const [pending, setPending] = useState<Record<string, AssignmentPayload>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [newShift, setNewShift] = useState({
    name: "",
    code: "",
    startTime: "09:00",
    endTime: "18:00",
    color: "#3b82f6",
  });

  const pendingCount = Object.keys(pending).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftList, depts, week] = await Promise.all([
        getShifts(true),
        getDepartments(true),
        getWeekRoster(
          weekStart,
          departmentId === "all" ? undefined : departmentId
        ),
      ]);
      setShifts(shiftList);
      setDepartments(depts);
      setRoster(week);
      setPending({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load roster");
    } finally {
      setLoading(false);
    }
  }, [weekStart, departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const cellKey = (userId: string, workDate: string) => `${userId}|${workDate}`;

  const getCellValue = (userId: string, day: WeeklyRoster["employees"][0]["days"][0]) => {
    const key = cellKey(userId, day.workDate);
    const p = pending[key];
    if (p) {
      if (p.isWeekOff) return OFF_VALUE;
      if (!p.shiftId) return CLEAR_VALUE;
      return p.shiftId;
    }
    if (day.isWeekOff) return OFF_VALUE;
    return day.shiftId || CLEAR_VALUE;
  };

  const getCellDisplay = (userId: string, day: WeeklyRoster["employees"][0]["days"][0]) => {
    const key = cellKey(userId, day.workDate);
    const p = pending[key];
    if (p) {
      if (p.isWeekOff) return { label: "OFF", color: "#94a3b8", sub: "Week off" };
      if (!p.shiftId) return { label: "—", color: "#e2e8f0", sub: "" };
      const shift = shifts.find((s) => s.id === p.shiftId);
      return {
        label: shift?.code || "Shift",
        color: shift?.color || "#3b82f6",
        sub: shift ? `${shift.startTime}–${shift.endTime}` : "",
      };
    }
    if (day.isWeekOff) return { label: "OFF", color: "#94a3b8", sub: "Week off" };
    if (!day.shiftId) return { label: "—", color: "#e2e8f0", sub: "" };
    return {
      label: day.shiftCode || "Shift",
      color: day.color || "#3b82f6",
      sub: day.startTime && day.endTime ? `${day.startTime}–${day.endTime}` : "",
    };
  };

  const setCell = (userId: string, workDate: string, value: string) => {
    const key = cellKey(userId, workDate);
    setPending((prev) => ({
      ...prev,
      [key]: {
        userId,
        workDate,
        shiftId: value === OFF_VALUE || value === CLEAR_VALUE ? null : value,
        isWeekOff: value === OFF_VALUE,
      },
    }));
  };

  const handleSave = async () => {
    if (!roster || pendingCount === 0) return;
    setSaving(true);
    try {
      const updated = await saveAssignments(roster.id, Object.values(pending));
      setRoster(updated);
      setPending({});
      toast.success("Roster saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!roster) return;
    if (pendingCount > 0) {
      toast.error("Save pending changes before publishing");
      return;
    }
    setSaving(true);
    try {
      const updated =
        roster.status === "published"
          ? await unpublishRoster(roster.id)
          : await publishRoster(roster.id);
      setRoster(updated);
      toast.success(
        updated.status === "published" ? "Roster published" : "Roster set to draft"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    setSaving(true);
    try {
      const updated = await copyPreviousWeek(weekStart);
      setRoster(updated);
      setPending({});
      toast.success("Copied from previous week");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy failed");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyWeek = async (userId: string, value: string) => {
    if (!roster) return;
    setSaving(true);
    try {
      const updated = await applyWeekShift(roster.id, {
        userId,
        shiftId: value === OFF_VALUE || value === CLEAR_VALUE ? null : value,
        isWeekOff: value === OFF_VALUE,
      });
      setRoster(updated);
      setPending((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (k.startsWith(`${userId}|`)) delete next[k];
        });
        return next;
      });
      toast.success("Applied to full week");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateShift = async () => {
    if (!newShift.name.trim() || !newShift.code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    try {
      await createShift({
        name: newShift.name.trim(),
        code: newShift.code.trim().toUpperCase(),
        startTime: newShift.startTime,
        endTime: newShift.endTime,
        color: newShift.color,
      });
      toast.success("Shift created");
      setShiftDialogOpen(false);
      setNewShift({
        name: "",
        code: "",
        startTime: "09:00",
        endTime: "18:00",
        color: "#3b82f6",
      });
      const list = await getShifts(true);
      setShifts(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create shift");
    }
  };

  const weekLabel = useMemo(() => {
    if (!roster) return "";
    return `${format(parseISO(roster.weekStart), "dd MMM")} – ${format(
      parseISO(roster.weekEnd),
      "dd MMM yyyy"
    )}`;
  }, [roster]);

  return (
    <div className="container px-4 py-8">
      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Weekly Shift Roster</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign shifts for all employees for each week (Mon–Sun)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShiftDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Shift
          </Button>
          <Button variant="outline" onClick={handleCopy} disabled={saving}>
            <Copy className="h-4 w-4 mr-1" /> Copy previous
          </Button>
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={saving || pendingCount === 0}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1" />
            )}
            Save{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
          <Button
            className="attendance-gradient"
            onClick={handlePublish}
            disabled={saving || !roster}
          >
            {roster?.status === "published" ? (
              <>
                <Undo2 className="h-4 w-4 mr-1" /> Unpublish
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" /> Publish
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setWeekStart(
                  format(subWeeks(parseISO(weekStart), 1), "yyyy-MM-dd")
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[200px] text-center">
              <div className="font-semibold">{weekLabel || "…"}</div>
              <div className="text-xs text-muted-foreground">
                Week of {weekStart}
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setWeekStart(
                  format(addDays(parseISO(weekStart), 7), "yyyy-MM-dd")
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setWeekStart(format(toMonday(new Date()), "yyyy-MM-dd"))
              }
            >
              This week
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {roster && (
              <Badge
                variant="outline"
                className={
                  roster.status === "published"
                    ? "bg-green-100 text-green-800"
                    : "bg-amber-100 text-amber-800"
                }
              >
                {roster.status}
              </Badge>
            )}
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Employees ({roster?.employees.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-attendance-primary" />
            </div>
          ) : !roster || roster.employees.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No active employees found for this filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="sticky left-0 z-10 bg-muted/50 text-left p-3 border-b min-w-[200px]">
                      Employee
                    </th>
                    <th className="text-left p-3 border-b min-w-[140px]">
                      Apply week
                    </th>
                    {roster.dates.map((d) => (
                      <th
                        key={d}
                        className="text-center p-3 border-b min-w-[130px] font-medium"
                      >
                        {dayLabel(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roster.employees.map((emp) => (
                    <tr key={emp.userId} className="border-b hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-white p-3">
                        <div className="font-medium">{emp.userName}</div>
                        <div className="text-xs text-muted-foreground">
                          {emp.employeeCode || "—"}
                          {emp.departmentName ? ` · ${emp.departmentName}` : ""}
                        </div>
                      </td>
                      <td className="p-2">
                        <Select
                          onValueChange={(v) => handleApplyWeek(emp.userId, v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Set week…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={CLEAR_VALUE}>Clear</SelectItem>
                            <SelectItem value={OFF_VALUE}>Week off</SelectItem>
                            {shifts.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} ({s.startTime}–{s.endTime})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      {emp.days.map((day) => {
                        const display = getCellDisplay(emp.userId, day);
                        const value = getCellValue(emp.userId, day);
                        return (
                          <td key={day.workDate} className="p-2 align-top">
                            <div
                              className="rounded-md border p-1.5 mb-1 text-center text-white text-xs font-semibold"
                              style={{
                                backgroundColor:
                                  display.label === "—"
                                    ? "#f1f5f9"
                                    : display.color,
                                color: display.label === "—" ? "#64748b" : "#fff",
                              }}
                            >
                              <div>{display.label}</div>
                              {display.sub && (
                                <div className="font-normal opacity-90 text-[10px]">
                                  {display.sub}
                                </div>
                              )}
                            </div>
                            <Select
                              value={value}
                              onValueChange={(v) =>
                                setCell(emp.userId, day.workDate, v)
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={CLEAR_VALUE}>—</SelectItem>
                                <SelectItem value={OFF_VALUE}>OFF</SelectItem>
                                {shifts.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.code}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add shift template</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Name</Label>
              <Input
                value={newShift.name}
                onChange={(e) =>
                  setNewShift((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="Morning"
              />
            </div>
            <div>
              <Label>Code</Label>
              <Input
                value={newShift.code}
                onChange={(e) =>
                  setNewShift((s) => ({ ...s, code: e.target.value }))
                }
                placeholder="MORNING"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input
                  type="time"
                  value={newShift.startTime}
                  onChange={(e) =>
                    setNewShift((s) => ({ ...s, startTime: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>End</Label>
                <Input
                  type="time"
                  value={newShift.endTime}
                  onChange={(e) =>
                    setNewShift((s) => ({ ...s, endTime: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Color</Label>
              <Input
                type="color"
                value={newShift.color}
                onChange={(e) =>
                  setNewShift((s) => ({ ...s, color: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateShift} className="attendance-gradient">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Roster;
