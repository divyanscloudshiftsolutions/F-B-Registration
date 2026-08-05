import React from 'react';
import { 
  Grid3X3, 
  Users, 
  BarChart3, 
  DollarSign, 
  Clock 
} from 'lucide-react';

export type AdminSubTab = 
  | 'tables' 
  | 'staff' 
  | 'chart' 
  | 'rates' 
  | 'customers';

interface AdminNavTabsProps {
  activeTab: AdminSubTab;
  setActiveTab: (tab: AdminSubTab) => void;
}

export const AdminNavTabs: React.FC<AdminNavTabsProps> = ({ activeTab, setActiveTab }) => {
  const tabs: { id: AdminSubTab; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: 'tables', label: 'Tables Floor Plan', icon: Grid3X3 },
    { id: 'staff', label: 'Staff Directory', icon: Users },
    { id: 'chart', label: 'Revenue Analytics', icon: BarChart3 },
    { id: 'rates', label: 'Rate Cards', icon: DollarSign },
    { id: 'customers', label: 'Customer Sessions', icon: Clock },
  ];

  return (
    <div className="glass-panel p-2 rounded-2xl flex flex-wrap gap-2">
      {tabs.map(t => {
        const Icon = t.icon;
        const isSel = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
              isSel
                ? 'bg-primary text-text-inverse shadow-md shadow-primary/25'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
          >
            <Icon size={16} className={isSel ? 'text-text-inverse' : 'text-text-muted group-hover:text-text-primary'} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};
