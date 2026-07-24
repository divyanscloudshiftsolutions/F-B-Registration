import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { useAttendance } from "@/hooks/useAttendance";
import AttendanceHistory from "@/components/AttendanceHistory";
import AttendanceFilters from "@/components/AttendanceFilters";
import Header from "@/components/Header";

const History = () => {
  const { attendanceHistory, isLoading } = useAttendance();
  const [filters, setFilters] = useState({
    date: undefined as Date | undefined,
    month: new Date(), // Default to current month
    type: undefined as string | undefined,
    method: undefined as string | undefined,
    search: "",
  });

  const filteredRecords = useMemo(() => {
    return attendanceHistory.filter((record) => {
      if (
        filters.date &&
        format(new Date(record.timestamp), "yyyy-MM-dd") !==
          format(filters.date, "yyyy-MM-dd")
      ) {
        return false;
      }
      // Filter by month
      if (
        filters.month &&
        format(new Date(record.timestamp), "yyyy-MM") !==
          format(filters.month, "yyyy-MM")
      ) {
        return false;
      }
      if (
        filters.type &&
        filters.type !== "all" &&
        record.type !== filters.type
      ) {
        return false;
      }
      if (
        filters.method &&
        filters.method !== "all" &&
        record.method !== filters.method
      ) {
        return false;
      }
      if (
        filters.search &&
        !record.status.toLowerCase().includes(filters.search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [attendanceHistory, filters]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 container px-4 py-6 md:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">Attendance History</h1>
            <p className="text-muted-foreground">
              View and filter your past attendance records
            </p>
          </div>

          <AttendanceFilters onFilterChange={setFilters} />

          {isLoading ? (
            <div className="text-center py-10">
              <div className="animate-spin h-8 w-8 border-4 border-attendance-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p>Loading your attendance history...</p>
            </div>
          ) : (
            <AttendanceHistory records={filteredRecords} />
          )}
        </div>
      </main>
    </div>
  );
};

export default History;
