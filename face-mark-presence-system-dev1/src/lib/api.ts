const API_BASE = import.meta.env.VITE_API_URL || "";

export type AuthMode = "user" | "admin" | "none";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(mode: AuthMode): string | null {
  if (mode === "user") return localStorage.getItem("attendanceToken");
  if (mode === "admin") return localStorage.getItem("adminToken");
  return null;
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  auth: AuthMode = "user"
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken(auth);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = await response.json();
      message = body.detail || body.message || message;
      if (Array.isArray(message)) {
        message = message.map((e: { msg?: string }) => e.msg).join(", ");
      }
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const setUserToken = (token: string | null) => {
  if (token) localStorage.setItem("attendanceToken", token);
  else localStorage.removeItem("attendanceToken");
};

export const setAdminToken = (token: string | null) => {
  if (token) localStorage.setItem("adminToken", token);
  else localStorage.removeItem("adminToken");
};
