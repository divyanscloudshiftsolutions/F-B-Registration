import { apiRequest } from "@/lib/api";

export interface WeekOffRequest {
  id: string;
  userId: string;
  userEmail: string;
  date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export const createWeekoff = async (
  data: Omit<WeekOffRequest, "id" | "createdAt">
): Promise<WeekOffRequest> => {
  return apiRequest<WeekOffRequest>(
    "/api/weekoffs",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "user"
  );
};

export const getWeekoffs = async (): Promise<WeekOffRequest[]> => {
  return apiRequest<WeekOffRequest[]>("/api/weekoffs", {}, "user");
};

export const getWeekoffById = async (id: string): Promise<WeekOffRequest> => {
  return apiRequest<WeekOffRequest>(`/api/weekoffs/${id}`, {}, "user");
};

export const updateWeekoff = async (
  id: string,
  data: Partial<WeekOffRequest>
): Promise<WeekOffRequest> => {
  return apiRequest<WeekOffRequest>(
    `/api/weekoffs/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    "user"
  );
};

export const deleteWeekoff = async (id: string): Promise<void> => {
  return apiRequest<void>(
    `/api/weekoffs/${id}`,
    { method: "DELETE" },
    "admin"
  );
};
