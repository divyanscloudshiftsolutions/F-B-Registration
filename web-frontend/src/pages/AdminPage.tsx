import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AdminNavTabs, type AdminSubTab } from '../components/admin/AdminNavTabs';
import { TableManagement } from '../components/admin/TableManagement';
import { StaffManagement } from '../components/admin/StaffManagement';
import { LiveDashboard } from '../components/admin/LiveDashboard';
import { RevenueAnalyticsChart } from '../components/admin/RevenueAnalyticsChart';
import { SmartCardInventory } from '../components/admin/SmartCardInventory';
import { RateManagement } from '../components/admin/RateManagement';
import { SystemSettingsConfig } from '../components/admin/SystemSettingsConfig';
import { CustomerSessionsManager } from '../components/admin/CustomerSessionsManager';

export const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminSubTab>('tables');

  // Role Security Check matching NfcBarContext.tsx
  const userRole = user?.role ? user.role.toLowerCase() : '';
  const isAdmin = userRole === 'admin';

  if (!isAdmin) {
    return (
      <div className="glass-panel p-8 rounded-3xl border border-red-500/30 text-center space-y-4 max-w-md mx-auto my-12">
        <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 flex items-center justify-center mx-auto text-2xl">
          <ShieldAlert size={36} />
        </div>
        <h3 className="text-xl font-bold text-red-400">Access Restricted</h3>
        <p className="text-xs text-gray-300">
          The System Administration & Staff Portal is restricted strictly to Administrator shift accounts.
        </p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'tables':
        return <TableManagement />;
      case 'staff':
        return <StaffManagement />;
      case 'live':
        return <LiveDashboard />;
      case 'chart':
        return <RevenueAnalyticsChart />;
      case 'cards':
        return <SmartCardInventory />;
      case 'rates':
        return <RateManagement />;
      case 'customers':
        return <CustomerSessionsManager />;
      case 'settings':
        return <SystemSettingsConfig />;
      default:
        return <TableManagement />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tab Navigation Bar */}
      <AdminNavTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Sub-Tab Active Module */}
      <div>{renderTabContent()}</div>
    </div>
  );
};
