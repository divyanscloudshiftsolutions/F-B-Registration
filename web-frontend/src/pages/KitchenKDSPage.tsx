import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChefHat, Clock, AlertTriangle, CheckCircle2, Loader2, RotateCcw, Layers, UtensilsCrossed, Ban, X, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { joinRoom, leaveRoom, onSocketEvent } from '../services/socket';
import { KitchenStockTab } from '../components/kitchen/KitchenStockTab';
import { useServedUndo } from '../services/servedUndoManager';

interface KdsItem {
  id: string;
  orderId: string;
  menuItemId: string;
  itemName: string;
  variantName?: string | null;
  selectedModifiers?: any[];
  specialInstructions?: string | null;
  quantity: number;
  station: string;
  status: 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED' | 'STOCK_OUT';
  foodType?: string;
  isSessionClosed?: boolean;
  tokenStatus?: string | null;
  createdAt: string;
}

interface KdsTicket {
  orderId: string;
  orderNumber: number;
  tableNumber: string;
  placedAt: string;
  notes: string | null;
  status: string;
  isSessionClosed?: boolean;
  tokenStatus?: string | null;
  items: KdsItem[];
}

interface KitchenKDSPageProps {
  initialSubTab?: 'tickets' | 'stock';
}

export const KitchenKDSPage: React.FC<KitchenKDSPageProps> = ({ initialSubTab = 'tickets' }) => {
  const { user, showToast } = useAuth();
  const userRoleLower = user?.role ? user.role.toLowerCase() : '';
  const canBump = ['chef', 'admin', 'manager'].includes(userRoleLower);

  const [activeSubTab, setActiveSubTab] = useState<'tickets' | 'stock'>(initialSubTab);
  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<number>(Date.now());
  const [stockOutModalItem, setStockOutModalItem] = useState<{ menuItemId: string; itemName: string } | null>(null);
  const [isStockOutSubmitting, setIsStockOutSubmitting] = useState<boolean>(false);
  const [cleanupModalItem, setCleanupModalItem] = useState<{
    id: string;
    itemName: string;
    tableNumber: string;
    orderNumber: number;
    quantity: number;
  } | null>(null);
  const [isCleanupSubmitting, setIsCleanupSubmitting] = useState<boolean>(false);

  // Shared in-memory 5s Undo manager that survives tab switching
  const {
    isPending: isServedUndoPending,
    getRemainingSeconds: getServedUndoSeconds,
    startUndo: startServedUndo,
    cancelUndo: cancelServedUndo,
  } = useServedUndo();

  const isFetchingRef = useRef<boolean>(false);
  const pendingFetchRef = useRef<boolean>(false);

  // 1-second live ticker for accurate elapsed displays without polling the server
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTickets = async (silent: boolean = false) => {
    if (isFetchingRef.current) {
      pendingFetchRef.current = true;
      return;
    }
    isFetchingRef.current = true;
    if (!silent) setLoading(true);

    try {
      const res = await api.getKdsOrders('KITCHEN');
      const ticketsList = Array.isArray(res) ? res : ((res as any)?.tickets || []);
      setTickets(ticketsList);
    } catch (err: any) {
      console.warn('Failed to load Kitchen KDS tickets:', err.message);
    } finally {
      if (!silent) setLoading(false);
      isFetchingRef.current = false;
      if (pendingFetchRef.current) {
        pendingFetchRef.current = false;
        fetchTickets(true);
      }
    }
  };

  useEffect(() => {
    fetchTickets();
    joinRoom('kds:kitchen');
    joinRoom('staff:all');
    joinRoom('tables:all');

    const unsubItemUpdated = onSocketEvent('order.item.updated', (payload) => {
      if (!payload?.station || payload.station === 'KITCHEN' || payload.station === 'DESSERT') {
        fetchTickets(true);
      }
    });

    const unsubOrderCreated = onSocketEvent('order.created', (payload) => {
      const hasKitchen = payload?.items?.some((i: any) => i.station === 'KITCHEN' || i.station === 'DESSERT');
      if (!payload?.items || hasKitchen) {
        fetchTickets(true);
      }
    });

    const unsubMenuUpdated = onSocketEvent('menu.updated', () => {
      fetchTickets(true);
    });

    const unsubSessionClosed = onSocketEvent('table.session.closed', () => {
      fetchTickets(true);
    });

    const unsubBillSettled = onSocketEvent('bill.settled', () => {
      fetchTickets(true);
    });

    const handleGlobalRefresh = () => fetchTickets(true);
    window.addEventListener('app:global-refresh', handleGlobalRefresh);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTickets(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTickets(true);
      }
    }, 5000);

    return () => {
      leaveRoom('kds:kitchen');
      leaveRoom('staff:all');
      leaveRoom('tables:all');
      unsubItemUpdated();
      unsubOrderCreated();
      unsubMenuUpdated();
      unsubSessionClosed();
      unsubBillSettled();
      window.removeEventListener('app:global-refresh', handleGlobalRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  const handleUpdateStatus = async (
    orderItemId: string,
    targetStatus: string,
    isReverse: boolean = false,
    itemInfo?: { itemName?: string; tableNumber?: string }
  ) => {
    if (updatingIds.has(orderItemId)) return;

    if (targetStatus === 'SERVED' && !isReverse) {
      startServedUndo(orderItemId, user?.id, () => fetchTickets(true));
      return;
    }

    setUpdatingIds((prev) => new Set(prev).add(orderItemId));
    try {
      await api.updateOrderItemStatus(orderItemId, targetStatus, user?.id);
      showToast(
        isReverse ? `Dish moved back to ${targetStatus}` : `Dish status updated to ${targetStatus}`,
        isReverse ? 'info' : 'success'
      );
      await fetchTickets(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to update dish status', 'danger');
      await fetchTickets(true);
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderItemId);
        return next;
      });
    }
  };

  const handleOpenStockOutModal = (menuItemId: string, itemName: string) => {
    if (!canBump) return;
    setStockOutModalItem({ menuItemId, itemName });
  };

  const handleConfirmStockOut = async () => {
    if (!stockOutModalItem || isStockOutSubmitting) return;
    setIsStockOutSubmitting(true);
    try {
      await api.setItemAvailability(stockOutModalItem.menuItemId, false);
      showToast(`"${stockOutModalItem.itemName}" marked as Stock Out`, 'warning');
      setStockOutModalItem(null);
      await fetchTickets(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to update stock status', 'danger');
    } finally {
      setIsStockOutSubmitting(false);
    }
  };

  const handleConfirmCleanup = async () => {
    if (!cleanupModalItem || isCleanupSubmitting) return;
    setIsCleanupSubmitting(true);
    try {
      await api.cleanupClosedSessionOrderItem(cleanupModalItem.id);
      showToast(`Order for "${cleanupModalItem.itemName}" removed from KDS`, 'info');
      setCleanupModalItem(null);
      await fetchTickets(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to remove order item', 'danger');
    } finally {
      setIsCleanupSubmitting(false);
    }
  };

  const getElapsedMin = (placedAt: string) => {
    return Math.max(0, Math.floor((now - new Date(placedAt).getTime()) / 60000));
  };

  const formatElapsedMMSS = (placedAt: string) => {
    const totalSecs = Math.max(0, Math.floor((now - new Date(placedAt).getTime()) / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Flatten active KITCHEN/DESSERT items for board columns (excluding terminal SERVED, CANCELLED, STOCK_OUT)
  const activeItems = useMemo(() => {
    return tickets.flatMap((t) =>
      t.items
        .filter(
          (i) =>
            (i.station === 'KITCHEN' || i.station === 'DESSERT') &&
            i.status !== 'SERVED' &&
            (i.status as string) !== 'CANCELLED' &&
            (i.status as string) !== 'STOCK_OUT'
        )
        .map((i) => ({ ticket: t, item: i }))
    );
  }, [tickets]);

  const columns: {
    key: KdsItem['status'];
    label: string;
    actionLabel: string;
    nextStatus: string;
    prevStatus?: string;
    prevLabel?: string;
  }[] = [
    { key: 'PLACED', label: 'New', actionLabel: 'Accept', nextStatus: 'ACCEPTED' },
    { key: 'ACCEPTED', label: 'Accepted', actionLabel: 'Start', nextStatus: 'PREPARING', prevStatus: 'PLACED', prevLabel: 'Move back to Placed' },
    { key: 'PREPARING', label: 'Preparing', actionLabel: 'Ready', nextStatus: 'READY', prevStatus: 'ACCEPTED', prevLabel: 'Move back to Accepted' },
    { key: 'READY', label: 'Ready', actionLabel: 'Served', nextStatus: 'SERVED', prevStatus: 'PREPARING', prevLabel: 'Move back to Preparing' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 dark:bg-[#111114] bg-[#F5F3FA] p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary dark:bg-amber-500/15 dark:border-amber-500/20 dark:text-amber-400 flex items-center justify-center shadow-xs">
            <ChefHat size={22} />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              Kitchen Display System (KDS)
            </h1>
            <p className="text-xs text-zinc-500 dark:text-text-muted font-medium">Food &amp; Dessert station tickets synchronized in real time</p>
          </div>
        </div>

        {/* Subtab Toggle (Orders vs Stock In / Stock Out) */}
        <div className="flex items-center p-1 rounded-2xl bg-zinc-200/80 dark:bg-white/5 border border-zinc-300 dark:border-white/10 shrink-0">
          <button
            onClick={() => setActiveSubTab('tickets')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'tickets'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs border border-zinc-200 dark:border-white/10'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Layers size={14} />
            <span>Orders</span>
            {activeItems.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-primary/10 text-primary dark:bg-amber-500/20 dark:text-amber-400">
                {activeItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab('stock')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'stock'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs border border-zinc-200 dark:border-white/10'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <UtensilsCrossed size={14} />
            <span>Stock In / Stock Out</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'stock' ? (
        <KitchenStockTab />
      ) : loading && tickets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-24 text-zinc-500 text-sm">
          <Loader2 className="animate-spin mr-2" size={20} /> Loading Kitchen tickets...
        </div>
      ) : (
        /* Responsive Kanban Board: 1 col on mobile, 2 cols on tablet, 4 cols on desktop */
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 flex-1">
          {columns.map((col) => {
            const list = activeItems.filter((entry) => entry.item.status === col.key);

            return (
              <div
                key={col.key}
                className="rounded-2xl border border-zinc-300 dark:border-white/10 bg-zinc-100 dark:bg-[#18181A] p-3.5 sm:p-4 flex flex-col min-h-[420px] shadow-xs"
              >
                <div className="mb-3 flex items-center justify-between text-sm pb-2 border-b border-zinc-200 dark:border-white/10">
                  <span className="font-black text-base text-zinc-900 dark:text-white">{col.label}</span>
                  <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/20">
                    {list.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  {list.map(({ ticket, item }) => {
                    const mins = getElapsedMin(ticket.placedAt);
                    const priority = mins >= 20 ? 'urgent' : mins >= 10 ? 'warn' : 'ok';
                    const isUpdating = updatingIds.has(item.id);
                    const isClosedSession = Boolean(item.isSessionClosed ?? ticket.isSessionClosed);

                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-3.5 space-y-2.5 transition-all shadow-xs ${
                          priority === 'urgent'
                            ? 'border-rose-500 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-950/25'
                            : priority === 'warn'
                            ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/25'
                            : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#141416]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-zinc-800 dark:text-zinc-200 truncate">
                              Table {ticket.tableNumber || 'N/A'} · #{String(ticket.orderNumber).padStart(2, '0')}
                            </span>
                            {isClosedSession && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-zinc-200/90 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300/80 dark:border-zinc-700 shrink-0">
                                Session Closed
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`inline-flex items-center gap-1 font-mono font-bold ${
                                priority === 'urgent'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : priority === 'warn'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-zinc-700 dark:text-zinc-400'
                              }`}
                            >
                              {priority === 'urgent' && <AlertTriangle size={12} className="text-rose-600 dark:text-rose-400 shrink-0" />}
                              {priority === 'warn' && <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />}
                              <Clock size={12} className="shrink-0" />
                              <span>{formatElapsedMMSS(ticket.placedAt)}</span>
                            </span>
                            {canBump && isClosedSession && item.status === 'PLACED' && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() =>
                                  setCleanupModalItem({
                                    id: item.id,
                                    itemName: item.itemName,
                                    tableNumber: ticket.tableNumber,
                                    orderNumber: ticket.orderNumber,
                                    quantity: item.quantity,
                                  })
                                }
                                title="Remove closed-session order"
                                aria-label="Remove closed-session order"
                                className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="font-extrabold text-sm text-zinc-900 dark:text-white">
                          {item.quantity} × {item.itemName}
                          {item.variantName ? ` (${item.variantName})` : ''}
                        </div>

                        {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                          <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                            {item.selectedModifiers.map((m: any) => m.optionName || m.name).join(', ')}
                          </div>
                        )}

                        {item.specialInstructions && (
                          <div className="text-[11px] font-semibold italic text-amber-700 dark:text-amber-400">
                            &quot;{item.specialInstructions}&quot;
                          </div>
                        )}

                        <div className="pt-2 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {canBump && col.prevStatus && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleUpdateStatus(item.id, col.prevStatus!, true)}
                                title={col.prevLabel}
                                aria-label={col.prevLabel}
                                className={`p-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-300 transition-all flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                                  isUpdating ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              >
                                {isUpdating ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <RotateCcw size={14} />
                                )}
                              </button>
                            )}

                            {canBump && col.key === 'PLACED' && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleOpenStockOutModal(item.menuItemId, item.itemName)}
                                title={`Mark "${item.itemName}" as Stock Out`}
                                aria-label={`Mark "${item.itemName}" as Stock Out`}
                                className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50"
                              >
                                <Ban size={13} />
                                <span>Stock Out</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isServedUndoPending(item.id) ? (
                              <button
                                type="button"
                                onClick={() => cancelServedUndo(item.id)}
                                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer animate-pulse"
                              >
                                <RotateCcw size={14} />
                                <span>Undo {getServedUndoSeconds(item.id) ?? 1}s</span>
                              </button>
                            ) : canBump ? (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() =>
                                  handleUpdateStatus(item.id, col.nextStatus, false, {
                                    itemName: item.itemName,
                                    tableNumber: ticket.tableNumber,
                                  })
                                }
                                className={`px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-extrabold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                  isUpdating ? 'opacity-60 cursor-not-allowed' : ''
                                }`}
                              >
                                {isUpdating ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={14} />
                                )}
                                <span>{isUpdating ? 'Updating...' : col.actionLabel}</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-zinc-600 dark:text-zinc-400 italic px-2.5 py-1 rounded-lg bg-zinc-100 border border-zinc-200 dark:bg-white/5 dark:border-white/10">
                                View Only
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {list.length === 0 && (
                    <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-zinc-300 dark:border-white/15 bg-zinc-50/70 dark:bg-[#141416]/50 rounded-2xl">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 font-bold">No orders in {col.label.toLowerCase()}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stock Out Confirmation Dialog */}
      {stockOutModalItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="stockout-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Ban className="w-5 h-5" />
              </div>
              <button
                type="button"
                disabled={isStockOutSubmitting}
                onClick={() => setStockOutModalItem(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 id="stockout-dialog-title" className="text-base font-black text-zinc-900 dark:text-white">
                Mark "{stockOutModalItem.itemName}" as Stock Out?
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Are you sure you want to mark <strong className="text-zinc-900 dark:text-white font-bold">{stockOutModalItem.itemName}</strong> as out of stock?
              </p>
              <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3.5 rounded-xl space-y-1.5">
                <p className="text-[11px] leading-relaxed">
                  • <strong>Already accepted items</strong> (Accepted, Preparing, Ready, Served) remain unaffected and continue through normal kitchen workflow.
                </p>
                <p className="text-[11px] leading-relaxed">
                  • <strong>All unaccepted orders</strong> for this dish will automatically become <strong>Stock Out (₹0 / Not Charged)</strong>.
                </p>
                <p className="text-[11px] leading-relaxed">
                  • Menu catalog availability will be turned <strong>OFF</strong> for future customer orders.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isStockOutSubmitting}
                onClick={() => setStockOutModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isStockOutSubmitting}
                onClick={handleConfirmStockOut}
                className="px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isStockOutSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                Confirm Stock Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Closed-Session Order Cleanup Confirmation Dialog */}
      {cleanupModalItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cleanup-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
                <Trash2 className="w-5 h-5" />
              </div>
              <button
                type="button"
                disabled={isCleanupSubmitting}
                onClick={() => setCleanupModalItem(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 id="cleanup-dialog-title" className="text-base font-black text-zinc-900 dark:text-white">
                Clean Up Closed-Session Order?
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                The customer dining session for <strong className="text-zinc-900 dark:text-white font-bold">Table {cleanupModalItem.tableNumber} (Order #{String(cleanupModalItem.orderNumber).padStart(2, '0')})</strong> is already closed.
              </p>
              <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 p-3.5 rounded-xl space-y-1.5">
                <p className="text-[11px] leading-relaxed">
                  • <strong>Item:</strong> {cleanupModalItem.quantity} × {cleanupModalItem.itemName}
                </p>
                <p className="text-[11px] leading-relaxed">
                  • This pending order was never accepted and can no longer be processed since the dining session ended.
                </p>
                <p className="text-[11px] leading-relaxed">
                  • Confirming will remove this order card from the KDS and release any reserved inventory back to stock.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isCleanupSubmitting}
                onClick={() => setCleanupModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCleanupSubmitting}
                onClick={handleConfirmCleanup}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isCleanupSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Remove Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenKDSPage;
