import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock,
  UserCheck,
  UserX,
  MapPin,
  Users,
  AlertTriangle,
  ScanFace,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdmin } from "@/contexts/AdminContext";
import { useAuth } from "@/contexts/AuthContext";
import { AttendanceRecord } from "@/hooks/useAttendance";
import {
  getAllCurrentMonthAttendance,
  updateAttendanceRecordByIdAndUserId,
} from "@/services/attendanceService";
import { isSameLocalDay } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/api";

const formatFaceAccuracy = (confidence?: number) =>
  confidence != null ? `${(confidence * 100).toFixed(1)}%` : "—";

const faceAccuracyClass = (confidence?: number) => {
  if (confidence == null) return "bg-muted text-muted-foreground";
  if (confidence >= 0.85) return "bg-green-100 text-green-800";
  if (confidence >= 0.75) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
};

const averageFaceConfidence = (records: AttendanceRecord[]) => {
  const faceRecords = records.filter(
    (r) => r.method === "face" && r.faceConfidence != null
  );
  if (faceRecords.length === 0) return null;
  const total = faceRecords.reduce((sum, r) => sum + (r.faceConfidence ?? 0), 0);
  return total / faceRecords.length;
};

const dayStatusClass = (status?: string) => {
  if (!status) return "bg-muted text-muted-foreground";
  if (status === "present") return "bg-green-100 text-green-800";
  if (status === "late") return "bg-amber-100 text-amber-800";
  if (status === "half_day") return "bg-orange-100 text-orange-800";
  if (status === "early_departure") return "bg-red-100 text-red-800";
  return "bg-muted text-muted-foreground";
};

const AdminDashboard = () => {
  const { admin, isAuthenticated, isLoading } = useAdmin();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<AttendanceRecord[]>(
    []
  );

  // Redirect if not authenticated as admin
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/admin/login");
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Load all attendance records
  useEffect(() => {
    const loadAllAttendanceRecords = async () => {
      try {
        const allRecords = await getAllCurrentMonthAttendance();
        //console.log("All Current Month Attendance Records:", allRecords);
        if (!allRecords) {
          console.error("No attendance records found.");
          return;
        }
        allRecords.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setAttendanceData(allRecords);

        // Filter for pending approvals
        const pending = allRecords.filter(
          (record) => record.status === "pending"
        );

        setPendingApprovals(pending);
      } catch (error) {
        console.error("Error loading attendance records:", error);
      }
    };

    loadAllAttendanceRecords();

    // Set up interval to refresh data every minute
    const interval = setInterval(loadAllAttendanceRecords, 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle approval of pending records
  const handleApproval = (
    userId: string,
    recordId: string,
    approved: boolean
  ) => {
    // Find the record and update its status

    const attendance = attendanceData.find((r) => r.id === recordId);

    if (!attendance) {
      console.error("Record not found:", recordId);
      return;
    }
    attendance.status = approved ? "approved" : "rejected";

    attendance.note = approved ? "Approved by Admin" : "Rejected by Admin";

    updateAttendanceRecordByIdAndUserId(recordId, userId, attendance).catch(
      (error) => {
        console.error("Error updating attendance record:", error);
        throw error;
      }
    );

    const updatedRecords: AttendanceRecord[] = attendanceData.map((r) => {
      if (r.id === recordId) {
        return {
          ...r,
          status: approved ? "approved" : "rejected",
        };
      }
      return r;
    });

    // Update state
    setAttendanceData(updatedRecords);

    // Update pendingApprovals
    setPendingApprovals(
      pendingApprovals.filter((record) => record.id !== recordId)
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-attendance-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const todayRecords = attendanceData.filter((record) =>
    isSameLocalDay(record.timestamp)
  );

  const totalUsers = new Set(attendanceData.map((record) => record.userId))
    .size;
  const totalCheckIns = attendanceData.filter(
    (record) => record.type === "check-in"
  ).length;
  const totalCheckOuts = attendanceData.filter(
    (record) => record.type === "check-out"
  ).length;
  const manualEntries = attendanceData.filter(
    (record) => record.method === "manual"
  ).length;
  const monthFaceAccuracy = averageFaceConfidence(attendanceData);
  const todayFaceAccuracy = averageFaceConfidence(todayRecords);
  const faceAttendanceCount = attendanceData.filter(
    (r) => r.method === "face"
  ).length;

  return (
    <div className="container mx-auto py-6 px-4">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-attendance-primary mr-2" />
                  <span className="text-2xl font-bold">{totalUsers}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Today's Check-ins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <UserCheck className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-2xl font-bold">
                    {todayRecords.filter((r) => r.type === "check-in").length}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Today's Check-outs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <UserX className="h-5 w-5 text-indigo-500 mr-2" />
                  <span className="text-2xl font-bold">
                    {todayRecords.filter((r) => r.type === "check-out").length}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
                  <span className="text-2xl font-bold">
                    {pendingApprovals.length}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Face Match Accuracy
                </CardTitle>
                <CardDescription className="text-xs">
                  Today / This month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <ScanFace className="h-5 w-5 text-attendance-primary mr-2" />
                  <div>
                    <span className="text-2xl font-bold">
                      {todayFaceAccuracy != null
                        ? formatFaceAccuracy(todayFaceAccuracy)
                        : "—"}
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      / {monthFaceAccuracy != null
                        ? formatFaceAccuracy(monthFaceAccuracy)
                        : "—"}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {faceAttendanceCount} face attendance record
                  {faceAttendanceCount === 1 ? "" : "s"} this month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Pending Approvals Section */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Pending Approvals</h2>

            {pendingApprovals.length === 0 ? (
              <div className="bg-white p-6 rounded-lg shadow text-center text-muted-foreground">
                No pending approvals at this time.
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        User Name
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Type
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Timestamp
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Method
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Notes
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingApprovals.map((record) => (
                      <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.userName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.type === "check-in" ? (
                            <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">
                              Check In
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-800">
                              Check Out
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(record.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {record.note || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() =>
                              handleApproval(record.userId, record.id, true)
                            }
                            className="text-green-600 hover:text-green-900 mr-4"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              handleApproval(record.userId, record.id, false)
                            }
                            className="text-red-600 hover:text-red-900"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Activity Section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Attendance</h2>

            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      User Email
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Type
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Timestamp
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Method
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Image
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Face Accuracy
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Day Status
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceData.slice(0, 10).map((record) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.userName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.type === "check-in" ? (
                          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">
                            Check In
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-800">
                            Check Out
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(record.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.method}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.imageUrl ? (
                          <img
                            src={resolveMediaUrl(record.imageUrl)}
                            alt="Attendance Image"
                            className="w-10 h-10 rounded-md object-cover"
                          />
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.method === "face" ? (
                          <Badge
                            variant="outline"
                            className={faceAccuracyClass(record.faceConfidence)}
                          >
                            {formatFaceAccuracy(record.faceConfidence)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.dayStatus ? (
                          <Badge variant="outline" className={dayStatusClass(record.dayStatus)}>
                            {record.dayStatus.replace("_", " ")}
                            {record.workHours != null && ` · ${record.workHours}h`}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.status === "approved" ? (
                          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">
                            Approved
                          </span>
                        ) : record.status === "rejected" ? (
                          <span className="px-2 py-1 rounded-full bg-red-100 text-red-800">
                            Rejected
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
    </div>
  );
};

export default AdminDashboard;
