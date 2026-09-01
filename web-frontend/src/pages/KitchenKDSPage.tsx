import React, { useState, useEffect } from 'react';
import { ChefHat, RefreshCw, Clock, AlertTriangle, CheckCircle2, GlassWater } from 'lucide-react';
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

    const interval = setInterval(fetchTickets, 5000);
    return () => {
      leaveRoom('kds:kitchen');
      unsubItemUpdated();
      unsubOrderCreated();
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
    <div className="flex-1 flex flex-col min-h-0 dark:bg-[#141225] bg-[#F5F3FA] p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
      {/* Header Bar matching table/ KdsShell */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#8D6CE5]/15">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#8D6CE5]/10 text-[#8D6CE5] flex items-center justify-center shadow-xs">
            <ChefHat size={22} />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-text-primary dark:text-white tracking-tight">
              Kitchen Display System (KDS)
            </h1>
            <p className="text-xs text-text-muted">Food & Dessert station tickets synchronized in real time</p>
          </div>
        </div>

        {/* Station Navigation Pills & Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-2xl dark:bg-[#1A1829] bg-white border border-[#8D6CE5]/15 shadow-2xs">
            <a
              href="/kds/kitchen"
              className="px-3.5 py-1.5 rounded-xl bg-[#8D6CE5] text-white text-xs font-bold shadow-xs"
            >
              Kitchen
            </a>
            <a
              href="/kds/bar"
              className="px-3.5 py-1.5 rounded-xl text-text-muted hover:text-text-primary text-xs font-bold transition-colors"
            >
              Bar
            </a>
          </div>

          <a
            href="/demo"
            className="px-3 py-2 rounded-xl border border-[#8D6CE5]/20 hover:bg-[#8D6CE5]/10 text-xs font-bold text-text-primary dark:text-white transition-colors"
          >
            Demo Hub
          </a>

          <button
            onClick={() => {
              setRefreshing(true);
              fetchTickets();
            }}
            disabled={refreshing}
            className="p-2 rounded-xl border border-[#8D6CE5]/20 hover:bg-[#8D6CE5]/10 text-text-primary dark:text-white transition-colors"
            title="Refresh Tickets"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin text-[#8D6CE5]' : ''} />
          </button>
        </div>
      </div>

      {/* 4-Column Kanban Board matching table/ KitchenBoard */}
      <div className="grid gap-4 md:grid-cols-4 flex-1">
        {columns.map((col) => {
          const list = activeItems.filter((entry) => entry.item.status === col.key);

          return (
            <div
              key={col.key}
              className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white p-4 flex flex-col min-h-[420px] shadow-xs"
            >
              <div className="mb-3 flex items-center justify-between text-sm pb-2 border-b border-[#8D6CE5]/10">
                <span className="font-black text-base text-text-primary dark:text-white">{col.label}</span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#8D6CE5]/10 text-[#8D6CE5]">
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
                          ? 'border-rose-500/50 bg-rose-500/5 dark:bg-rose-500/10'
                          : priority === 'warn'
                          ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10'
                          : 'border-[#8D6CE5]/15 dark:bg-[#141225] bg-[#F7F6FC]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-text-muted font-bold">
                        <span>
                          Table {ticket.tableNumber || 'C5'} · #{String(ticket.orderNumber).padStart(2, '0')}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono">
                          {priority !== 'ok' && <AlertTriangle size={12} className="text-amber-500" />}
                          <Clock size={12} />
                          {formatElapsedMMSS(ticket.placedAt)}
                        </span>
                      </div>

                      <div className="font-extrabold text-sm text-text-primary dark:text-white">
                        {item.quantity} × {item.itemName}
                        {item.variantName ? ` (${item.variantName})` : ''}
                      </div>

                      {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                        <div className="text-[11px] text-text-muted">
                          {item.selectedModifiers.map((m: any) => m.optionName).join(', ')}
                        </div>
                      )}

                      {item.specialInstructions && (
                        <div className="text-[11px] italic text-amber-500">
                          "{item.specialInstructions}"
                        </div>
                      )}

                      <div className="pt-2 border-t border-[#8D6CE5]/10 flex items-center justify-end">
                        <button
                          onClick={() => handleAdvanceStatus(item.id, col.nextStatus)}
                          className="px-4 py-2 rounded-xl bg-[#8D6CE5] hover:bg-[#7B59D8] text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
                        >
                          <CheckCircle2 size={14} />
                          <span>{col.actionLabel}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {list.length === 0 && (
                  <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#8D6CE5]/20 rounded-2xl">
                    <p className="text-xs text-text-muted font-bold">No orders in {col.label.toLowerCase()}</p>
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
