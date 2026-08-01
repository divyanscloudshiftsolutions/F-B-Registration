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
    return localStorage.getItem('nfc_web_active_tab') || 'dashboard';
  });
  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    localStorage.setItem('nfc_web_active_tab', tab);
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  if (!user) {
    return <LoginPage />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
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
        return <DashboardPage />;
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
      default: return 'NFC Bar Management System';
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0A0C10] text-gray-100 font-sans">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
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
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl flex items-center justify-between border backdrop-blur-md transition-all animate-bounce-short ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : toast.type === 'danger'
                ? 'bg-red-950/90 border-red-500/50 text-red-200'
                : 'bg-blue-950/90 border-blue-500/50 text-blue-200'
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
