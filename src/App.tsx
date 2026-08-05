import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CheckInPage } from './pages/CheckInPage';
import { QuickAttendanceWebPage } from './pages/QuickAttendanceWebPage';
import { BartenderPage } from './pages/BartenderPage';
import { TablesPage } from './pages/TablesPage';
import { AdminPage } from './pages/AdminPage';

const AppContent: React.FC = () => {
  const { user, toasts, dismissToast } = useAuth();
  const [activeTab, setActiveTabState] = useState<string>(() => {
    return localStorage.getItem('bar_web_active_tab') || 'dashboard';
  });
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    localStorage.setItem('bar_web_active_tab', tab);
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  if (!user) {
    return <LoginPage />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardPage 
            onNavigate={(tabId, adminSubtab) => {
              if (adminSubtab) {
                localStorage.setItem('bar_web_admin_subtab', adminSubtab);
                window.dispatchEvent(new Event('storage'));
              }
              setActiveTab(tabId);
            }} 
          />
        );
      case 'checkin':
        return <CheckInPage />;
      case 'quick_attendance':
        return <QuickAttendanceWebPage />;
      case 'bartender':
        return <BartenderPage />;
      case 'tables':
        return <TablesPage onNavigateToCheckIn={() => setActiveTab('checkin')} />;
      case 'admin':
        return <AdminPage />;
      default:
        return (
          <DashboardPage 
            onNavigate={(tabId, adminSubtab) => {
              if (adminSubtab) {
                localStorage.setItem('bar_web_admin_subtab', adminSubtab);
                window.dispatchEvent(new Event('storage'));
              }
              setActiveTab(tabId);
            }} 
          />
        );
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Executive Management Dashboard';
      case 'checkin': return 'Reception Check-In & Customer Registration';
      case 'quick_attendance': return 'FaceMark Quick Facial Attendance Kiosk';
      case 'bartender': return 'Bartender Drink Service Station';
      case 'tables': return 'Live Seating Floor Plan & Tables';
      case 'admin': return 'System Administration & Staff Portal';
      default: return 'Bar Management System';
    }
  };

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary font-sans overflow-hidden relative">
      {/* Ambient background orbs for glassmorphism */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] dark:bg-primary/5 bg-primary/10 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[55%] dark:bg-mint/5 bg-mint/8 rounded-full blur-[140px] pointer-events-none z-0" />

      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        <Header title={getTabTitle()} />
        
        <main className="p-6 flex-1 overflow-y-auto">
          {renderTabContent()}
        </main>
      </div>

      {/* Global Toast Alert Notifications Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg flex items-center justify-between border backdrop-blur-md transition-all ${
              toast.type === 'success'
                ? 'bg-status-success-bg border-status-success-border text-status-success'
                : toast.type === 'danger'
                ? 'bg-status-danger-bg border-status-danger-border text-status-danger'
                : 'bg-status-info-bg border-status-info-border text-status-info'
            }`}
          >
            <span className="text-xs font-semibold">{toast.message}</span>
            <button
              onClick={() => dismissToast(toast.id)}
              className="ml-4 text-xs opacity-70 hover:opacity-100 font-bold"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}
