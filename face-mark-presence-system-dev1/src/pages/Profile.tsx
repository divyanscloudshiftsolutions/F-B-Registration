import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import { resolveMediaUrl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mail, User, Building, Calendar } from "lucide-react";
import { format } from "date-fns";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { applyLeave, getLeaveBalances, getLeaveTypes, LeaveType } from "@/services/leaveService";
import {
  getMonthlyDayStatus,
  MonthlyDayStatusSummary,
} from "@/services/hrService";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MonthRow = {
  key: string;
  label: string;
  workingHours: number;
  expectedHours: number;
  weekOffs: number;
  overtimeHours: number;
};

const roundHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

const Profile = () => {
  const { user } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [monthRows, setMonthRows] = useState<MonthRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [weekOffReason, setWeekOffReason] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [weekOffDate, setWeekOffDate] = useState<Date>();

  useEffect(() => {
    if (user?.userId) {
      getLeaveTypes().then(setLeaveTypes).catch(console.error);
      getLeaveBalances(user.userId).catch(console.error);
    }
  }, [user?.userId]);

  useEffect(() => {
    if (!user?.userId) return;
    const now = new Date();
    const targets: { month: number; year: number }[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      targets.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }

    setLoadingSummary(true);
    Promise.all(
      targets.map(({ month, year }) =>
        getMonthlyDayStatus(month, year).then((summary: MonthlyDayStatusSummary) => {
          const label = format(new Date(year, month - 1, 1), "MMMM yyyy");
          return {
            key: `${year}-${month}`,
            label,
            workingHours: roundHours(summary.workedMinutes || 0),
            expectedHours: roundHours(summary.expectedMinutes || 0),
            weekOffs: summary.weekOffs || 0,
            overtimeHours: roundHours(summary.overtimeMinutes || 0),
          } satisfies MonthRow;
        })
      )
    )
      .then(setMonthRows)
      .catch((err) => {
        console.error(err);
        toast.error("Could not load monthly attendance summary");
      })
      .finally(() => setLoadingSummary(false));
  }, [user?.userId]);

  const handleWeekOffRequest = async () => {
    if (!weekOffDate || !weekOffReason.trim() || !leaveTypeId) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      await applyLeave({
        leaveTypeId,
        startDate: format(weekOffDate, "yyyy-MM-dd"),
        endDate: format(weekOffDate, "yyyy-MM-dd"),
        reason: weekOffReason,
      });
      toast.success("Leave request submitted successfully");
      setWeekOffDate(undefined);
      setWeekOffReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Leave request failed");
    }
  };

  if (!user) {
    return null;
  }

  const current = monthRows[0];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 container px-4 py-6 md:py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Profile</h1>

          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start space-x-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={resolveMediaUrl(user.userImage)} alt={user.userName} />
                    <AvatarFallback className="text-lg">
                      {user.userName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="space-y-4 flex-1">
                    <div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>Name</span>
                      </div>
                      <p className="text-lg font-medium">{user.userName}</p>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span>Email</span>
                      </div>
                      <p className="text-lg">{user.email}</p>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Building className="h-4 w-4" />
                        <span>Employee ID</span>
                      </div>
                      <p className="text-lg">{user.userName}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>This month (from attendance day status)</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSummary || !current ? (
                  <p className="text-sm text-muted-foreground">Loading summary…</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Worked hours</p>
                      <p className="text-lg font-medium">{current.workingHours}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expected hours</p>
                      <p className="text-lg font-medium">{current.expectedHours}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Week offs</p>
                      <p className="text-lg font-medium">{current.weekOffs}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Overtime hours</p>
                      <p className="text-lg font-medium">{current.overtimeHours}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Worked Hours</TableHead>
                      <TableHead>Expected</TableHead>
                      <TableHead>Week Offs</TableHead>
                      <TableHead>Overtime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell>{row.workingHours}</TableCell>
                        <TableCell>{row.expectedHours}</TableCell>
                        <TableCell>{row.weekOffs}</TableCell>
                        <TableCell>{row.overtimeHours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request Leave</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground">Leave Type</label>
                    <select
                      className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={leaveTypeId}
                      onChange={(e) => setLeaveTypeId(e.target.value)}
                    >
                      <option value="">Select leave type</option>
                      {leaveTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start mt-1.5">
                          <Calendar className="mr-2 h-4 w-4" />
                          {weekOffDate ? format(weekOffDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={weekOffDate}
                          onSelect={setWeekOffDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Reason</label>
                    <textarea
                      className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                      value={weekOffReason}
                      onChange={(e) => setWeekOffReason(e.target.value)}
                      placeholder="Reason for leave…"
                    />
                  </div>
                  <Button onClick={handleWeekOffRequest} className="attendance-gradient">
                    Submit request
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
