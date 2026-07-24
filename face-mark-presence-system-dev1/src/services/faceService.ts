import { apiRequest, AuthMode } from "@/lib/api";

export interface FaceEnrollmentStatus {
  userId: string;
  sampleCount: number;
  hasEnsemble: boolean;
  isEnrolled: boolean;
  minRequired: number;
  maxAllowed: number;
}

export interface FaceVerifyResult {
  userId: string;
  userName: string;
  confidence: number;
  matchType: string;
  verified: boolean;
}

export const getFaceEnrollmentStatus = (userId: string, auth: AuthMode = "user"): Promise<FaceEnrollmentStatus> =>
  apiRequest(`/api/face/embedding-status/${userId}`, {}, auth);

export const registerMultipleFaces = async (
  userId: string,
  files: File[],
  auth: AuthMode = "user"
): Promise<{ success: boolean; message: string; successfulEmbeddings: number; profileImageUrl?: string }> => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  return apiRequest(`/api/face/register-multiple/${userId}`, {
    method: "POST",
    body: formData,
  }, auth);
};

export const verifyFace = async (userId: string, file: File): Promise<FaceVerifyResult> => {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest(`/api/face/verify/${userId}`, { method: "POST", body: formData }, "user");
};

export const faceCheckIn = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest("/api/attendance/checkin", { method: "POST", body: formData }, "user");
};

export const faceCheckOut = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest("/api/attendance/checkout", { method: "POST", body: formData }, "user");
};
