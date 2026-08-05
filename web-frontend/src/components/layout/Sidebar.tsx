import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  UserCheck, 
  Wine, 
  Grid3X3, 
  ShieldCheck, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    tables: false,
    bartender: false,
    administration: false,
  });

  useEffect(() => {
    if (activeTab === 'tables') {
      setOpenGroups(prev => ({ ...prev, tables: true }));
    } else if (activeTab === 'bartender') {
      setOpenGroups(prev => ({ ...prev, bartender: true }));
    } else if (activeTab === 'admin') {
      setOpenGroups(prev => ({ ...prev, administration: true }));
    }
  }, [activeTab]);

  const toggleGroup = (group: string) => {
    if (collapsed) {
      setCollapsed(false);
    }
    
    const wasOpen = openGroups[group];
    
    // Toggle open state
    setOpenGroups(prev => ({
      ...prev,
      [group]: !wasOpen
    }));

    // Trigger default navigation to the first child subtab only if we are expanding it
    if (!wasOpen) {
      if (group === 'tables') {
        handleSubItemClick('tables');
      } else if (group === 'bartender') {
        handleSubItemClick('bartender');
      } else if (group === 'administration') {
        handleSubItemClick('admin', 'tables');
      }
    }
  };

  const handleSubItemClick = (tabId: string, adminSubtab?: string, subtabValue?: string) => {
    if (adminSubtab) {
      localStorage.setItem('bar_web_admin_subtab', adminSubtab);
      window.dispatchEvent(new Event('storage'));
    }
    if (tabId === 'tables' && subtabValue) {
      localStorage.setItem('bar_web_tables_filter', subtabValue);
      window.dispatchEvent(new Event('storage'));
    }
    if (tabId === 'bartender' && subtabValue) {
      localStorage.setItem('bar_web_bartender_subtab', subtabValue);
      window.dispatchEvent(new Event('storage'));
    }
    setActiveTab(tabId);
  };

  const userRoleLower = user?.role ? user.role.toLowerCase() : '';

  const hasRole = (allowedRoles: string[]) => {
    return !user || allowedRoles.includes(userRoleLower);
  };

  const groups = [
    {
      id: 'tables',
      label: 'Tables',
      icon: Grid3X3,
      roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.BARTENDER],
      subItems: [
        { label: 'Table Layout', onClick: () => handleSubItemClick('tables', undefined, 'all'), active: activeTab === 'tables' && (localStorage.getItem('bar_web_tables_filter') !== 'reserved') },
        { label: 'Reservations', onClick: () => handleSubItemClick('tables', undefined, 'reserved'), active: activeTab === 'tables' && localStorage.getItem('bar_web_tables_filter') === 'reserved' }
      ]
    },
    {
      id: 'bartender',
      label: 'Bartender',
      icon: Wine,
      roles: [UserRole.ADMIN, UserRole.BARTENDER],
      subItems: [
        { label: 'Orders', onClick: () => handleSubItemClick('bartender', undefined, 'orders'), active: activeTab === 'bartender' && localStorage.getItem('bar_web_bartender_subtab') !== 'queue' },
        { label: 'Queue', onClick: () => handleSubItemClick('bartender', undefined, 'queue'), active: activeTab === 'bartender' && localStorage.getItem('bar_web_bartender_subtab') === 'queue' }
      ]
    },
    {
      id: 'administration',
      label: 'Administration',
      icon: ShieldCheck,
      roles: [UserRole.ADMIN, UserRole.MANAGER],
      subItems: [
        { label: 'Table Floor', onClick: () => handleSubItemClick('admin', 'tables'), active: activeTab === 'admin' && (localStorage.getItem('bar_web_admin_subtab') === 'tables' || !localStorage.getItem('bar_web_admin_subtab')) },
        { label: 'Staff Directory', onClick: () => handleSubItemClick('admin', 'staff'), active: activeTab === 'admin' && localStorage.getItem('bar_web_admin_subtab') === 'staff' },
        { label: 'Revenue Analytics', onClick: () => handleSubItemClick('admin', 'chart'), active: activeTab === 'admin' && localStorage.getItem('bar_web_admin_subtab') === 'chart' },
        { label: 'Rate Cards', onClick: () => handleSubItemClick('admin', 'rates'), active: activeTab === 'admin' && localStorage.getItem('bar_web_admin_subtab') === 'rates' },
        { label: 'Customer Sessions', onClick: () => handleSubItemClick('admin', 'customers'), active: activeTab === 'admin' && localStorage.getItem('bar_web_admin_subtab') === 'customers' }
      ]
    }
  ];

  const renderGroup = (group: any) => {
    if (!group || !hasRole(group.roles)) return null;
    const GroupIcon = group.icon;
    const isGroupOpen = openGroups[group.id];
    
    const isGroupActive = 
      (group.id === 'tables' && activeTab === 'tables') ||
      (group.id === 'bartender' && activeTab === 'bartender') ||
      (group.id === 'administration' && activeTab === 'admin');
    
    return (
      <div key={group.id} className="space-y-1">
        <button
          onClick={() => toggleGroup(group.id)}
          className={`w-full flex items-center ${
            collapsed ? 'justify-center px-0' : 'justify-between px-3'
          } py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
            isGroupActive
              ? 'bg-primary text-text-inverse shadow-[0_4px_20px_rgba(141,108,229,0.3)] border-t border-t-white/10 scale-[1.01] active:scale-[0.98] font-black'
              : 'text-text-muted hover:bg-bg-hover/60 hover:text-text-primary hover:scale-[1.01] active:scale-[0.98]'
          }`}
          title={collapsed ? group.label : undefined}
        >
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <GroupIcon size={18} className={isGroupActive ? 'text-text-inverse' : 'text-text-muted'} />
            {!collapsed && <span>{group.label}</span>}
          </div>
          {!collapsed && (
            <ChevronDown 
              size={14} 
              className={`${isGroupActive ? 'text-text-inverse' : 'text-text-muted'} transition-transform duration-200 ${isGroupOpen ? 'rotate-180' : ''}`} 
            />
          )}
        </button>

        {!collapsed && isGroupOpen && (
          <div className="pl-9 pr-2 py-1 space-y-1 animate-slideDown">
            {group.subItems.map((sub: any, idx: number) => (
              <button
                key={idx}
                onClick={sub.onClick}
                className={`w-full text-left py-1.5 px-3 rounded-lg text-[11px] font-semibold transition-all duration-300 cursor-pointer hover:scale-[1.01] active:scale-[0.98] ${
                  sub.active
                    ? 'text-primary bg-primary-light font-bold shadow-[0_2px_10px_rgba(141,108,229,0.15)] border-t border-t-white/5'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-hover/60'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside 
      className={`h-[calc(100vh-2rem)] my-4 ml-4 bg-bg-sidebar border border-border-sidebar flex flex-col justify-between transition-all duration-300 z-30 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex flex-col flex-1 min-h-0">
        <div className="h-16 border-b border-border flex items-center justify-between px-4 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-text-inverse font-bold text-sm">
                🍸
              </div>
              <span className="font-extrabold text-text-primary tracking-wide text-xs">BAR SYSTEM</span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-text-inverse font-bold text-sm mx-auto">
               🍸
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg bg-bg-primary hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="p-3 space-y-1.5 overflow-y-auto flex-1 min-h-0">
          {/* 1. Dashboard (Direct) */}
          {hasRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.BARTENDER]) && (
            <button
              onClick={() => handleSubItemClick('dashboard')}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center px-0' : 'gap-3 px-3'
              } py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-primary text-text-inverse shadow-[0_4px_20px_rgba(141,108,229,0.3)] border-t border-t-white/10 scale-[1.01] active:scale-[0.98] font-black'
                  : 'text-text-muted hover:bg-bg-hover/60 hover:text-text-primary hover:scale-[1.01] active:scale-[0.98]'
              }`}
              title={collapsed ? 'Dashboard' : undefined}
            >
              <LayoutDashboard size={18} className={activeTab === 'dashboard' ? 'text-text-inverse' : 'text-text-muted'} />
              {!collapsed && <span>Dashboard</span>}
            </button>
          )}

          {/* 2. Reception (Direct) */}
          {hasRole([UserRole.ADMIN, UserRole.RECEPTIONIST]) && (
            <button
              onClick={() => handleSubItemClick('checkin')}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center px-0' : 'gap-3 px-3'
              } py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                activeTab === 'checkin'
                  ? 'bg-primary text-text-inverse shadow-[0_4px_20px_rgba(141,108,229,0.3)] border-t border-t-white/10 scale-[1.01] active:scale-[0.98] font-black'
                  : 'text-text-muted hover:bg-bg-hover/60 hover:text-text-primary hover:scale-[1.01] active:scale-[0.98]'
              }`}
              title={collapsed ? 'Reception' : undefined}
            >
              <UserCheck size={18} className={activeTab === 'checkin' ? 'text-text-inverse' : 'text-text-muted'} />
              {!collapsed && <span>Reception</span>}
            </button>
          )}

          {/* 3. Tables (Group) */}
          {renderGroup(groups.find(g => g.id === 'tables'))}

          {/* 4. Bartender (Group) */}
          {renderGroup(groups.find(g => g.id === 'bartender'))}

          {/* 5. Attendance (Direct) */}
          {hasRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST]) && (
            <button
              onClick={() => handleSubItemClick('quick_attendance')}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center px-0' : 'gap-3 px-3'
              } py-2.5 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer ${
                activeTab === 'quick_attendance'
                  ? 'bg-primary text-text-inverse shadow-[0_4px_20px_rgba(141,108,229,0.3)] border-t border-t-white/10 scale-[1.01] active:scale-[0.98] font-black'
                  : 'text-text-muted hover:bg-bg-hover/60 hover:text-text-primary hover:scale-[1.01] active:scale-[0.98]'
              }`}
              title={collapsed ? 'Attendance' : undefined}
            >
              <Camera size={18} className={activeTab === 'quick_attendance' ? 'text-text-inverse' : 'text-text-muted'} />
              {!collapsed && <span>Attendance</span>}
            </button>
          )}

          {/* 6. Administration (Group) */}
          {renderGroup(groups.find(g => g.id === 'administration'))}
        </nav>
      </div>

      <div className="p-3 border-t border-border shrink-0">
        {user && !collapsed && (
          <div className="mb-3 px-2">
            <p className="text-xs font-bold text-text-primary truncate">{user.fullName || user.username}</p>
            <p className="text-[10px] text-primary uppercase tracking-wider font-bold">{user.role}</p>
          </div>
        )}

        <button
          onClick={logout}
          className={`w-full flex items-center justify-center ${
            collapsed ? 'px-0' : 'gap-3 px-3'
          } py-2.5 rounded-xl text-xs font-bold primary-btn cursor-pointer`}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={18} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};
