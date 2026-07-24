import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { compressAndUploadFile } from "@/services/fileUploadService";
import {
  createAttendance,
  getAllAttendanceByEmail,
} from "@/services/attendanceService";
import { isSameLocalDay, isSameLocalMonth } from "@/lib/utils";

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  timestamp: string;
  type: "check-in" | "check-out" | "week-off";
  method: "face" | "manual" | "geolocation";
  status: "pending" | "approved" | "rejected";
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  note?: string;
  imageUrl?: string;
  faceConfidence?: number;
  workHours?: number;
  dayStatus?: string;
}

interface UseAttendanceReturn {
  attendanceRecords: AttendanceRecord[];
  attendanceHistory: AttendanceRecord[];
  isLoading: boolean;
  markAttendance: (
    type: "check-in" | "check-out" | "week-off",
    method: "face" | "manual" | "geolocation",
    location?: { latitude: number; longitude: number; accuracy: number },
    note?: string,
    imageUrl?: File
  ) => Promise<void>;
  todayRecords: {
    checkIn?: AttendanceRecord;
    checkOut?: AttendanceRecord;
  };
}

export const useAttendance = (): UseAttendanceReturn => {
  const { user } = useAuth();
  const [attendanceRecords, setAttendanceRecords] = useState<
    AttendanceRecord[]
  >([]);
  const [attendanceHistory, setAttendanceHistory] = useState<
    AttendanceRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Load attendance records from localStorage
    const loadAttendanceRecords = () => {
      if (!user) {
        setAttendanceRecords([]);
        setIsLoading(false);
        return;
      }

      try {
        //const storedRecords = JSON.parse(localStorage.getItem(`attendance_${user.userId}`));
        getAllAttendanceByEmail(user.email)
          .then((records) => {
            if (!records) {
              setAttendanceRecords([]);
              return;
            } else {
              setAttendanceHistory(records);
              const currentRecords = records.filter((record) =>
                isSameLocalMonth(record.timestamp)
              );
              setAttendanceRecords(currentRecords);
              setIsLoading(false);
            }
          })
          .catch((error) => {
            console.error("Error fetching attendance records:", error);
            toast.error("Failed to load attendance records");
          });
      } catch (error) {
        console.error("Error loading attendance records:", error);
        toast.error("Failed to load attendance records");
      } finally {
        setIsLoading(false);
      }
    };

    loadAttendanceRecords();
  }, [user]);

  const saveAttendanceRecords = (records: AttendanceRecord[]) => {
    if (!user) return;
    // localStorage.setItem(`attendance_${user.userId}`, JSON.stringify(records));
    setAttendanceRecords(records);
  };

  const markAttendance = async (
    type: "check-in" | "check-out",
    method: "face" | "manual" | "geolocation",
    location?: { latitude: number; longitude: number; accuracy: number },
    note?: string,
    imageUrl?: File
  ) => {
    if (!user) {
      toast.error("You must be logged in to mark attendance");
      return;
    }

    setIsLoading(true);

    try {
      let url: string = "";
      if (imageUrl || imageUrl instanceof File) {
        url = await compressAndUploadFile(imageUrl, `attendance-photos`);
        if (!url) {
          throw new Error("Image upload failed");
        }
      }
      const created = await createAttendance({
        userId: user.userId,
        userName: user.userName,
        timestamp: new Date().toISOString(),
        type,
        method,
        status: method === "manual" ? "pending" : "approved",
        location,
        note,
        imageUrl: url || undefined,
        userEmail: user.email,
      });

      const updatedRecords = [...attendanceRecords, created];
      saveAttendanceRecords(updatedRecords);
      setAttendanceHistory((prev) => [created, ...prev]);

      // Show success message
      toast.success(
        `${
          type === "check-in" ? "Check-in" : "Check-out"
        } recorded successfully`
      );
    } catch (error) {
      console.error("Error marking attendance:", error);
      toast.error("Failed to record attendance");
    } finally {
      setIsLoading(false);
    }
  };

  const todayRecords = useMemo(() => {
    return attendanceRecords.reduce(
      (acc, record) => {
        if (!isSameLocalDay(record.timestamp)) {
          return acc;
        }
        if (record.type === "check-in") {
          acc.checkIn = record;
        } else if (record.type === "check-out") {
          acc.checkOut = record;
        }
        return acc;
      },
      {} as { checkIn?: AttendanceRecord; checkOut?: AttendanceRecord }
    );
  }, [attendanceRecords]);

  return {
    attendanceRecords,
    attendanceHistory,
    isLoading,
    markAttendance,
    todayRecords,
  };
};
