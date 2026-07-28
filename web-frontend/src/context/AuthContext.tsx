import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, NotificationItem } from '../types';
import { api } from '../services/api';

interface ToastMessage {
  id: string;
  type: 'success' | 'danger' | 'warning' | 'info';
  message: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isDark: boolean;
  systemMode: 'online' | 'offline' | 'syncing';
  toasts: ToastMessage[];
  notifications: NotificationItem[];
  toggleTheme: () => void;
  login: (username: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'danger' | 'warning' | 'info') => void;
  dismissToast: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [systemMode] = useState<'online' | 'offline' | 'syncing'>('online');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [notifications] = useState<NotificationItem[]>([
    {
      id: '1',
      title: 'System Online',
      message: 'Connected to Production API endpoint.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    },
  ]);

  useEffect(() => {
    const savedUser = localStorage.getItem('nfc_web_user');
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('nfc_web_user');
      }
    }
    setIsLoading(false);
  }, [token]);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const showToast = (message: string, type: 'success' | 'danger' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4000);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const login = async (username: string, pin: string): Promise<boolean> => {
    try {
      const res = await api.login(username, pin);
      if (res.user && res.token) {
        setUser(res.user);
        setToken(res.token);
        localStorage.setItem('nfc_web_user', JSON.stringify(res.user));
        showToast(`Welcome back, ${res.user.fullName}!`, 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      showToast(err.message || 'Login failed. Incorrect ID or PIN.', 'danger');
      return false;
    }
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
    setToken(null);
    localStorage.removeItem('nfc_web_user');
    showToast('Logged out successfully.', 'info');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isDark,
        systemMode,
        toasts,
        notifications,
        toggleTheme,
        login,
        logout,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
