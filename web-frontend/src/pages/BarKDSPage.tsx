import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Wine, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { joinRoom, leaveRoom, onSocketEvent } from '../services/socket';

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
  status: 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'CANCELLED';
  foodType?: string;
  createdAt: string;
}

interface KdsTicket {
  orderId: string;
  orderNumber: number;
  tableNumber: string;
  placedAt: string;
  notes: string | null;
  status: string;
  items: KdsItem[];
}

export const BarKDSPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const userRoleLower = user?.role ? user.role.toLowerCase() : '';
  const canBump = ['bartender', 'admin', 'manager'].includes(userRoleLower);

  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<number>(Date.now());

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
      const res = await api.getKdsOrders('BAR');
      const ticketsList = Array.isArray(res) ? res : ((res as any)?.tickets || []);
      setTickets(ticketsList);
    } catch (err: any) {
      console.warn('Failed to load Bar KDS tickets:', err.message);
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
    joinRoom('kds:bar');

    const unsubItemUpdated = onSocketEvent('order.item.updated', (payload) => {
      // Re-fetch tickets silently if event affects bar station or general orders
      if (!payload?.station || payload.station === 'BAR') {
        fetchTickets(true);
      }
    });

    const unsubOrderCreated = onSocketEvent('order.created', (payload) => {
      const hasBar = payload?.items?.some((i: any) => i.station === 'BAR');
      if (!payload?.items || hasBar) {
        fetchTickets(true);
      }
    });

    const handleGlobalRefresh = () => fetchTickets(true);
    window.addEventListener('app:global-refresh', handleGlobalRefresh);

    // Visibility change handler: pause polling when backgrounded
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTickets(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Fallback polling every 5 seconds (only when tab is visible)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTickets(true);
      }
    }, 5000);

    return () => {
      leaveRoom('kds:bar');
      unsubItemUpdated();
      unsubOrderCreated();
      window.removeEventListener('app:global-refresh', handleGlobalRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  const handleAdvanceStatus = async (orderItemId: string, nextStatus: string) => {
    if (updatingIds.has(orderItemId)) return; // Prevent double-clicks

    setUpdatingIds((prev) => new Set(prev).add(orderItemId));
    try {
      await api.updateOrderItemStatus(orderItemId, nextStatus, user?.id);
      showToast(`Drink status updated to ${nextStatus}`, 'success');
      await fetchTickets(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to update drink status', 'danger');
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderItemId);
        return next;
      });
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

  // Flatten active BAR items for board columns (excluding terminal SERVED and CANCELLED)
  const activeItems = useMemo(() => {
    return tickets.flatMap((t) =>
      t.items
        .filter((i) => i.station === 'BAR' && i.status !== 'SERVED' && (i.status as string) !== 'CANCELLED')
        .map((i) => ({ ticket: t, item: i }))
    );
  }, [tickets]);

  const columns: { key: KdsItem['status']; label: string; actionLabel: string; nextStatus: string }[] = [
    { key: 'PLACED', label: 'New', actionLabel: 'Accept', nextStatus: 'ACCEPTED' },
    { key: 'ACCEPTED', label: 'Accepted', actionLabel: 'Pouring', nextStatus: 'PREPARING' },
    { key: 'PREPARING', label: 'Preparing', actionLabel: 'Ready at Bar', nextStatus: 'READY' },
    { key: 'READY', label: 'Ready for Pickup', actionLabel: 'Served', nextStatus: 'SERVED' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 dark:bg-[#111114] bg-[#F5F3FA] p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary dark:bg-amber-500/15 dark:border-amber-500/20 dark:text-amber-400 flex items-center justify-center shadow-xs">
            <Wine size={22} />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              Bar Display System (KDS)
            </h1>
            <p className="text-xs text-zinc-500 dark:text-text-muted font-medium">Cocktails, pints, and spirit pours synchronized in real time</p>
          </div>
        </div>
      </div>

      {/* Responsive Kanban Board: 1 col on mobile, 2 cols on tablet, 4 cols on desktop */}
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

              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {list.map(({ ticket, item }) => {
                  const mins = getElapsedMin(ticket.placedAt);
                  const priority = mins >= 20 ? 'urgent' : mins >= 10 ? 'warn' : 'ok';
                  const isUpdating = updatingIds.has(item.id);

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
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-zinc-800 dark:text-zinc-200">
                          Table {ticket.tableNumber || 'C5'} · #{String(ticket.orderNumber).padStart(2, '0')}
                        </span>
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
                      </div>

                      <div className="font-extrabold text-sm text-zinc-900 dark:text-white">
                        {item.quantity} × {item.itemName}
                        {item.variantName ? ` (${item.variantName})` : ''}
                      </div>

                      {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium">
                          {item.selectedModifiers.map((m: any) => m.optionName).join(', ')}
                        </div>
                      )}

                      {item.specialInstructions && (
                        <div className="text-[11px] font-semibold italic text-amber-700 dark:text-amber-400">
                          &quot;{item.specialInstructions}&quot;
                        </div>
                      )}

                      <div className="pt-2 border-t border-zinc-200 dark:border-white/10 flex items-center justify-end">
                        {canBump ? (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleAdvanceStatus(item.id, col.nextStatus)}
                            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-extrabold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
};

export default BarKDSPage;
