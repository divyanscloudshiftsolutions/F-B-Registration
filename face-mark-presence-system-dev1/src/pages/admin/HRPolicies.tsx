import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  assignWeekOffPolicy,
  createHoliday,
  createLeaveType,
  createWeekOffPolicy,
  deleteHoliday,
  getAdminLeaveTypes,
  getHolidays,
  getWeekOffPolicies,
  type Holiday,
  type WeekOffPolicy,
} from "@/services/hrService";
import { getUsers } from "@/services/userService";
import type { LeaveType } from "@/services/leaveService";
import type { Employee } from "@/services/employeeService";

const WEEKDAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

const HRPolicies = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [policies, setPolicies] = useState<WeekOffPolicy[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignForm, setAssignForm] = useState({ userId: "", policyId: "" });

  const [holidayForm, setHolidayForm] = useState({
    name: "",
    holidayDate: "",
    holidayType: "public",
    appliesTo: "all",
    isPaid: true,
    workCompensation: "comp_off",
  });

  const [policyForm, setPolicyForm] = useState({
    name: "",
    code: "",
    policyType: "fixed",
    weekOffDays: [5, 6] as number[],
    isPaid: true,
    workCompensation: "comp_off",
    isDefault: false,
  });

  const [leaveForm, setLeaveForm] = useState({
    name: "",
    code: "",
    maxDaysPerYear: 12,
    isPaid: true,
    allowHalfDay: true,
    requiresApproval: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const [h, p, lt, users] = await Promise.all([
        getHolidays(year),
        getWeekOffPolicies(),
        getAdminLeaveTypes(),
        getUsers(),
      ]);
      setHolidays(h);
      setPolicies(p);
      setLeaveTypes(lt);
      setEmployees(users.filter((u) => u.userRole !== "admin"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleWeekday = (day: number) => {
    setPolicyForm((prev) => ({
      ...prev,
      weekOffDays: prev.weekOffDays.includes(day)
        ? prev.weekOffDays.filter((d) => d !== day)
        : [...prev.weekOffDays, day].sort(),
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-attendance-primary" />
      </div>
    );
  }

  return (
    <div className="container px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">HR Policies</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Holidays, week-off rules and leave types that feed the Attendance Day Status Engine.
      </p>

      <Tabs defaultValue="holidays">
        <TabsList>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
          <TabsTrigger value="weekoff">Week-Off</TabsTrigger>
          <TabsTrigger value="leave">Leave Types</TabsTrigger>
        </TabsList>

        <TabsContent value="holidays" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add holiday</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={holidayForm.holidayDate}
                  onChange={(e) =>
                    setHolidayForm((f) => ({ ...f, holidayDate: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={holidayForm.holidayType}
                  onValueChange={(v) => setHolidayForm((f) => ({ ...f, holidayType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public Holiday</SelectItem>
                    <SelectItem value="company">Company Holiday</SelectItem>
                    <SelectItem value="optional">Optional Holiday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>If employee works</Label>
                <Select
                  value={holidayForm.workCompensation}
                  onValueChange={(v) =>
                    setHolidayForm((f) => ({ ...f, workCompensation: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal pay</SelectItem>
                    <SelectItem value="ot">OT</SelectItem>
                    <SelectItem value="1.5x">1.5x</SelectItem>
                    <SelectItem value="2x">2x</SelectItem>
                    <SelectItem value="comp_off">Comp-Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={holidayForm.isPaid}
                    onCheckedChange={(c) =>
                      setHolidayForm((f) => ({ ...f, isPaid: Boolean(c) }))
                    }
                  />
                  Paid holiday
                </label>
              </div>
              <div className="flex items-end">
                <Button
                  className="attendance-gradient"
                  onClick={async () => {
                    if (!holidayForm.name || !holidayForm.holidayDate) {
                      toast.error("Name and date required");
                      return;
                    }
                    try {
                      await createHoliday(holidayForm);
                      toast.success("Holiday added");
                      setHolidayForm({
                        name: "",
                        holidayDate: "",
                        holidayType: "public",
                        appliesTo: "all",
                        isPaid: true,
                        workCompensation: "comp_off",
                      });
                      load();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              {holidays.length === 0 ? (
                <p className="text-muted-foreground text-sm">No holidays configured</p>
              ) : (
                holidays.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between border rounded-md p-3"
                  >
                    <div>
                      <div className="font-medium">{h.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.holidayDate} · {h.holidayType} ·{" "}
                        {h.isPaid ? "Paid" : "Unpaid"} · work→{h.workCompensation}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await deleteHoliday(h.id);
                        toast.success("Holiday removed");
                        load();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekoff" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add week-off policy</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  value={policyForm.name}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Code</Label>
                <Input
                  value={policyForm.code}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-2 block">Week-off days</Label>
                <div className="flex flex-wrap gap-3">
                  {WEEKDAYS.map((d) => (
                    <label key={d.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={policyForm.weekOffDays.includes(d.value)}
                        onCheckedChange={() => toggleWeekday(d.value)}
                      />
                      {d.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={policyForm.isPaid}
                    onCheckedChange={(c) =>
                      setPolicyForm((f) => ({ ...f, isPaid: Boolean(c) }))
                    }
                  />
                  Paid week-off
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={policyForm.isDefault}
                    onCheckedChange={(c) =>
                      setPolicyForm((f) => ({ ...f, isDefault: Boolean(c) }))
                    }
                  />
                  Default policy
                </label>
              </div>
              <div>
                <Button
                  className="attendance-gradient"
                  onClick={async () => {
                    if (!policyForm.name || !policyForm.code) {
                      toast.error("Name and code required");
                      return;
                    }
                    try {
                      await createWeekOffPolicy(policyForm);
                      toast.success("Policy created");
                      setPolicyForm({
                        name: "",
                        code: "",
                        policyType: "fixed",
                        weekOffDays: [5, 6],
                        isPaid: true,
                        workCompensation: "comp_off",
                        isDefault: false,
                      });
                      load();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Create policy
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              {policies.map((p) => (
                <div key={p.id} className="border rounded-md p-3 flex justify-between items-center">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {p.name}
                      {p.isDefault && <Badge variant="outline">Default</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.code} · {p.policyType} · days [{(p.weekOffDays || []).join(", ")}] ·{" "}
                      {p.isPaid ? "Paid" : "Unpaid"}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assign week-off policy</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Employee</Label>
                <Select
                  value={assignForm.userId}
                  onValueChange={(v) => setAssignForm((f) => ({ ...f, userId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.userId} value={e.userId}>
                        {e.userName} ({e.employeeCode || "—"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Policy</Label>
                <Select
                  value={assignForm.policyId}
                  onValueChange={(v) => setAssignForm((f) => ({ ...f, policyId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {policies.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  className="attendance-gradient"
                  onClick={async () => {
                    if (!assignForm.userId || !assignForm.policyId) {
                      toast.error("Select employee and policy");
                      return;
                    }
                    try {
                      await assignWeekOffPolicy(assignForm.userId, assignForm.policyId);
                      toast.success("Week-off policy assigned");
                      setAssignForm({ userId: "", policyId: "" });
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Assign failed");
                    }
                  }}
                >
                  Assign
                </Button>
              </div>
              <p className="text-xs text-muted-foreground md:col-span-3">
                Fixed policies apply by weekday. Rotational offs come from a{" "}
                <strong>published</strong> weekly roster (mark OFF on Roster).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add leave type</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={leaveForm.name}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Code</Label>
                <Input
                  value={leaveForm.code}
                  onChange={(e) => setLeaveForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div>
                <Label>Annual days</Label>
                <Input
                  type="number"
                  value={leaveForm.maxDaysPerYear}
                  onChange={(e) =>
                    setLeaveForm((f) => ({
                      ...f,
                      maxDaysPerYear: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="flex items-center gap-4 md:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={leaveForm.isPaid}
                    onCheckedChange={(c) =>
                      setLeaveForm((f) => ({ ...f, isPaid: Boolean(c) }))
                    }
                  />
                  Paid
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={leaveForm.allowHalfDay}
                    onCheckedChange={(c) =>
                      setLeaveForm((f) => ({ ...f, allowHalfDay: Boolean(c) }))
                    }
                  />
                  Half day
                </label>
              </div>
              <div>
                <Button
                  className="attendance-gradient"
                  onClick={async () => {
                    if (!leaveForm.name || !leaveForm.code) {
                      toast.error("Name and code required");
                      return;
                    }
                    try {
                      await createLeaveType(leaveForm);
                      toast.success("Leave type created");
                      setLeaveForm({
                        name: "",
                        code: "",
                        maxDaysPerYear: 12,
                        isPaid: true,
                        allowHalfDay: true,
                        requiresApproval: true,
                      });
                      load();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed");
                    }
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add type
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-2">
              {leaveTypes.map((t) => (
                <div key={t.id} className="border rounded-md p-3">
                  <div className="font-medium">
                    {t.name} ({t.code})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t.maxDaysPerYear}/year · {t.isPaid ? "Paid" : "Unpaid"} ·{" "}
                    {t.allowHalfDay ? "Half-day OK" : "Full-day only"}
                    {t.isCompOff ? " · Comp-Off" : ""}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HRPolicies;
