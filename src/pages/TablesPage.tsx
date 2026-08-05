import React, { useState, useEffect } from 'react';
import { Grid3X3, RefreshCw, X, CheckCircle2, Users, ArrowRight, Search, UserPlus } from 'lucide-react';
import { api } from '../services/api';
import type { Table } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

interface TablesPageProps {
  onNavigateToCheckIn?: () => void;
}

export const TablesPage: React.FC<TablesPageProps> = ({ onNavigateToCheckIn }) => {
  const { showToast, setPreselectedTable } = useAuth();
  const { tables, tokens, isLoading, refreshTables, refreshTokens } = useData();
  const [placeZone, setPlaceZoneState] = useState<'STANDING_BAR' | 'PREMIUM_LOUNGE'>(() => {
    return (localStorage.getItem('bar_web_tables_zone') as 'STANDING_BAR' | 'PREMIUM_LOUNGE') || 'STANDING_BAR';
  });
  const setPlaceZone = (zone: 'STANDING_BAR' | 'PREMIUM_LOUNGE') => {
    setPlaceZoneState(zone);
    localStorage.setItem('bar_web_tables_zone', zone);
  };
  const [filter, setFilterState] = useState<string>(() => {
    return localStorage.getItem('bar_web_tables_filter') || 'all';
  });
  const setFilter = (val: string) => {
    setFilterState(val);
    localStorage.setItem('bar_web_tables_filter', val);
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const storedFilter = localStorage.getItem('bar_web_tables_filter');
      if (storedFilter && storedFilter !== filter) {
        setFilterState(storedFilter);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [filter]);

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
    if (filter === 'reserved') return t.status === 'reserved';
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
    <div className="space-y-6 text-text-main">
      
      {/* Non-Overlapping Structured Control Toolbar */}
      <div className="glass-panel p-5 rounded-3xl border border-border-main space-y-4">
        {/* Tier 1: Primary Zone Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border-main">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlaceZone('STANDING_BAR')}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border whitespace-nowrap transition-all cursor-pointer ${
                placeZone === 'STANDING_BAR'
                  ? 'bg-[#8D6CE5] text-black border-[#8D6CE5] shadow-xl shadow-[#8D6CE5]/20 font-black'
                  : 'bg-bg-primary text-text-muted border-border-main hover:bg-bg-card'
              }`}
            >
              Standard Zone (Standing Bar)
            </button>

            <button
              onClick={() => setPlaceZone('PREMIUM_LOUNGE')}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider border whitespace-nowrap transition-all cursor-pointer ${
                placeZone === 'PREMIUM_LOUNGE'
                  ? 'bg-[#8D6CE5] text-black border-[#8D6CE5] shadow-xl shadow-[#8D6CE5]/20 font-black'
                  : 'bg-bg-primary text-text-muted border-border-main hover:bg-bg-card'
              }`}
            >
              Premium Zone (Lounge)
            </button>
          </div>

          <div className="text-xs font-bold text-text-muted">
            Total Tables: <span className="text-text-main font-mono">{filteredTables.length}</span>
          </div>
        </div>

        {/* Tier 2: Secondary Status Filters & Refresh Action */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider mr-1">Status Filter:</span>
            {['all', 'available', 'occupied', 'reserved'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border whitespace-nowrap transition-all cursor-pointer ${
                  filter === f
                    ? 'bg-bg-card text-text-main border-border-main shadow-md'
                    : 'bg-bg-primary text-text-muted border-border-main hover:bg-bg-card'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-bold text-text-muted hover:text-text-main border border-border-main flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh Floor Plan
          </button>
        </div>
      </div>

      {/* Stable Table Cards Floor Plan Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-text-muted text-sm">Loading floor layout & seat maps...</div>
      ) : filteredTables.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-border-main text-center space-y-3">
          <p className="text-text-muted text-sm">No tables match your filter parameters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                    ? 'bg-bg-surface/50 border-amber-500/20 opacity-75 shadow-lg shadow-black/40'
                    : 'bg-bg-surface border-emerald-500/25 hover:border-[#8D6CE5]/50 hover:shadow-xl hover:shadow-[#8D6CE5]/5 shadow-md'
                }`}
              >
                {/* Row 1: Header - Table Number & Status Pill */}
                <div className="grid grid-cols-2 items-center justify-between">
                  <div>
                    <span className="font-mono text-[#8D6CE5] font-black text-2xl tracking-wide">{tb.tableNumber}</span>
                    <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block mt-0.5">
                      {placeZone === 'STANDING_BAR' ? 'Standard Zone' : 'Premium Zone'}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        tb.status === 'occupied'
                          ? 'dark:bg-primary-light/15 bg-primary-light dark:text-primary text-[#8D6CE5] border border-primary/30'
                          : tb.status === 'reserved'
                          ? 'dark:bg-orange-light/15 bg-orange-light dark:text-orange text-[#F19307] border border-orange/30'
                          : tb.status === 'maintenance'
                          ? 'dark:bg-zinc-800/50 bg-zinc-200/50 text-text-muted border border-border-main'
                          : 'dark:bg-emerald-500/15 bg-emerald-500/10 dark:text-emerald-400 text-emerald-700 border border-emerald-500/30'
                      }`}
                    >
                      {tb.status === 'occupied' ? <Users size={12} /> : <CheckCircle2 size={12} />}
                      <span className="capitalize">{tb.status}</span>
                    </span>
                  </div>
                </div>

                {/* Row 2: Grid Layout for Visual Seating & Metrics */}
                <div className="py-2.5 px-4 rounded-2xl bg-bg-primary border border-border-main grid grid-rows-[auto_1fr_auto] items-center gap-1.5">
                  <div className="flex justify-between w-full text-[10px] text-text-muted font-bold uppercase">
                    <span>Seat Capacity</span>
                    <span className={isOccupied ? 'dark:text-amber-400 text-amber-700 font-extrabold' : 'dark:text-emerald-400 text-emerald-700 font-extrabold'}>
                      {occupiedCount} / {capacity} Seats
                    </span>
                  </div>

                  {/* Micro Floor Plan Seating Alignment */}
                  <div className="relative flex items-center justify-center h-14 bg-bg-surface/30 rounded-xl border border-border-main">
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
                                : 'bg-bg-primary border-border-main'
                            }`}
                            title={`Seat #${i + 1} (${isFilled ? 'Occupied' : 'Empty'})`}
                          />
                        );
                      })}
                    </div>

                    {/* Central table plate */}
                    <div className={`px-4 py-0.5 bg-bg-primary border rounded text-[9px] font-mono font-black tracking-wider shadow ${
                      isOccupied ? 'dark:text-amber-400 text-amber-700 border-amber-500/30' : 'text-[#8D6CE5] border-border-main'
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
                                : 'bg-bg-primary border-border-main'
                            }`}
                            title={`Seat #${Math.ceil(capacity / 2) + i + 1} (${isFilled ? 'Occupied' : 'Empty'})`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {assignedToken && (
                    <div className="flex items-center justify-between text-[10px] border-t border-border-main pt-1 text-text-muted">
                      <span className="font-semibold truncate max-w-[80px]">👤 {assignedToken.customer?.name || 'Guest'}</span>
                      <span className="font-mono text-[#8D6CE5] font-bold">{assignedToken.tokenNumber}</span>
                    </div>
                  )}
                </div>

                {/* Row 3: Action Buttons */}
                <div className="flex gap-2">
                  {isOccupied ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingTable(tb);
                      }}
                      className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:dark:bg-amber-500/20 bg-amber-500/10 dark:text-amber-300 text-amber-700 text-xs font-bold border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Search size={14} /> Inspect Details
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRedirectToCheckIn(tb);
                        }}
                        className="flex-1 py-2.5 rounded-xl primary-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow cursor-pointer"
                      >
                        <UserPlus size={14} /> Assign
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectingTable(tb);
                        }}
                        className="py-2.5 px-3 rounded-xl bg-bg-primary hover:bg-bg-card border border-border-main text-text-muted hover:text-text-main transition-all cursor-pointer"
                        title="View Setup Diagram"
                      >
                        <Search size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INSPECT DETAILS MODAL */}
      {(() => {
        if (!inspectingTable) return null;
        const capacity = inspectingTable.capacity || 4;
        const assignedToken = tokens.find(tk => tk.tableId === inspectingTable.id || (tk.table && tk.table.id === inspectingTable.id));
        const isOccupied = inspectingTable.status === 'occupied';
        const occupiedCount = assignedToken ? (assignedToken.personsCount || 1) : (isOccupied ? capacity : 0);

        const topCount = Math.ceil(capacity / 2);
        const bottomCount = Math.floor(capacity / 2);

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
            <div className="w-full max-w-lg bg-bg-surface border border-border-main rounded-3xl p-6 space-y-6 shadow-2xl relative text-text-main animate-scaleUp">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border-main">
                <div className="flex items-center gap-2 text-[#8D6CE5] font-bold text-base">
                  <Grid3X3 size={20} /> Table {inspectingTable.tableNumber} Inspection Dialog
                </div>
                <button 
                  onClick={() => setInspectingTable(null)}
                  className="p-1.5 rounded-lg bg-bg-primary hover:bg-bg-card text-text-muted hover:text-text-main transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Top Center Visual Seating View */}
              <div className="p-5 rounded-2xl bg-bg-primary border border-border-main flex flex-col items-center justify-center space-y-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">
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
                            isFilled ? 'dark:bg-amber-500/20 bg-amber-500/10 dark:border-amber-400 border-amber-500 dark:text-amber-300 text-amber-700 font-extrabold shadow-sm' : 'bg-bg-primary border-border-main text-text-muted'
                          }`}>
                            👤
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Table Surface */}
                  <div className="px-8 py-3 rounded-2xl bg-bg-surface border-2 border-[#8D6CE5] text-center min-w-[180px] shadow-lg">
                    <p className="font-mono text-[#8D6CE5] font-black text-lg">{inspectingTable.tableNumber}</p>
                    <p className="text-[10px] text-text-muted font-semibold">{placeZone === 'STANDING_BAR' ? 'Standard Zone' : 'Premium Zone'}</p>
                  </div>

                  {/* Bottom Seats Row */}
                  <div className="flex items-center justify-center gap-3">
                    {Array.from({ length: bottomCount }).map((_, i) => {
                      const isFilled = (topCount + i) < occupiedCount;
                      return (
                        <div key={`bottom-${i}`} className="flex flex-col items-center gap-1">
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold ${
                            isFilled ? 'dark:bg-amber-500/20 bg-amber-500/10 dark:border-amber-400 border-amber-500 dark:text-amber-300 text-amber-700 font-extrabold shadow-sm' : 'bg-bg-primary border-border-main text-text-muted'
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
                <div className="p-3.5 rounded-2xl bg-bg-primary border border-border-main space-y-1">
                  <span className="text-text-muted text-[10px] font-bold uppercase">Status</span>
                  <p className={`font-bold text-sm uppercase ${inspectingTable.status === 'occupied' ? 'dark:text-amber-400 text-amber-700' : 'dark:text-emerald-400 text-emerald-700'}`}>
                    {inspectingTable.status}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-bg-primary border border-border-main space-y-1">
                  <span className="text-text-muted text-[10px] font-bold uppercase">Capacity Limit</span>
                  <p className="font-bold text-sm text-text-main">{inspectingTable.capacity} Guests Max</p>
                </div>
              </div>

              {inspectingToken && (
                <div className="p-4 rounded-2xl bg-bg-primary border border-border-main space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Assigned Customer:</span>
                    <span className="font-bold text-text-main">{inspectingToken.customer?.name || 'Guest'} ({inspectingToken.customer?.phoneNumber || '—'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Token Pass:</span>
                    <span className="font-mono text-[#8D6CE5] font-bold">{inspectingToken.tokenNumber}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-border-main flex gap-3">
                <button
                  type="button"
                  onClick={() => setInspectingTable(null)}
                  className="flex-1 py-3 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-bold text-text-muted hover:text-text-main border border-border-main cursor-pointer"
                >
                  Close Dialog
                </button>

                {inspectingTable.status === 'occupied' ? (
                  <button
                    type="button"
                    onClick={() => handleRelease(inspectingTable.id)}
                    className="flex-1 py-3 rounded-xl dark:bg-red-500/20 bg-red-500/10 hover:bg-red-500/30 dark:text-red-300 text-red-700 font-bold text-xs border border-red-500/30 transition-all text-center cursor-pointer"
                  >
                    Release Table
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRedirectToCheckIn(inspectingTable)}
                    className="flex-1 py-3 rounded-xl primary-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg cursor-pointer"
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
          <div className="bg-bg-surface border border-border-main rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative text-text-main animate-fadeIn">
            <button 
              onClick={() => setAssigningTable(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-[#8D6CE5] font-bold text-sm">
              <Grid3X3 size={18} /> Assign Table {assigningTable.tableNumber}
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Active Guest Token Pass</label>
                {tokens.length === 0 ? (
                  <p className="text-xs text-text-muted p-2 bg-bg-primary rounded-xl">No active guest tokens available for assignment.</p>
                ) : (
                  <select
                    value={selectedTokenId}
                    onChange={e => setSelectedTokenId(e.target.value)}
                    className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-[#8D6CE5]"
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
                  className="flex-1 py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-semibold text-text-muted hover:text-text-main border border-border-main cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssign || !selectedTokenId}
                  className="flex-1 py-2.5 rounded-xl primary-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
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


