import { apiRequest } from "@/lib/api";
import { getDepartments as fetchDepartments } from "@/services/settingsService";

export interface EmployeeDocument {
  type: string;
  name: string;
  url: string;
}

export interface EmployeeSalaryInput {
  basicSalary: number;
  hra?: number;
  da?: number;
  conveyance?: number;
  medicalAllowance?: number;
  specialAllowance?: number;
  overtimeRate?: number;
  effectiveFrom?: string;
}

export interface CreateEmployeePayload {
  email: string;
  password: string;
  userName: string;
  userImage?: string;
  phone?: string;
  employeeCode?: string;
  departmentId?: string;
  joiningDate?: string;
  terminationDate?: string;
  designation?: string;
  employmentType?: string;
  status?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  uanNumber?: string;
  esiNumber?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  documents?: EmployeeDocument[];
  salary?: EmployeeSalaryInput;
}

export interface Employee {
  userId: string;
  email: string;
  userName: string;
  userRole: string;
  userImage?: string;
  phone?: string;
  employeeCode?: string;
  departmentId?: string;
  departmentName?: string;
  joiningDate?: string;
  terminationDate?: string;
  designation?: string;
  employmentType?: string;
  status?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  uanNumber?: string;
  esiNumber?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  documents?: Record<string, { url: string; name: string }>;
  hasSalaryStructure?: boolean;
  salary?: EmployeeSalaryInput;
  createdAt?: string;
}

export interface UpdateEmployeePayload {
  email?: string;
  password?: string;
  userName?: string;
  userImage?: string;
  phone?: string;
  employeeCode?: string;
  departmentId?: string;
  joiningDate?: string;
  terminationDate?: string;
  designation?: string;
  employmentType?: string;
  status?: string;
  aadhaarNumber?: string;
  panNumber?: string;
  uanNumber?: string;
  esiNumber?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  documents?: EmployeeDocument[];
  salary?: EmployeeSalaryInput;
}

export const getDepartments = (): Promise<import("@/services/settingsService").Department[]> =>
  fetchDepartments(true);

export const createEmployee = (payload: CreateEmployeePayload): Promise<Employee> =>
  apiRequest("/api/users/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  }, "admin");

export const getEmployee = (userId: string): Promise<Employee> =>
  apiRequest(`/api/users/employees/${userId}`, {}, "admin");

export const updateEmployee = (userId: string, payload: UpdateEmployeePayload): Promise<Employee> =>
  apiRequest(`/api/users/employees/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }, "admin");

export const uploadEmployeeDocument = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", "employee-documents");
  const result = await apiRequest<{ url: string }>(
    "/api/upload/admin",
    { method: "POST", body: formData },
    "admin"
  );
  return result.url;
};
