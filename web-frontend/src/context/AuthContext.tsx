import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { User, NotificationItem } from '../types';
import { api } from '../services/api';

export interface ToastMessage {
  id: string;
  type: 'success' | 'danger' | 'error' | 'warning' | 'info' | 'primary';
  message: string;
  title?: string;
  subMessage?: string;
  tableNumber?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  remainingMs?: number;
  visibleStartedAt?: number;
  createdAt: number;
  dedupKey?: string;
}

export type ToastOptions = {
  message: string;
  title?: string;
  subMessage?: string;
  type?: 'success' | 'danger' | 'error' | 'warning' | 'info' | 'primary';
  tableNumber?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  dedupKey?: string;
};

interface PreselectedTable {
  id: string;
  number: string;
  capacity: number;
  placeTypeId: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isDark: boolean;
  systemMode: 'online' | 'offline' | 'syncing';
  toasts: ToastMessage[];
  activeToast: ToastMessage | null;
  notifications: NotificationItem[];
  preselectedTable: PreselectedTable | null;
  setPreselectedTable: (table: PreselectedTable | null) => void;
  toggleTheme: () => void;
  login: (username: string, pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
  showToast: (
    messageOrOptions: string | ToastOptions,
    type?: 'success' | 'danger' | 'error' | 'warning' | 'info' | 'primary'
  ) => void;
  dismissToast: (id?: string) => void;
  dismissActiveToast: () => void;
  addNotification: (title: string, message: string) => void;
  markNotificationsAsRead: () => void;
  clearNotifications: () => void;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  token: null,
  isLoading: true,
  isDark: false,
  systemMode: 'online',
  toasts: [],
  activeToast: null,
  notifications: [],
  preselectedTable: null,
  setPreselectedTable: () => {},
  toggleTheme: () => {},
  login: async () => false,
  logout: async () => {},
  showToast: () => {},
  dismissToast: () => {},
  dismissActiveToast: () => {},
  addNotification: () => {},
  markNotificationsAsRead: () => {},
  clearNotifications: () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDark, setIsDark] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('bar_web_theme');
    return savedTheme === 'dark'; // Default to false (light theme)
  });
  const [systemMode] = useState<'online' | 'offline' | 'syncing'>('online');
  const [preselectedTable, setPreselectedTable] = useState<PreselectedTable | null>(null);

  // =========================================================================
  // STAFF LIVE NOTIFICATION QUEUE ENGINE (3s timer, 500ms promotion gap, LIFO)
  // =========================================================================
  const NOTIFICATION_PROMOTION_GAP_MS = 500;

  const [activeToast, setActiveToast] = useState<ToastMessage | null>(null);
  const [queuedToasts, setQueuedToasts] = useState<ToastMessage[]>([]);
  const notificationQueueRef = useRef<ToastMessage[]>([]);
  const activeToastRef = useRef<ToastMessage | null>(null);
  const promotionGapTimerRef = useRef<any>(null);
  const isPromotionGapActiveRef = useRef<boolean>(false);
  const processedEventKeysRef = useRef<Map<string, number>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (promotionGapTimerRef.current) {
        clearTimeout(promotionGapTimerRef.current);
        promotionGapTimerRef.current = null;
      }
    };
  }, []);

  const isEventDuplicate = useCallback((dedupKey: string, cooldownMs: number = 8000): boolean => {
    if (!dedupKey) return false;
    const now = Date.now();
    const lastTime = processedEventKeysRef.current.get(dedupKey);
    if (lastTime && now - lastTime < cooldownMs) {
      return true;
    }
    processedEventKeysRef.current.set(dedupKey, now);

    // Prune stale keys if map exceeds 200 items
    if (processedEventKeysRef.current.size > 200) {
      for (const [k, time] of processedEventKeysRef.current.entries()) {
        if (now - time > 60000) processedEventKeysRef.current.delete(k);
      }
    }
    return false;
  }, []);

  const dismissActiveToast = useCallback(() => {
    // 1. Immediately clear the dismissed active notification from screen
    activeToastRef.current = null;
    setActiveToast(null);

    // 2. Clear any pending promotion gap timer
    if (promotionGapTimerRef.current) {
      clearTimeout(promotionGapTimerRef.current);
      promotionGapTimerRef.current = null;
    }

    // 3. If there are pending notifications in queue, initiate controlled 500ms promotion gap
    if (notificationQueueRef.current.length > 0) {
      isPromotionGapActiveRef.current = true;
      promotionGapTimerRef.current = setTimeout(() => {
        isPromotionGapActiveRef.current = false;
        promotionGapTimerRef.current = null;

        if (notificationQueueRef.current.length > 0) {
          // LIFO: pop newest notification from top of stack and initialize its fresh 3-second visible timer
          const nextToast = notificationQueueRef.current.shift()!;
          const resumedToast: ToastMessage = {
            ...nextToast,
            visibleStartedAt: Date.now(),
            remainingMs: nextToast.durationMs || 3000,
          };
          activeToastRef.current = resumedToast;
          setActiveToast(resumedToast);
          setQueuedToasts([...notificationQueueRef.current]);
        } else {
          activeToastRef.current = null;
          setActiveToast(null);
          setQueuedToasts([]);
        }
      }, NOTIFICATION_PROMOTION_GAP_MS);
    } else {
      isPromotionGapActiveRef.current = false;
      setQueuedToasts([]);
    }
  }, []);

  const dismissToast = useCallback(
    (id?: string) => {
      if (!id || activeToastRef.current?.id === id) {
        dismissActiveToast();
      } else {
        notificationQueueRef.current = notificationQueueRef.current.filter((t) => t && t.id !== id);
        setQueuedToasts([...notificationQueueRef.current]);
      }
    },
    [dismissActiveToast]
  );

  const showToast = useCallback(
    (
      messageOrOptions: string | ToastOptions,
      legacyType: 'success' | 'danger' | 'error' | 'warning' | 'info' | 'primary' = 'info'
    ) => {
      let options: ToastOptions;
      if (typeof messageOrOptions === 'string') {
        options = {
          message: messageOrOptions,
          type: legacyType,
        };
      } else {
        options = {
          ...messageOrOptions,
          type: messageOrOptions.type || legacyType,
        };
      }

      if (!options || !options.message) return;

      const dedupKey =
        options.dedupKey ||
        `${options.tableNumber || ''}_${options.message}_${options.type || 'info'}`;

      if (dedupKey && isEventDuplicate(dedupKey, 8000)) {
        return;
      }

      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const duration = options.durationMs || 3000;
      const now = Date.now();

      const fullToast: ToastMessage = {
        id,
        createdAt: now,
        durationMs: duration,
        remainingMs: duration,
        visibleStartedAt: now,
        message: options.message,
        title: options.title,
        subMessage: options.subMessage,
        type: options.type || 'info',
        tableNumber: options.tableNumber,
        actionLabel: options.actionLabel,
        onAction: options.onAction,
        dedupKey,
      };

      if (!activeToastRef.current && !isPromotionGapActiveRef.current) {
        // No popup currently visible on screen and no breathing gap active: promote immediately as active
        activeToastRef.current = fullToast;
        setActiveToast(fullToast);
        setQueuedToasts([...notificationQueueRef.current]);
      } else {
        // Active popup is currently visible OR post-dismissal breathing gap is in progress:
        const currentActive = activeToastRef.current;

        // If active popup is identical, avoid duplicate
        if (currentActive && currentActive.message === fullToast.message && currentActive.type === fullToast.type) {
          return;
        }

        // Evict older duplicate with same dedupKey from queue
        const filteredQueue = notificationQueueRef.current.filter((t) => {
          if (!t) return false;
          if (fullToast.dedupKey && t.dedupKey === fullToast.dedupKey) return false;
          return true;
        });

        // Insert latest notification at FRONT of LIFO queue
        const updatedQueue = [fullToast, ...filteredQueue].slice(0, 10);
        notificationQueueRef.current = updatedQueue;
        setQueuedToasts(updatedQueue);

        // If in breathing gap and no gap timer is active, trigger promotion timer
        if (isPromotionGapActiveRef.current && !promotionGapTimerRef.current) {
          promotionGapTimerRef.current = setTimeout(() => {
            isPromotionGapActiveRef.current = false;
            promotionGapTimerRef.current = null;
            if (notificationQueueRef.current.length > 0) {
              const nextToast = notificationQueueRef.current.shift()!;
              const resumedToast: ToastMessage = {
                ...nextToast,
                visibleStartedAt: Date.now(),
                remainingMs: nextToast.durationMs || 3000,
              };
              activeToastRef.current = resumedToast;
              setActiveToast(resumedToast);
              setQueuedToasts([...notificationQueueRef.current]);
            }
          }, NOTIFICATION_PROMOTION_GAP_MS);
        }
      }
    },
    [isEventDuplicate]
  );

  // Expose stacked array for visual preview
  const toasts = activeToast ? [activeToast, ...queuedToasts] : [];

  // Notifications state loaded from localStorage
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem('bar_web_notifications');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback below
      }
    }
    return [
      {
        id: '1',
        title: 'System Online',
        message: 'System active and ready for venue operations.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
      },
    ];
  });

  // Apply DOM Theme classes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [isDark]);

  // Sync notifications to localStorage
  useEffect(() => {
    localStorage.setItem('bar_web_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    const savedUser = localStorage.getItem('bar_web_user');
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('bar_web_user');
      }
    }
    setIsLoading(false);
  }, [token]);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem('bar_web_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const login = async (username: string, pin: string): Promise<boolean> => {
    try {
      const res = await api.login(username, pin);
      if (res.user && res.token) {
        setUser(res.user);
        setToken(res.token);
        localStorage.setItem('bar_web_user', JSON.stringify(res.user));
        const roleLower = res.user.role ? String(res.user.role).toLowerCase() : '';
        let defaultTab = 'dashboard';
        if (roleLower === 'chef') {
          defaultTab = 'kds_kitchen';
        } else if (roleLower === 'waiter' || roleLower === 'server') {
          defaultTab = 'waiter_tables';
        } else if (roleLower === 'bartender') {
          defaultTab = 'bartender/checkins';
        } else if (roleLower === 'receptionist') {
          defaultTab = 'checkin';
        } else {
          defaultTab = 'dashboard';
        }
        localStorage.setItem('bar_web_active_tab', defaultTab);
        showToast(`Welcome back, ${res.user.fullName}!`, 'success');

        // Log receptionist/admin login notification
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const newNotif: NotificationItem = {
          id: Date.now().toString(),
          title: 'Staff Access Granted',
          message: `${res.user.fullName} logged into administrative portal successfully.`,
          timestamp: timeStr,
          read: false,
        };
        setNotifications((prev) => [newNotif, ...prev]);

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
    localStorage.removeItem('bar_web_user');
    localStorage.removeItem('bar_web_active_tab');
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/customer') && !window.location.pathname.startsWith('/t/')) {
      window.history.replaceState(null, '', '/login');
    }
    showToast('Logged out successfully.', 'info');
  };

  // Helper actions for notifications
  const addNotification = (title: string, message: string) => {
    const newNotif: NotificationItem = {
      id: Date.now().toString(),
      title,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const markNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
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
        activeToast,
        notifications,
        preselectedTable,
        setPreselectedTable,
        toggleTheme,
        login,
        logout,
        showToast,
        dismissToast,
        dismissActiveToast,
        addNotification,
        markNotificationsAsRead,
        clearNotifications,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  return context || defaultAuthContext;
};
