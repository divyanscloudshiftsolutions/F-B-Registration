import React from 'react';
import { 
  LayoutDashboard, 
  UserCheck, 
  Wine, 
  Grid3X3, 
  ShieldCheck, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Camera
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  collapsed, 
  setCollapsed 
}) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.BARTENDER] },
    { id: 'checkin', label: 'Reception Check-In', icon: UserCheck, roles: [UserRole.ADMIN, UserRole.RECEPTIONIST] },
    { id: 'quick_attendance', label: 'FaceMark Attendance', icon: Camera, roles: [UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.MANAGER] },
    { id: 'bartender', label: 'Bartender Panel', icon: Wine, roles: [UserRole.ADMIN, UserRole.BARTENDER] },
    { id: 'tables', label: 'Seating Tables', icon: Grid3X3, roles: [UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.BARTENDER, UserRole.MANAGER] },
    { id: 'admin', label: 'System Administration', icon: ShieldCheck, roles: [UserRole.ADMIN] },
  ];

  const userRoleLower = user?.role ? user.role.toLowerCase() : '';
  const filteredNavItems = navItems.filter(item => 
    !user || item.roles.includes(userRoleLower as any)
  );

  return (
    <aside 
      className={`h-screen sticky top-0 bg-[#0E121B] border-r border-white/10 flex flex-col justify-between transition-all duration-300 z-30 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Top Header */}
      <div>
        <div className="h-16 border-b border-white/10 flex items-center justify-between px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gold-gradient-btn flex items-center justify-center text-black font-black text-sm">
                🍸
              </div>
              <span className="font-extrabold text-white tracking-wider text-sm">NFC BAR SYSTEM</span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg gold-gradient-btn flex items-center justify-center text-black font-black text-sm mx-auto">
              🍸
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5">
          {filteredNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#F5E08B] text-black shadow-lg shadow-[#D4AF37]/20 font-black'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className={isActive ? 'text-black' : 'text-gray-400'} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-white/10">
        {user && !collapsed && (
          <div className="mb-3 px-2">
            <p className="text-xs font-bold text-white truncate">{user.fullName || user.username}</p>
            <p className="text-[10px] text-[#D4AF37] uppercase tracking-wider font-semibold">{user.role}</p>
          </div>
        )}

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
