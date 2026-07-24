import { apiRequest, setAdminToken, setUserToken } from "@/lib/api";
import { UserLogin } from "@/lib/Model";

interface TokenResponse {
  access_token: string;
  token_type: string;
}

interface AdminProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "admin";
}

export const signInWithEmail = async (
  email: string,
  password: string
): Promise<UserLogin> => {
  try {
    const tokenRes = await apiRequest<TokenResponse>(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      "none"
    );

    setUserToken(tokenRes.access_token);

    return await apiRequest<UserLogin>("/api/auth/me", {}, "user");
  } catch (error) {
    setUserToken(null);
    throw error;
  }
};

export const signUpWithEmail = async (
  name: string,
  email: string,
  password: string,
  userImage?: string
): Promise<UserLogin> => {
  return apiRequest<UserLogin>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        userName: name,
        userImage: userImage || null,
      }),
    },
    "none"
  );
};

export const updateProfile = async (
  data: Partial<Pick<UserLogin, "userName" | "userImage">>
): Promise<UserLogin> => {
  return apiRequest<UserLogin>(
    "/api/auth/me",
    {
      method: "PATCH",
      body: JSON.stringify({
        userName: data.userName,
        userImage: data.userImage,
      }),
    },
    "user"
  );
};

export const getCurrentUser = async (): Promise<UserLogin> => {
  return apiRequest<UserLogin>("/api/auth/me", {}, "user");
};

export const signInAdmin = async (
  email: string,
  password: string
): Promise<AdminProfile> => {
  try {
    const tokenRes = await apiRequest<TokenResponse>(
      "/api/auth/admin/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
      "none"
    );

    setAdminToken(tokenRes.access_token);

    return await apiRequest<AdminProfile>("/api/auth/admin/me", {}, "admin");
  } catch (error) {
    setAdminToken(null);
    throw error;
  }
};

export const signUpAdmin = async (
  name: string,
  email: string,
  password: string
): Promise<AdminProfile> => {
  await apiRequest<AdminProfile>(
    "/api/auth/admin/register",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        userName: name,
      }),
    },
    "none"
  );

  return signInAdmin(email, password);
};

export const getCurrentAdmin = async (): Promise<AdminProfile> => {
  return apiRequest<AdminProfile>("/api/auth/admin/me", {}, "admin");
};

export const logoutUser = (): void => {
  setUserToken(null);
};

export const logoutAdmin = (): void => {
  setAdminToken(null);
};
