import { apiRequest } from "@/lib/api";
import { AttendanceRecord } from "@/hooks/useAttendance";

export interface QuickAttendanceResult {
  action: "check-in" | "check-out";
  userId: string;
  userName: string;
  userEmail: string;
  confidence: number;
  matchType: string;
  timestamp: string;
  message: string;
  record: AttendanceRecord;
}

export const quickMarkAttendance = async (
  file: File,
  employeeCode?: string
): Promise<QuickAttendanceResult> => {
  const kioskToken = (import.meta.env.VITE_KIOSK_TOKEN as string | undefined)?.trim();
  if (!kioskToken) {
    throw new Error(
      "Kiosk token is not configured. Set VITE_KIOSK_TOKEN to match the server KIOSK_API_TOKEN."
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  if (employeeCode?.trim()) {
    formData.append("employee_code", employeeCode.trim());
  }
  return apiRequest<QuickAttendanceResult>(
    "/api/attendance/quick",
    {
      method: "POST",
      body: formData,
      headers: { "X-Kiosk-Token": kioskToken },
    },
    "none"
  );
};
