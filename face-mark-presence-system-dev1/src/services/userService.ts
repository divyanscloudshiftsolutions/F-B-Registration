import { apiRequest } from "@/lib/api";
import { UserLogin } from "@/lib/Model";
import { Employee } from "@/services/employeeService";

export const getUsers = async (): Promise<Employee[]> => {
  return apiRequest<Employee[]>("/api/users", {}, "admin");
};

export const getUserByEmail = async (
  email: string
): Promise<UserLogin | null> => {
  try {
    return await apiRequest<UserLogin>(
      `/api/users/by-email/${encodeURIComponent(email)}`,
      {},
      "user"
    );
  } catch {
    return null;
  }
};

export const getUser = async (id: string): Promise<UserLogin> => {
  return apiRequest<UserLogin>(`/api/users/${id}`, {}, "user");
};
