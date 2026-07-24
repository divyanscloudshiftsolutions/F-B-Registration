import imageCompression from "browser-image-compression";
import { apiRequest, resolveMediaUrl } from "@/lib/api";

interface UploadResponse {
  url: string;
}

export const compressAndUploadFile = async (
  file: File,
  folder = "uploads",
  auth: "user" | "admin" = "user"
): Promise<string> => {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };

  const compressedFile = await imageCompression(file, options);
  const formData = new FormData();
  formData.append("file", compressedFile, compressedFile.name);
  formData.append("folder", folder);

  const result = await apiRequest<UploadResponse>(
    "/api/upload",
    {
      method: "POST",
      body: formData,
    },
    auth
  );

  return resolveMediaUrl(result.url);
};
