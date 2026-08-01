import React, { useState } from 'react';
import { Grid3X3, Plus, RefreshCw, X, CheckCircle2, Users } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import type { Table } from '../../types';

export const TableManagement: React.FC = () => {
  const { showToast } = useAuth();
  const { tables, tokens, isLoading, refreshTables, refreshTokens } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<'STANDING_BAR' | 'PREMIUM_LOUNGE'>('STANDING_BAR');

  // Form State
  const [tableNumber, setTableNumber] = useState('S-01');
  const [capacity, setCapacity] = useState('4');
  const [placeType, setPlaceType] = useState('STANDING_BAR');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inspection Dialog Modal State
  const [inspectingTable, setInspectingTable] = useState<Table | null>(null);

  const filteredTables = tables.filter(tb => {
    const p = (tb.placeTypeId || tb.categoryName || tb.tableNumber || '').toUpperCase();
    if (selectedPlace === 'STANDING_BAR') {
      return p.includes('STANDING') || p.includes('BAR') || tb.tableNumber.startsWith('S-');
    }
    return p.includes('PREMIUM') || p.includes('LOUNGE') || tb.tableNumber.startsWith('L-');
  });

  // Real-time validations
  const isTableNumberValid = /^[SL]-\d{2,3}$/.test(tableNumber.trim().toUpperCase());
  const capVal = parseInt(capacity, 10);
  const isCapacityValid = !isNaN(capVal) && capVal >= 1 && capVal <= 100;
  const isFormValid = isTableNumberValid && isCapacityValid;

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    try {
      await api.createTable({
        tableNumber: tableNumber.trim().toUpperCase(),
        capacity: parseInt(capacity, 10),
        placeTypeId: placeType,
      });
      showToast(`Table ${tableNumber} created successfully!`, 'success');
      setIsModalOpen(false);
      refreshTables();
    } catch (err: any) {
      showToast(err.message || 'Failed to create table.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const inspectingToken = inspectingTable 
    ? tokens.find(tk => tk.tableId === inspectingTable.id || (tk.table && tk.table.id === inspectingTable.id))
    : null;

  return (
    <div className="space-y-6">
      {/* Top Bar with Place Type Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-border-main">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedPlace('STANDING_BAR')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
              selectedPlace === 'STANDING_BAR'
                ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-lg font-black'
                : 'bg-bg-primary text-text-muted border-border-main hover:bg-bg-card'
            }`}
          >
            Standard Zone (Standing Bar)
          </button>

          <button
            onClick={() => setSelectedPlace('PREMIUM_LOUNGE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
              selectedPlace === 'PREMIUM_LOUNGE'
                ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-lg font-black'
                : 'bg-bg-primary text-text-muted border-border-main hover:bg-bg-card'
            }`}
          >
            Premium Zone (Lounge)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { refreshTables(); refreshTokens(); }}
            className="px-3.5 py-2 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-semibold text-text-muted border border-border-main flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl gold-gradient-btn text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-lg"
          >
            <Plus size={16} /> Add New Table
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-text-muted text-sm">Loading floor tables...</div>
      ) : filteredTables.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-border-main text-center space-y-3">
          <Grid3X3 className="mx-auto text-text-muted" size={32} />
          <p className="text-sm font-bold text-text-muted">No Seating Tables Available</p>
          <p className="text-xs text-text-muted">There are no tables matching the selected zone filter right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
                    : 'bg-bg-surface border-emerald-500/25 hover:border-[#D4AF37]/50 hover:shadow-xl hover:shadow-[#D4AF37]/5 shadow-md'
                }`}
              >
                {/* Row 1: Header - Table Number & Status Pill */}
                <div className="grid grid-cols-2 items-center justify-between">
                  <div>
                    <span className="font-mono text-[#D4AF37] font-black text-2xl tracking-wide">{tb.tableNumber}</span>
                    <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block mt-0.5">
                      {selectedPlace === 'STANDING_BAR' ? 'Standard Zone' : 'Premium Zone'}
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                        isOccupied 
                          ? 'dark:bg-amber-500/15 bg-amber-500/10 dark:text-amber-400 text-amber-700 border border-amber-500/30' 
                          : 'dark:bg-emerald-500/15 bg-emerald-500/10 dark:text-emerald-400 text-emerald-700 border border-emerald-500/30'
                      }`}
                    >
                      {isOccupied ? <Users size={12} /> : <CheckCircle2 size={12} />}
                      <span>{isOccupied ? 'Occupied' : 'Available'}</span>
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
                      isOccupied ? 'dark:text-amber-400 text-amber-700 border-amber-500/30' : 'text-[#D4AF37] border-border-main'
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

                  <div className="h-5 flex items-center justify-center">
                    {assignedToken ? (
                      <p className="text-[11px] font-bold dark:text-amber-300 text-amber-700 truncate max-w-full text-center">
                        👤 {assignedToken.customer?.name || 'Guest'} ({assignedToken.tokenNumber})
                      </p>
                    ) : (
                      <p className="text-[10px] dark:text-emerald-400 text-emerald-700/80 text-center font-medium">Ready for guest seating</p>
                    )}
                  </div>
                </div>

                {/* Row 3: Action Buttons */}
                <div className="pt-2 border-t border-border-main">
                  {isOccupied ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRelease(tb.id);
                      }}
                      className="w-full py-2.5 rounded-xl dark:bg-red-500/20 bg-red-500/10 hover:bg-red-500/30 dark:text-red-300 text-red-700 font-bold text-xs border border-red-500/30 transition-all text-center cursor-pointer"
                    >
                      Release Table
                    </button>
                  ) : (
                    <div className="w-full py-2.5 text-center dark:text-emerald-400 text-emerald-700 font-bold text-xs bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      Open for Seating
                    </div>
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
            <div className="w-full max-w-lg bg-bg-surface border border-border-main rounded-3xl p-6 space-y-6 shadow-2xl relative animate-scaleUp">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border-main">
                <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-base">
                  <Grid3X3 size={20} /> Table {inspectingTable.tableNumber} Inspection Dialog
                </div>
                <button 
                  onClick={() => setInspectingTable(null)}
                  className="p-1.5 rounded-lg bg-bg-primary hover:bg-black/5 dark:hover:bg-white/10 text-text-muted hover:text-text-main transition-all cursor-pointer"
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
                  <div className="px-8 py-3 rounded-2xl bg-bg-primary border-2 border-[#D4AF37] text-center min-w-[180px] shadow-lg">
                    <p className="font-mono text-[#D4AF37] font-black text-lg">{inspectingTable.tableNumber}</p>
                    <p className="text-[10px] text-text-muted font-semibold">{selectedPlace === 'STANDING_BAR' ? 'Standard Zone' : 'Premium Zone'}</p>
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
                    <span className="font-mono text-[#D4AF37] font-bold">{inspectingToken.tokenNumber}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 border-t border-border-main flex gap-3">
                <button
                  type="button"
                  onClick={() => setInspectingTable(null)}
                  className="flex-1 py-3 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-bold text-text-muted cursor-pointer"
                >
                  Close Dialog
                </button>

                {inspectingTable.status === 'occupied' && (
                  <button
                    type="button"
                    onClick={() => handleRelease(inspectingTable.id)}
                    className="flex-1 py-3 rounded-xl dark:bg-red-500/20 bg-red-500/10 hover:bg-red-500/30 dark:text-red-300 text-red-700 font-bold text-xs border border-red-500/30 transition-all text-center cursor-pointer"
                  >
                    Release Table
                  </button>
                )}
              </div>

            </div>
          </div>
        );
      })()}

      {/* ADD TABLE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-main rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-sm">
              <Grid3X3 size={18} /> Add New Seating Table
            </div>

            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Table Number <span className="text-text-muted">(Must match pattern S-01, L-01)</span>
                </label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. S-01"
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Guest Seat Capacity (1 - 100)</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                  min={1}
                  max={100}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Place Type Category</label>
                <select
                  value={placeType}
                  onChange={e => setPlaceType(e.target.value)}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="STANDING_BAR">Standing Bar Zone</option>
                  <option value="PREMIUM_LOUNGE">Premium Lounge Zone</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-semibold text-text-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid}
                  className="flex-1 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Confirm Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
