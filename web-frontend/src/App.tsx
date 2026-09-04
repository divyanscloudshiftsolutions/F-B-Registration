import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CheckInPage } from './pages/CheckInPage';
import { QuickAttendanceWebPage } from './pages/QuickAttendanceWebPage';
import { BartenderPage } from './pages/BartenderPage';
import { TablesPage } from './pages/TablesPage';
import { AdminPage } from './pages/AdminPage';
import { KitchenKDSPage } from './pages/KitchenKDSPage';
import { BarKDSPage } from './pages/BarKDSPage';
import { WaiterStationPage } from './pages/WaiterStationPage';
import { CustomerApp } from './pages/CustomerApp';
import { CustomerLandingPage } from './pages/CustomerLandingPage';
import { CustomerAccessPage } from './pages/CustomerAccessPage';
import { TableDisplayPage } from './pages/TableDisplayPage';
import { AlertTriangle, X } from 'lucide-react';

const isValidAppPath = (pathname: string): boolean => {
  if (pathname === '/' || pathname === '/login') return true;
  if (pathname.startsWith('/customer') || pathname.startsWith('/t/')) return true;
  if (pathname.startsWith('/table/') || pathname.startsWith('/display/')) return true;
  if (pathname === '/dashboard' || pathname === '/checkin' || pathname === '/quick_attendance' || pathname === '/attendance') return true;
  if (pathname.startsWith('/tables') || pathname.startsWith('/bartender') || pathname.startsWith('/admin')) return true;
  if (pathname.startsWith('/kds') || pathname.startsWith('/waiter') || pathname.startsWith('/staff')) return true;
  return false;
};

const getDefaultTabForRole = (role?: string): { tab: string; path: string } => {
  const r = (role || '').toLowerCase();
  if (r === 'receptionist') return { tab: 'checkin', path: '/checkin' };
  if (r === 'bartender') return { tab: 'bartender/checkins', path: '/bartender' };
  if (r === 'chef') return { tab: 'kds_kitchen', path: '/kds/kitchen' };
  if (r === 'waiter' || r === 'server') return { tab: 'waiter_tables', path: '/waiter' };
  return { tab: 'dashboard', path: '/dashboard' };
};

const getTabFromPathname = (pathname: string): string => {
  if (pathname === '/checkin') return 'checkin';
  if (pathname === '/admin/menu') return 'admin/menu';
  if (pathname === '/admin/staff') return 'admin/staff';
  if (pathname === '/admin/rates') return 'admin/rates';
  if (pathname === '/admin/chart') return 'admin/chart';
  if (pathname === '/admin/customers') return 'admin/customers';
  if (pathname === '/admin/tables' || pathname === '/admin' || pathname.startsWith('/admin')) return 'admin/tables';
  if (pathname === '/tables/reservations') return 'tables/reservations';
  if (pathname === '/tables/layout' || pathname === '/tables' || pathname.startsWith('/tables')) return 'tables/layout';
  if (pathname === '/bartender/scan') return 'bartender/scan';
  if (pathname === '/bartender/checkins' || pathname === '/bartender' || pathname.startsWith('/bartender')) return 'bartender/checkins';
  if (pathname === '/waiter/tables') return 'waiter_tables';
  if (pathname === '/waiter/requests') return 'waiter_requests';
  if (pathname === '/waiter/ready') return 'waiter_ready';
  if (pathname === '/waiter/bills') return 'waiter_bills';
  if (pathname === '/waiter' || pathname.startsWith('/waiter') || pathname.startsWith('/staff')) return 'waiter_tables';
  if (pathname === '/quick_attendance' || pathname === '/attendance') return 'quick_attendance';
  if (pathname === '/kds/kitchen' || pathname === '/kds_kitchen' || pathname === '/kds') return 'kds_kitchen';
  if (pathname === '/kds/bar' || pathname === '/kds_bar') return 'kds_bar';
  if (pathname === '/dashboard' || pathname === '/') return 'dashboard';
  return '';
};

const AppContent: React.FC = () => {
  const { user, toasts, dismissToast, isLoading } = useAuth();
  const { sessionAlerts, dismissAlert, refreshAll } = useData();
  const [isGlobalRefreshing, setIsGlobalRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTabState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (isValidAppPath(p)) {
        const tabFromPath = getTabFromPathname(p);
        if (tabFromPath) return tabFromPath;
      }
    }
    return localStorage.getItem('bar_web_active_tab') || 'dashboard';
  });

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    localStorage.setItem('bar_web_active_tab', tab);
    if (typeof window !== 'undefined') {
      const route = tab === 'dashboard' ? '/dashboard' 
        : tab === 'checkin' ? '/checkin'
        : tab === 'kds' || tab === 'kds_kitchen' ? '/kds/kitchen'
        : tab === 'kds_bar' ? '/kds/bar'
        : tab === 'quick_attendance' ? '/quick_attendance'
        : tab === 'waiter_tables' ? '/waiter/tables'
        : tab === 'waiter_requests' ? '/waiter/requests'
        : tab === 'waiter_ready' ? '/waiter/ready'
        : tab === 'waiter_bills' ? '/waiter/bills'
        : tab.startsWith('waiter') ? '/waiter'
        : tab === 'tables/reservations' ? '/tables/reservations'
        : tab.startsWith('tables') ? '/tables/layout'
        : tab === 'bartender/scan' ? '/bartender/scan'
        : tab.startsWith('bartender') ? '/bartender/checkins'
        : tab.startsWith('admin') ? `/${tab}`
        : `/${tab}`;
      if (window.location.pathname !== route && !window.location.pathname.startsWith('/t/') && !window.location.pathname.startsWith('/customer')) {
        window.history.pushState(null, '', route);
      }
    }
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const handleGlobalRefresh = async () => {
    if (isGlobalRefreshing) return;
    setIsGlobalRefreshing(true);
    const start = Date.now();
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:global-refresh'));
      }
      await refreshAll();
    } finally {
      const elapsed = Date.now() - start;
      const delay = Math.max(0, 500 - elapsed);
      setTimeout(() => setIsGlobalRefreshing(false), delay);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const p = window.location.pathname;
        if (!isValidAppPath(p)) {
          if (!user) {
            window.history.replaceState(null, '', '/');
          } else {
            const def = getDefaultTabForRole(user?.role);
            window.history.replaceState(null, '', def.path);
            setActiveTabState(def.tab);
          }
          return;
        }
        const tab = getTabFromPathname(p);
        if (tab) {
          setActiveTabState(tab);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user]);

  useEffect(() => {
    if (!isLoading) {
      if (typeof window !== 'undefined') {
        const p = window.location.pathname;
        if (!user) {
          if (p !== '/' && p !== '/login' && !p.startsWith('/customer') && !p.startsWith('/t/') && !p.startsWith('/table/') && !p.startsWith('/display/')) {
            window.history.replaceState(null, '', '/login');
          }
          setActiveTabState('dashboard');
          localStorage.setItem('bar_web_active_tab', 'dashboard');
        } else {
          // If on landing or login route upon authentication, redirect immediately to role default
          if (p === '/' || p === '/login') {
            const def = getDefaultTabForRole(user?.role);
            window.history.replaceState(null, '', def.path);
            setActiveTabState(def.tab);
            localStorage.setItem('bar_web_active_tab', def.tab);
          } else if (!isValidAppPath(p)) {
            const def = getDefaultTabForRole(user?.role);
            window.history.replaceState(null, '', def.path);
            setActiveTabState(def.tab);
            localStorage.setItem('bar_web_active_tab', def.tab);
          } else {
            const tabFromPath = getTabFromPathname(p);
            if (tabFromPath) {
              setActiveTabState(tabFromPath);
              localStorage.setItem('bar_web_active_tab', tabFromPath);
            }
          }
        }
      }
    }
  }, [user, isLoading]);

  // Determine standalone routes that bypass standard Staff App Shell
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;

    // 1. Direct short URL Token Verification (e.g. /t/BAR-20260902-12345)
    if (pathname.startsWith('/t/')) {
      return <CustomerAccessPage />;
    }

    // 2. Direct Customer Access Gateway (e.g. /customer/access/BAR-20260902-12345)
    if (pathname.startsWith('/customer/access/')) {
      return <CustomerAccessPage />;
    }

    // 3. Customer App Routes (e.g. /customer/home, /customer/cart, /customer/eat, etc.)
    if (pathname.startsWith('/customer')) {
      const activeToken = localStorage.getItem('bar_active_token');
      if (activeToken) {
        return <CustomerApp />;
      }
      return <CustomerLandingPage />;
    }

    // 4. Physical Table Display (Isolated / Internal Table Terminal)
    if (pathname.startsWith('/table/') || pathname.startsWith('/display/')) {
      return <TableDisplayPage />;
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center dark:bg-[#141225] bg-[#F5F3FA] text-text-main font-bold">
        <div className="text-sm text-text-muted">Loading session...</div>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== 'undefined' && (window.location.pathname === '/' || window.location.pathname === '')) {
      return <CustomerLandingPage />;
    }
    return <LoginPage />;
  }

  const userRole = user?.role ? String(user.role).toLowerCase() : '';

  const renderTabContent = () => {
    // Dedicated Chef View
    if (userRole === 'chef') {
      if (activeTab === 'quick_attendance') return <QuickAttendanceWebPage />;
      return <KitchenKDSPage />;
    }

    // Dedicated Waiter / Server View
    if (userRole === 'waiter' || userRole === 'server') {
      if (activeTab === 'quick_attendance') return <QuickAttendanceWebPage />;
      const sub = activeTab.replace('waiter_', '').replace('waiter', '') as any;
      const waiterTab = ['overview', 'tables', 'requests', 'ready', 'bills'].includes(sub) ? sub : 'overview';
      return <WaiterStationPage initialTab={waiterTab} onTabChange={(tab) => setActiveTab(`waiter_${tab}`)} />;
    }

    if (activeTab.startsWith('waiter')) {
      if (userRole !== 'admin' && userRole !== 'manager' && userRole !== 'waiter' && userRole !== 'server') {
        return (
          <div className="p-8 text-center text-text-muted">
            <p className="text-sm font-bold text-red-400">Access Denied: Waiter Station is restricted to Servers, Managers, and Administrators.</p>
          </div>
        );
      }
      const sub = activeTab.replace('waiter_', '').replace('waiter', '') as any;
      const waiterTab = ['overview', 'tables', 'requests', 'ready', 'bills'].includes(sub) ? sub : 'overview';
      return <WaiterStationPage initialTab={waiterTab} onTabChange={(tab) => setActiveTab(`waiter_${tab}`)} />;
    }

    if (activeTab === 'kds' || activeTab === 'kds_kitchen') {
      if (userRole === 'admin' || userRole === 'manager' || userRole === 'chef') {
        return <KitchenKDSPage />;
      }
      return (
        <div className="p-8 text-center text-text-muted">
          <p className="text-sm font-bold text-red-400">Access Denied: Kitchen KDS is restricted to Chefs, Managers, and Administrators.</p>
        </div>
      );
    }
    if (activeTab === 'kds_bar') {
      if (userRole === 'admin' || userRole === 'manager' || userRole === 'bartender') {
        return <BarKDSPage />;
      }
      return (
        <div className="p-8 text-center text-text-muted">
          <p className="text-sm font-bold text-red-400">Access Denied: Bar KDS is restricted to Bartenders, Managers, and Administrators.</p>
        </div>
      );
    }
    if (activeTab === 'dashboard') {
      if (userRole !== 'admin' && userRole !== 'manager') {
        return (
          <div className="p-8 text-center text-text-muted">
            <p className="text-sm font-bold text-red-400">Access Denied: Executive Dashboard is restricted strictly to Managers and Administrators.</p>
          </div>
        );
      }
      return (
        <DashboardPage 
          onNavigate={(tabId, adminSubtab) => {
            if (tabId === 'admin' && adminSubtab) {
              setActiveTab(`admin/${adminSubtab}`);
            } else if (tabId === 'tables') {
              setActiveTab('tables/layout');
            } else {
              setActiveTab(tabId);
            }
          }} 
        />
      );
    }
    if (activeTab === 'checkin') {
      if (userRole !== 'admin' && userRole !== 'manager' && userRole !== 'receptionist') {
        return (
          <div className="p-8 text-center text-text-muted">
            <p className="text-sm font-bold text-red-400">Access Denied: Check-In is restricted to Receptionists, Managers, and Administrators.</p>
          </div>
        );
      }
      return <CheckInPage />;
    }
    if (activeTab === 'quick_attendance') {
      return <QuickAttendanceWebPage />;
    }
    if (activeTab.startsWith('bartender')) {
      if (userRole !== 'admin' && userRole !== 'manager' && userRole !== 'bartender') {
        return (
          <div className="p-8 text-center text-text-muted">
            <p className="text-sm font-bold text-red-400">Access Denied: Bartender operations are restricted to Bartenders, Managers, and Administrators.</p>
          </div>
        );
      }
      return <BartenderPage activeTab={activeTab} setActiveTab={setActiveTab} />;
    }
    if (activeTab.startsWith('tables')) {
      if (userRole === 'chef' || userRole === 'bartender') {
        return (
          <div className="p-8 text-center text-text-muted">
            <p className="text-sm font-bold text-red-400">Access Denied: Floor tables layout is restricted to Receptionists, Waiters, Managers, and Administrators.</p>
          </div>
        );
      }
      return (
        <TablesPage 
          onNavigateToCheckIn={() => setActiveTab('checkin')} 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      );
    }
    if (activeTab.startsWith('admin')) {
      if (userRole !== 'admin' && userRole !== 'manager') {
        return (
          <div className="p-8 text-center text-text-muted">
            <p className="text-sm font-bold text-red-400">Access Denied: Administration is restricted strictly to Administrators and Managers.</p>
          </div>
        );
      }
      return <AdminPage activeTab={activeTab} setActiveTab={setActiveTab} />;
    }
    return (
      <DashboardPage 
        onNavigate={(tabId, adminSubtab) => {
          if (tabId === 'admin' && adminSubtab) {
            setActiveTab(`admin/${adminSubtab}`);
          } else if (tabId === 'tables') {
            setActiveTab('tables/layout');
          } else {
            setActiveTab(tabId);
          }
        }} 
      />
    );
  };

  const getTabTitle = () => {
    if (activeTab === 'kds' || activeTab === 'kds_kitchen') return 'Kitchen KDS Food Preparation';
    if (activeTab === 'kds_bar') return 'Bar KDS Beverage Station';
    if (activeTab.startsWith('waiter')) return 'Waiter Floor Service Station';
    if (activeTab === 'dashboard') return 'Executive Management Dashboard';
    if (activeTab === 'checkin') return 'Reception Check-In & Customer Registration';
    if (activeTab === 'quick_attendance') return 'Quick Facial Attendance Kiosk';
    if (activeTab.startsWith('bartender')) return 'Bartender Drink Service Station';
    if (activeTab.startsWith('tables')) return 'Live Seating Floor Plan & Tables';
    if (activeTab.startsWith('admin')) return 'System Administration & Staff Portal';
    return 'TableFlow Operations';
  };

  return (
    <div className="flex h-[100dvh] dark:bg-gradient-to-br dark:from-[#111114] dark:via-[#161619] dark:to-[#0A0A0C] bg-gradient-to-br from-[#F8F9FA] via-[#FFFFFF] to-[#F1F3F5] text-text-primary font-sans overflow-hidden relative">
      {/* Multi-Layer Atmospheric Ambient Background (Neutral non-purple depth) */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[15%] -left-[10%] w-[45%] h-[55%] dark:bg-[radial-gradient(circle,rgba(241,147,7,0.06)_0%,transparent_70%)] bg-[radial-gradient(circle,rgba(0,0,0,0.02)_0%,transparent_70%)] rounded-full blur-[130px] animate-ambient-slow-1" />
        <div className="absolute -top-[20%] right-[15%] w-[50%] h-[60%] dark:bg-[radial-gradient(circle,rgba(212,175,55,0.12)_0%,transparent_70%)] bg-[radial-gradient(circle,rgba(0,0,0,0.02)_0%,transparent_70%)] rounded-full blur-[140px] animate-ambient-slow-2" />
        <div className="absolute top-[25%] right-[5%] w-[40%] h-[50%] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.03)_0%,transparent_70%)] bg-[radial-gradient(circle,rgba(0,0,0,0.01)_0%,transparent_70%)] rounded-full blur-[150px] animate-ambient-slow-1" />
      </div>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        collapsed={sidebarCollapsed} 
        setCollapsed={setSidebarCollapsed} 
      />

      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden relative z-10">
        <Header 
          title={getTabTitle()} 
          onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onRefresh={handleGlobalRefresh}
          isRefreshing={isGlobalRefreshing}
        />

        {/* Global Urgent Session Alert Toast Bar */}
        {sessionAlerts.filter(alert => !alert.dismissed).length > 0 && (
          <div className="px-4 py-2 space-y-1.5 z-50 shrink-0">
            {sessionAlerts.filter(alert => !alert.dismissed).map(alert => (
              <div 
                key={alert.id}
                className="p-3 rounded-2xl flex items-center justify-between shadow-lg backdrop-blur-md border animate-bounce-short text-xs font-bold dark:bg-amber-500/20 bg-amber-50 border-amber-500/40 dark:text-amber-300 text-amber-700"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span>{alert.message}</span>
                </div>
                <button 
                  onClick={() => dismissAlert(alert.id)}
                  className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-2 sm:px-4 md:px-6 py-2 sm:py-4 relative">
          {renderTabContent()}
        </main>
      </div>

      {/* Global Toast Messages */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`p-3.5 rounded-2xl shadow-xl border pointer-events-auto flex items-center justify-between text-xs font-bold animate-slide-up backdrop-blur-md ${
              (toast.type as string) === 'success' 
                ? 'dark:bg-emerald-950/80 bg-emerald-50 border-emerald-500/30 dark:text-emerald-300 text-emerald-800'
                : (toast.type as string) === 'danger' || (toast.type as string) === 'error'
                ? 'dark:bg-rose-950/80 bg-rose-50 border-rose-500/30 dark:text-rose-300 text-rose-800'
                : 'dark:bg-indigo-950/80 bg-indigo-50 border-indigo-500/30 dark:text-indigo-300 text-indigo-800'
            }`}
          >
            <span>{toast.message}</span>
            <button 
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 ml-2"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
};

export default App;
