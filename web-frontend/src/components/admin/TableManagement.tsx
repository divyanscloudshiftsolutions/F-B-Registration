import React, { useState, useEffect } from 'react';
import { Grid3X3, Plus, RefreshCw, X, CheckCircle2, Users, VideoOff, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import type { Table, Token } from '../../types';
import { TableDiagram } from '../TableDiagram';
import { SeatingRow } from '../SeatingRow';
import { ExtendSessionModal } from '../modals/ExtendSessionModal';

export const TableManagement: React.FC = () => {
  const { user, showToast, isDark } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const { tables, tokens, allSessions, reservations, rates, isLoading, refreshTables, refreshTokens, refreshAllSessions, refreshReservations } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<'STANDING_BAR' | 'PREMIUM_LOUNGE'>('STANDING_BAR');
  const [filter, setFilter] = useState<string>('all');

  // Fetch tables, tokens and reservations on component mount
  useEffect(() => {
    refreshTables();
    refreshTokens();
    refreshAllSessions();
    refreshReservations();
  }, []);

  // Comprehensive active token resolution helper
  const getActiveTokenForTable = (table: Table | null | undefined): Token | null => {
    if (!table) return null;
    const directMatch = tokens.find((tk: any) => 
      (table.currentTokenId && (tk.id === table.currentTokenId || tk.tokenNumber === table.currentTokenId)) ||
      (tk.tableId && tk.tableId === table.id) ||
      (tk.table?.id && tk.table.id === table.id) ||
      (tk.tableNumber && table.tableNumber && tk.tableNumber.toUpperCase() === table.tableNumber.toUpperCase()) ||
      (tk.table?.number && table.tableNumber && tk.table.number.toUpperCase() === table.tableNumber.toUpperCase())
    );
    if (directMatch) return directMatch as Token;

    const allSessionMatch = allSessions?.find((tk: any) => 
      (tk.status?.toUpperCase() === 'ACTIVE' || tk.status?.toUpperCase() === 'EXTENDED') && (
        (table.currentTokenId && (tk.id === table.currentTokenId || tk.tokenNumber === table.currentTokenId)) ||
        (tk.tableId && tk.tableId === table.id) ||
        (tk.table?.id && tk.table.id === table.id) ||
        (tk.tableNumber && table.tableNumber && tk.tableNumber.toUpperCase() === table.tableNumber.toUpperCase()) ||
        (tk.table?.number && table.tableNumber && tk.table.number.toUpperCase() === table.tableNumber.toUpperCase())
      )
    );
    return (allSessionMatch as Token) || null;
  };

  // Form State (Create)
  const [tableNumber, setTableNumber] = useState('S-01');
  const [capacity, setCapacity] = useState('4');
  const [placeType, setPlaceType] = useState('STANDING_BAR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Form State (Edit)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTableNumber, setEditTableNumber] = useState('');
  const [editCapacity, setEditCapacity] = useState('4');
  const [editPlaceType, setEditPlaceType] = useState('STANDING_BAR');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editSuggestions, setEditSuggestions] = useState<string[]>([]);

  // Delete & Release Confirmation State
  const [deletingTableForConfirm, setDeletingTableForConfirm] = useState<Table | null>(null);
  const [releasingTableForConfirm, setReleasingTableForConfirm] = useState<Table | null>(null);
  const [cancellingReservationForConfirm, setCancellingReservationForConfirm] = useState<Table | null>(null);
  const [isSubmittingCancelRes, setIsSubmittingCancelRes] = useState(false);

  // Extend Session State
  const [extendingToken, setExtendingToken] = useState<Token | null>(null);

  // Inspection Dialog Modal State
  const [inspectingTable, setInspectingTable] = useState<Table | null>(null);
  const isInspectingTableOccupied = inspectingTable?.status === 'occupied';

  // Sync placeType default with the selected screen tab when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setPlaceType(selectedPlace);
    }
  }, [isModalOpen]);

  // Helper to calculate next logical table number and suggestions based on placeType
  const getTableSuggestions = (type: string) => {
    const prefix = type === 'STANDING_BAR' ? 'S-' : 'L-';
    // Filter existing tables that start with prefix
    const prefixedTables = tables.filter(t => t.tableNumber.toUpperCase().startsWith(prefix));
    let maxNum = 0;
    prefixedTables.forEach(t => {
      const numStr = t.tableNumber.slice(prefix.length);
      const parsed = parseInt(numStr, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    });
    
    const nextNum = maxNum + 1;
    const padLen = 2; // Always format with at least 2 digits (e.g. S-01, S-16)
    
    const formatNumber = (num: number) => {
      return `${prefix}${String(num).padStart(padLen, '0')}`;
    };

    return [
      formatNumber(nextNum),
      formatNumber(nextNum + 1),
      formatNumber(nextNum + 2),
      formatNumber(nextNum + 3),
    ];
  };

  // Update suggestions and default value on modal open or placeType change
  useEffect(() => {
    if (isModalOpen) {
      const currentSuggestions = getTableSuggestions(placeType);
      setSuggestions(currentSuggestions);
      setTableNumber(currentSuggestions[0]);
    }
  }, [isModalOpen, placeType, tables]);

  const filteredTables = tables
  .filter(tb => {
    const p = (tb.placeTypeId || tb.categoryName || tb.tableNumber || '').toUpperCase();
    if (selectedPlace === 'STANDING_BAR') {
      return p.includes('STANDING') || p.includes('BAR') || tb.tableNumber.startsWith('S-');
    }
    return p.includes('PREMIUM') || p.includes('LOUNGE') || tb.tableNumber.startsWith('L-');
  })
  .filter(tb => {
    if (filter === 'all') return true;
    return tb.status === filter;
  });

  // Real-time validations
  const isTableNumberValid = /^[SL]-\d{2,4}$/.test(tableNumber.trim().toUpperCase());
  const capVal = parseInt(capacity, 10);
  const isCapacityValid = !isNaN(capVal) && capVal >= 1 && capVal <= 20;
  const normalizedInput = tableNumber.trim().toUpperCase();
  const isNameDuplicate = tables.some(
    t => t.tableNumber.trim().toUpperCase() === normalizedInput
  );
  const isFormValid = isTableNumberValid && isCapacityValid && !isNameDuplicate;

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
      const res = await api.releaseTable(tableId, 'MANUAL', 'This table was closed by Admin');
      showToast(res.message || 'Table released and session closed successfully!', 'success');
      if (inspectingTable && inspectingTable.id === tableId) {
        setInspectingTable(null);
      }
      refreshTables();
      refreshTokens();
    } catch (err: any) {
      showToast(err.message || 'Failed to release table.', 'danger');
    }
  };

  const [isTogglingLock, setIsTogglingLock] = useState(false);

  const handleToggleLockTable = async (tb: Table) => {
    setIsTogglingLock(true);
    try {
      const isLocked = tb.status === 'in_checkin' || tb.status === 'maintenance';
      if (isLocked) {
        try {
          await api.unlockTable(tb.id, true);
        } catch {
          await api.patchTableStatus(tb.id, 'available');
        }

        // Invalidate stale draft in localStorage if it references this table
        try {
          const draft = localStorage.getItem('bar_incomplete_checkin');
          if (draft) {
            const parsed = JSON.parse(draft);
            if (parsed.selectedTableId === tb.id) {
              localStorage.removeItem('bar_incomplete_checkin');
            }
          }
          const target = localStorage.getItem('bar_checkin_assign_target');
          if (target) {
            const parsed = JSON.parse(target);
            if (parsed.tableId === tb.id) {
              localStorage.removeItem('bar_checkin_assign_target');
            }
          }
        } catch (e) {
          console.warn('Failed to clear local draft on table release:', e);
        }

        showToast(`Table ${tb.tableNumber} released successfully!`, 'success');
      } else {
        try {
          await api.lockTable(tb.id);
        } catch {
          await api.patchTableStatus(tb.id, 'maintenance');
        }
        showToast(`Table ${tb.tableNumber} locked successfully!`, 'success');
      }

      if (inspectingTable && inspectingTable.id === tb.id) {
        setInspectingTable(prev => prev ? { ...prev, status: isLocked ? 'available' : 'in_checkin' } : null);
      }
      refreshTables();
      refreshTokens();
    } catch (err: any) {
      showToast(err.message || 'Failed to update table lock status.', 'danger');
    } finally {
      setIsTogglingLock(false);
    }
  };

  // Suggestions logic for edit modal
  useEffect(() => {
    if (isEditModalOpen && editPlaceType) {
      const currentSuggestions = getTableSuggestions(editPlaceType);
      setEditSuggestions(currentSuggestions);
    }
  }, [isEditModalOpen, editPlaceType, tables]);

  // Real-time validations for edit (Max capacity strictly 20)
  const isEditTableNumberValid = /^[SL]-\d{2,4}$/.test(editTableNumber.trim().toUpperCase());
  const editCapVal = parseInt(editCapacity, 10);
  const isEditCapacityValid = !isNaN(editCapVal) && editCapVal >= 1 && editCapVal <= 20;
  const editNormalizedInput = editTableNumber.trim().toUpperCase();
  const isEditNameDuplicate = tables.some(
    t => t.id !== inspectingTable?.id && t.tableNumber.trim().toUpperCase() === editNormalizedInput
  );
  const isEditFormValid = isEditTableNumberValid && isEditCapacityValid && !isEditNameDuplicate;

  const openEditModal = (tb: Table) => {
    setEditTableNumber(tb.tableNumber);
    setEditCapacity(String(tb.capacity || 4));
    setEditPlaceType(tb.tableNumber.toUpperCase().startsWith('S-') ? 'STANDING_BAR' : 'PREMIUM_LOUNGE');
    setIsEditModalOpen(true);
  };

  const handleUpdateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingTable || !isEditFormValid) return;

    setIsSubmittingEdit(true);
    try {
      await api.updateTable(inspectingTable.id, {
        tableNumber: editTableNumber.trim().toUpperCase(),
        capacity: parseInt(editCapacity, 10),
        placeTypeId: editPlaceType,
      });
      showToast(`Table ${editTableNumber} updated successfully!`, 'success');
      setIsEditModalOpen(false);
      setInspectingTable(null); // Close inspecting drawer
      refreshTables();
    } catch (err: any) {
      showToast(err.message || 'Failed to update table.', 'danger');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const confirmDeleteTable = async () => {
    if (!deletingTableForConfirm) return;
    try {
      await api.deleteTable(deletingTableForConfirm.id);
      showToast(`Table ${deletingTableForConfirm.tableNumber} deleted successfully.`, 'success');
      setDeletingTableForConfirm(null);
      setInspectingTable(null); // Close drawer
      refreshTables();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete table.', 'danger');
    }
  };

  const inspectingToken = inspectingTable 
    ? getActiveTokenForTable(inspectingTable)
    : null;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Control Panel Container */}
      <div className="border-b border-border-main pb-4 mb-6 space-y-4 w-full">
        {/* Tier 1: Primary Zone Switcher Tabs & Total Tables */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 pb-4 border-b border-border-main w-full">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto px-4">
            <button
              onClick={() => setSelectedPlace('STANDING_BAR')}
              className={`w-full sm:w-auto px-4 py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all premium-tab-primary text-center shrink-0 ${
                selectedPlace === 'STANDING_BAR' ? 'active' : ''
              }`}
            >
              Standard Zone (Standing Bar)
            </button>

            <button
              onClick={() => setSelectedPlace('PREMIUM_LOUNGE')}
              className={`w-full sm:w-auto px-4 py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all premium-tab-primary text-center shrink-0 ${
                selectedPlace === 'PREMIUM_LOUNGE' ? 'active' : ''
              }`}
            >
              Premium Zone (Lounge)
            </button>
          </div>

          <div className="text-xs font-bold text-text-muted w-full sm:w-auto text-left sm:text-right flex items-center justify-between sm:block px-4">
            <span>Total Tables:</span> <span className="text-text-main font-mono text-sm sm:text-xs">{filteredTables.length}</span>
          </div>
        </div>

        {/* Tier 2: Secondary Status Filters & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 w-full px-4">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider mr-1 w-full sm:w-auto block mb-1 sm:mb-0">Status Filter:</span>
            {['all', 'available', 'occupied', 'reserved'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 sm:px-3.5 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all premium-tab-secondary ${
                  filter === f ? 'active' : ''
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <button
              onClick={() => { refreshTables(); refreshTokens(); }}
              className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-all premium-btn-secondary active"
            >
              <div className="nav-icon-badge">
                <RefreshCw size={12} />
              </div>
              <span>Refresh Data</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl primary-btn text-[10px] sm:text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
              >
                <div className="nav-icon-badge p-0.5">
                  <Plus size={14} />
                </div>
                <span className="hidden sm:inline">Add New Table</span>
                <span className="sm:hidden">Add Table</span>
              </button>
            )}
          </div>
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
        <div className="space-y-6 sm:space-y-8">
          {Array.from(new Set(filteredTables.map(tb => tb.capacity || 4)))
          .sort((a, b) => b - a)
          .map(cap => {
            const capTables = filteredTables
            .filter(tb => (tb.capacity || 4) === cap)
            .sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true, sensitivity: 'base' }));
          if (capTables.length === 0) return null;

            return (
              <SeatingRow key={cap} capacity={cap} tableCount={capTables.length}>
                {capTables.map(tb => {
                  const isOccupied = tb.status === 'occupied';
                  const capacity = tb.capacity || 4;
                  const assignedToken = getActiveTokenForTable(tb);
                  const occupiedCount = assignedToken ? (assignedToken.personsCount || 1) : (isOccupied ? capacity : 0);
                  const sizeCategory = capacity <= 2 ? 'Small' : capacity <= 4 ? 'Medium' : capacity <= 6 ? 'Large' : 'VIP Executive';

                  const isFull = isOccupied && occupiedCount >= capacity;
                  const isPartial = isOccupied && occupiedCount > 0 && occupiedCount < capacity;

                  return (
                    <div
                      key={tb.id}
                      onClick={() => setInspectingTable(tb)}
                      className={`w-full max-w-[320px] mx-auto shrink-0 p-3 rounded-[20px] dark:rounded-xl border transition-all relative overflow-hidden flex flex-col justify-between gap-3 dark:bg-[#1C1C1E] ${
                        inspectingTable?.id === tb.id ? 'dark:border-primary' : 'dark:border-[rgba(255,255,255,0.1)]'
                      } ${
                        isFull
                          ? 'bg-bg-surface/50 border-red-500/30 '
                          : isPartial
                          ? 'bg-bg-surface/50 border-amber-500/30 '
                          : tb.status === 'reserved'
                          ? 'bg-bg-surface border-blue-500/20 '
                          : tb.status === 'maintenance'
                          ? 'bg-bg-surface/50 border-border-main opacity-60 '
                          : 'bg-bg-surface border-emerald-500/30 hover:border-primary/50 '
                      }`}
                    >
                      {/* Header: Table Number & Semantic Status Pill */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono dark:text-[#D4AF37] text-primary font-black text-xl tracking-wider">{tb.tableNumber}</span>
                          <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest block mt-0.5">
                            {selectedPlace === 'STANDING_BAR' ? 'Standard Zone' : 'Premium Zone'}
                          </p>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            isFull
                              ? 'dark:bg-red-500/15 bg-red-500/10 dark:text-red-400 text-red-700 border border-red-500/30'
                              : isPartial
                              ? 'dark:bg-amber-500/15 bg-amber-500/10 dark:text-amber-400 text-amber-700 border border-amber-500/30'
                              : tb.status === 'reserved'
                              ? 'dark:bg-blue-500/15 bg-blue-500/10 dark:text-blue-400 text-blue-700 border border-blue-500/30'
                              : tb.status === 'maintenance'
                              ? 'dark:bg-zinc-800/50 bg-zinc-200/50 text-text-muted border border-border-main'
                              : 'dark:bg-emerald-500/15 bg-emerald-500/10 dark:text-emerald-400 text-emerald-700 border border-emerald-500/30'
                          }`}
                        >
                          {isOccupied ? <Users size={12} /> : <CheckCircle2 size={12} />}
                          <span className="capitalize">
                            {isFull ? 'Occupied (Full)' : isPartial ? 'Partially Occupied' : tb.status}
                          </span>
                        </span>
                      </div>

                      {/* Central Dynamic Table Diagram Container */}
                      <div className="py-1 px-2 rounded-2xl bg-bg-primary/90 border border-border-sidebar/40 flex items-center justify-center h-28 relative">
                        <TableDiagram
                          capacity={capacity}
                          occupiedCount={occupiedCount}
                          status={tb.status}
                          tableNumber={tb.tableNumber}
                        />
                      </div>

                      {/* Info Bar - Size, Capacity & Token Metadata */}
                      <div className="space-y-1 text-xs px-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-text-muted">
                          <span className="uppercase text-[9px] tracking-widest text-text-muted">
                            {sizeCategory} • <span className="font-black text-text-primary text-[10px]">{capacity}</span> Pax
                          </span>
                          <span className={
                            isFull
                              ? 'dark:text-red-400 text-red-700 font-black text-[10px]'
                              : isPartial
                              ? 'dark:text-amber-400 text-amber-700 font-black text-[10px]'
                              : tb.status === 'reserved'
                              ? 'dark:text-blue-400 text-blue-700 font-black text-[10px]'
                              : 'dark:text-emerald-400 text-emerald-700 font-black text-[10px]'
                          }>
                            {occupiedCount} / {capacity} Seats
                          </span>
                        </div>

                        {assignedToken ? (
                          <div className="flex items-center justify-between text-[11px] border-t border-border-main/40 pt-1 text-text-muted">
                            <span className="font-semibold truncate max-w-[120px]">👤 {assignedToken.customer?.name || 'Guest'}</span>
                            <span className="font-mono text-text-main font-black">{assignedToken.tokenNumber}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-text-muted border-t border-border-main/30 pt-1 flex justify-between">
                            <span className="text-text-muted uppercase text-[9px] tracking-wider">Rate Allowance:</span>
                            <span className="font-mono font-black text-[10.5px] text-text-primary">₹500 / Session</span>
                          </div>
                        )}
                      </div>

                      {/* Card Action Row */}
                      <div className="pt-2 border-t border-border-main/50">
                        {tb.status === 'occupied' ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReleasingTableForConfirm(tb);
                              }}
                              className={`py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all text-center cursor-pointer ${isDark ? 'primary-btn bg-red-500' : 'bg-red-500/10 text-red-700 hover:bg-red-500/15 hover:border-red-500/50 hover:text-red-800 active:bg-red-500/25 active:text-red-900 border border-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-500/20'}`}
                            >
                              <VideoOff size={11} />
                              <span>Release</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const activeTok = getActiveTokenForTable(tb);
                                if (activeTok) {
                                  setExtendingToken(activeTok);
                                } else {
                                  showToast('No active session token found for this table.', 'warning');
                                }
                              }}
                              className="py-2 rounded-xl bg-transparent border border-primary text-primary hover:bg-primary/5 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                              <span>Extend</span>
                            </button>
                          </div>
                        ) : tb.status === 'reserved' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancellingReservationForConfirm(tb);
                            }}
                            className="w-full py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
                          >
                            <X size={12} />
                            <span>Release Reservation</span>
                          </button>
                        ) : tb.status === 'maintenance' || tb.status === 'in_checkin' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReleasingTableForConfirm(tb);
                            }}
                            className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
                          >
                            <Unlock size={12} />
                            <span>Release Table</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectingTable(tb);
                            }}
                            className="w-full py-2.5 rounded-xl primary-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <div className="nav-icon-badge p-0.5">
                              <Plus size={12} />
                            </div>
                            <span>Open for Seating</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </SeatingRow>
            );
          })}
        </div>
      )}

      {/* CENTERED TABLE INSPECTION DIALOG MODAL BOX -> CHANGED TO RIGHT DRAWER */}
      {inspectingTable && (() => {
        const capacity = inspectingTable.capacity || 4;
        const isOccupied = inspectingTable.status === 'occupied';
        const occupiedCount = inspectingToken ? (inspectingToken.personsCount || 1) : (isOccupied ? capacity : 0);
        const isTableReserved = inspectingTable.status === 'reserved' || !!reservations?.some(r => r.tableId === inspectingTable.id && (r.status === 'PENDING' || r.status === 'CONFIRMED'));
        const isTableLocked = inspectingTable.status === 'in_checkin' || inspectingTable.status === 'maintenance';

        return (
          <div className="fixed inset-0 z-50 dark:bg-transparent bg-slate-900/40 flex items-center justify-end p-0 animate-fadeIn pointer-events-none">
            <div className="w-full md:w-[380px] bg-bg-surface border border-border-main border-y-0 border-r-0 border-l-[1px] dark:border-[rgba(255,255,255,0.1)] dark:bg-[#121212] rounded-none p-5 relative text-text-main animate-none h-[100dvh] pointer-events-auto flex flex-col">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-4 dark:pb-5 border-b border-border-main dark:border-[rgba(255,255,255,0.1)] shrink-0">
                <div className="flex items-center gap-2 text-text-main font-bold text-sm sm:text-base pr-2 dark:text-white">
                  <span className="hidden dark:block w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="truncate dark:text-lg">T-{inspectingTable.tableNumber.padStart(2, '0')}</span>
                  <span className="hidden dark:block text-[10px] text-primary ml-2 uppercase">VIP Lounge</span>
                </div>
                <button 
                  onClick={() => setInspectingTable(null)}
                  className="p-0 rounded-lg dark:bg-transparent bg-bg-surface hover:bg-bg-card hover:bg-transparent text-text-muted hover:text-text-main transition-all cursor-pointer shrink-0"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Scrollable Content Area */}
              <div className="flex-1 overflow-y-auto py-5 space-y-6 no-scrollbar">
                
                {/* Top Center Visual Seating View using TableDiagram */}
                <div className="dark:bg-transparent p-5 rounded-none bg-bg-primary border border-border-main dark:border-[rgba(255,255,255,0.1)] flex flex-col items-center justify-center space-y-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">
                    Visual Seating Alignment ({occupiedCount} / {capacity} Seats Occupied)
                  </p>

                  <div className="w-full max-w-sm h-36 flex items-center justify-center">
                    <TableDiagram
                      capacity={capacity}
                      occupiedCount={occupiedCount}
                      status={inspectingTable.status}
                      tableNumber={inspectingTable.tableNumber}
                    />
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

                {/* Table Lock Information for In-Checkin or Maintenance Tables */}
                {(inspectingTable.status === 'in_checkin' || inspectingTable.status === 'maintenance') && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-400">
                      <Lock size={14} className="shrink-0" />
                      <span>Table Lock Information</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-amber-500/20">
                      <span className="text-text-muted">Locked By:</span>
                      <span className="font-bold text-text-main">
                        {inspectingTable.lockedBy || (inspectingTable.status === 'in_checkin' ? 'Receptionist (In Check-In)' : 'Administrator')}
                      </span>
                    </div>
                    {inspectingTable.lockedByRole && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Role:</span>
                        <span className="font-semibold text-text-main uppercase text-[11px]">{inspectingTable.lockedByRole}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-text-muted">Lock Status:</span>
                      <span className="font-semibold text-text-main capitalize">
                        {inspectingTable.status === 'in_checkin' ? 'Check-In Lock (In Progress)' : 'Maintenance Lock (Admin)'}
                      </span>
                    </div>
                    {inspectingTable.lockedAt && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Locked Since:</span>
                        <span className="font-mono text-text-main text-[11px]">
                          {new Date(inspectingTable.lockedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Reservation Details for Reserved Table */}
                {isTableReserved && (
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-400">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>Reservation Details</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCancellingReservationForConfirm(inspectingTable)}
                        className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30 font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                      >
                        Release Res.
                      </button>
                    </div>
                    {(() => {
                      const res = reservations?.find(r => r.tableId === inspectingTable.id && (r.status === 'PENDING' || r.status === 'CONFIRMED'));
                      const resUser = res?.user ? (res.user.fullName || res.user.username) : (res?.userId ? `User (${res.userId.substring(0, 6)})` : 'Receptionist');
                      const resRole = res?.user?.role?.name || res?.user?.role || 'Receptionist';

                      return res ? (
                        <>
                          <div className="flex justify-between pt-1 border-t border-blue-500/20">
                            <span className="text-text-muted">Customer:</span>
                            <span className="font-bold text-text-main">{res.customerName}</span>
                          </div>
                          {res.phoneNumber && (
                            <div className="flex justify-between">
                              <span className="text-text-muted">Phone:</span>
                              <span className="font-mono text-text-main">{res.phoneNumber}</span>
                            </div>
                          )}
                          {res.email && (
                            <div className="flex justify-between">
                              <span className="text-text-muted">Email:</span>
                              <span className="font-mono text-text-main truncate max-w-[180px]">{res.email}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-text-muted">Headcount:</span>
                            <span className="font-bold text-text-main">{res.personsCount} Guests</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-blue-500/20">
                            <span className="text-text-muted">Reserved By:</span>
                            <span className="font-bold text-primary font-mono">{resUser}</span>
                          </div>
                          {resRole && (
                            <div className="flex justify-between">
                              <span className="text-text-muted">Staff Role:</span>
                              <span className="font-semibold text-text-main uppercase text-[10px]">{resRole}</span>
                            </div>
                          )}
                          {res.createdAt && (
                            <div className="flex justify-between">
                              <span className="text-text-muted">Reserved At:</span>
                              <span className="font-mono text-text-main text-[11px]">
                                {new Date(res.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-text-muted text-[11px]">Reserved table details pending confirmation.</p>
                      );
                    })()}
                  </div>
                )}

                {inspectingToken && (
                  <div className="p-4 rounded-2xl bg-bg-primary border border-border-main space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Assigned Customer:</span>
                      <span className="font-bold text-text-main">{inspectingToken.customer?.name || 'Guest'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Phone Number:</span>
                      <span className="font-mono text-text-main">{inspectingToken.customer?.phoneNumber || '—'}</span>
                    </div>
                    {inspectingToken.customer?.email && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Email Address:</span>
                        <span className="font-mono text-text-main">{inspectingToken.customer.email}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-text-muted">Token Pass:</span>
                      <span className="font-mono text-text-main font-bold">{inspectingToken.tokenNumber}</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-4 border-t border-border-main flex flex-col gap-3">
                  {inspectingTable.status === 'occupied' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setReleasingTableForConfirm(inspectingTable)}
                        className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/25 text-red-700 dark:text-red-400 font-bold text-xs border border-red-500/30 transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <VideoOff size={14} />
                        <span>Release Table</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const activeTok = getActiveTokenForTable(inspectingTable);
                          if (activeTok) {
                            setExtendingToken(activeTok);
                          } else {
                            showToast('No active session token found for this table.', 'warning');
                          }
                        }}
                        className="w-full py-2 rounded-xl bg-transparent border border-primary text-primary hover:bg-primary/5 font-bold text-xs transition-all cursor-pointer"
                      >
                        Extend Session
                      </button>
                    </>
                  )}

                  {isAdmin && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(inspectingTable)}
                          className="py-2.5 px-3 rounded-xl bg-transparent border border-primary text-primary hover:bg-primary/5 active:bg-primary/10 font-bold text-xs transition-all cursor-pointer text-center truncate flex items-center justify-center gap-1.5"
                        >
                          Edit Table
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTableForConfirm(inspectingTable)}
                          disabled={inspectingTable.status === 'occupied'}
                          title={inspectingTable.status === 'occupied' ? "Cannot delete an occupied table" : undefined}
                          className="py-2.5 px-3 rounded-xl bg-transparent border border-red-500/35 hover:bg-red-500/5 active:bg-red-500/10 text-red-600 dark:text-red-400 font-bold text-xs transition-all cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed truncate flex items-center justify-center gap-1.5"
                        >
                          Delete Table
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Clear Reservation Button */}
                        <button
                          type="button"
                          disabled={!isTableReserved}
                          onClick={() => setCancellingReservationForConfirm(inspectingTable)}
                          title={isTableReserved ? "Force-cancel the pending reservation and release table" : "No active reservation on this table"}
                          className={`py-2.5 px-3 rounded-xl border font-bold text-xs transition-all text-center truncate flex items-center justify-center gap-1.5 ${
                            isTableReserved
                              ? 'bg-blue-500/15 hover:bg-blue-500/25 active:bg-blue-500/30 text-blue-700 dark:text-blue-400 border-blue-500/40 cursor-pointer shadow-sm'
                              : 'bg-transparent border-border-main/30 text-text-muted/40 opacity-40 cursor-not-allowed'
                          }`}
                        >
                          <X size={13} className="shrink-0" />
                          <span>Clear Reservation</span>
                        </button>

                        {/* Lock / Release Table Button */}
                        {isTableLocked ? (
                          <button
                            type="button"
                            disabled={isTogglingLock}
                            onClick={() => setReleasingTableForConfirm(inspectingTable)}
                            title="Release table lock and clear abandoned check-in drafts"
                            className="py-2.5 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/30 text-amber-700 dark:text-amber-400 border border-amber-500/40 font-bold text-xs transition-all cursor-pointer text-center truncate flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <Unlock size={13} className="shrink-0" />
                            <span>Release Table</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={inspectingTable.status === 'occupied' || isTogglingLock}
                            onClick={() => handleToggleLockTable(inspectingTable)}
                            title={inspectingTable.status === 'occupied' ? "Cannot lock an occupied table" : "Lock table for maintenance"}
                            className={`py-2.5 px-3 rounded-xl border font-bold text-xs transition-all text-center truncate flex items-center justify-center gap-1.5 ${
                              inspectingTable.status === 'occupied'
                                ? 'bg-transparent border-border-main/30 text-text-muted/40 opacity-40 cursor-not-allowed'
                                : 'bg-transparent border-border-main hover:bg-bg-primary text-text-muted hover:text-text-main cursor-pointer'
                            }`}
                          >
                            <Lock size={13} className="shrink-0" />
                            <span>Lock Table</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setInspectingTable(null)}
                    className="w-full py-2.5 rounded-xl bg-transparent text-xs font-bold text-text-muted hover:text-text-main border border-border-main dark:border-[rgba(255,255,255,0.1)] cursor-pointer mt-1 transition-all"
                  >
                    Close Panel
                  </button>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* ADD TABLE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] dark:bg-black/75 bg-slate-900/35 flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-main rounded-3xl p-6 w-full max-w-md space-y-4 relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-text-main font-bold text-sm">
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
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary"
                  required
                />
                {/* Suggestions */}
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-text-muted font-bold self-center mr-1">Suggestions:</span>
                    {suggestions.map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setTableNumber(sug)}
                        className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all border ${
                          normalizedInput === sug
                            ? 'bg-primary text-white border-primary'
                            : 'bg-bg-primary text-text-muted border-border-main hover:text-text-main hover:border-text-muted'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
                {isNameDuplicate && (
                  <p className="text-red-500 text-[10px] mt-1.5 font-bold">
                    Table name already exists. Please use a different table name.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Guest Seat Capacity (1 - 20)</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                  min={1}
                  max={20}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary"
                  required
                />
                {parseInt(capacity, 10) >= 20 && (
                  <p className="text-red-500 text-[10px] mt-1 font-bold">
                    Maximum table capacity is 20.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Place Type Category</label>
                <select
                  value={placeType}
                  onChange={e => setPlaceType(e.target.value)}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary"
                >
                  <option value="STANDING_BAR">Standing Bar Zone</option>
                  <option value="PREMIUM_LOUNGE">Premium Lounge Zone</option>
                </select>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl text-xs font-semibold transition-all premium-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid}
                  title={isSubmitting ? "Creating..." : !isFormValid ? "Fill all fields" : undefined}
                  className="flex-1 py-3 rounded-xl primary-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Confirm Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TABLE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] dark:bg-black/75 bg-slate-900/35 flex items-center justify-center p-4 animate-fadeIn pointer-events-auto">
          <div className="bg-bg-surface border border-border-main rounded-3xl p-6 w-full max-w-md space-y-4 relative text-text-main">
            <button 
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-text-main font-bold text-sm">
              <Grid3X3 size={18} /> Edit Seating Table ({inspectingTable?.tableNumber})
            </div>

            <form onSubmit={handleUpdateTable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">
                  Table Number <span className="text-text-muted">(Must match pattern S-01, L-01)</span>
                </label>
                <input
                  type="text"
                  value={editTableNumber}
                  onChange={e => setEditTableNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. S-01"
                  disabled={isInspectingTableOccupied}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
                {isInspectingTableOccupied && (
                  <p className="text-[10px] text-amber-500 font-semibold mt-1.5">
                    ⚠ Seating is occupied. Only capacity details can be updated safely.
                  </p>
                )}
                {/* Suggestions */}
                {editSuggestions.length > 0 && !isInspectingTableOccupied && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-text-muted font-bold self-center mr-1">Suggestions:</span>
                    {editSuggestions.map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setEditTableNumber(sug)}
                        className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition-all border ${
                          editNormalizedInput === sug
                            ? 'bg-primary text-white border-primary'
                            : 'bg-bg-primary text-text-muted border-border-main hover:text-text-main hover:border-text-muted'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
                {isEditNameDuplicate && (
                  <p className="text-red-500 text-[10px] mt-1.5 font-bold">
                    Table name already exists. Please use a different table name.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Guest Seat Capacity (1 - 20)</label>
                <input
                  type="number"
                  value={editCapacity}
                  onChange={e => setEditCapacity(e.target.value)}
                  min={1}
                  max={20}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary"
                  required
                />
                {parseInt(editCapacity, 10) >= 20 && (
                  <p className="text-red-500 text-[10px] mt-1 font-bold">
                    Maximum table capacity is 20.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Place Type Category</label>
                <select
                  value={editPlaceType}
                  onChange={e => setEditPlaceType(e.target.value)}
                  disabled={isInspectingTableOccupied}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="STANDING_BAR">Standing Bar Zone</option>
                  <option value="PREMIUM_LOUNGE">Premium Lounge Zone</option>
                </select>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-3 rounded-xl text-xs font-semibold transition-all premium-btn-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit || !isEditFormValid}
                  title={isSubmittingEdit ? "Updating..." : !isEditFormValid ? "Fill all fields" : undefined}
                  className="flex-1 py-3 rounded-xl primary-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingEdit ? 'Updating...' : 'Update Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG MODAL */}
      {deletingTableForConfirm && (
        <div className="fixed inset-0 z-[120] dark:bg-black/85 bg-slate-900/60 flex items-center justify-center p-4 animate-fadeIn pointer-events-auto">
          <div className="bg-bg-surface border border-border-main rounded-3xl p-6 w-full max-w-sm space-y-4 relative text-text-main">
            <button 
              onClick={() => setDeletingTableForConfirm(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="text-text-main font-bold text-base flex items-center gap-2">
              Delete Table
            </div>

            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to permanently delete Table <strong className="text-text-main font-bold font-mono">{deletingTableForConfirm.tableNumber}</strong>? This action will remove the table configuration and cannot be undone.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTableForConfirm(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all premium-btn-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTable}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RELEASE CONFIRMATION DIALOG MODAL */}
      {releasingTableForConfirm && (() => {
        const isOccupied = releasingTableForConfirm.status === 'occupied';
        const activeTok = isOccupied
          ? getActiveTokenForTable(releasingTableForConfirm)
          : null;
        const customerName = activeTok?.customerName || (activeTok?.customer as any)?.name || 'Guest Customer';
        const customerPhone = activeTok?.phoneNumber || (activeTok?.customer as any)?.phoneNumber || '';
        const customerEmail = activeTok?.email || (activeTok?.customer as any)?.email || '';
        const personsCount = activeTok?.personsCount || (activeTok as any)?.persons || 1;
        const initialAmount = activeTok?.amountPaid ? parseFloat(activeTok.amountPaid.toString()) : 0;
        const extensionAmount = (activeTok as any)?.extensions?.reduce((sum: number, ext: any) => sum + (ext.amount ? parseFloat(ext.amount.toString()) : 0), 0) || 0;
        const totalAmount = initialAmount + extensionAmount;

        return (
          <div className="fixed inset-0 z-[120] dark:bg-black/85 bg-slate-900/60 flex items-center justify-center p-4 animate-fadeIn pointer-events-auto">
            <div className="bg-bg-surface border border-border-main rounded-3xl p-6 w-full max-w-sm space-y-4 relative text-text-main">
              <button 
                onClick={() => setReleasingTableForConfirm(null)}
                className="absolute top-4 right-4 text-text-muted hover:text-text-main cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="text-text-main font-bold text-base flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500 shrink-0" />
                <span>Release Table {releasingTableForConfirm.tableNumber}</span>
              </div>

              <p className="text-xs text-text-muted leading-relaxed">
                {isOccupied ? (
                  <>
                    Are you sure you want to release Table <strong className="text-text-main font-bold font-mono">{releasingTableForConfirm.tableNumber}</strong>? This will checkout the session, archive all financial details, and mark the table available.
                  </>
                ) : (
                  <>
                    Are you sure you want to release the lock on Table <strong className="text-text-main font-bold font-mono">{releasingTableForConfirm.tableNumber}</strong>? This will clear any abandoned check-in draft and make the table available for new guests.
                  </>
                )}
              </p>

              {isOccupied && activeTok && (
                <div className="p-3.5 bg-bg-primary border border-border-main rounded-2xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Customer:</span>
                    <span className="font-bold text-text-main">{customerName}</span>
                  </div>
                  {customerPhone && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Phone:</span>
                      <span className="font-mono text-text-main">{customerPhone}</span>
                    </div>
                  )}
                  {customerEmail && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Email:</span>
                      <span className="font-mono text-text-main truncate max-w-[180px]">{customerEmail}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-text-muted">Headcount:</span>
                    <span className="font-semibold text-text-main">{personsCount} Guests</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border-main/50">
                    <span className="text-text-muted">Initial Payment:</span>
                    <span className="font-mono text-text-main">₹{initialAmount}</span>
                  </div>
                  {extensionAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-muted">Extended Amount:</span>
                      <span className="font-mono text-emerald-500 font-semibold">+₹{extensionAmount}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-border-main font-bold">
                    <span className="text-text-muted">Total Amount:</span>
                    <span className="font-mono text-primary">₹{totalAmount}</span>
                  </div>
                  <div className="pt-1.5 border-t border-border-main/50 text-[11px] text-text-muted italic">
                    Closure phrase: &ldquo;<strong className="text-text-main not-italic font-semibold">This table was closed by Admin</strong>&rdquo;
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReleasingTableForConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all premium-btn-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isTogglingLock}
                  onClick={async () => {
                    const tb = releasingTableForConfirm;
                    setReleasingTableForConfirm(null);
                    if (tb.status === 'occupied') {
                      await handleRelease(tb.id);
                    } else {
                      await handleToggleLockTable(tb);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl primary-btn text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  Confirm Release
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* CANCEL / CLEAR RESERVATION CONFIRMATION DIALOG MODAL */}
      {cancellingReservationForConfirm && (() => {
        const res = reservations?.find(r => r.tableId === cancellingReservationForConfirm.id && r.status === 'PENDING');
        return (
          <div className="fixed inset-0 z-[120] dark:bg-black/85 bg-slate-900/60 flex items-center justify-center p-4 animate-fadeIn pointer-events-auto">
            <div className="bg-bg-surface border border-border-main rounded-3xl p-6 w-full max-w-sm space-y-4 relative text-text-main">
              <button 
                onClick={() => setCancellingReservationForConfirm(null)}
                className="absolute top-4 right-4 text-text-muted hover:text-text-main cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="text-text-main font-bold text-base flex items-center gap-2 text-red-500">
                <AlertTriangle size={18} className="shrink-0" />
                <span>Release Reservation on T-{cancellingReservationForConfirm.tableNumber}</span>
              </div>

              <p className="text-xs text-text-muted leading-relaxed">
                Are you sure you want to cancel the reservation on Table <strong className="text-text-main font-bold font-mono">{cancellingReservationForConfirm.tableNumber}</strong>? This will clear the reservation and immediately mark the table available.
              </p>

              {res && (() => {
                const resUser = res.user ? (res.user.fullName || res.user.username) : (res.userId ? `User (${res.userId.substring(0, 6)})` : 'Receptionist');
                const resRole = res.user?.role?.name || res.user?.role || 'Receptionist';
                return (
                  <div className="p-3 bg-bg-primary border border-border-main rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Customer:</span>
                      <span className="font-semibold text-text-main">{res.customerName}</span>
                    </div>
                    {res.phoneNumber && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Phone:</span>
                        <span className="font-mono text-text-main">{res.phoneNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-text-muted">Headcount:</span>
                      <span className="font-bold text-text-main">{res.personsCount} Guests</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-border-main/50">
                      <span className="text-text-muted">Reserved By:</span>
                      <span className="font-bold text-primary font-mono">{resUser} ({resRole})</span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingReservationForConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all premium-btn-secondary cursor-pointer"
                >
                  Keep Reservation
                </button>
                <button
                  type="button"
                  disabled={isSubmittingCancelRes}
                  onClick={async () => {
                    setIsSubmittingCancelRes(true);
                    try {
                      const resToCancel = reservations?.find(r => r.tableId === cancellingReservationForConfirm.id && (r.status === 'PENDING' || r.status === 'CONFIRMED'));
                      if (resToCancel) {
                        await api.cancelReservation(resToCancel.id);
                      } else {
                        await api.patchTableStatus(cancellingReservationForConfirm.id, 'available');
                      }
                      showToast(`Reservation cancelled. Table ${cancellingReservationForConfirm.tableNumber} is now available.`, 'success');
                      setCancellingReservationForConfirm(null);
                      if (inspectingTable && inspectingTable.id === cancellingReservationForConfirm.id) {
                        setInspectingTable(null);
                      }
                      refreshTables();
                      refreshReservations();
                    } catch (err: any) {
                      showToast(err.message || 'Failed to cancel reservation.', 'danger');
                    } finally {
                      setIsSubmittingCancelRes(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {isSubmittingCancelRes ? 'Releasing...' : 'Confirm Release'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* EXTEND SESSION MODAL */}
      {extendingToken && (
        <ExtendSessionModal
          isOpen={!!extendingToken}
          token={extendingToken}
          rates={rates || []}
          onClose={() => setExtendingToken(null)}
          onSuccess={() => {
            setExtendingToken(null);
            showToast('Session extended successfully!', 'success');
            refreshTables();
            refreshTokens();
          }}
        />
      )}
    </div>
  );
};
