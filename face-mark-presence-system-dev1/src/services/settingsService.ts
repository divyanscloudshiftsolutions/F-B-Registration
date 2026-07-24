import { apiRequest } from "@/lib/api";

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
}

export interface EmploymentType {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  sortOrder: number;
}

export interface DocumentType {
  id: string;
  key: string;
  label: string;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface AttendancePolicy {
  id?: string;
  employmentTypeId?: string;
  employmentTypeName?: string;
  employmentTypeCode?: string;
  shiftStartTime: string;
  shiftEndTime: string;
  lateGraceMinutes: number;
  halfDayHours: number;
  fullDayHours: number;
  overtimeAfterHours: number;
  updatedAt?: string;
}

export const getDepartments = (activeOnly = true) =>
  apiRequest<Department[]>(
    `/api/settings/departments?active_only=${activeOnly}`,
    {},
    "admin"
  );

export const createDepartment = (data: Omit<Department, "id">) =>
  apiRequest<Department>("/api/settings/departments", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      code: data.code,
      description: data.description,
      is_active: data.isActive,
    }),
  }, "admin");

export const updateDepartment = (id: string, data: Omit<Department, "id">) =>
  apiRequest<Department>(`/api/settings/departments/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: data.name,
      code: data.code,
      description: data.description,
      is_active: data.isActive,
    }),
  }, "admin");

export const deleteDepartment = (id: string) =>
  apiRequest<void>(`/api/settings/departments/${id}`, { method: "DELETE" }, "admin");

export const getEmploymentTypes = () =>
  apiRequest<EmploymentType[]>("/api/settings/employment-types", {}, "admin");

export const createEmploymentType = (data: Omit<EmploymentType, "id">) =>
  apiRequest<EmploymentType>("/api/settings/employment-types", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      code: data.code,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    }),
  }, "admin");

export const updateEmploymentType = (id: string, data: Omit<EmploymentType, "id">) =>
  apiRequest<EmploymentType>(`/api/settings/employment-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: data.name,
      code: data.code,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    }),
  }, "admin");

export const deleteEmploymentType = (id: string) =>
  apiRequest<void>(`/api/settings/employment-types/${id}`, { method: "DELETE" }, "admin");

export const getDocumentTypes = () =>
  apiRequest<DocumentType[]>("/api/settings/document-types", {}, "admin");

export const createDocumentType = (data: Omit<DocumentType, "id">) =>
  apiRequest<DocumentType>("/api/settings/document-types", {
    method: "POST",
    body: JSON.stringify({
      key: data.key,
      label: data.label,
      is_required: data.isRequired,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    }),
  }, "admin");

export const updateDocumentType = (id: string, data: Omit<DocumentType, "id">) =>
  apiRequest<DocumentType>(`/api/settings/document-types/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      key: data.key,
      label: data.label,
      is_required: data.isRequired,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    }),
  }, "admin");

export const deleteDocumentType = (id: string) =>
  apiRequest<void>(`/api/settings/document-types/${id}`, { method: "DELETE" }, "admin");

export const getAttendancePolicies = () =>
  apiRequest<AttendancePolicy[]>("/api/settings/attendance-policies", {}, "admin");

export const updateAttendancePolicyForType = (employmentTypeId: string, data: AttendancePolicy) =>
  apiRequest<AttendancePolicy>(`/api/settings/attendance-policies/${employmentTypeId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }, "admin");

export const getAttendancePolicy = () =>
  apiRequest<AttendancePolicy>("/api/settings/attendance-policy", {}, "admin");

export const updateAttendancePolicy = (data: AttendancePolicy) =>
  apiRequest<AttendancePolicy>("/api/settings/attendance-policy", {
    method: "PUT",
    body: JSON.stringify(data),
  }, "admin");
