import React, { useEffect } from "react";
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
import AttendanceFilters from "@/components/AttendanceFilters";
import { format, parseISO, isSameMonth } from "date-fns";
import { AttendanceRecord } from "@/hooks/useAttendance";
import { getAttendance } from "@/services/attendanceService";
import { resolveMediaUrl } from "@/lib/api";
import ReactPaginate from "react-paginate";

const formatFaceAccuracy = (confidence?: number) =>
  confidence != null ? `${(confidence * 100).toFixed(1)}%` : "—";

const faceAccuracyClass = (confidence?: number) => {
  if (confidence == null) return "bg-muted text-muted-foreground";
  if (confidence >= 0.85) return "bg-green-100 text-green-800";
  if (confidence >= 0.75) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
};

const Attendance = () => {
  const [attendanceHistory, setAttendanceHistory] = React.useState<
    AttendanceRecord[]
  >([]);

  const [filters, setFilters] = React.useState({
    date: undefined as Date | undefined,
    month: new Date(),
    type: undefined as string | undefined,
    method: undefined as string | undefined,
    search: "",
  });

  const [currentPage, setCurrentPage] = React.useState(0);
  const recordsPerPage = 10;

  useEffect(() => {
    const fetchUsers = async () => {
      const attendance: AttendanceRecord[] = await getAttendance();
      if (attendance) {
        attendance.sort((a, b) => {
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        });

        setAttendanceHistory(attendance);
      } else {
        setAttendanceHistory([]);
      }
    };

    fetchUsers().catch((error) => {
      console.error("Error fetching users:", error);
    });
  }, []);

  const filteredRecords = React.useMemo(() => {
    return attendanceHistory.filter((record) => {
      const { date, month, type, method, search } = filters;

      // Filter by specific date
      if (
        date &&
        format(parseISO(record.timestamp), "yyyy-MM-dd") !==
          format(date, "yyyy-MM-dd")
      ) {
        return false;
      }

      // Filter by month
      if (month && !isSameMonth(parseISO(record.timestamp), month)) {
        return false;
      }

      // Filter by type
      if (type && type !== "all" && record.type !== type) {
        return false;
      }

      // Filter by method
      if (method && method !== "all" && record.method !== method) {
        return false;
      }

      // Filter by search text (user name)
      if (
        search &&
        !record.userName.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [attendanceHistory, filters]);

  const paginatedRecords = React.useMemo(() => {
    const startIndex = currentPage * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, currentPage]);

  const handlePageChange = (selectedItem: { selected: number }) => {
    setCurrentPage(selectedItem.selected);
  };

  return (
    <div className="container px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Attendance Records</h1>

        <AttendanceFilters onFilterChange={setFilters} />

        <Card>
          <CardHeader>
            <CardTitle>All Records</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead>Face Accuracy</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      No records found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.userName}</TableCell>
                      <TableCell>
                        {record?.timestamp
                          ? format(parseISO(record.timestamp), "PPp")
                          : "N/A"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {record.type === "check-in" ? (
                          <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">
                            Check In
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-800">
                            Check Out
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">
                        {record.method}
                      </TableCell>
                      <TableCell>
                        {record.imageUrl ? (
                          <a
                            href={resolveMediaUrl(record.imageUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={resolveMediaUrl(record.imageUrl)}
                              alt={`${record.userName} attendance`}
                              className="w-12 h-12 rounded-md object-cover border hover:opacity-90"
                            />
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.method === "face" ? (
                          <Badge
                            variant="outline"
                            className={faceAccuracyClass(record.faceConfidence)}
                          >
                            {formatFaceAccuracy(record.faceConfidence)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="capitalize">
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <ReactPaginate
              previousLabel={"Previous"}
              nextLabel={"Next"}
              breakLabel={"..."}
              pageCount={Math.ceil(filteredRecords.length / recordsPerPage)}
              marginPagesDisplayed={3}
              pageRangeDisplayed={5}
              onPageChange={handlePageChange}
              containerClassName={"pagination"}
              activeClassName={"active"}
              className="flex justify-center mt-6 items-center"
              previousLinkClassName="px-4 py-2 border rounded-l font-medium bg-green-200 hover:bg-green-300"
              nextLinkClassName="px-4 py-2 border rounded-r font-medium bg-purple-200 hover:bg-purple-300"
              pageLinkClassName="px-4 py-2 border bg-blue-200 hover:bg-blue-300"
              breakLinkClassName="px-4 py-2 border bg-blue-200 hover:bg-blue-300"
            />
          </CardContent>
        </Card>
    </div>
  );
};

export default Attendance;
