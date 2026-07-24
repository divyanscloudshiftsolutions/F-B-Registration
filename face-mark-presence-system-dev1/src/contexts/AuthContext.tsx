import { UserLogin } from "@/lib/Model";
import {
  getCurrentUser,
  logoutUser,
  signInWithEmail,
  signUpWithEmail,
  updateProfile,
} from "@/services/authService";
import { compressAndUploadFile } from "@/services/fileUploadService";
import React, { createContext, useState, useContext, useEffect } from "react";

interface AuthContextProps {
  user: UserLogin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    image: File
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<UserLogin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("attendanceToken");
    if (!token) {
      setIsLoading(false);
      return;
    }

    getCurrentUser()
      .then((profile) => {
        setUser(profile);
        localStorage.setItem("attendanceUser", JSON.stringify(profile));
      })
      .catch((error) => {
        console.error("Error restoring session:", error);
        logoutUser();
        localStorage.removeItem("attendanceUser");
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const profile = await signInWithEmail(email, password);
      localStorage.setItem("attendanceUser", JSON.stringify(profile));
      setUser(profile);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    image: File
  ) => {
    setIsLoading(true);
    try {
      await signUpWithEmail(name, email, password);
      let profile = await signInWithEmail(email, password);

      const imageUrl = await compressAndUploadFile(image, "user-photos");
      if (imageUrl) {
        profile = await updateProfile({ userImage: imageUrl });
      }

      setUser(profile);
      localStorage.setItem("attendanceUser", JSON.stringify(profile));
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    logoutUser();
    setUser(null);
    localStorage.removeItem("attendanceUser");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
