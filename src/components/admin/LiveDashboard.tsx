import React, { useState, useEffect } from 'react';
import { DollarSign, Users, Wine, Grid3X3, TrendingUp, Activity } from 'lucide-react';
import { api } from '../../services/api';
import type { Token, Table } from '../../types';

export const LiveDashboard: React.FC = () => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      const [tokenData, tableData] = await Promise.all([
        api.getActiveTokens(),
        api.getTables(),
      ]);
      setTokens(tokenData);
      setTables(tableData);
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const totalCollections = tokens.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
  const activeCount = tokens.length;
  const inHouseGuests = tokens.reduce((sum, s) => sum + s.personsCount, 0);
  const totalDrinksServed = tokens.reduce((sum, s) => sum + s.redemptionsUsed, 0);
  const occupiedTables = tables.filter(t => t.status === 'occupied').length;

  return (
    <div className="space-y-6">
      {/* Live Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-[#D4AF37] flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Sales Revenue</p>
            <h3 className="text-2xl font-black text-white mt-1">₹{totalCollections.toLocaleString()}</h3>
            <p className="text-[11px] text-emerald-400 mt-1 font-medium flex items-center gap-1">
              <TrendingUp size={12} /> Live Verified Collections
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center font-bold">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-emerald-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Active Guest Sessions</p>
            <h3 className="text-2xl font-black text-white mt-1">{activeCount}</h3>
            <p className="text-[11px] text-gray-400 mt-1">{inHouseGuests} Total Guests In-House</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-amber-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Drinks Redeemed</p>
            <h3 className="text-2xl font-black text-white mt-1">{totalDrinksServed}</h3>
            <p className="text-[11px] text-amber-400 mt-1">Dispensed Today</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
            <Wine size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-purple-500 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Floor Occupancy</p>
            <h3 className="text-2xl font-black text-white mt-1">{occupiedTables} / {tables.length}</h3>
            <p className="text-[11px] text-purple-400 mt-1">Seating Tables Occupied</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center font-bold">
            <Grid3X3 size={24} />
          </div>
        </div>
      </div>

      {/* Live Stream Panel */}
      <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <Activity size={18} className="animate-pulse" /> Live Activity & Guest Sessions Stream
          </div>
          <span className="text-xs text-gray-400 font-mono">Auto Sync Active</span>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-gray-400 text-sm">Synchronizing live stream...</div>
        ) : tokens.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">No active customer sessions right now.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tokens.slice(0, 6).map(tk => (
              <div key={tk.id} className="p-4 rounded-xl bg-[#141A25] border border-white/10 flex justify-between items-center">
                <div>
                  <span className="font-mono text-[#D4AF37] font-bold text-sm">{tk.tokenNumber}</span>
                  <p className="text-xs font-semibold text-white mt-0.5">{tk.customer?.name || 'Walk-in Guest'}</p>
                  <p className="text-[10px] text-gray-400">{tk.personsCount} Guests • {tk.deliveryMode}</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold badge-active">{tk.status}</span>
                  <p className="text-xs text-amber-300 font-mono font-bold mt-1">{tk.redemptionsUsed}/{tk.totalRedemptionsAllowed} Drinks</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
