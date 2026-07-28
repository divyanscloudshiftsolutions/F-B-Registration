import React from 'react';
import { 
  Activity, 
  Grid3X3, 
  Users, 
  BarChart3, 
  CreditCard, 
  DollarSign, 
  Settings, 
  Clock 
} from 'lucide-react';

export type AdminSubTab = 
  | 'live' 
  | 'tables' 
  | 'staff' 
  | 'chart' 
  | 'cards' 
  | 'rates' 
  | 'settings' 
  | 'customers';

interface AdminNavTabsProps {
  activeTab: AdminSubTab;
  setActiveTab: (tab: AdminSubTab) => void;
}

export const AdminNavTabs: React.FC<AdminNavTabsProps> = ({ activeTab, setActiveTab }) => {
  const tabs: { id: AdminSubTab; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: 'tables', label: 'Tables Floor Plan', icon: Grid3X3 },
    { id: 'staff', label: 'Staff Directory', icon: Users },
    { id: 'live', label: 'Live Dashboard', icon: Activity },
    { id: 'chart', label: 'Revenue Analytics', icon: BarChart3 },
    { id: 'cards', label: 'Smart Cards', icon: CreditCard },
    { id: 'rates', label: 'Rate Cards', icon: DollarSign },
    { id: 'customers', label: 'Customer Sessions', icon: Clock },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <div className="glass-panel p-2 rounded-2xl border border-white/10 flex flex-wrap gap-2">
      {tabs.map(t => {
        const Icon = t.icon;
        const isSel = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              isSel
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#F5E08B] text-black shadow-lg shadow-[#D4AF37]/20 font-black'
                : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={16} className={isSel ? 'text-black' : 'text-gray-400'} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};
