import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { joinRoom, leaveRoom, onSocketEvent } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  LayoutGrid,
  BellRing,
  ChefHat,
  Receipt,
  Plus,
  Clock,
  CheckCircle2,
  Users,
  Search,
  Filter,
  RefreshCw,
  X,
  Minus,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { VegBadge } from '../components/customer/VegBadge';

export type WaiterTab = 'overview' | 'tables' | 'requests' | 'ready' | 'bills';

interface WaiterStationPageProps {
  initialTab?: WaiterTab;
  onTabChange?: (tab: WaiterTab) => void;
}

export const WaiterStationPage: React.FC<WaiterStationPageProps> = ({ initialTab = 'overview', onTabChange }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTabState] = useState<WaiterTab>(initialTab);

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTabState(initialTab);
    }
  }, [initialTab]);

  const setActiveTab = (tab: WaiterTab) => {
    setActiveTabState(tab);
    onTabChange?.(tab);
  };
  const [tables, setTables] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [readyItems, setReadyItems] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [isAssistedOrderingOpen, setIsAssistedOrderingOpen] = useState<boolean>(false);
  const [assistedCart, setAssistedCart] = useState<any[]>([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const fetchTables = useCallback(async () => {
    try {
      const data: any = await api.getTables();
      setTables(Array.isArray(data) ? data : data?.tables || []);
    } catch (err) {
      console.warn('Failed to load tables:', err);
    }
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await api.getActiveServiceRequests();
      setRequests(data);
    } catch (err) {
      console.warn('Failed to load service requests:', err);
    }
  }, []);

  const fetchReadyItems = useCallback(async () => {
    try {
      const data = await api.getReadyItems();
      setReadyItems(data);
    } catch (err) {
      console.warn('Failed to load ready items:', err);
    }
  }, []);

  const fetchMenu = useCallback(async () => {
    try {
      const data = await api.getMenu(false);
      setMenu(data);
    } catch (err) {
      console.warn('Failed to load menu:', err);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchTables(), fetchRequests(), fetchReadyItems(), fetchMenu()]).finally(() => {
      setIsLoading(false);
    });

    // Real-Time Room Subscriptions
    joinRoom('tables:all');
    joinRoom('staff:requests');
    joinRoom('staff:ready');

    const unsubTable = onSocketEvent('table.updated', () => fetchTables());
    const unsubReqCreated = onSocketEvent('service_request.created', () => fetchRequests());
    const unsubReqUpdated = onSocketEvent('service_request.updated', () => fetchRequests());
    const unsubItemUpdated = onSocketEvent('order.item.updated', () => {
      fetchReadyItems();
      fetchTables();
    });
    const unsubOrderCreated = onSocketEvent('order.created', () => {
      fetchReadyItems();
      fetchTables();
    });

    return () => {
      leaveRoom('tables:all');
      leaveRoom('staff:requests');
      leaveRoom('staff:ready');
      unsubTable();
      unsubReqCreated();
      unsubReqUpdated();
      unsubItemUpdated();
      unsubOrderCreated();
    };
  }, [fetchTables, fetchRequests, fetchReadyItems, fetchMenu]);

  // Actions: Service Request Lifecycle
  const handleUpdateReqStatus = async (requestId: string, status: 'ACKNOWLEDGED' | 'COMPLETED') => {
    try {
      await api.updateServiceRequestStatus(requestId, status, user?.id);
      fetchRequests();
    } catch (err: any) {
      alert(err.message || 'Failed to update request.');
    }
  };

  // Actions: Ready Item Lifecycle
  const handleMarkItemServed = async (orderItemId: string) => {
    try {
      await api.updateOrderItemStatus(orderItemId, 'SERVED', user?.id);
      fetchReadyItems();
      fetchTables();
    } catch (err: any) {
      alert(err.message || 'Failed to serve item.');
    }
  };

  // Assisted Ordering Handlers
  const handleAddAssistedItem = (menuItem: any) => {
    setAssistedCart((prev) => {
      const existing = prev.find((i) => i.menuItemId === menuItem.id);
      if (existing) {
        return prev.map((i) => (i.menuItemId === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          menuItemId: menuItem.id,
          name: menuItem.name,
          unitPrice: menuItem.basePrice,
          foodType: menuItem.foodType,
          station: menuItem.station,
          quantity: 1,
        },
      ];
    });
  };

  const handleUpdateAssistedQty = (menuItemId: string, delta: number) => {
    setAssistedCart((prev) =>
      prev
        .map((i) => (i.menuItemId === menuItemId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const handleSubmitAssistedOrder = async () => {
    if (!selectedTable || assistedCart.length === 0) return;
    setIsSubmittingOrder(true);
    try {
      const payload = {
        tokenNumber: selectedTable.currentTokenId || selectedTable.currentSessionId || `BAR-${selectedTable.tableNumber}`,
        tableId: selectedTable.id,
        orderSource: 'SERVER',
        handlerId: user?.id,
        items: assistedCart.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          station: i.station,
        })),
      };

      await api.placeOrder(payload);
      setFeedbackMsg(`Assisted order submitted for Table ${selectedTable.tableNumber || selectedTable.number}!`);
      setAssistedCart([]);
      setIsAssistedOrderingOpen(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
      fetchTables();
    } catch (err: any) {
      setFeedbackMsg(`Order submission failed: ${err.message}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Flattened Menu Items for Assisted Order Modal
  const allMenuItems: any[] = [];
  menu.forEach((section: any) => {
    (section.categories || []).forEach((cat: any) => {
      (cat.items || []).forEach((item: any) => {
        allMenuItems.push({ ...item, categoryName: cat.name });
      });
    });
  });

  const filteredMenuItems = allMenuItems.filter((i) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q);
  });

  const assistedCartTotal = assistedCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  // Statistics
  const openRequests = requests.filter((r) => r.status !== 'COMPLETED');
  const activeTablesCount = tables.filter((t) => t.status === 'occupied' || t.status === 'OCCUPIED' || t.status === 'BILL_REQUESTED').length;
  const billRequestedTables = tables.filter((t) => t.status === 'BILL_REQUESTED' || t.isBillRequested);

  return (
    <div className="flex flex-col h-full overflow-hidden dark:bg-[#141225] bg-[#F5F3FA] p-4 lg:p-6 space-y-4">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#8D6CE5]/15 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-black text-text-primary dark:text-white tracking-tight">
              Waiter Dashboard
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#8D6CE5]/10 text-[#8D6CE5]">
              {user?.fullName || 'Staff'}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">Floor occupancy, service requests, ready pickup queue, and table-side orders</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl dark:bg-[#1A1829] bg-white border border-[#8D6CE5]/15 shadow-2xs self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-[#8D6CE5] text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === 'requests'
                ? 'bg-[#8D6CE5] text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <BellRing className="w-4 h-4" />
            <span>Requests ({openRequests.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('ready')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === 'ready'
                ? 'bg-[#8D6CE5] text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Ready ({readyItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'tables'
                ? 'bg-[#8D6CE5] text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Tables</span>
          </button>

          <button
            onClick={() => setActiveTab('bills')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'bills'
                ? 'bg-[#8D6CE5] text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Bills ({billRequestedTables.length})</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. OVERVIEW TAB (4 KPI Cards + Priority Stream)                      */}
      {/* ==================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in overflow-y-auto">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white p-5 shadow-xs">
              <div className="text-xs uppercase tracking-widest text-text-muted font-bold">Active Tables</div>
              <div className="mt-1 font-black text-3xl text-text-primary dark:text-white">{activeTablesCount}</div>
            </div>

            <div className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white p-5 shadow-xs">
              <div className="text-xs uppercase tracking-widest text-text-muted font-bold">New Requests</div>
              <div className="mt-1 font-black text-3xl text-amber-500">
                {requests.filter((r) => r.status === 'NEW').length}
              </div>
            </div>

            <div className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white p-5 shadow-xs">
              <div className="text-xs uppercase tracking-widest text-text-muted font-bold">Ready to Serve</div>
              <div className="mt-1 font-black text-3xl text-[#8D6CE5]">{readyItems.length}</div>
            </div>

            <div className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white p-5 shadow-xs">
              <div className="text-xs uppercase tracking-widest text-text-muted font-bold">Bill Requests</div>
              <div className="mt-1 font-black text-3xl text-indigo-500">{billRequestedTables.length}</div>
            </div>
          </div>

          {/* Priority Task Stream */}
          <div className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white p-5 shadow-xs space-y-3">
            <h3 className="font-black text-lg text-text-primary dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#8D6CE5]" /> Priority Operations
            </h3>

            {openRequests.length === 0 && readyItems.length === 0 && billRequestedTables.length === 0 ? (
              <p className="text-xs text-text-muted py-4">All calm on the floor. Tables are attended.</p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {openRequests.map((r) => (
                  <li
                    key={r.id}
                    onClick={() => setActiveTab('requests')}
                    className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between cursor-pointer hover:bg-amber-500/10 transition-colors"
                  >
                    <span className="font-bold text-text-primary dark:text-white">
                      • Table {r.tableNumber || r.table?.tableNumber || 'C5'}: {r.type.replace('_', ' ').toLowerCase()} ({r.note || 'No notes'})
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      {r.status}
                    </span>
                  </li>
                ))}
                {readyItems.map((item) => (
                  <li
                    key={item.id}
                    onClick={() => setActiveTab('ready')}
                    className="p-3 rounded-xl border border-[#8D6CE5]/20 bg-[#8D6CE5]/5 flex items-center justify-between cursor-pointer hover:bg-[#8D6CE5]/10 transition-colors"
                  >
                    <span className="font-bold text-text-primary dark:text-white">
                      • Table {item.tableNumber || 'C5'}: {item.quantity} × {item.itemName || item.name} ready to serve
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#8D6CE5]/20 text-[#8D6CE5]">
                      READY
                    </span>
                  </li>
                ))}
                {billRequestedTables.map((t) => (
                  <li
                    key={t.id}
                    onClick={() => setActiveTab('bills')}
                    className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-center justify-between cursor-pointer hover:bg-indigo-500/10 transition-colors"
                  >
                    <span className="font-bold text-text-primary dark:text-white">
                      • Table {t.tableNumber || t.number}: Bill requested — collect payment
                    </span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-500">
                      PAYMENT
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. FLOOR TABLES TAB                                                  */}
      {/* ==================================================================== */}
      {activeTab === 'tables' && (
        <div className="flex-1 overflow-y-auto space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
            {tables.map((table) => {
              const isOccupied = table.status === 'occupied' || table.status === 'OCCUPIED' || table.status === 'BILL_REQUESTED';
              const isBillReq = table.status === 'BILL_REQUESTED';

              return (
                <div
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[140px] shadow-xs ${
                    isBillReq
                      ? 'border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10 hover:border-amber-500'
                      : isOccupied
                      ? 'border-[#8D6CE5]/40 bg-[#8D6CE5]/5 dark:bg-[#8D6CE5]/10 hover:border-[#8D6CE5]'
                      : 'border-black/10 dark:border-white/10 bg-white dark:bg-[#1A1829] hover:border-[#8D6CE5]/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-black text-lg text-text-primary dark:text-white">
                        {table.tableNumber || table.number || 'T'}
                      </span>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        Cap: {table.capacity || 4} guests
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        isBillReq
                          ? 'bg-amber-500/20 text-amber-500'
                          : isOccupied
                          ? 'bg-[#8D6CE5]/20 text-[#8D6CE5]'
                          : 'bg-emerald-500/20 text-emerald-500'
                      }`}
                    >
                      {table.status || 'AVAILABLE'}
                    </span>
                  </div>

                  <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[11px]">
                    <span className="text-text-muted truncate max-w-[80px]">
                      {table.placeType?.name || 'Standard'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTable(table);
                        setIsAssistedOrderingOpen(true);
                      }}
                      className="p-1 rounded-lg bg-[#8D6CE5] text-white hover:bg-[#7B59D8] transition-colors"
                      title="Place Assisted Order"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. REQUESTS TAB                                                      */}
      {/* ==================================================================== */}
      {activeTab === 'requests' && (
        <div className="flex-1 overflow-y-auto space-y-3 animate-fade-in">
          {openRequests.length === 0 ? (
            <div className="p-16 text-center border border-dashed border-[#8D6CE5]/20 rounded-2xl dark:bg-[#1A1829]/50">
              <BellRing className="w-12 h-12 mx-auto text-[#8D6CE5]/40 mb-3" />
              <h3 className="font-bold text-sm text-text-primary dark:text-white">No Pending Service Requests</h3>
              <p className="text-xs text-text-muted mt-1">Guest calls for water, cutlery, and cleanup will appear here in real time.</p>
            </div>
          ) : (
            openRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base text-text-primary dark:text-white">
                      Table {req.tableNumber || req.table?.tableNumber || 'C5'}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#8D6CE5]/10 text-[#8D6CE5]">
                      {req.type}
                    </span>
                  </div>
                  {req.note && <p className="text-xs text-text-muted mt-1">"{req.note}"</p>}
                  <div className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {req.status === 'NEW' ? (
                    <button
                      onClick={() => handleUpdateReqStatus(req.id, 'ACKNOWLEDGED')}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      Acknowledge
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdateReqStatus(req.id, 'COMPLETED')}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition-colors"
                    >
                      Mark Done
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. READY QUEUE TAB                                                   */}
      {/* ==================================================================== */}
      {activeTab === 'ready' && (
        <div className="flex-1 overflow-y-auto space-y-3 animate-fade-in">
          {readyItems.length === 0 ? (
            <div className="p-16 text-center border border-dashed border-[#8D6CE5]/20 rounded-2xl dark:bg-[#1A1829]/50">
              <ChefHat className="w-12 h-12 mx-auto text-[#8D6CE5]/40 mb-3" />
              <h3 className="font-bold text-sm text-text-primary dark:text-white">Ready Queue is Empty</h3>
              <p className="text-xs text-text-muted mt-1">Dishes plated by the chef and cocktails poured by the bartender will appear here for pickup.</p>
            </div>
          ) : (
            readyItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl border border-emerald-500/30 dark:bg-[#1A1829] bg-white flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base text-text-primary dark:text-white">
                      Table {item.tableNumber || 'C5'}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">
                      {item.station}
                    </span>
                  </div>
                  <div className="font-bold text-sm text-text-primary dark:text-white mt-1 flex items-center gap-1.5">
                    <VegBadge type={item.foodType} size="sm" />
                    <span>{item.quantity} × {item.itemName || item.name}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleMarkItemServed(item.id)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Deliver & Serve</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. BILLS TAB                                                         */}
      {/* ==================================================================== */}
      {activeTab === 'bills' && (
        <div className="flex-1 overflow-y-auto space-y-3 animate-fade-in">
          {billRequestedTables.length === 0 ? (
            <div className="p-16 text-center border border-dashed border-[#8D6CE5]/20 rounded-2xl dark:bg-[#1A1829]/50">
              <Receipt className="w-12 h-12 mx-auto text-[#8D6CE5]/40 mb-3" />
              <h3 className="font-bold text-sm text-text-primary dark:text-white">No Pending Bill Requests</h3>
              <p className="text-xs text-text-muted mt-1">When a customer requests their bill from their table, it will appear here.</p>
            </div>
          ) : (
            billRequestedTables.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-2xl border border-indigo-500/30 dark:bg-[#1A1829] bg-white flex items-center justify-between gap-4 shadow-xs"
              >
                <div>
                  <div className="font-black text-lg text-text-primary dark:text-white">
                    Table {t.tableNumber || t.number}
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    Token: {t.currentTokenId || 'ACTIVE'}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTable(t)}
                  className="px-4 py-2 rounded-xl bg-[#8D6CE5] text-white font-bold text-xs shadow-md"
                >
                  View Details
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Assisted Order Drawer */}
      {isAssistedOrderingOpen && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white dark:bg-[#1A1829] h-full flex flex-col p-6 shadow-2xl overflow-hidden animate-slide-left">
            <div className="flex items-center justify-between pb-4 border-b border-[#8D6CE5]/15">
              <div>
                <h3 className="font-black text-xl text-text-primary dark:text-white">
                  Assisted Order — Table {selectedTable.tableNumber || selectedTable.number}
                </h3>
                <p className="text-xs text-text-muted">Take table-side order directly for guests</p>
              </div>
              <button
                onClick={() => {
                  setIsAssistedOrderingOpen(false);
                  setAssistedCart([]);
                }}
                className="p-2 text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Search */}
            <div className="mt-4 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-[#8D6CE5]/20 bg-white dark:bg-[#141225] dark:text-white focus:outline-none focus:border-[#8D6CE5]"
              />
            </div>

            {/* Menu Items List */}
            <div className="flex-1 overflow-y-auto space-y-2 mt-4 pr-1">
              {filteredMenuItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-[#8D6CE5]/10 dark:bg-[#141225] bg-white flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <VegBadge type={item.foodType} size="sm" />
                      <span className="font-bold text-xs text-text-primary dark:text-white truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#8D6CE5] font-black mt-0.5">₹{Number(item.basePrice).toFixed(2)}</div>
                  </div>
                  <button
                    onClick={() => handleAddAssistedItem(item)}
                    className="px-3 py-1.5 rounded-lg bg-[#8D6CE5] hover:bg-[#7B59D8] text-white font-bold text-xs shadow-xs"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>

            {/* Assisted Cart Summary */}
            {assistedCart.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#8D6CE5]/15 space-y-3">
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {assistedCart.map((item) => (
                    <div key={item.menuItemId} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[180px] text-text-primary dark:text-white font-medium">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUpdateAssistedQty(item.menuItemId, -1)}
                          className="w-5 h-5 rounded border flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-4 text-center font-bold">{item.quantity}</span>
                        <button
                          onClick={() => handleUpdateAssistedQty(item.menuItemId, 1)}
                          className="w-5 h-5 rounded border flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="w-14 text-right font-black">₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-[#8D6CE5]/10 text-text-primary dark:text-white">
                  <span>Total</span>
                  <span className="text-[#8D6CE5]">₹{assistedCartTotal.toFixed(2)}</span>
                </div>

                <button
                  disabled={isSubmittingOrder}
                  onClick={handleSubmitAssistedOrder}
                  className="w-full py-3.5 rounded-xl bg-[#8D6CE5] hover:bg-[#7B59D8] text-white font-extrabold text-xs shadow-md transition-all"
                >
                  {isSubmittingOrder ? 'Submitting...' : `Submit Order for Table ${selectedTable.tableNumber || selectedTable.number}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WaiterStationPage;
