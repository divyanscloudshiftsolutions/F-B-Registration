import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CheckInPage } from './pages/CheckInPage';
import { BartenderPage } from './pages/BartenderPage';
import { TablesPage } from './pages/TablesPage';
import { AdminPage } from './pages/AdminPage';

const AppContent: React.FC = () => {
  const { user, toasts, dismissToast } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
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
      case 'bartender':
        return <BartenderPage />;
      case 'tables':
        return <TablesPage />;
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
      case 'bartender': return 'Bartender Drink Service Station';
      case 'tables': return 'Live Seating Floor Plan & Tables';
      case 'admin': return 'Staff Administration & System Config';
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
        {/* Sticky System Header */}
        <Header title={getTabTitle()} />

        {/* Page Body Container */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {renderTabContent()}
        </main>
      </div>

      {/* Global Toast Notifications Container */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            onClick={() => dismissToast(toast.id)}
            className={`pointer-events-auto p-4 rounded-2xl border backdrop-blur-xl shadow-xl flex items-center justify-between transition-all cursor-pointer ${
              toast.type === 'success'
                ? 'bg-emerald-900/80 border-emerald-500/40 text-emerald-200'
                : toast.type === 'danger'
                ? 'bg-red-900/80 border-red-500/40 text-red-200'
                : toast.type === 'warning'
                ? 'bg-amber-900/80 border-amber-500/40 text-amber-200'
                : 'bg-blue-900/80 border-blue-500/40 text-blue-200'
            }`}
          >
            <span className="text-xs font-semibold">{toast.message}</span>
            <span className="text-xs opacity-60 ml-2">×</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
