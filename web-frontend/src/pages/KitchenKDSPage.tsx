import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, AlertTriangle, CheckCircle2, GlassWater } from 'lucide-react';
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
  status: 'PLACED' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED';
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

export const KitchenKDSPage: React.FC = () => {
  const { user, showToast } = useAuth();
  const userRoleLower = user?.role ? user.role.toLowerCase() : '';
  const canBump = ['chef', 'admin', 'manager'].includes(userRoleLower);
  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchTickets = async () => {
    try {
      const res = await api.getKdsOrders('KITCHEN');
      if (res && Array.isArray(res)) {
        setTickets(res);
      }
    } catch (err: any) {
      console.warn('Failed to load KDS tickets:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTickets();
    joinRoom('kds:kitchen');

    const unsubItemUpdated = onSocketEvent('order.item.updated', () => fetchTickets());
    const unsubOrderCreated = onSocketEvent('order.created', () => fetchTickets());
    const handleGlobalRefresh = () => fetchTickets();
    window.addEventListener('app:global-refresh', handleGlobalRefresh);

    const interval = setInterval(fetchTickets, 5000);
    return () => {
      leaveRoom('kds:kitchen');
      unsubItemUpdated();
      unsubOrderCreated();
      window.removeEventListener('app:global-refresh', handleGlobalRefresh);
      clearInterval(interval);
    };
  }, []);

  const handleAdvanceStatus = async (orderItemId: string, nextStatus: string) => {
    try {
      await api.updateOrderItemStatus(orderItemId, nextStatus, user?.id);
      showToast(`Item updated to ${nextStatus}`, 'success');
      fetchTickets();
    } catch (err: any) {
      showToast(err.message || 'Failed to update item status', 'danger');
    }
  };

  const getElapsedMin = (placedAt: string) => {
    return Math.max(0, Math.floor((Date.now() - new Date(placedAt).getTime()) / 60000));
  };

  const formatElapsedMMSS = (placedAt: string) => {
    const totalSecs = Math.max(0, Math.floor((Date.now() - new Date(placedAt).getTime()) / 1000));
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Flatten active items for board columns
  const activeItems = tickets.flatMap((t) =>
    t.items
      .filter((i) => (i.station === 'KITCHEN' || i.station === 'DESSERT') && i.status !== 'SERVED')
      .map((i) => ({ ticket: t, item: i }))
  );

  const columns: { key: KdsItem['status']; label: string; actionLabel: string; nextStatus: string }[] = [
    { key: 'PLACED', label: 'New', actionLabel: 'Accept', nextStatus: 'ACCEPTED' },
    { key: 'ACCEPTED', label: 'Accepted', actionLabel: 'Start', nextStatus: 'PREPARING' },
    { key: 'PREPARING', label: 'Preparing', actionLabel: 'Ready', nextStatus: 'READY' },
    { key: 'READY', label: 'Ready', actionLabel: 'Served', nextStatus: 'SERVED' },
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

        {/* Station Navigation Pills & Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 h-11 rounded-xl dark:bg-[#18181A] bg-white border border-zinc-300 dark:border-white/10 shadow-xs">
            <a
              href="/kds/kitchen"
              className="h-9 px-4 rounded-lg bg-primary text-white dark:bg-[#D4AF37] dark:text-black text-xs font-bold shadow-xs flex items-center justify-center transition-all"
            >
              Kitchen
            </a>
            <a
              href="/kds/bar"
              className="h-9 px-4 rounded-lg text-zinc-600 dark:text-text-muted hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 text-xs font-bold transition-all flex items-center justify-center"
            >
              Bar
            </a>
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
                            onClick={() => handleAdvanceStatus(item.id, col.nextStatus)}
                            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-extrabold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 size={14} />
                            <span>{col.actionLabel}</span>
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

export default KitchenKDSPage;
