import React, { useState, useEffect } from 'react';
import { Grid3X3, RefreshCw, X } from 'lucide-react';
import { api } from '../services/api';
import type { Table, Token } from '../types';
import { useAuth } from '../context/AuthContext';

export const TablesPage: React.FC = () => {
  const { showToast } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available' | 'occupied'>('all');

  // Assign Table Modal State
  const [assigningTable, setAssigningTable] = useState<Table | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  const loadTables = async () => {
    setIsLoading(true);
    try {
      const [tableData, tokenData] = await Promise.all([
        api.getTables(),
        api.getActiveTokens(),
      ]);
      setTables(tableData);
      setTokens(tokenData);
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

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningTable || !selectedTokenId) return;

    setIsSubmittingAssign(true);
    try {
      await api.assignTable(assigningTable.id, selectedTokenId);
      showToast(`Table ${assigningTable.tableNumber} assigned successfully!`, 'success');
      setAssigningTable(null);
      setSelectedTokenId('');
      loadTables();
    } catch (err: any) {
      showToast(err.message || 'Failed to assign table.', 'danger');
    } finally {
      setIsSubmittingAssign(false);
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
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between h-48 ${
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
                  <p className="text-[11px] text-[#D4AF37] font-semibold mt-0.5 uppercase tracking-wider">
                    {tb.categoryName || (typeof tb.placeType === 'string' ? tb.placeType : tb.placeType?.name) || 'Standard Category'}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                  {isOccupied ? (
                    <button
                      onClick={() => handleRelease(tb.id)}
                      className="w-full py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/30 transition-all"
                    >
                      Clear & Release
                    </button>
                  ) : (
                    <button
                      onClick={() => setAssigningTable(tb)}
                      className="w-full py-1.5 rounded-lg bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] font-bold text-xs border border-[#D4AF37]/30 transition-all"
                    >
                      Assign Guest Token
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ASSIGN TABLE MODAL */}
      {assigningTable && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setAssigningTable(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-sm">
              <Grid3X3 size={18} /> Assign Table {assigningTable.tableNumber}
            </div>

            <p className="text-xs text-gray-400">
              Select an active customer token pass to seat at table <span className="font-bold text-white">{assigningTable.tableNumber}</span>
            </p>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Active Customer Token</label>
                {tokens.length === 0 ? (
                  <p className="text-xs text-gray-500 p-2 bg-white/5 rounded-xl">No unassigned active customer tokens available.</p>
                ) : (
                  <select
                    value={selectedTokenId}
                    onChange={e => setSelectedTokenId(e.target.value)}
                    className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    required
                  >
                    <option value="">Select Token Pass...</option>
                    {tokens.map(tk => (
                      <option key={tk.id} value={tk.id}>
                        {tk.tokenNumber} — {tk.customer?.name || 'Guest'} ({tk.personsCount} Persons)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningTable(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssign || !selectedTokenId}
                  className="flex-1 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {isSubmittingAssign ? 'Assigning...' : 'Confirm Table Seating'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
