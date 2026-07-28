import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Grid3X3, 
  Wine, 
  DollarSign, 
  TrendingUp 
} from 'lucide-react';
import { api } from '../services/api';
import type { Token, Table } from '../types';
import { useAuth } from '../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { showToast } = useAuth();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tokenData, tableData] = await Promise.all([
        api.getActiveTokens(),
        api.getTables(),
      ]);
      setTokens(tokenData);
      setTables(tableData);
    } catch (err: any) {
      showToast(err.message || 'Failed to load dashboard metrics.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeTokensCount = tokens.length;
  const occupiedTablesCount = tables.filter(t => t.status === 'occupied').length;
  const totalCapacity = tables.reduce((acc, t) => acc + t.capacity, 0);
  const totalGuestsInHouse = tokens.reduce((acc, tk) => acc + tk.personsCount, 0);
  const totalRedemptionsUsed = tokens.reduce((acc, tk) => acc + tk.redemptionsUsed, 0);
  const totalRevenue = tokens.reduce((acc, tk) => acc + (tk.amountPaid || 0), 0);

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-[#D4AF37]">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Guest Sessions</p>
            <h3 className="text-2xl font-black text-white mt-1">{activeTokensCount}</h3>
            <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp size={12} /> {totalGuestsInHouse} Total Guests In-House
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Seating Occupancy</p>
            <h3 className="text-2xl font-black text-white mt-1">{occupiedTablesCount} / {tables.length}</h3>
            <p className="text-[11px] text-gray-400 mt-1">
              Floor Capacity: {totalCapacity} Seats
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
            <Grid3X3 size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Drink Redemptions</p>
            <h3 className="text-2xl font-black text-white mt-1">{totalRedemptionsUsed}</h3>
            <p className="text-[11px] text-amber-400 mt-1">Active Drinks Served Today</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
            <Wine size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Session Revenue</p>
            <h3 className="text-2xl font-black text-white mt-1">₹{totalRevenue.toLocaleString()}</h3>
            <p className="text-[11px] text-blue-400 mt-1">Verified Gate Payments</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center font-bold">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* Active Guest Sessions Table */}
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Live Customer Sessions</h3>
            <p className="text-xs text-gray-400">Real-time NFC & QR active seating tickets</p>
          </div>
          <button 
            onClick={loadData}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition-colors border border-white/10"
          >
            Refresh List
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading live session data...</div>
        ) : tokens.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">No active customer sessions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="pb-3 px-3">Token #</th>
                  <th className="pb-3 px-3">Customer</th>
                  <th className="pb-3 px-3">Phone</th>
                  <th className="pb-3 px-3">Persons</th>
                  <th className="pb-3 px-3">Redemptions</th>
                  <th className="pb-3 px-3">Mode</th>
                  <th className="pb-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tokens.map(tk => (
                  <tr key={tk.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#D4AF37]">{tk.tokenNumber}</td>
                    <td className="py-3 px-3 font-semibold text-white">{tk.customer?.name || 'Walk-in Guest'}</td>
                    <td className="py-3 px-3 font-mono text-gray-300">{tk.customer?.phoneNumber || 'N/A'}</td>
                    <td className="py-3 px-3 font-semibold text-gray-200">{tk.personsCount} Guests</td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-amber-300 font-bold">{tk.redemptionsUsed}</span> / {tk.totalRedemptionsAllowed} Drinks
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-gray-300 border border-white/10">
                        {tk.deliveryMode}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold badge-active">
                        {tk.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
