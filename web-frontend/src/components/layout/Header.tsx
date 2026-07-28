import React from 'react';
import { Bell, Moon, Sun, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  title: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, onRefresh, isRefreshing }) => {
  const { isDark, toggleTheme, notifications } = useAuth();
  const unreadNotifications = notifications.filter(n => !n.read).length;

  return (
    <header className="sticky top-0 z-20 bg-[#0E121B]/90 backdrop-blur-md border-b border-white/10 px-6 py-3.5 flex items-center justify-between">
      {/* Title & Page Header */}
      <div>
        <h2 className="text-lg font-bold text-white tracking-wide">{title}</h2>
        <p className="text-xs text-gray-400">Production Backend: api.nfc-qr.app.cloudshiftsolutions.in</p>
      </div>

      {/* System Status & Actions */}
      <div className="flex items-center gap-3">
        {/* System Mode Capsule */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>System Online</span>
        </div>

        {/* Refresh Action Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-[#D4AF37]' : ''} />
          </button>
        )}

        {/* Notifications Icon */}
        <div className="relative">
          <button 
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all"
            title="Notifications"
          >
            <Bell size={16} />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#D4AF37]" />
            )}
          </button>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-all"
          title="Toggle Color Theme"
        >
          {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
};
