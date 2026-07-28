import React, { useState, useEffect } from 'react';
import { BarChart3, Download, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import type { Token } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const RevenueAnalyticsChart: React.FC = () => {
  const { showToast } = useAuth();
  const [tokens, setTokens] = useState<Token[]>([]);

  const loadData = async () => {
    try {
      const data = await api.getActiveTokens();
      setTokens(data);
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Hourly Breakdown matching AdminPortal.tsx:L309
  const hourlyData = [
    { hour: '6 PM', amount: 12500 },
    { hour: '7 PM', amount: 24200 },
    { hour: '8 PM', amount: 41800 },
    { hour: '9 PM', amount: 62500 },
    { hour: '10 PM', amount: 94800, peak: true },
    { hour: '11 PM', amount: 82100 },
    { hour: '12 AM', amount: 58000 },
    { hour: '1 AM', amount: 31200 },
  ];

  const maxVal = Math.max(...hourlyData.map(d => d.amount));

  const handleExportCSV = () => {
    try {
      const headers = 'TokenNumber,CustomerName,PhoneNumber,Persons,RedemptionsUsed,TotalRedemptions,DeliveryMode,AmountPaid,Status\n';
      const rows = tokens.map(t => 
        `"${t.tokenNumber}","${t.customer?.name || ''}","${t.customer?.phoneNumber || ''}",${t.personsCount},${t.redemptionsUsed},${t.totalRedemptionsAllowed},"${t.deliveryMode}",${t.amountPaid || 0},"${t.status}"`
      ).join('\n');

      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `sessions_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Sessions export CSV downloaded successfully!', 'success');
    } catch (err: any) {
      showToast('Failed to export CSV logs.', 'danger');
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-white/10">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Revenue Analytics & Sales Summary</h3>
          <p className="text-xs text-gray-400">Peak hour analysis and financial collections</p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 rounded-xl gold-gradient-btn text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-lg"
        >
          <Download size={16} /> Export Sessions CSV
        </button>
      </div>

      {/* Hourly Sales Bar Chart Component */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-sm">
            <BarChart3 size={18} /> Hourly Revenue Breakdown & Peak Collections
          </div>
          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
            <TrendingUp size={14} /> Peak Hour: 10:00 PM (₹94,800)
          </span>
        </div>

        <div className="pt-4 pb-2 flex items-end justify-between gap-3 h-56 px-2">
          {hourlyData.map(d => {
            const heightPercent = Math.round((d.amount / maxVal) * 100);
            return (
              <div key={d.hour} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[10px] font-mono text-gray-300 font-bold">₹{(d.amount / 1000).toFixed(1)}k</span>
                <div 
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-xl transition-all duration-500 ${
                    d.peak 
                      ? 'bg-gradient-to-t from-[#D4AF37] to-[#F5E08B] shadow-lg shadow-[#D4AF37]/30' 
                      : 'bg-white/15 hover:bg-white/25'
                  }`}
                />
                <span className={`text-[10px] font-bold ${d.peak ? 'text-[#D4AF37]' : 'text-gray-400'}`}>{d.hour}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
