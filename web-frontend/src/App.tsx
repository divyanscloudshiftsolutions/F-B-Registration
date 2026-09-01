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
import { DemoHubPage } from './pages/DemoHubPage';
import { AlertTriangle, X } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, toasts, dismissToast, isLoading } = useAuth();
  const { sessionAlerts, dismissAlert, refreshAll } = useData();
  const [isGlobalRefreshing, setIsGlobalRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTabState] = useState<string>(() => {
    return localStorage.getItem('bar_web_active_tab') || 'dashboard';
  });

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    localStorage.setItem('bar_web_active_tab', tab);
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const handleGlobalRefresh = async () => {
    if (isGlobalRefreshing) return;
    setIsGlobalRefreshing(true);
    const start = Date.now();
    try {
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
    if (!isLoading && !user) {
      setActiveTabState('dashboard');
      localStorage.setItem('bar_web_active_tab', 'dashboard');
    }
  }, [user, isLoading]);

  // Handle Customer and Demo Hub Paths
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/t/') || pathname.startsWith('/customer')) {
      return <CustomerApp />;
    }
    if (pathname === '/demo') {
      return <DemoHubPage />;
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
    return <LoginPage />;
  }

  // Handle direct authenticated URL routes
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/staff') || pathname === '/waiter') {
      return <WaiterStationPage />;
    }
    if (pathname === '/kds' || pathname === '/kds/kitchen' || pathname === '/kds_kitchen') {
      return <KitchenKDSPage />;
    }
    if (pathname === '/kds/bar' || pathname === '/kds_bar') {
      return <BarKDSPage />;
    }
  }

  const userRole = user?.role ? String(user.role).toLowerCase() : '';

  const renderTabContent = () => {
    // Dedicated Chef View
    if (userRole === 'chef') {
      return <KitchenKDSPage />;
    }

    // Dedicated Waiter / Server View
    if (userRole === 'waiter' || userRole === 'server') {
      return <WaiterStationPage />;
    }

    if (activeTab.startsWith('waiter')) {
      return <WaiterStationPage />;
    }

    if (activeTab === 'kds_kitchen') {
      if (userRole === 'admin' || userRole === 'manager' || userRole === 'chef') {
        return <KitchenKDSPage />;
      }
      return (
        <div className="p-8 text-center text-text-muted">
          <p className="text-sm font-bold text-red-400">Access Denied: Kitchen KDS is restricted to Chefs and Managers.</p>
        </div>
      );
    }
    if (activeTab === 'kds_bar') {
      if (userRole === 'admin' || userRole === 'manager' || userRole === 'bartender') {
        return <BarKDSPage />;
      }
      return (
        <div className="p-8 text-center text-text-muted">
          <p className="text-sm font-bold text-red-400">Access Denied: Bar KDS is restricted to Bartenders and Managers.</p>
        </div>
      );
    }
    if (activeTab === 'dashboard') {
      if (userRole === 'bartender' || userRole === 'chef' || userRole === 'waiter') {
        return (
          <div className="p-8 text-center text-text-muted">
            <p className="text-sm font-bold text-red-400">Access Denied: Dashboard is restricted to Receptionists, Managers, and Admins.</p>
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
      if (userRole === 'bartender' || userRole === 'chef' || userRole === 'waiter') {
        return (
          <div className="p-8 text-center text-text-muted">
            <p className="text-sm font-bold text-red-400">Access Denied: Check-In is restricted to Receptionists and Admins.</p>
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
            <p className="text-sm font-bold text-red-400">Access Denied: Bartender operations are restricted to Bartenders and Managers.</p>
          </div>
        );
      }
      return <BartenderPage activeTab={activeTab} setActiveTab={setActiveTab} />;
    }
    if (activeTab.startsWith('tables')) {
      if (userRole === 'chef') {
        return (
          <div className="p-8 text-center text-text-muted">
            <p className="text-sm font-bold text-red-400">Access Denied.</p>
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
            <p className="text-sm font-bold text-red-400">Access Denied: Administration is restricted to Administrators and Managers.</p>
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
    if (activeTab === 'kds_kitchen') return 'Kitchen KDS Food Preparation';
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
    <div className="flex h-[100dvh] dark:bg-gradient-to-br dark:from-[#141225] dark:via-[#1A1333] dark:to-[#080612] bg-gradient-to-br from-[#F5F3FA] via-[#FAF9FF] to-[#EDE9FE] text-text-primary font-sans overflow-hidden relative">
      {/* Multi-Layer Atmospheric Ambient Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[15%] -left-[10%] w-[45%] h-[55%] dark:bg-[radial-gradient(circle,rgba(241,147,7,0.06)_0%,transparent_70%)] bg-[radial-gradient(circle,rgba(241,147,7,0.04)_0%,transparent_70%)] rounded-full blur-[130px] animate-ambient-slow-1" />
        <div className="absolute -top-[20%] right-[15%] w-[50%] h-[60%] dark:bg-[radial-gradient(circle,rgba(141,108,229,0.16)_0%,transparent_70%)] bg-[radial-gradient(circle,rgba(141,108,229,0.12)_0%,transparent_70%)] rounded-full blur-[140px] animate-ambient-slow-2" />
        <div className="absolute top-[25%] right-[5%] w-[40%] h-[50%] dark:bg-[radial-gradient(circle,rgba(99,102,241,0.10)_0%,transparent_70%)] bg-[radial-gradient(circle,rgba(99,102,241,0.06)_0%,transparent_70%)] rounded-full blur-[150px] animate-ambient-slow-1" />
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
        {sessionAlerts.length > 0 && (
          <div className="px-4 py-2 space-y-1.5 z-50 shrink-0">
            {sessionAlerts.map(alert => (
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

        <main className="flex-1 overflow-y-auto px-2 sm:px-4 md:px-6 py-2 sm:py-4 relative z-0">
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
