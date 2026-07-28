import React from 'react';
import { 
  LayoutDashboard, 
  UserCheck, 
  Wine, 
  Grid3X3, 
  ShieldCheck, 
  LogOut, 
  ChevronLeft,
  ChevronRight
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
    { id: 'bartender', label: 'Bartender Panel', icon: Wine, roles: [UserRole.ADMIN, UserRole.BARTENDER] },
    { id: 'tables', label: 'Seating Tables', icon: Grid3X3, roles: [UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.BARTENDER, UserRole.MANAGER] },
    { id: 'admin', label: 'Staff & System Config', icon: ShieldCheck, roles: [UserRole.ADMIN] },
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
      {/* Top Branding Logo */}
      <div>
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#D4AF37] to-[#F5E08B] flex items-center justify-center text-black font-black text-lg">
                🍸
              </div>
              <div>
                <h1 className="font-extrabold tracking-wider text-sm text-[#D4AF37] uppercase">NFC BAR SYSTEM</h1>
                <p className="text-[10px] text-gray-400 font-medium">Enterprise Web Edition</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#D4AF37] to-[#F5E08B] flex items-center justify-center text-black font-black text-lg mx-auto">
              🍸
            </div>
          )}

          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation Menu Links */}
        <nav className="p-3 space-y-1.5 mt-2">
          {filteredNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all ${
                  isActive 
                    ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 shadow-lg shadow-[#D4AF37]/5 font-semibold' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                } ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} className={isActive ? 'text-[#D4AF37]' : 'text-gray-400'} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Info & Logout */}
      <div className="p-3 border-t border-white/10 space-y-2">
        {!collapsed && (
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] font-bold text-xs uppercase">
              {user?.username ? user.username.substring(0, 2) : 'US'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user?.fullName || 'Staff User'}</p>
              <p className="text-[10px] text-[#D4AF37] uppercase font-semibold tracking-wider">{user?.role || 'User'}</p>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-white hover:bg-red-500/20 border border-transparent hover:border-red-500/30 transition-all ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title="Sign Out"
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
