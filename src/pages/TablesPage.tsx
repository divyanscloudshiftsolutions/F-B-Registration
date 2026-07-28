import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import type { Table } from '../types';
import { useAuth } from '../context/AuthContext';

export const TablesPage: React.FC = () => {
  const { showToast } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied'>('all');

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const tableData = await api.getTables();
      setTables(tableData);
    } catch (err: any) {
      showToast(err.message || 'Failed to fetch table floor plan.', 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const filteredTables = tables.filter(t => {
    if (filter === 'available') return t.status === 'available';
    if (filter === 'occupied') return t.status === 'occupied';
    return true;
  });

  const handleRelease = async (tableId: string) => {
    try {
      await api.releaseTable(tableId);
      showToast('Table released successfully!', 'success');
      loadTables();
    } catch (err: any) {
      showToast(err.message || 'Failed to release table.', 'danger');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2">
          {['all', 'available', 'occupied'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                filter === f
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
              }`}
            >
              {f} Tables
            </button>
          ))}
        </div>

        <button
          onClick={loadTables}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 border border-white/10 flex items-center gap-2 transition-all"
        >
          <RefreshCw size={14} />
          <span>Refresh Floor Plan</span>
        </button>
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Loading seating layout...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTables.map(tb => {
            const isOccupied = tb.status === 'occupied';
            return (
              <div
                key={tb.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between h-44 ${
                  isOccupied
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-[#141A25] border-white/10 hover:border-[#D4AF37]/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[#D4AF37] font-black text-lg">{tb.tableNumber}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      isOccupied ? 'badge-active' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}
                  >
                    {tb.status}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-400 font-medium">Capacity: {tb.capacity} Guests</p>
                  {tb.placeType && (
                    <p className="text-[11px] text-[#D4AF37] mt-0.5">{tb.placeType.name}</p>
                  )}
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  {isOccupied ? (
                    <button
                      onClick={() => handleRelease(tb.id)}
                      className="w-full py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/30 transition-all"
                    >
                      Clear & Release
                    </button>
                  ) : (
                    <span className="text-[11px] text-gray-500 font-medium">Ready for Assignment</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
