import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  UserCheck, 
  Wine, 
  Grid3X3, 
  ShieldCheck, 
  ChevronLeft,
  ChevronRight,
  Camera,
  Settings,
  Martini
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
    if (activeTab.startsWith('tables')) {
      setOpenGroups(prev => ({ ...prev, tables: true }));
    } else if (activeTab.startsWith('bartender')) {
      setOpenGroups(prev => ({ ...prev, bartender: true }));
    } else if (activeTab.startsWith('admin')) {
      setOpenGroups(prev => ({ ...prev, administration: true }));
    }
  }, [activeTab]);

  const toggleGroup = (group: string) => {
    setCollapsed(false);
    const isOpen = openGroups[group];
    
    setOpenGroups(prev => ({
      ...prev,
      [group]: !isOpen
    }));

    if (!isOpen) {
      if (group === 'tables') {
        setActiveTab('tables/layout');
      } else if (group === 'bartender') {
        setActiveTab('bartender/orders');
      } else if (group === 'administration') {
        setActiveTab('admin/tables');
      }
    }
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
        { label: 'Table Layout', onClick: () => setActiveTab('tables/layout'), active: activeTab === 'tables/layout' },
        { label: 'Reservations', onClick: () => setActiveTab('tables/reservations'), active: activeTab === 'tables/reservations' }
      ]
    },
    {
      id: 'bartender',
      label: 'Bartender',
      icon: Wine,
      roles: [UserRole.ADMIN, UserRole.BARTENDER],
      subItems: [
        { label: 'Orders', onClick: () => setActiveTab('bartender/orders'), active: activeTab === 'bartender/orders' },
        { label: 'Queue', onClick: () => setActiveTab('bartender/queue'), active: activeTab === 'bartender/queue' }
      ]
    },
    {
      id: 'administration',
      label: 'Administration',
      icon: ShieldCheck,
      roles: [UserRole.ADMIN, UserRole.MANAGER],
      subItems: [
        { label: 'Table Floor', onClick: () => setActiveTab('admin/tables'), active: activeTab === 'admin/tables' },
        { label: 'Staff Directory', onClick: () => setActiveTab('admin/staff'), active: activeTab === 'admin/staff' },
        { label: 'Revenue Analytics', onClick: () => setActiveTab('admin/chart'), active: activeTab === 'admin/chart' },
        { label: 'Rate Cards', onClick: () => setActiveTab('admin/rates'), active: activeTab === 'admin/rates' },
        { label: 'Customer Sessions', onClick: () => setActiveTab('admin/customers'), active: activeTab === 'admin/customers' }
      ]
    }
  ];

  const renderNavButton = (id: string, label: string, Icon: any, allowedRoles: string[]) => {
    if (!hasRole(allowedRoles)) return null;
    const isActive = activeTab === id;
    
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center justify-between ${
          collapsed ? 'justify-center px-0' : 'px-3'
        } py-2.5 text-[13px] overflow-hidden premium-menu-item ${
          isActive ? 'active' : ''
        }`}
        title={collapsed ? label : undefined}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} relative z-10`}>
          <div className="nav-icon-badge">
            <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
          </div>
          {!collapsed && <span>{label}</span>}
        </div>
      </button>
    );
  };

  const renderGroup = (group: any) => {
    if (!group || !hasRole(group.roles)) return null;
    const GroupIcon = group.icon;
    const isGroupOpen = openGroups[group.id];
    
    const isGroupActive = 
      (group.id === 'tables' && activeTab.startsWith('tables')) ||
      (group.id === 'bartender' && activeTab.startsWith('bartender')) ||
      (group.id === 'administration' && activeTab.startsWith('admin'));
    
    return (
      <div key={group.id} className="space-y-1">
        <button
          onClick={() => toggleGroup(group.id)}
          className={`w-full flex items-center justify-between ${
            collapsed ? 'justify-center px-0' : 'px-3'
          } py-2 text-[13px] overflow-hidden premium-menu-item ${
            isGroupActive ? 'active' : ''
          }`}
          title={collapsed ? group.label : undefined}
        >
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} relative z-10`}>
            <div className="nav-icon-badge">
              <GroupIcon size={16} strokeWidth={isGroupActive ? 2.5 : 2} />
            </div>
            {!collapsed && <span>{group.label}</span>}
          </div>
          {!collapsed && (
            <ChevronRight 
              size={16} 
              className={`relative z-10 ${isGroupActive ? 'text-white/70' : 'text-text-muted'} transition-transform duration-200 ${isGroupOpen ? 'rotate-90' : ''}`} 
            />
          )}
        </button>

        {!collapsed && isGroupOpen && (
          <div className="pl-8 pr-2 py-1 space-y-1.5 animate-slideDown">
            {group.subItems.map((sub: any, idx: number) => (
              <button
                key={idx}
                onClick={sub.onClick}
                className={`w-full text-left py-2 px-3 text-[12px] cursor-pointer flex items-center justify-between glass-sub-menu-btn ${
                  sub.active ? 'active' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${sub.active ? 'bg-white shadow-[0_0_8px_#8D6CE5]' : 'bg-text-muted/40'}`} />
                  <span>{sub.label}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside 
      className={`h-[calc(100vh-2rem)] my-4 ml-4 bg-bg-sidebar border border-border-sidebar flex flex-col justify-between transition-all duration-300 z-30 rounded-[28px] shadow-[var(--shadow-glass)] backdrop-blur-[var(--blur-glass)] ${
        collapsed ? 'w-20' : 'w-[280px]'
      }`}
    >
      <div className="flex flex-col flex-1 min-h-0">
        {/* Logo Section */}
        <div className={`h-24 flex items-center justify-between shrink-0 pt-4 pb-2 w-full ${collapsed ? 'px-2' : 'px-5'}`}>
          {!collapsed ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full premium-logo-glow flex items-center justify-center shrink-0">
                  <Martini size={20} className="text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-text-primary text-sm tracking-wide">BAR SYSTEM</span>
                  <span className="text-[11px] text-text-muted font-medium">Management Portal</span>
                </div>
              </div>
              <button
                onClick={() => setCollapsed(true)}
                className="w-7 h-7 rounded-lg bg-white/60 dark:bg-white/10 flex items-center justify-center text-text-primary hover:bg-white dark:hover:bg-white/20 transition-colors shadow-sm border border-black/5 dark:border-white/5 cursor-pointer shrink-0"
                title="Minimize Sidebar"
              >
                <ChevronLeft size={14} />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between w-full gap-1">
              <div className="w-8 h-8 rounded-full premium-logo-glow flex items-center justify-center shrink-0">
                <Martini size={16} className="text-white" />
              </div>
              <button
                onClick={() => setCollapsed(false)}
                className="w-5.5 h-5.5 rounded-lg bg-white/60 dark:bg-white/10 flex items-center justify-center text-text-primary hover:bg-white dark:hover:bg-white/20 transition-colors shadow-sm border border-black/5 dark:border-white/5 cursor-pointer shrink-0"
                title="Expand Sidebar"
              >
                <ChevronRight size={12} />
              </button>
            </div>
          )}
        </div>

        <nav className="px-4 py-2 space-y-1 overflow-y-auto flex-1 min-h-0">
          {/* MAIN SECTION */}
          {!collapsed && (
            <div className="px-2 mb-2 mt-2 text-[10px] font-bold text-text-muted/70 tracking-widest uppercase">MAIN</div>
          )}
          
          {renderNavButton('dashboard', 'Dashboard', LayoutDashboard, [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST, UserRole.BARTENDER])}
          {renderNavButton('checkin', 'Reception', UserCheck, [UserRole.ADMIN, UserRole.RECEPTIONIST])}
          {renderGroup(groups.find(g => g.id === 'tables'))}
          {renderGroup(groups.find(g => g.id === 'bartender'))}
          
          {/* OTHER SECTION */}
          {!collapsed && (
            <div className="px-2 mb-2 mt-6 text-[10px] font-bold text-text-muted/70 tracking-widest uppercase">OTHER</div>
          )}

          {renderNavButton('quick_attendance', 'Attendance', Camera, [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECEPTIONIST])}
          {renderGroup(groups.find(g => g.id === 'administration'))}
          
          <button
            onClick={() => {}}
            className={`w-full flex items-center justify-between ${
              collapsed ? 'justify-center px-0' : 'px-3'
            } py-2 text-[13px] overflow-hidden premium-menu-item mt-1`}
            title={collapsed ? 'Settings' : undefined}
          >
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} relative z-10`}>
              <div className="nav-icon-badge">
                <Settings size={16} strokeWidth={2} />
              </div>
              {!collapsed && <span>Settings</span>}
            </div>
          </button>
        </nav>
      </div>

      <div className="shrink-0 pb-4">
        {/* User Profile / Logout */}
        {user && (
          <div className="px-4">
            <button
              onClick={logout}
              className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-colors cursor-pointer border border-transparent ${
                collapsed ? 'justify-center' : 'hover:bg-black/5 dark:hover:bg-white/5 hover:border-black/5 dark:hover:border-white/5'
              }`}
              title="Sign Out"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                {!collapsed && (
                  <div className="flex flex-col text-left">
                    <span className="text-[13px] font-bold text-text-primary flex items-center gap-1.5">
                      {user.fullName || user.username} 
                      <span className="text-white text-[9px] bg-[#2A85FF] w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-sm">✓</span>
                    </span>
                    <span className="text-[11px] text-text-muted capitalize font-medium">{user.role} Account</span>
                  </div>
                )}
              </div>
              {!collapsed && <ChevronRight size={16} className="text-text-muted" />}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
