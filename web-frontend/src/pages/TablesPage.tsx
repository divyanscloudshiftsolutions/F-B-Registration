import React, { useState, useEffect } from 'react';
import { Grid3X3, RefreshCw, X, Info } from 'lucide-react';
import { api } from '../services/api';
import type { Table, Token } from '../types';
import { useAuth } from '../context/AuthContext';

export const TablesPage: React.FC = () => {
  const { showToast } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [placeZone, setPlaceZone] = useState<'STANDING_BAR' | 'PREMIUM_LOUNGE'>('STANDING_BAR');
  const [filter, setFilter] = useState<string>('all');

  // Assign Modal State
  const [assigningTable, setAssigningTable] = useState<Table | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Table Detail View Modal State
  const [inspectingTable, setInspectingTable] = useState<Table | null>(null);

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

  const zoneFilteredTables = tables.filter(tb => {
    const p = (tb.placeTypeId || tb.categoryName || tb.tableNumber || '').toUpperCase();
    if (placeZone === 'STANDING_BAR') {
      return p.includes('STANDING') || p.includes('BAR') || tb.tableNumber.startsWith('S-');
    }
    return p.includes('PREMIUM') || p.includes('LOUNGE') || tb.tableNumber.startsWith('L-');
  });

  const filteredTables = zoneFilteredTables.filter(t => {
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
      {/* Filter and Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-white/10">
        {/* 2 Primary Place Zone Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaceZone('STANDING_BAR')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
              placeZone === 'STANDING_BAR'
                ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-lg font-black'
                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
            }`}
          >
            Standard Zone (Standing Bar)
          </button>

          <button
            onClick={() => setPlaceZone('PREMIUM_LOUNGE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
              placeZone === 'PREMIUM_LOUNGE'
                ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-lg font-black'
                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
            }`}
          >
            Premium Zone (Lounge)
          </button>
        </div>

        {/* Secondary Status Filters */}
        <div className="flex items-center gap-2">
          {['all', 'available', 'occupied'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                filter === f
                  ? 'bg-white/20 text-white border-white/40'
                  : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}

          <button
            onClick={loadTables}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 border border-white/10 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Seating Floor Plan Visual Layout Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Loading floor layout & seat maps...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredTables.map(tb => {
            const isOccupied = tb.status === 'occupied';
            const capacity = tb.capacity || 4;
            const assignedToken = tokens.find(tk => tk.tableId === tb.id || (tk.table && tk.table.id === tb.id));

            return (
              <div
                key={tb.id}
                className={`p-5 rounded-3xl border transition-all relative overflow-hidden flex flex-col justify-between h-60 ${
                  isOccupied
                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xl shadow-emerald-500/5'
                    : 'bg-[#121620] border-white/10 hover:border-[#D4AF37]/50'
                }`}
              >
                {/* Header Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[#D4AF37] font-black text-xl">{tb.tableNumber}</span>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                      {tb.categoryName || 'Standard'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setInspectingTable(tb)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300"
                      title="Inspect Table Details"
                    >
                      <Info size={14} />
                    </button>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        isOccupied ? 'badge-active' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}
                    >
                      {tb.status}
                    </span>
                  </div>
                </div>

                {/* Visual Seat Representation Map Around Table Container */}
                <div className="my-2 py-3 px-4 rounded-2xl bg-black/40 border border-white/5 flex flex-col items-center justify-center relative">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">Visual Seat Map ({capacity} Seats)</p>

                  <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: capacity }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          isOccupied
                            ? 'bg-emerald-500 border-emerald-300 shadow-md shadow-emerald-500/40 animate-pulse'
                            : 'bg-white/10 border-white/20'
                        }`}
                        title={`Seat #${i + 1} (${isOccupied ? 'Occupied' : 'Available'})`}
                      />
                    ))}
                  </div>

                  {assignedToken && (
                    <p className="text-[11px] font-bold text-emerald-300 mt-2 truncate max-w-[180px]">
                      👤 {assignedToken.customer?.name || 'Guest'} ({assignedToken.tokenNumber})
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                  {isOccupied ? (
                    <button
                      onClick={() => handleRelease(tb.id)}
                      className="w-full py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/30 transition-all"
                    >
                      Release Table
                    </button>
                  ) : (
                    <button
                      onClick={() => setAssigningTable(tb)}
                      className="w-full py-2 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] font-bold text-xs border border-[#D4AF37]/30 transition-all"
                    >
                      Assign Guest
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INSPECT TABLE DETAILS MODAL */}
      {inspectingTable && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setInspectingTable(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-sm">
              <Grid3X3 size={18} /> Detailed Information for Table {inspectingTable.tableNumber}
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-gray-400">Category Zone:</span>
                <span className="font-bold text-white uppercase">{inspectingTable.categoryName || 'Standard'}</span>
              </div>

              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-gray-400">Seat Capacity:</span>
                <span className="font-bold text-white">{inspectingTable.capacity} Seats Total</span>
              </div>

              <div className="flex justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-gray-400">Occupancy Status:</span>
                <span className={`font-bold uppercase ${inspectingTable.status === 'occupied' ? 'text-emerald-400' : 'text-gray-300'}`}>
                  {inspectingTable.status}
                </span>
              </div>
            </div>

            <button
              onClick={() => setInspectingTable(null)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white mt-4"
            >
              Close Details
            </button>
          </div>
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

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Active Guest Token Pass</label>
                {tokens.length === 0 ? (
                  <p className="text-xs text-gray-500 p-2 bg-white/5 rounded-xl">No active tokens available.</p>
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
                  {isSubmittingAssign ? 'Assigning...' : 'Confirm Seating'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
