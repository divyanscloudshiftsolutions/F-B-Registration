import {
  getCurrentAdmin,
  logoutAdmin,
  signInAdmin,
  signUpAdmin,
} from "@/services/authService";
import React, { createContext, useState, useContext, useEffect } from "react";

interface Admin {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "admin";
}

interface AdminContextProps {
  admin: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminContext = createContext<AdminContextProps>({
  admin: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export const useAdmin = () => useContext(AdminContext);

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      setIsLoading(false);
      return;
    }

    getCurrentAdmin()
      .then((profile) => {
        setAdmin(profile);
        localStorage.setItem("attendanceAdmin", JSON.stringify(profile));
      })
      .catch((error) => {
        console.error("Error restoring admin session:", error);
        logoutAdmin();
        localStorage.removeItem("attendanceAdmin");
        setAdmin(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const profile = await signInAdmin(email, password);
      setAdmin(profile);
      localStorage.setItem("attendanceAdmin", JSON.stringify(profile));
    } catch (error) {
      console.error("Admin login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const profile = await signUpAdmin(name, email, password);
      setAdmin(profile);
      localStorage.setItem("attendanceAdmin", JSON.stringify(profile));
    } catch (error) {
      console.error("Admin registration error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    logoutAdmin();
    setAdmin(null);
    localStorage.removeItem("attendanceAdmin");
  };

  return (
    <AdminContext.Provider
      value={{
        admin,
        isAuthenticated: !!admin,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
};
