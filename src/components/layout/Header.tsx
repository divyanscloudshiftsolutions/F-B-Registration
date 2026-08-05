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

  const toggleThemeWithWave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (
      !(document as any).startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      toggleTheme();
      return;
    }

    const x = e.clientX;
    const y = e.clientY;

    const right = window.innerWidth - x;
    const bottom = window.innerHeight - y;
    const maxRadius = Math.hypot(Math.max(x, right), Math.max(y, bottom));

    const transition = (document as any).startViewTransition(() => {
      toggleTheme();
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`
          ]
        },
        {
          duration: 800,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
    });
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearNotifications();
  };

  return (
    <header className="sticky top-0 z-20 bg-bg-sidebar/90 backdrop-blur-md border-b border-border px-6 py-3.5 flex items-center justify-between text-text-primary">
      {/* Title & Page Header */}
      <div>
        <h2 className="text-lg font-bold text-text-primary tracking-wide">{title}</h2>
        <p className="text-xs text-text-muted">Bar Management System</p>
      </div>

      {/* System Status & Actions */}
      <div className="flex items-center gap-3 relative">
        {/* System Status Capsule */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-status-success-bg border border-status-success-border text-status-success text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
          <span>System Active</span>
        </div>

        {/* Refresh Action Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-bg-hover border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover/80 transition-all disabled:opacity-50 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-primary' : ''} />
          </button>
        )}

        {/* Notifications Icon with Dropdown */}
        <div ref={popoverRef} className="relative">
          <button 
            onClick={handleTogglePanel}
            className="p-2 rounded-xl bg-bg-hover border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover/80 transition-all relative cursor-pointer"
            title="Notifications"
          >
            <Bell size={16} />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-primary" />
            )}
          </button>

          {/* Notifications Dropdown Panel Overlay */}
          {isOpen && (
            <div className="absolute right-0 mt-2.5 w-80 rounded-3xl border border-border glass-panel shadow-2xl overflow-hidden z-50 text-text-primary animate-fadeIn">
              
              {/* Popover Header */}
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-text-primary">Notifications Log</span>
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearAll}
                    className="text-[10px] text-status-danger hover:text-status-danger/80 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 size={11} /> Clear All
                  </button>
                )}
              </div>

              {/* Popover Body List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-border">
                {notifications.length === 0 ? (
                  <div className="px-5 py-8 text-center space-y-2">
                    <CheckSquare className="mx-auto text-text-muted" size={24} />
                    <p className="text-xs font-semibold text-text-primary">No Operational Alerts</p>
                    <p className="text-[10px] text-text-muted">Your session activity log is currently clear.</p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="p-4 hover:bg-bg-hover transition-all text-xs space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-bold text-text-primary text-[11px]">{notif.title}</p>
                        <span className="text-[9px] text-text-muted font-mono">{notif.timestamp}</span>
                      </div>
                      <p className="text-[10px] text-text-muted leading-relaxed">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Popover Action Footer (Sign Out matching native shell overlay) */}
              <div className="p-3 bg-bg-primary border-t border-border">
                {user && (
                  <div className="flex items-center justify-between px-2 pb-2">
                    <span className="text-[10px] text-text-muted truncate max-w-[120px]">👤 {user.fullName}</span>
                    <span className="text-[8px] text-primary border border-primary/30 px-2 py-0.5 rounded-full font-bold uppercase">{user.role}</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-status-danger-bg hover:bg-status-danger-bg/80 text-status-danger border border-status-danger-border transition-all cursor-pointer"
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
          onClick={toggleThemeWithWave}
          className="p-2 rounded-xl bg-bg-hover border border-border text-text-muted hover:text-text-primary hover:bg-bg-hover/80 transition-all cursor-pointer"
          title="Toggle Color Theme"
        >
          {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
};
