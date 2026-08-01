import React, { useState, useEffect, useRef } from 'react';
import { Bell, Moon, Sun, RefreshCw, Trash2, LogOut, CheckSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  title: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, onRefresh, isRefreshing }) => {
  const { 
    isDark, 
    toggleTheme, 
    notifications, 
    markNotificationsAsRead, 
    clearNotifications,
    logout,
    user
  } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const unreadNotifications = notifications.filter(n => !n.read).length;
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleTogglePanel = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      markNotificationsAsRead();
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearNotifications();
  };

  return (
    <header className="sticky top-0 z-20 bg-bg-surface/90 backdrop-blur-md border-b border-border-main px-6 py-3.5 flex items-center justify-between text-text-main">
      {/* Title & Page Header */}
      <div>
        <h2 className="text-lg font-bold text-text-main tracking-wide">{title}</h2>
        <p className="text-xs text-text-muted">NFC QR Management System</p>
      </div>

      {/* System Status & Actions */}
      <div className="flex items-center gap-3 relative">
        {/* System Status Capsule */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full dark:bg-emerald-500/10 bg-emerald-500/5 border border-emerald-500/30 dark:text-emerald-400 text-emerald-700 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full dark:bg-emerald-400 bg-emerald-500 animate-pulse" />
          <span>System Active</span>
        </div>

        {/* Refresh Action Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-white/5 border border-border-main text-text-muted hover:text-text-main hover:bg-white/10 transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-[#D4AF37]' : ''} />
          </button>
        )}

        {/* Notifications Icon with Dropdown */}
        <div ref={popoverRef} className="relative">
          <button 
            onClick={handleTogglePanel}
            className="p-2 rounded-xl bg-white/5 border border-border-main text-text-muted hover:text-text-main hover:bg-white/10 transition-all relative cursor-pointer"
            title="Notifications"
          >
            <Bell size={16} />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
            )}
          </button>

          {/* Notifications Dropdown Panel Overlay */}
          {isOpen && (
            <div className="absolute right-0 mt-2.5 w-80 rounded-3xl border border-border-main glass-panel shadow-2xl overflow-hidden z-50 text-text-main animate-fadeIn">
              
              {/* Popover Header */}
              <div className="px-5 py-3.5 border-b border-border-main flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-text-main">Notifications Log</span>
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearAll}
                    className="text-[10px] dark:text-red-400 text-red-700 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 size={11} /> Clear All
                  </button>
                )}
              </div>

              {/* Popover Body List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-border-main">
                {notifications.length === 0 ? (
                  <div className="px-5 py-8 text-center space-y-2">
                    <CheckSquare className="mx-auto text-text-muted" size={24} />
                    <p className="text-xs font-semibold text-text-main">No Operational Alerts</p>
                    <p className="text-[10px] text-text-muted">Your session activity log is currently clear.</p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="p-4 hover:bg-white/5 transition-all text-xs space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-bold text-text-main text-[11px]">{notif.title}</p>
                        <span className="text-[9px] text-text-muted font-mono">{notif.timestamp}</span>
                      </div>
                      <p className="text-[10px] text-text-muted leading-relaxed">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Popover Action Footer (Sign Out matching native shell overlay) */}
              <div className="p-3 bg-bg-primary border-t border-border-main">
                {user && (
                  <div className="flex items-center justify-between px-2 pb-2">
                    <span className="text-[10px] text-text-muted truncate max-w-[120px]">👤 {user.fullName}</span>
                    <span className="text-[8px] text-[#D4AF37] border border-[#D4AF37]/30 px-2 py-0.5 rounded-full font-black uppercase">{user.role}</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 dark:text-red-400 text-red-700 border border-red-500/20 transition-all cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Sign Out Shift Account</span>
                </button>
              </div>

            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white/5 border border-border-main text-text-muted hover:text-text-main hover:bg-white/10 transition-all cursor-pointer"
          title="Toggle Color Theme"
        >
          {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
};
