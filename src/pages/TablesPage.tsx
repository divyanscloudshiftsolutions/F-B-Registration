import React, { useState } from 'react';
import { Grid3X3, RefreshCw, X, CheckCircle2, Users, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import type { Table } from '../types';
import { useAuth } from '../context/AuthContext';

interface TablesPageProps {
  onNavigateToCheckIn?: () => void;
}

import { useData } from '../context/DataContext';

interface TablesPageProps {
  onNavigateToCheckIn?: () => void;
}

export const TablesPage: React.FC<TablesPageProps> = ({ onNavigateToCheckIn }) => {
  const { showToast, setPreselectedTable } = useAuth();
  const { tables, tokens, isLoading, refreshTables, refreshTokens } = useData();
  const [placeZone, setPlaceZoneState] = useState<'STANDING_BAR' | 'PREMIUM_LOUNGE'>(() => {
    return (localStorage.getItem('nfc_web_tables_zone') as 'STANDING_BAR' | 'PREMIUM_LOUNGE') || 'STANDING_BAR';
  });
  const setPlaceZone = (zone: 'STANDING_BAR' | 'PREMIUM_LOUNGE') => {
    setPlaceZoneState(zone);
    localStorage.setItem('nfc_web_tables_zone', zone);
  };
  const [filter, setFilterState] = useState<string>(() => {
    return localStorage.getItem('nfc_web_tables_filter') || 'all';
  });
  const setFilter = (val: string) => {
    setFilterState(val);
    localStorage.setItem('nfc_web_tables_filter', val);
  };

  // Assign Modal State
  const [assigningTable, setAssigningTable] = useState<Table | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  // Centered Table Inspection Dialog Modal State
  const [inspectingTable, setInspectingTable] = useState<Table | null>(null);

  const handleRefresh = async () => {
    await Promise.all([refreshTables(), refreshTokens()]);
  };

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
      if (inspectingTable && inspectingTable.id === tableId) {
        setInspectingTable(null);
      }
      refreshTables();
      refreshTokens();
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
      refreshTables();
      refreshTokens();
    } catch (err: any) {
      showToast(err.message || 'Failed to assign table.', 'danger');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  const handleRedirectToCheckIn = (tb: Table) => {
    const placeType = tb.tableNumber.startsWith('S-') ? 'standing_bar' : 'premium_lounge';
    setPreselectedTable({
      id: tb.id,
      number: tb.tableNumber,
      capacity: tb.capacity || 4,
      placeTypeId: placeType,
    });
    setInspectingTable(null);
    if (onNavigateToCheckIn) {
      onNavigateToCheckIn();
    }
  };

  const inspectingToken = inspectingTable 
    ? tokens.find(tk => tk.tableId === inspectingTable.id || (tk.table && tk.table.id === inspectingTable.id))
    : null;

  return (
    <div className="space-y-6">
      
      {/* Non-Overlapping Structured Control Toolbar */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4">
        {/* Tier 1: Primary Zone Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaceZone('STANDING_BAR')}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border whitespace-nowrap transition-all ${
                placeZone === 'STANDING_BAR'
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-xl shadow-[#D4AF37]/20 font-black'
                  : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
              }`}
            >
              Standard Zone (Standing Bar)
            </button>

            <button
              onClick={() => setPlaceZone('PREMIUM_LOUNGE')}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border whitespace-nowrap transition-all ${
                placeZone === 'PREMIUM_LOUNGE'
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-xl shadow-[#D4AF37]/20 font-black'
                  : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
              }`}
            >
              Premium Zone (Lounge)
            </button>
          </div>

          <div className="text-xs font-bold text-gray-400">
            Total Tables: <span className="text-white font-mono">{filteredTables.length}</span>
          </div>
        </div>

        {/* Tier 2: Secondary Status Filters & Refresh Action */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">Status Filter:</span>
            {['all', 'available', 'occupied'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border whitespace-nowrap transition-all ${
                  filter === f
                    ? 'bg-white/20 text-white border-white/40 shadow-md'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 border border-white/10 flex items-center gap-2 whitespace-nowrap transition-all"
          >
            <RefreshCw size={14} /> Refresh Floor Plan
          </button>
        </div>
      </div>

      {/* Stable Table Cards Floor Plan Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-gray-400 text-sm">Loading floor layout & seat maps...</div>
      ) : filteredTables.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-white/10 text-center space-y-3">
          <Grid3X3 className="mx-auto text-gray-500" size={32} />
          <p className="text-sm font-bold text-gray-300">No Seating Tables Available</p>
          <p className="text-xs text-gray-400">There are no tables matching the selected zone filter right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTables.map(tb => {
            const isOccupied = tb.status === 'occupied';
            const capacity = tb.capacity || 4;
            const assignedToken = tokens.find(tk => tk.tableId === tb.id || (tk.table && tk.table.id === tb.id));
            const occupiedCount = assignedToken ? (assignedToken.personsCount || 1) : (isOccupied ? capacity : 0);

            return (
              <div
                key={tb.id}
                onClick={() => setInspectingTable(tb)}
                className={`p-6 rounded-3xl border transition-all cursor-pointer relative overflow-hidden grid grid-rows-[auto_1fr_auto] gap-4 h-72 ${
                  isOccupied
                    ? 'bg-[#121620]/50 border-amber-500/20 opacity-75 shadow-lg shadow-black/40'
                    : 'bg-[#121620] border-emerald-500/25 hover:border-[#D4AF37]/50 hover:shadow-xl hover:shadow-[#D4AF37]/5 shadow-md'
                }`}
              >
                {/* Row 1: Header - Table Number & Status Pill */}
                <div className="grid grid-cols-2 items-center justify-between">
                  <div>
                    <span className="font-mono text-[#D4AF37] font-black text-2xl tracking-wide">{tb.tableNumber}</span>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mt-0.5">
                      {placeZone === 'STANDING_BAR' ? 'Standard Zone' : 'Premium Zone'}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        isOccupied 
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' 
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {isOccupied ? <Users size={12} /> : <CheckCircle2 size={12} />}
                      <span>{isOccupied ? 'Occupied' : 'Available'}</span>
                    </span>
                  </div>
                </div>

                {/* Row 2: Grid Layout for Visual Seating & Metrics */}
                <div className="py-2.5 px-4 rounded-2xl bg-black/40 border border-white/5 grid grid-rows-[auto_1fr_auto] items-center gap-1.5">
                  <div className="flex justify-between w-full text-[10px] text-gray-400 font-bold uppercase">
                    <span>Seat Capacity</span>
                    <span className={isOccupied ? 'text-amber-400 font-extrabold' : 'text-emerald-400 font-extrabold'}>
                      {occupiedCount} / {capacity} Seats
                    </span>
                  </div>

                  {/* Micro Floor Plan Seating Alignment */}
                  <div className="relative flex items-center justify-center h-14 bg-[#121620]/30 rounded-xl border border-white/5">
                    {/* Top Seats Row */}
                    <div className="absolute top-1.5 flex gap-2">
                      {Array.from({ length: Math.ceil(capacity / 2) }).map((_, i) => {
                        const isFilled = i < occupiedCount;
                        return (
                          <div
                            key={`mini-top-${i}`}
                            className={`w-3 h-3 rounded-full border transition-all ${
                              isFilled
                                ? 'bg-amber-500 border-amber-300 shadow-md shadow-amber-500/30 animate-pulse'
                                : 'bg-white/5 border-white/10'
                            }`}
                            title={`Seat #${i + 1} (${isFilled ? 'Occupied' : 'Empty'})`}
                          />
                        );
                      })}
                    </div>

                    {/* Central table plate */}
                    <div className={`px-4 py-0.5 bg-[#1C2333] border rounded text-[9px] font-mono font-black tracking-wider shadow ${
                      isOccupied ? 'text-amber-400 border-amber-500/30' : 'text-[#D4AF37] border-white/10'
                    }`}>
                      {tb.tableNumber}
                    </div>

                    {/* Bottom Seats Row */}
                    <div className="absolute bottom-1.5 flex gap-2">
                      {Array.from({ length: Math.floor(capacity / 2) }).map((_, i) => {
                        const isFilled = (Math.ceil(capacity / 2) + i) < occupiedCount;
                        return (
                          <div
                            key={`mini-bottom-${i}`}
                            className={`w-3 h-3 rounded-full border transition-all ${
                              isFilled
                                ? 'bg-amber-500 border-amber-300 shadow-md shadow-amber-500/30 animate-pulse'
                                : 'bg-white/5 border-white/10'
                            }`}
                            title={`Seat #${Math.ceil(capacity / 2) + i + 1} (${isFilled ? 'Occupied' : 'Empty'})`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="h-5 flex items-center justify-center">
                    {assignedToken ? (
                      <p className="text-[11px] font-bold text-amber-300 truncate max-w-full text-center">
                        👤 {assignedToken.customer?.name || 'Guest'} ({assignedToken.tokenNumber})
                      </p>
                    ) : (
                      <p className="text-[10px] text-emerald-400/80 text-center font-medium">Ready for guest seating</p>
                    )}
                  </div>
                </div>

                {/* Row 3: Action Buttons */}
                <div className="pt-2 border-t border-white/10">
                  {isOccupied ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRelease(tb.id);
                      }}
                      className="w-full py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/30 transition-all text-center cursor-pointer"
                    >
                      Release Table
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRedirectToCheckIn(tb);
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] font-bold text-xs border border-[#D4AF37]/30 transition-all text-center cursor-pointer"
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

      {/* CENTERED TABLE INSPECTION DIALOG MODAL BOX */}
      {inspectingTable && (() => {
        const capacity = inspectingTable.capacity || 4;
        const isOccupied = inspectingTable.status === 'occupied';
        const occupiedCount = inspectingToken ? (inspectingToken.personsCount || 1) : (isOccupied ? capacity : 0);
        const topCount = Math.ceil(capacity / 2);
        const bottomCount = Math.floor(capacity / 2);

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="w-full max-w-lg bg-[#121620] border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl relative animate-scaleUp">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-base">
                  <Grid3X3 size={20} /> Table {inspectingTable.tableNumber} Inspection Dialog
                </div>
                <button 
                  onClick={() => setInspectingTable(null)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Top Center Visual Seating View */}
              <div className="p-5 rounded-2xl bg-[#0B0E14] border border-white/10 flex flex-col items-center justify-center space-y-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400">
                  Visual Seating Alignment ({occupiedCount} / {capacity} Seats Occupied)
                </p>

                <div className="flex flex-col items-center space-y-2">
                  {/* Top Seats Row */}
                  <div className="flex items-center justify-center gap-3">
                    {Array.from({ length: topCount }).map((_, i) => {
                      const isFilled = i < occupiedCount;
                      return (
                        <div key={`top-${i}`} className="flex flex-col items-center gap-1">
                          <div className={`w-1 h-3 rounded-full ${isFilled ? 'bg-amber-400' : 'bg-gray-600'}`} />
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${
                            isFilled ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-extrabold shadow-sm shadow-amber-500/20' : 'bg-white/5 border-white/10 text-gray-500'
                          }`}>
                            👤
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Table Surface */}
                  <div className="px-8 py-3 rounded-2xl bg-[#1A202C] border-2 border-[#D4AF37] text-center min-w-[180px] shadow-lg">
                    <p className="font-mono text-[#D4AF37] font-black text-lg">{inspectingTable.tableNumber}</p>
                    <p className="text-[10px] text-gray-300 font-semibold">{placeZone === 'STANDING_BAR' ? 'Standard Zone' : 'Premium Zone'}</p>
                  </div>

                  {/* Bottom Seats Row */}
                  <div className="flex items-center justify-center gap-3">
                    {Array.from({ length: bottomCount }).map((_, i) => {
                      const isFilled = (topCount + i) < occupiedCount;
                      return (
                        <div key={`bottom-${i}`} className="flex flex-col items-center gap-1">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${
                            isFilled ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-extrabold shadow-sm shadow-amber-500/20' : 'bg-white/5 border-white/10 text-gray-500'
                          }`}>
                            👤
                          </div>
                          <div className={`w-1 h-3 rounded-full ${isFilled ? 'bg-amber-400' : 'bg-gray-600'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Table & Session Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-[#141A25] border border-white/10 space-y-1">
                  <span className="text-gray-400 text-[10px] font-bold uppercase">Status</span>
                  <p className={`font-bold text-sm uppercase ${inspectingTable.status === 'occupied' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {inspectingTable.status}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#141A25] border border-white/10 space-y-1">
                  <span className="text-gray-400 text-[10px] font-bold uppercase">Capacity Limit</span>
                  <p className="font-bold text-sm text-white">{inspectingTable.capacity} Guests Max</p>
                </div>
              </div>

              {inspectingToken && (
                <div className="p-4 rounded-2xl bg-[#141A25] border border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Assigned Customer:</span>
                    <span className="font-bold text-white">{inspectingToken.customer?.name || 'Guest'} ({inspectingToken.customer?.phoneNumber || '—'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Token Pass:</span>
                    <span className="font-mono text-[#D4AF37] font-bold">{inspectingToken.tokenNumber}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-white/10 flex gap-3">
                <button
                  type="button"
                  onClick={() => setInspectingTable(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300"
                >
                  Close Dialog
                </button>

                {inspectingTable.status === 'occupied' ? (
                  <button
                    type="button"
                    onClick={() => handleRelease(inspectingTable.id)}
                    className="flex-1 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/30 transition-all text-center"
                  >
                    Release Table
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRedirectToCheckIn(inspectingTable)}
                    className="flex-1 py-3 rounded-xl gold-gradient-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg"
                  >
                    <span>Assign Guest & Check-In</span>
                    <ArrowRight size={16} />
                  </button>
                )}
              </div>

            </div>
          </div>
        );
      })()}

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
                  <p className="text-xs text-gray-500 p-2 bg-white/5 rounded-xl">No active guest tokens available for assignment.</p>
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
