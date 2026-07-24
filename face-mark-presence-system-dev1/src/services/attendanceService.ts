import { apiRequest } from "@/lib/api";
import { AttendanceRecord } from "@/hooks/useAttendance";

export const createAttendance = async (
  data: Omit<AttendanceRecord, "id">
): Promise<AttendanceRecord> => {
  return apiRequest<AttendanceRecord>(
    "/api/attendance",
    {
      method: "POST",
      body: JSON.stringify({
        userId: data.userId,
        userName: data.userName,
        userEmail: data.userEmail,
        timestamp: data.timestamp,
        type: data.type,
        method: data.method,
        status: data.status,
        location: data.location,
        note: data.note,
        imageUrl: data.imageUrl,
      }),
    },
    "user"
  );
};

export const getAttendance = async (): Promise<AttendanceRecord[]> => {
  return apiRequest<AttendanceRecord[]>("/api/attendance", {}, "admin");
};

export const getAttendanceById = async (
  id: string
): Promise<AttendanceRecord> => {
  return apiRequest<AttendanceRecord>(`/api/attendance/${id}`, {}, "user");
};

export const getAllAttendanceByEmail = async (
  email: string
): Promise<AttendanceRecord[]> => {
  return apiRequest<AttendanceRecord[]>(
    `/api/attendance/email/${encodeURIComponent(email)}`,
    {},
    "user"
  );
};

export const getAllCurrentMonthAttendance = async (): Promise<
  AttendanceRecord[]
> => {
  return apiRequest<AttendanceRecord[]>("/api/attendance/month", {}, "admin");
};

export const updateAttendanceRecordByIdAndUserId = async (
  id: string,
  userId: string,
  updateData: Partial<AttendanceRecord>
): Promise<AttendanceRecord> => {
  return apiRequest<AttendanceRecord>(
    `/api/attendance/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        userId,
        status: updateData.status,
        note: updateData.note,
        type: updateData.type,
        method: updateData.method,
        location: updateData.location,
        imageUrl: updateData.imageUrl,
      }),
    },
    "admin"
  );
};

export const deleteAttendance = async (id: string): Promise<void> => {
  return apiRequest<void>(
    `/api/attendance/${id}`,
    { method: "DELETE" },
    "admin"
  );
};
