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
  X,
  Minus,
  AlertCircle,
  Sparkles,
  CalendarCheck,
  Phone,
  Loader2,
  Mail,
  User,
  Banknote,
  QrCode,
  CreditCard,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  History,
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
  const [reservations, setReservations] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [readyItems, setReadyItems] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [isAssistedOrderingOpen, setIsAssistedOrderingOpen] = useState<boolean>(false);
  const [isBillDetailsOpen, setIsBillDetailsOpen] = useState<boolean>(false);
  const [selectedBillTable, setSelectedBillTable] = useState<any | null>(null);
  const [activeTableBill, setActiveTableBill] = useState<any | null>(null);
  const [isBillLoading, setIsBillLoading] = useState<boolean>(false);
  const [billFetchError, setBillFetchError] = useState<string | null>(null);
  const [selectedReservationTable, setSelectedReservationTable] = useState<{ table: any; reservation: any } | null>(null);
  const [isReservationModalOpen, setIsReservationModalOpen] = useState<boolean>(false);
  const [assistedCart, setAssistedCart] = useState<any[]>([]);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [isSettlingBill, setIsSettlingBill] = useState<boolean>(false);
  const [isInitiatingSettlement, setIsInitiatingSettlement] = useState<boolean>(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  // Bills Workspace State
  const [activeBills, setActiveBills] = useState<any[]>([]);
  const [settledBills, setSettledBills] = useState<any[]>([]);
  const [settledSummary, setSettledSummary] = useState<{ completedTodayCount: number; completedTodayRevenue: number }>({
    completedTodayCount: 0,
    completedTodayRevenue: 0,
  });
  const [isBillsLoading, setIsBillsLoading] = useState<boolean>(false);
  const [billsSubTab, setBillsSubTab] = useState<'active' | 'history'>('active');
  const [billsSearchQuery, setBillsSearchQuery] = useState<string>('');
  const [settlementStep, setSettlementStep] = useState<'review' | 'payment'>('review');

  const fetchTables = useCallback(async () => {
    try {
      const data: any = await api.getTables();
      setTables(Array.isArray(data) ? data : data?.tables || []);
    } catch (err) {
      console.warn('Failed to load tables:', err);
    }
  }, []);

  const fetchReservations = useCallback(async () => {
    try {
      const data: any = await api.getReservations();
      setReservations(Array.isArray(data) ? data : data?.reservations || []);
    } catch (err) {
      console.warn('Failed to load reservations:', err);
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

  const fetchBillsData = useCallback(async () => {
    setIsBillsLoading(true);
    try {
      const [active, settled] = await Promise.all([
        api.getActiveBills().catch(() => []),
        api.getSettledBills(50).catch(() => ({ bills: [], summary: { completedTodayCount: 0, completedTodayRevenue: 0 } })),
      ]);
      setActiveBills(Array.isArray(active) ? active : []);
      setSettledBills(Array.isArray(settled?.bills) ? settled.bills : []);
      if (settled?.summary) {
        setSettledSummary(settled.summary);
      }
    } catch (err) {
      console.warn('Failed to load bills data:', err);
    } finally {
      setIsBillsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchTables(), fetchRequests(), fetchReadyItems(), fetchMenu(), fetchReservations(), fetchBillsData()]).finally(() => {
      setIsLoading(false);
    });

    // Real-Time Room Subscriptions
    joinRoom('tables:all');
    joinRoom('staff:requests');
    joinRoom('staff:ready');
    joinRoom('staff:billing');

    const unsubTable = onSocketEvent('table.updated', () => {
      fetchTables();
      fetchReservations();
      fetchBillsData();
    });
    const unsubReqCreated = onSocketEvent('service_request.created', () => {
      fetchRequests();
      fetchBillsData();
    });
    const unsubReqUpdated = onSocketEvent('service_request.updated', () => {
      fetchRequests();
      fetchBillsData();
    });
    const unsubItemUpdated = onSocketEvent('order.item.updated', () => {
      fetchReadyItems();
      fetchTables();
      fetchBillsData();
    });
    const unsubOrderCreated = onSocketEvent('order.created', () => {
      fetchReadyItems();
      fetchTables();
      fetchBillsData();
    });
    const unsubBillSettled = onSocketEvent('bill.settled', () => {
      fetchBillsData();
      fetchTables();
    });
    const unsubSessionClosed = onSocketEvent('table.session.closed', () => {
      fetchBillsData();
      fetchTables();
    });

    const handleGlobalRefresh = () => {
      fetchTables();
      fetchRequests();
      fetchReadyItems();
      fetchMenu();
      fetchReservations();
      fetchBillsData();
    };
    window.addEventListener('app:global-refresh', handleGlobalRefresh);

    return () => {
      leaveRoom('tables:all');
      leaveRoom('staff:requests');
      leaveRoom('staff:ready');
      leaveRoom('staff:billing');
      unsubTable();
      unsubReqCreated();
      unsubReqUpdated();
      unsubItemUpdated();
      unsubOrderCreated();
      unsubBillSettled();
      unsubSessionClosed();
      window.removeEventListener('app:global-refresh', handleGlobalRefresh);
    };
  }, [fetchTables, fetchRequests, fetchReadyItems, fetchMenu, fetchReservations, fetchBillsData]);

  // Periodic tick for reactive elapsed waiting time
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(timer);
  }, []);

  const formatRequestType = (type?: string) => {
    if (!type) return 'Request';
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getWaitMinutes = (createdAt: string) => {
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  };

  const getRelativeWaitTime = (createdAt: string) => {
    const mins = getWaitMinutes(createdAt);
    if (mins < 1) return 'Just now';
    return `${mins}m ago`;
  };

  const formatTableStatus = (status?: string) => {
    if (!status) return 'Available';
    const s = status.toUpperCase();
    if (s === 'AVAILABLE') return 'Available';
    if (s === 'OCCUPIED' || s === 'IN_CHECKIN') return 'Occupied';
    if (s === 'BILL_REQUESTED') return 'Bill Requested';
    if (s === 'RESERVED') return 'Reserved';
    if (s === 'MAINTENANCE') return 'Maintenance';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  };

  const getTableStatusClasses = (status?: string) => {
    const s = (status || 'AVAILABLE').toUpperCase();
    if (s === 'BILL_REQUESTED') {
      return {
        cardBorder: 'border-amber-400 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-500',
        badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/50',
      };
    }
    if (s === 'OCCUPIED' || s === 'IN_CHECKIN') {
      return {
        cardBorder: 'border-primary/30 dark:border-[#D4AF37]/30 bg-primary/5 dark:bg-[#D4AF37]/10 hover:border-primary dark:hover:border-[#D4AF37]',
        badge: 'bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] border-primary/20 dark:border-[#D4AF37]/30',
      };
    }
    if (s === 'RESERVED') {
      return {
        cardBorder: 'border-blue-400/40 dark:border-blue-500/40 bg-blue-50/30 dark:bg-blue-950/20 hover:border-blue-500',
        badge: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
      };
    }
    if (s === 'MAINTENANCE') {
      return {
        cardBorder: 'border-rose-300 dark:border-rose-500/40 bg-rose-50/30 dark:bg-rose-950/20 hover:border-rose-400',
        badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50',
      };
    }
    // Default AVAILABLE
    return {
      cardBorder: 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] hover:border-zinc-300 dark:hover:border-white/20',
      badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/50',
    };
  };

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
      let resolvedToken = selectedTable.currentTokenId || selectedTable.currentSessionId || selectedTable.activeSession?.tokenNumber;
      if (!resolvedToken) {
        try {
          const sessionRes = await api.getTableActiveSession(selectedTable.tableNumber || selectedTable.id);
          if (sessionRes?.session?.tokenNumber) {
            resolvedToken = sessionRes.session.tokenNumber;
          }
        } catch {}
      }

      if (!resolvedToken) {
        setFeedbackMsg(`Cannot place order: Table ${selectedTable.tableNumber || selectedTable.number} has no active dining session. Please check in guests at Reception first.`);
        setIsSubmittingOrder(false);
        return;
      }

      const payload = {
        tokenNumber: resolvedToken,
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

  const handleOpenBillModal = async (tableOrBill: any) => {
    setSelectedBillTable(tableOrBill);
    setIsBillDetailsOpen(true);
    setIsBillLoading(true);
    setBillFetchError(null);
    setActiveTableBill(null);
    setSelectedPaymentMethod('CASH');
    setSettlementError(null);
    setSettlementStep('review');

    const lookupToken =
      tableOrBill.tokenNumber ||
      tableOrBill.currentTokenId ||
      tableOrBill.tokenId ||
      tableOrBill.activeSession?.tokenNumber ||
      tableOrBill.currentSessionId;

    try {
      if (lookupToken) {
        const res = await api.calculateBill(lookupToken);
        if (res && res.bill) {
          setActiveTableBill(res.bill);
          return;
        }
      }
      const tableIdentifier = tableOrBill.tableNumber || tableOrBill.number || tableOrBill.tableId || tableOrBill.id;
      if (tableIdentifier) {
        const sessionRes = await api.getTableActiveSession(tableIdentifier).catch(() => null);
        if (sessionRes && sessionRes.session?.tokenNumber) {
          const res = await api.calculateBill(sessionRes.session.tokenNumber);
          if (res && res.bill) {
            setActiveTableBill(res.bill);
            return;
          }
        }
      }
      if (tableOrBill.bill) {
        setActiveTableBill(tableOrBill.bill);
      } else {
        setBillFetchError('No active bill or order items found for this table.');
      }
    } catch (err: any) {
      console.warn('Failed to calculate bill for table:', err);
      if (tableOrBill.bill) {
        setActiveTableBill(tableOrBill.bill);
      } else {
        setBillFetchError(err.message || 'Unable to load bill details.');
      }
    } finally {
      setIsBillLoading(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!selectedBillTable || isInitiatingSettlement) return;
    const tokenToSettle =
      activeTableBill?.tokenNumber ||
      activeTableBill?.tokenId ||
      selectedBillTable.tokenNumber ||
      selectedBillTable.currentTokenId ||
      selectedBillTable.tokenId ||
      selectedBillTable.activeSession?.tokenNumber;

    if (!tokenToSettle) {
      setSettlementError('Missing active session token to settle.');
      return;
    }

    const unservedCount = (activeTableBill?.items || []).filter(
      (it: any) => it.status !== 'SERVED' && it.status !== 'CANCELLED'
    ).length;

    if (unservedCount > 0) {
      setSettlementError(`Cannot proceed to payment. There are ${unservedCount} unserved item(s). All items must be SERVED or CANCELLED first.`);
      return;
    }

    setIsInitiatingSettlement(true);
    setSettlementError(null);

    try {
      const res = await api.initiateBillSettlement(tokenToSettle);
      if (res && res.success) {
        setSettlementStep('payment');
        if (res.calculated) {
          setActiveTableBill(res.calculated);
        }
      } else {
        setSettlementError('Failed to initiate bill settlement.');
      }
    } catch (err: any) {
      console.error('Initiate settlement error:', err);
      setSettlementError(err.message || 'Failed to initiate bill settlement.');
    } finally {
      setIsInitiatingSettlement(false);
    }
  };

  const handleBackToReview = async () => {
    const tokenToSettle =
      activeTableBill?.tokenNumber ||
      activeTableBill?.tokenId ||
      selectedBillTable?.tokenNumber ||
      selectedBillTable?.currentTokenId ||
      selectedBillTable?.tokenId;

    if (tokenToSettle) {
      try {
        await api.cancelBillSettlement(tokenToSettle);
      } catch (err) {
        console.warn('Failed to cancel settlement lock on backend:', err);
      }
    }
    setSettlementStep('review');
    setSettlementError(null);
  };

  const handleCloseBillModal = async () => {
    if (settlementStep === 'payment') {
      const tokenToSettle =
        activeTableBill?.tokenNumber ||
        activeTableBill?.tokenId ||
        selectedBillTable?.tokenNumber ||
        selectedBillTable?.currentTokenId ||
        selectedBillTable?.tokenId;
      if (tokenToSettle) {
        api.cancelBillSettlement(tokenToSettle).catch(() => null);
      }
    }
    setIsBillDetailsOpen(false);
    setSelectedBillTable(null);
    setSettlementError(null);
    setSettlementStep('review');
  };

  const handleServeItemInline = async (orderItemId: string) => {
    try {
      await api.updateOrderItemStatus(orderItemId, 'SERVED', user?.id);
      const tokenToSettle =
        activeTableBill?.tokenNumber ||
        activeTableBill?.tokenId ||
        selectedBillTable?.tokenNumber ||
        selectedBillTable?.currentTokenId;
      if (tokenToSettle) {
        const res = await api.calculateBill(tokenToSettle);
        if (res && res.bill) {
          setActiveTableBill(res.bill);
        }
      }
      fetchReadyItems();
      fetchTables();
      fetchBillsData();
    } catch (err: any) {
      alert(err.message || 'Failed to serve item.');
    }
  };

  const handleConfirmPayment = async () => {
    if (!selectedBillTable || isSettlingBill) return;
    const tokenToSettle =
      activeTableBill?.tokenNumber ||
      activeTableBill?.tokenId ||
      selectedBillTable.tokenNumber ||
      selectedBillTable.currentTokenId ||
      selectedBillTable.tokenId ||
      selectedBillTable.activeSession?.tokenNumber;

    if (!tokenToSettle) {
      setSettlementError('Missing active session token to settle.');
      return;
    }

    setIsSettlingBill(true);
    setSettlementError(null);

    try {
      const settlementRef =
        selectedPaymentMethod === 'UPI'
          ? `UPI-SIM-${Date.now().toString().slice(-6)}`
          : `CASH-REC-${Date.now().toString().slice(-6)}`;

      await api.settleBill({
        tokenNumber: tokenToSettle,
        paymentMethod: selectedPaymentMethod,
        settledByStaffId: user?.id,
        settlementReference: settlementRef,
      });

      const tblNum = selectedBillTable.tableNumber || selectedBillTable.number || activeTableBill?.tableNumber || 'N/A';
      setFeedbackMsg(
        `Payment of ₹${Number(activeTableBill?.grandTotal || activeTableBill?.total || 0).toFixed(2)} (${selectedPaymentMethod}) confirmed for Table ${tblNum}! Table released.`
      );

      setIsBillDetailsOpen(false);
      setSelectedBillTable(null);
      setActiveTableBill(null);
      setSettlementStep('review');

      await Promise.all([fetchTables(), fetchRequests(), fetchBillsData()]);
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err: any) {
      console.error('Settlement error:', err);
      setSettlementError(err.message || 'Failed to settle bill and confirm payment.');
    } finally {
      setIsSettlingBill(false);
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
  const activeTables = tables.filter((t) => {
    const s = (t.status || '').toUpperCase();
    return s === 'OCCUPIED' || s === 'BILL_REQUESTED' || t.isBillRequested;
  });
  const realBillRequestedTables = tables.filter((t) => {
    const s = (t.status || '').toUpperCase();
    return s === 'BILL_REQUESTED' || t.isBillRequested;
  });

  const billRequestedTables = realBillRequestedTables;

  const getBillForTable = (table: any) => {
    if (activeTableBill) return activeTableBill;
    if (table?.bill) return table.bill;
    return {
      items: [],
      subtotal: 0,
      cgst: 0,
      sgst: 0,
      serviceCharge: 0,
      total: 0,
    };
  };

  // Helper to match table with active reservation
  const getReservationForTable = (tableId: string) => {
    return reservations.find(
      (r) =>
        (r.tableId === tableId || r.table?.id === tableId) &&
        (r.status === 'PENDING' || r.status === 'CONFIRMED' || r.status === 'RESERVED')
    );
  };

  const isTableReserved = (t: any) => {
    const s = (t.status || '').toUpperCase();
    if (s === 'RESERVED') return true;
    return reservations.some(
      (r) =>
        (r.tableId === t.id || r.table?.id === t.id) &&
        (r.status === 'PENDING' || r.status === 'CONFIRMED')
    );
  };

  // 1. Reserved tables (Part 1 of /waiter/tables)
  const reservedTables = tables.filter((t) => {
    const s = (t.status || '').toUpperCase();
    if (s === 'AVAILABLE' && !reservations.some((r) => (r.tableId === t.id || r.table?.id === t.id) && (r.status === 'PENDING' || r.status === 'CONFIRMED'))) {
      return false;
    }
    return isTableReserved(t);
  });

  // 2. Billing & active occupied tables (Part 2 of /waiter/tables - excluding available & reserved)
  const billingTables = tables.filter((t) => {
    const s = (t.status || '').toUpperCase();
    if (s === 'AVAILABLE' || s === '') return false;
    if (isTableReserved(t)) return false;
    return true;
  });

  // Sort billing tables so BILL_REQUESTED tables appear first
  const sortedBillingTables = [...billingTables].sort((a, b) => {
    const aBillReq = a.status === 'BILL_REQUESTED' || a.isBillRequested ? 1 : 0;
    const bBillReq = b.status === 'BILL_REQUESTED' || b.isBillRequested ? 1 : 0;
    return bBillReq - aBillReq;
  });

  // Total non-available tables (reservations + bills)
  const nonAvailableTables = [...reservedTables, ...sortedBillingTables];

  return (
    <div className="flex flex-col h-full overflow-hidden dark:bg-[#111114] bg-[#F5F3FA] p-4 lg:p-6 space-y-4">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl lg:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              Waiter Dashboard
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary dark:bg-amber-500/15 dark:border-amber-500/20 dark:text-amber-400">
              {user?.fullName || 'Staff'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-text-muted mt-0.5">Floor occupancy, service requests, ready pickup queue, and table-side orders</p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl dark:bg-[#18181A] bg-white border border-zinc-300 dark:border-white/10 shadow-xs self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold shadow-xs'
                : 'text-zinc-600 dark:text-text-muted hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
              activeTab === 'requests'
                ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold shadow-xs'
                : 'text-zinc-600 dark:text-text-muted hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            <BellRing className="w-4 h-4" />
            <span>Requests ({openRequests.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ready')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
              activeTab === 'ready'
                ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold shadow-xs'
                : 'text-zinc-600 dark:text-text-muted hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Ready ({readyItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tables')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'tables'
                ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold shadow-xs'
                : 'text-zinc-600 dark:text-text-muted hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Tables ({nonAvailableTables.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bills')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bills'
                ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold shadow-xs'
                : 'text-zinc-600 dark:text-text-muted hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Bills ({activeBills.length > 0 ? activeBills.length : billRequestedTables.length})</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. OVERVIEW TAB (3-Section Operational Architecture)                 */}
      {/* ==================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-5 animate-fade-in overflow-y-auto pr-0.5">
          {/* ================================================================= */}
          {/* SECTION 1: REQUESTS — FIRST PRIORITY                              */}
          {/* ================================================================= */}
          <section
            className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-xs ${
              openRequests.length > 0
                ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/10 ring-1 ring-amber-400/20'
                : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-200/80 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                    openRequests.length > 0
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-400/30'
                      : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <BellRing className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                      Guest Service Requests
                    </h2>
                    <span
                      className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${
                        openRequests.length > 0
                          ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/50'
                          : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10'
                      }`}
                    >
                      {openRequests.length} Pending
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-text-muted">High-priority table calls requiring immediate waiter response</p>
                </div>
              </div>

              {openRequests.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-900/30 px-3 py-1 rounded-xl border border-amber-300/60 dark:border-amber-800/50 shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span>First Priority</span>
                </div>
              )}
            </div>

            {openRequests.length === 0 ? (
              <div className="py-6 text-center border border-dashed border-zinc-200 dark:border-white/10 rounded-xl bg-zinc-50/50 dark:bg-[#141416]/40 flex flex-col items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mb-1.5" />
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No Pending Service Requests</p>
                <p className="text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">All tables are attended. Calls will alert here in real time.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {openRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-white dark:bg-[#141416] flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-zinc-900 dark:text-white">
                          Table {req.tableNumber || req.table?.tableNumber || '-'}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                          {formatRequestType(req.type)}
                        </span>
                      </div>
                      {req.note && <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 italic truncate">"{req.note}"</p>}
                      <div className="text-[10px] text-zinc-500 dark:text-text-muted mt-1 flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>{getRelativeWaitTime(req.createdAt)}</span>
                        <span className="text-zinc-400 dark:text-zinc-500 font-normal">
                          ({new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {req.status === 'NEW' ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateReqStatus(req.id, 'ACKNOWLEDGED')}
                          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateReqStatus(req.id, 'COMPLETED')}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ================================================================= */}
          {/* SECTION 2: READY TO SERVE + ACTIVE TABLES (Secondary Ops Row)     */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Panel 2A: Ready to Serve */}
            <section className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-4 sm:p-5 shadow-xs flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-200/80 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary dark:bg-[#D4AF37]/15 dark:border-[#D4AF37]/20 dark:text-[#D4AF37] flex items-center justify-center shrink-0">
                    <ChefHat className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                      Ready to Serve
                    </h2>
                    <p className="text-[11px] text-zinc-500 dark:text-text-muted">Prepared dishes &amp; drinks ready for pickup</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] border border-primary/20 dark:border-[#D4AF37]/30">
                  {readyItems.length} Ready
                </span>
              </div>

              {readyItems.length === 0 ? (
                <div className="flex-1 py-8 border border-dashed border-zinc-200 dark:border-white/10 rounded-xl bg-zinc-50/50 dark:bg-[#141416]/40 flex flex-col items-center justify-center text-center">
                  <ChefHat className="w-7 h-7 text-zinc-400 dark:text-zinc-500 mb-1.5" />
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Ready Queue is Empty</p>
                  <p className="text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">Plated food and poured drinks will appear here for pickup.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {readyItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-emerald-500/30 dark:border-emerald-500/30 dark:bg-[#141416] bg-emerald-50/30 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-zinc-900 dark:text-white">
                            Table {item.tableNumber || '-'}
                          </span>
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/50">
                            {item.station}
                          </span>
                        </div>
                        <div className="font-bold text-xs text-zinc-900 dark:text-white mt-1 flex items-center gap-1.5 truncate">
                          <VegBadge type={item.foodType} size="sm" />
                          <span>{item.quantity} × {item.itemName || item.name}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleMarkItemServed(item.id)}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs active:scale-[0.98] transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Deliver</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Panel 2B: Active Tables */}
            <section className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-4 sm:p-5 shadow-xs flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-200/80 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                      Active Tables
                    </h2>
                    <p className="text-[11px] text-zinc-500 dark:text-text-muted">Current seated guests and open dining sessions</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                  {activeTables.length} Active
                </span>
              </div>

              {activeTables.length === 0 ? (
                <div className="flex-1 py-8 border border-dashed border-zinc-200 dark:border-white/10 rounded-xl bg-zinc-50/50 dark:bg-[#141416]/40 flex flex-col items-center justify-center text-center">
                  <Users className="w-7 h-7 text-zinc-400 dark:text-zinc-500 mb-1.5" />
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No Active Tables</p>
                  <p className="text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">Floor tables will populate here as guests are seated.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {activeTables.map((table) => {
                    const isBillReq = table.status === 'BILL_REQUESTED' || table.isBillRequested;
                    const placeTypeName = table.placeType?.name || (typeof table.placeType === 'string' ? table.placeType : table.categoryName);
                    return (
                      <div
                        key={table.id}
                        onClick={() => setSelectedTable(table)}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors cursor-pointer shadow-2xs ${
                          isBillReq
                            ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-500'
                            : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#141416] hover:border-primary/40 dark:hover:border-[#D4AF37]/40'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-zinc-900 dark:text-white">
                              Table {table.tableNumber || table.number || '-'}
                            </span>
                            <span
                              className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                                isBillReq
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/50'
                                  : 'bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] border border-primary/20 dark:border-[#D4AF37]/30'
                              }`}
                            >
                              {table.status || 'OCCUPIED'}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-text-muted mt-0.5 font-medium">
                            {table.capacity ? `Cap: ${table.capacity}` : ''} {placeTypeName ? `· ${placeTypeName}` : ''}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTable(table);
                            setIsAssistedOrderingOpen(true);
                          }}
                          className="w-8 h-8 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] text-white dark:text-black flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-all shrink-0"
                          title="Take Table Order"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* ================================================================= */}
          {/* SECTION 3: BILLS & PAYMENT REQUESTS (Third Area)                  */}
          {/* ================================================================= */}
          <section className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-4 sm:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-200/80 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/50 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white">
                    Bill &amp; Payment Requests
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-text-muted">Settlement calls from dining guests requesting their check</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                {billRequestedTables.length} Bills
              </span>
            </div>

            {billRequestedTables.length === 0 ? (
              <div className="py-6 border border-dashed border-zinc-200 dark:border-white/10 rounded-xl bg-zinc-50/50 dark:bg-[#141416]/40 flex flex-col items-center justify-center text-center">
                <Receipt className="w-7 h-7 text-zinc-400 dark:text-zinc-500 mb-1.5" />
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No Pending Bill Requests</p>
                <p className="text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">Tables requesting payment settlement will display here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {billRequestedTables.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-xl border border-indigo-500/30 dark:bg-[#141416] bg-indigo-50/20 flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div>
                      <div className="font-black text-sm text-zinc-900 dark:text-white">
                        Table {t.tableNumber || t.number || '-'}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-text-muted mt-0.5 font-medium">
                        Token: {t.currentTokenId || t.activeSession?.tokenNumber || '-'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenBillModal(t)}
                      className="px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-extrabold text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer shrink-0"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}


      {/* ==================================================================== */}
      {/* 2. FLOOR TABLES TAB — LEFT / RIGHT SPLIT: RESERVATIONS & BILLS       */}
      {/* ==================================================================== */}
      {activeTab === 'tables' && (
        <div className="flex-1 overflow-y-auto animate-fade-in pr-0.5">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 items-start">
              {/* Left Column: Reservations Skeleton */}
              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-white/10">
                  <div className="h-6 w-36 bg-zinc-200 dark:bg-white/10 rounded-md animate-pulse" />
                  <div className="h-5 w-8 bg-zinc-200 dark:bg-white/10 rounded-full animate-pulse" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-white/10 dark:bg-[#141416] bg-zinc-50/50 animate-pulse flex flex-col justify-between min-h-[140px] shadow-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="h-5 w-14 bg-zinc-200 dark:bg-white/10 rounded-md" />
                        <div className="h-3 w-20 bg-zinc-100 dark:bg-white/5 rounded-md" />
                      </div>
                      <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
                        <div className="h-3 w-16 bg-zinc-100 dark:bg-white/5 rounded-md" />
                        <div className="h-8 w-8 bg-zinc-200 dark:bg-white/10 rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Bills Skeleton */}
              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-white/10">
                  <div className="h-6 w-28 bg-zinc-200 dark:bg-white/10 rounded-md animate-pulse" />
                  <div className="h-5 w-8 bg-zinc-200 dark:bg-white/10 rounded-full animate-pulse" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-white/10 dark:bg-[#141416] bg-zinc-50/50 animate-pulse flex flex-col justify-between min-h-[140px] shadow-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="h-5 w-14 bg-zinc-200 dark:bg-white/10 rounded-md" />
                        <div className="h-3 w-18 bg-zinc-100 dark:bg-white/5 rounded-md" />
                      </div>
                      <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between">
                        <div className="h-3 w-16 bg-zinc-100 dark:bg-white/5 rounded-md" />
                        <div className="h-8 w-8 bg-zinc-200 dark:bg-white/10 rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 items-start">
              {/* ============================================================= */}
              {/* LEFT COLUMN: RESERVATIONS                                     */}
              {/* ============================================================= */}
              <section className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white tracking-tight">
                          Reservations
                        </h2>
                        <span className="text-xs px-2 py-0.5 rounded-full font-extrabold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                          {reservedTables.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Reserved dining tables and bookings
                      </p>
                    </div>
                  </div>
                </div>

                {reservedTables.length === 0 ? (
                  <div className="py-12 px-4 text-center border border-dashed border-zinc-300 dark:border-white/15 rounded-xl bg-zinc-50/70 dark:bg-[#141416]/50">
                    <CalendarCheck className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
                    <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">No Reserved Tables</h4>
                    <p className="text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">
                      There are currently no active reservations on the floor.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {reservedTables.map((table) => {
                      const res = getReservationForTable(table.id);
                      const guestName = res?.customerName || (table as any).reservationGuestName || '';
                      const guestPhone = res?.phoneNumber;
                      const guestsCount = res?.personsCount || table.capacity;

                      return (
                        <div
                          key={table.id}
                          onClick={() => {
                            setSelectedReservationTable(table);
                            setIsReservationModalOpen(true);
                          }}
                          className="p-3 sm:p-3.5 rounded-2xl border border-blue-200/80 dark:border-blue-900/40 bg-blue-50/20 dark:bg-[#141416] hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer flex flex-col justify-between min-h-[140px] shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <span className="font-black text-lg text-zinc-900 dark:text-white truncate block">
                                Table {table.tableNumber || table.number || '-'}
                              </span>
                              {guestName && (
                                <div className="font-bold text-xs text-zinc-800 dark:text-zinc-200 mt-0.5 truncate">
                                  {guestName}
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                              Reserved
                            </span>
                          </div>

                          <div className="mt-2 space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                            {guestsCount ? (
                              <div className="flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 shrink-0" />
                                <span>{guestsCount} Guests</span>
                              </div>
                            ) : null}
                            {guestPhone && (
                              <div className="flex items-center gap-1.5 truncate">
                                <Phone className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{guestPhone}</span>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-[11px] gap-2">
                            <span className="text-zinc-500 dark:text-zinc-400 truncate font-medium">
                              {table.placeType?.name || (typeof table.placeType === 'string' ? table.placeType : table.section || '')}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReservationTable(table);
                                setIsReservationModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-primary dark:text-[#D4AF37] hover:bg-primary/10 dark:hover:bg-[#D4AF37]/10 transition-colors shrink-0"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ============================================================= */}
              {/* RIGHT COLUMN: BILLS                                           */}
              {/* ============================================================= */}
              <section className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white tracking-tight">
                          Bills
                        </h2>
                        <span className="text-xs px-2 py-0.5 rounded-full font-extrabold bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-white/10">
                          {sortedBillingTables.length}
                        </span>
                        {billRequestedTables.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-extrabold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/50">
                            {billRequestedTables.length} Bill Requested
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Active dining sessions and settlement requests
                      </p>
                    </div>
                  </div>
                </div>

                {sortedBillingTables.length === 0 ? (
                  <div className="py-12 px-4 text-center border border-dashed border-zinc-300 dark:border-white/15 rounded-xl bg-zinc-50/70 dark:bg-[#141416]/50">
                    <Receipt className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
                    <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">No Active Bills</h4>
                    <p className="text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">
                      There are currently no active dining sessions or bill requests on the floor.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {sortedBillingTables.map((table) => {
                      const isBillReq = table.status === 'BILL_REQUESTED' || table.isBillRequested;
                      const statusStyles = getTableStatusClasses(table.status);
                      const displayStatus = formatTableStatus(table.status);

                      return (
                        <div
                          key={table.id}
                          onClick={() => handleOpenBillModal(table)}
                          className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[140px] shadow-xs ${
                            isBillReq
                              ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-500 ring-1 ring-amber-400/30'
                              : 'border-zinc-200 dark:border-white/10 bg-zinc-50/40 dark:bg-[#141416] hover:border-primary/50 dark:hover:border-[#D4AF37]/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <span className="font-black text-lg text-zinc-900 dark:text-white truncate block">
                                Table {table.tableNumber || table.number || '-'}
                              </span>
                              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium truncate">
                                {table.currentTokenId ? `Token: ${table.currentTokenId}` : (table.capacity ? `Cap: ${table.capacity} guests` : '')}
                              </div>
                            </div>
                            <span
                              className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${statusStyles.badge}`}
                            >
                              {displayStatus}
                            </span>
                          </div>

                          <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-[11px] gap-2">
                            <span className="text-zinc-500 dark:text-zinc-400 truncate font-medium max-w-[100px]">
                              {table.placeType?.name || (typeof table.placeType === 'string' ? table.placeType : table.section || '')}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBillModal(table);
                              }}
                              className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer ${
                                isBillReq
                                  ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                                  : 'bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black'
                              }`}
                              title="View Bill Details"
                            >
                              View Bill
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. REQUESTS TAB                                                      */}
      {/* ==================================================================== */}
      {activeTab === 'requests' && (
        <div className="flex-1 overflow-y-auto space-y-4 animate-fade-in">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 dark:bg-[#18181A] bg-white animate-pulse space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-24 bg-zinc-200 dark:bg-white/10 rounded-md" />
                    <div className="h-5 w-16 bg-zinc-200 dark:bg-white/10 rounded-full" />
                  </div>
                  <div className="h-4 w-28 bg-zinc-100 dark:bg-white/5 rounded-md" />
                  <div className="h-4 w-36 bg-zinc-100 dark:bg-white/5 rounded-md" />
                  <div className="h-11 w-full bg-zinc-200 dark:bg-white/10 rounded-xl mt-3" />
                </div>
              ))}
            </div>
          ) : openRequests.length === 0 ? (
            <div className="py-10 px-4 sm:py-16 text-center border border-dashed border-zinc-300 dark:border-white/15 rounded-2xl bg-zinc-50/70 dark:bg-[#141416]/50">
              <BellRing className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-500 mb-3" />
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">No Pending Service Requests</h3>
              <p className="text-xs text-zinc-500 dark:text-text-muted mt-1">Guest calls for water, cutlery, and cleanup will appear here in real time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {openRequests.map((req) => {
                const waitMins = getWaitMinutes(req.createdAt);
                const waitTimeColor =
                  waitMins >= 15
                    ? 'text-rose-700 dark:text-rose-400 font-bold'
                    : waitMins >= 10
                    ? 'text-amber-700 dark:text-amber-400 font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 font-medium';

                return (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 dark:bg-[#18181A] bg-white flex flex-col justify-between transition-all shadow-xs"
                  >
                    <div>
                      {/* Top Header Row: Table Number + Status Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-base text-zinc-900 dark:text-white tracking-tight">
                          Table {req.tableNumber || req.table?.tableNumber || 'C5'}
                        </span>
                        {req.status === 'NEW' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                            </span>
                            New
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                            Acknowledged
                          </span>
                        )}
                      </div>

                      {/* Request Type Badge */}
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] dark:border-[#D4AF37]/30">
                          {formatRequestType(req.type)}
                        </span>
                      </div>

                      {/* Guest Note (if present) */}
                      {req.note && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-2 italic line-clamp-2">
                          "{req.note}"
                        </p>
                      )}

                      {/* Waiting Time & Creation Timestamp with Visual Escalation */}
                      <div className={`text-xs mt-2.5 flex items-center gap-1.5 ${waitTimeColor}`}>
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-bold tracking-tight">{getRelativeWaitTime(req.createdAt)}</span>
                        <span className="text-zinc-400 dark:text-zinc-500 font-normal text-[11px]">
                          ({new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      </div>
                    </div>

                    {/* Action Button Row with Height 44px (h-11) and WCAG AA Amber Contrast */}
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-white/5">
                      {req.status === 'NEW' ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateReqStatus(req.id, 'ACKNOWLEDGED')}
                          className="w-full h-11 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateReqStatus(req.id, 'COMPLETED')}
                          className="w-full h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. READY QUEUE TAB                                                   */}
      {/* ==================================================================== */}
      {activeTab === 'ready' && (
        <div className="flex-1 overflow-y-auto space-y-4 animate-fade-in">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 dark:bg-[#18181A] bg-white animate-pulse space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-24 bg-zinc-200 dark:bg-white/10 rounded-md" />
                    <div className="h-5 w-16 bg-zinc-200 dark:bg-white/10 rounded-full" />
                  </div>
                  <div className="h-4 w-32 bg-zinc-100 dark:bg-white/5 rounded-md" />
                  <div className="h-4 w-44 bg-zinc-100 dark:bg-white/5 rounded-md" />
                  <div className="h-11 w-full bg-zinc-200 dark:bg-white/10 rounded-xl mt-3" />
                </div>
              ))}
            </div>
          ) : readyItems.length === 0 ? (
            <div className="py-10 px-4 sm:py-16 text-center border border-dashed border-zinc-300 dark:border-white/15 rounded-2xl bg-zinc-50/70 dark:bg-[#141416]/50">
              <ChefHat className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-500 mb-3" />
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Ready Queue is Empty</h3>
              <p className="text-xs text-zinc-500 dark:text-text-muted mt-1">Dishes plated by the chef and cocktails poured by the bartender will appear here for pickup.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {readyItems.map((item) => {
                const readyTimestamp = item.readyAt || item.createdAt;
                const waitMins = readyTimestamp ? getWaitMinutes(readyTimestamp) : 0;
                const waitTimeColor =
                  waitMins >= 10
                    ? 'text-rose-700 dark:text-rose-400 font-bold'
                    : waitMins >= 5
                    ? 'text-amber-700 dark:text-amber-400 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400';

                const isBar = item.station === 'BAR';

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 dark:bg-[#18181A] bg-white flex flex-col justify-between transition-all shadow-xs"
                  >
                    <div>
                      {/* Top Header Row: Table Number + Station Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-base text-zinc-900 dark:text-white tracking-tight">
                          Table {item.tableNumber || '-'}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                            isBar
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
                              : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                          }`}
                        >
                          {item.station}
                        </span>
                      </div>

                      {/* Item Name, Quantity & Variant */}
                      <div className="font-bold text-sm text-zinc-900 dark:text-white mt-2 flex items-start gap-1.5">
                        <div className="shrink-0 mt-0.5">
                          <VegBadge type={item.foodType} size="sm" />
                        </div>
                        <span className="leading-snug">
                          {item.quantity} × {item.itemName || item.name}
                          {item.variantName && (
                            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 ml-1">
                              ({item.variantName})
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Modifiers List (if present) */}
                      {item.selectedModifiers && Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                        <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium mt-1 pl-5">
                          {item.selectedModifiers.map((m: any) => m.optionName || m.name || m).join(', ')}
                        </div>
                      )}

                      {/* Special Instructions (if present) */}
                      {item.specialInstructions && (
                        <div className="text-[11px] font-semibold italic text-amber-700 dark:text-amber-400 mt-1.5 pl-5 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-1 rounded-md border border-amber-200/60 dark:border-amber-900/30">
                          &quot;{item.specialInstructions}&quot;
                        </div>
                      )}

                      {/* Elapsed Ready Time with Progressive Escalation */}
                      {readyTimestamp && (
                        <div className={`text-xs mt-2.5 flex items-center gap-1.5 ${waitTimeColor}`}>
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-bold tracking-tight">Ready {getRelativeWaitTime(readyTimestamp)}</span>
                          <span className="text-zinc-400 dark:text-zinc-500 font-normal text-[11px]">
                            ({new Date(readyTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Button Row: Full-width 44px (h-11) Touch Target */}
                    <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => handleMarkItemServed(item.id)}
                        className="w-full h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Deliver & Serve</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. BILLS TAB — Complete Operational Workspace                        */}
      {/* ==================================================================== */}
      {activeTab === 'bills' && (() => {
        const filteredActiveBills = activeBills.filter((b) => {
          if (!billsSearchQuery.trim()) return true;
          const q = billsSearchQuery.toLowerCase();
          return (
            String(b.tableNumber).toLowerCase().includes(q) ||
            String(b.tokenNumber).toLowerCase().includes(q) ||
            String(b.customerName || '').toLowerCase().includes(q) ||
            String(b.billNumber || '').toLowerCase().includes(q)
          );
        });

        const filteredSettledBills = settledBills.filter((b) => {
          if (!billsSearchQuery.trim()) return true;
          const q = billsSearchQuery.toLowerCase();
          return (
            String(b.tableNumber).toLowerCase().includes(q) ||
            String(b.tokenNumber).toLowerCase().includes(q) ||
            String(b.customerName || '').toLowerCase().includes(q) ||
            String(b.billNumber || '').toLowerCase().includes(q) ||
            String(b.settlementReference || '').toLowerCase().includes(q)
          );
        });

        const readyToSettleCount = activeBills.filter((b) => (b.unservedCount || 0) === 0).length;
        const inPrepCount = activeBills.filter((b) => (b.unservedCount || 0) > 0).length;

        return (
          <div className="flex-1 overflow-y-auto space-y-4 animate-fade-in pr-0.5">
            {/* Control & Navigation Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                    Bills & Checkout
                  </h2>
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live Queue</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Verify customer bills, check unserved items, collect payment, and release dining tables.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                {/* Sub-tab Navigation */}
                <div className="flex items-center gap-1 p-1 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setBillsSubTab('active')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      billsSubTab === 'active'
                        ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs font-black'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Active Requests</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        billsSubTab === 'active'
                          ? 'bg-white/20 text-white dark:bg-black/25 dark:text-black'
                          : 'bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {activeBills.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillsSubTab('history')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      billsSubTab === 'history'
                        ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs font-black'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Settled Today</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        billsSubTab === 'history'
                          ? 'bg-white/20 text-white dark:bg-black/25 dark:text-black'
                          : 'bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {settledSummary.completedTodayCount}
                    </span>
                  </button>
                </div>

                {/* Refresh Action */}
                <button
                  type="button"
                  onClick={fetchBillsData}
                  disabled={isBillsLoading}
                  title="Refresh bills data"
                  className="p-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className={`w-4 h-4 ${isBillsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Operational Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Active Requests
                  </div>
                  <div className="text-xl font-black text-zinc-900 dark:text-white">
                    {activeBills.length}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Ready to Settle
                  </div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {readyToSettleCount}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    inPrepCount > 0
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-zinc-100 dark:bg-white/5 text-zinc-400'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Items in Prep
                  </div>
                  <div
                    className={`text-xl font-black ${
                      inPrepCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-white'
                    }`}
                  >
                    {inPrepCount}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] flex items-center justify-center shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Settled Today
                  </div>
                  <div className="text-xl font-black text-zinc-900 dark:text-white flex items-baseline gap-1.5">
                    <span>{settledSummary.completedTodayCount}</span>
                    <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      · ₹{Number(settledSummary.completedTodayRevenue).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filter Row */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  billsSubTab === 'active'
                    ? 'Search active bills by table, token, or customer name...'
                    : 'Search settled history by table, bill #, token, or reference...'
                }
                value={billsSearchQuery}
                onChange={(e) => setBillsSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 rounded-xl text-xs bg-white dark:bg-[#18181A] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:border-primary dark:focus:border-[#D4AF37] transition-colors shadow-2xs"
              />
              {billsSearchQuery && (
                <button
                  type="button"
                  onClick={() => setBillsSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* TAB 1: ACTIVE REQUESTS */}
            {billsSubTab === 'active' && (
              <div className="space-y-3">
                {filteredActiveBills.length === 0 ? (
                  <div className="p-16 text-center border border-dashed border-zinc-300 dark:border-white/15 rounded-3xl bg-zinc-50/70 dark:bg-[#141416]/50">
                    <Receipt className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-500 mb-3" />
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                      {billsSearchQuery ? 'No Matching Active Bill Requests' : 'No Pending Bill Requests'}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-text-muted mt-1 max-w-sm mx-auto">
                      {billsSearchQuery
                        ? 'No active bill requests match your search criteria.'
                        : 'When a customer requests their bill from their mobile device or table terminal, it will appear here instantly.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {filteredActiveBills.map((b) => {
                      const waitMins = b.requestedAt ? getWaitMinutes(b.requestedAt) : 0;
                      const waitBadgeColor =
                        waitMins >= 15
                          ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 font-bold'
                          : waitMins >= 10
                          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30 font-bold'
                          : 'bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10';

                      const isUnserved = (b.unservedCount || 0) > 0;

                      return (
                        <div
                          key={b.id || b.tableId}
                          onClick={() => handleOpenBillModal(b)}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-4 shadow-xs hover:shadow-md ${
                            isUnserved
                              ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/20 dark:bg-[#18181A] hover:border-amber-500'
                              : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] hover:border-primary dark:hover:border-[#D4AF37]'
                          }`}
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-100 dark:border-white/5">
                              <div className="flex items-center gap-2 min-w-0">
                                <h3 className="font-black text-lg text-zinc-900 dark:text-white truncate">
                                  Table {b.tableNumber}
                                </h3>
                                {b.placeType && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 truncate">
                                    {b.placeType}
                                  </span>
                                )}
                              </div>

                              <div className={`px-2 py-0.5 rounded-full text-[10px] border flex items-center gap-1 shrink-0 ${waitBadgeColor}`}>
                                <Clock className="w-3 h-3" />
                                <span>{waitMins}m waiting</span>
                              </div>
                            </div>

                            {/* Session & Guest Info */}
                            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                              <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Token</span>
                                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200 truncate block">
                                  {b.tokenNumber || '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Guest</span>
                                <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate block">
                                  {b.customerName || 'Guest'} {b.personsCount ? `(${b.personsCount}p)` : ''}
                                </span>
                              </div>
                            </div>

                            {/* Kitchen/Bar Status Pill */}
                            <div className="mt-3">
                              {isUnserved ? (
                                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>{b.unservedCount} item(s) still in prep ({b.itemCount} total)</span>
                                </div>
                              ) : (
                                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>All {b.itemCount} items served</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Footer: Financials & Action */}
                          <div className="pt-3 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between gap-2">
                            <div>
                              <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Payable</div>
                              <div className="font-mono font-black text-base text-zinc-900 dark:text-white">
                                ₹{Number(b.grandTotal || 0).toFixed(2)}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBillModal(b);
                              }}
                              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-black text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <span>Review Bill</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SETTLED TODAY (AUDIT TRAIL) */}
            {billsSubTab === 'history' && (
              <div className="space-y-3">
                {filteredSettledBills.length === 0 ? (
                  <div className="p-16 text-center border border-dashed border-zinc-300 dark:border-white/15 rounded-3xl bg-zinc-50/70 dark:bg-[#141416]/50">
                    <History className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-500 mb-3" />
                    <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                      {billsSearchQuery ? 'No Matching Settled Bills' : 'No Settled Bills Today'}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-text-muted mt-1 max-w-sm mx-auto">
                      {billsSearchQuery
                        ? 'No historical settled bills match your search criteria.'
                        : 'Bills settled and confirmed by staff during today’s operational shift will appear here.'}
                    </p>
                  </div>
                ) : (
                  <div className="border border-zinc-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#18181A] overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                            <th className="py-3 px-4">Bill & Table</th>
                            <th className="py-3 px-4">Guest</th>
                            <th className="py-3 px-4">Method & Ref</th>
                            <th className="py-3 px-4">Settled By</th>
                            <th className="py-3 px-4">Time</th>
                            <th className="py-3 px-4 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200/70 dark:divide-white/5">
                          {filteredSettledBills.map((b) => (
                            <tr key={b.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/5 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-bold text-zinc-900 dark:text-white">Table {b.tableNumber}</div>
                                <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{b.billNumber}</div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-zinc-800 dark:text-zinc-200">{b.customerName || 'Guest'}</div>
                                {b.customerPhone && (
                                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{b.customerPhone}</div>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                      b.paymentMethod === 'UPI'
                                        ? 'bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
                                        : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                    }`}
                                  >
                                    {b.paymentMethod}
                                  </span>
                                </div>
                                {b.settlementReference && (
                                  <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    {b.settlementReference}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300 font-medium">
                                {b.settledBy || 'Staff'}
                              </td>
                              <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                                {b.paidAt ? getRelativeWaitTime(b.paidAt) : 'Today'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="font-mono font-black text-sm text-zinc-900 dark:text-white">
                                  ₹{Number(b.grandTotal || 0).toFixed(2)}
                                </div>
                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                                  PAID
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Assisted Order Drawer */}
      {isAssistedOrderingOpen && selectedTable && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white dark:bg-[#141416] border-l border-zinc-200 dark:border-white/10 h-full flex flex-col p-4 sm:p-6 shadow-2xl overflow-hidden animate-slide-left">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-white/10">
              <div>
                <h3 className="font-black text-xl text-zinc-900 dark:text-white">
                  Assisted Order — Table {selectedTable.tableNumber || selectedTable.number}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-text-muted">Take table-side order directly for guests</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAssistedOrderingOpen(false);
                  setAssistedCart([]);
                }}
                className="p-2 rounded-xl text-zinc-500 dark:text-text-muted hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Search */}
            <div className="mt-4 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#18181A] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-primary dark:focus:border-[#D4AF37] shadow-xs"
              />
            </div>

            {/* Menu Items List */}
            <div className="flex-1 overflow-y-auto space-y-2 mt-4 pr-1">
              {filteredMenuItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-zinc-200 dark:border-white/10 dark:bg-[#18181A] bg-white flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <VegBadge type={item.foodType} size="sm" />
                      <span className="font-bold text-xs text-zinc-900 dark:text-white truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-primary dark:text-[#D4AF37] font-black mt-0.5">₹{Number(item.basePrice).toFixed(2)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddAssistedItem(item)}
                    className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-bold text-xs shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>

            {/* Assisted Cart Summary */}
            {assistedCart.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-white/10 space-y-3">
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {assistedCart.map((item) => (
                    <div key={item.menuItemId} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[180px] text-zinc-900 dark:text-white font-medium">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateAssistedQty(item.menuItemId, -1)}
                          className="w-8 h-8 rounded-xl border border-zinc-300 dark:border-white/20 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-zinc-800 dark:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-2xs"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-xs text-zinc-900 dark:text-white">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateAssistedQty(item.menuItemId, 1)}
                          className="w-8 h-8 rounded-xl border border-zinc-300 dark:border-white/20 bg-zinc-100 dark:bg-white/10 hover:bg-zinc-200 dark:hover:bg-white/20 text-zinc-800 dark:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-2xs"
                          title="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-16 text-right font-black text-zinc-900 dark:text-white">₹{(item.unitPrice * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-sm font-black pt-2 border-t border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                  <span>Total</span>
                  <span className="text-primary dark:text-[#D4AF37]">₹{assistedCartTotal.toFixed(2)}</span>
                </div>

                <button
                  type="button"
                  disabled={isSubmittingOrder}
                  onClick={handleSubmitAssistedOrder}
                  className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                >
                  {isSubmittingOrder ? 'Submitting...' : `Submit Order for Table ${selectedTable.tableNumber || selectedTable.number}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bill Details Modal — Two-Stage Review & Payment Flow */}
      {isBillDetailsOpen && selectedBillTable && (() => {
        const bill = activeTableBill || getBillForTable(selectedBillTable);
        const waitMins = selectedBillTable.requestedAt
          ? getWaitMinutes(selectedBillTable.requestedAt)
          : selectedBillTable.createdAt
          ? getWaitMinutes(selectedBillTable.createdAt)
          : 0;
        const waitTimeColor =
          waitMins >= 15
            ? 'text-rose-700 dark:text-rose-400 font-bold'
            : waitMins >= 10
            ? 'text-amber-700 dark:text-amber-400 font-bold'
            : 'text-zinc-600 dark:text-zinc-400 font-medium';

        const unservedItems = (bill?.items || []).filter(
          (i: any) => i.status !== 'SERVED' && i.status !== 'CANCELLED'
        );

        const tableNum = selectedBillTable.tableNumber || selectedBillTable.number || bill?.tableNumber || '—';
        const tokenNum =
          selectedBillTable.tokenNumber ||
          selectedBillTable.currentTokenId ||
          selectedBillTable.tokenId ||
          bill?.tokenNumber ||
          '—';

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div className="w-full max-w-md sm:max-w-lg bg-white dark:bg-[#18181A] rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-200 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] flex items-center justify-center shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-lg sm:text-xl text-zinc-900 dark:text-white tracking-tight">
                        Table {tableNum}
                      </h3>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                        Bill Requested
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Token: <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{tokenNum}</span>
                      {selectedBillTable.placeType?.name || selectedBillTable.placeType ? ` · ${selectedBillTable.placeType?.name || selectedBillTable.placeType}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsBillDetailsOpen(false);
                    setSelectedBillTable(null);
                    setSettlementStep('review');
                  }}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Step Flow Progress Bar */}
              <div className="grid grid-cols-2 text-center text-xs font-black border-b border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-[#141416]/40">
                <button
                  type="button"
                  onClick={() => setSettlementStep('review')}
                  className={`py-2.5 px-3 border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    settlementStep === 'review'
                      ? 'border-primary text-primary dark:border-[#D4AF37] dark:text-[#D4AF37] bg-white dark:bg-[#18181A]'
                      : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <span>1. Review Bill & Items</span>
                  {unservedItems.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (bill && Number(bill.grandTotal || bill.total || 0) >= 0) {
                      setSettlementStep('payment');
                    }
                  }}
                  className={`py-2.5 px-3 border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    settlementStep === 'payment'
                      ? 'border-primary text-primary dark:border-[#D4AF37] dark:text-[#D4AF37] bg-white dark:bg-[#18181A]'
                      : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <span>2. Payment & Release</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                {isBillLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary dark:text-[#D4AF37] mb-2" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      Calculating current bill from active orders...
                    </p>
                  </div>
                ) : billFetchError ? (
                  <div className="py-8 text-center text-xs text-rose-600 dark:text-rose-400 font-medium">
                    {billFetchError}
                  </div>
                ) : !bill || !bill.items || bill.items.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    No billed items recorded yet for this table.
                  </div>
                ) : settlementStep === 'review' ? (
                  /* ========================================================= */
                  /* STAGE 1: BILL REVIEW                                      */
                  /* ========================================================= */
                  <>
                    {/* Waiting Time & Guests Banner */}
                    <div className="px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-between text-xs">
                      <div className={`flex items-center gap-1.5 ${waitTimeColor}`}>
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Requested {waitMins}m ago</span>
                      </div>
                      {selectedBillTable.personsCount || selectedBillTable.capacity ? (
                        <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400 font-medium">
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          <span>{selectedBillTable.personsCount || selectedBillTable.capacity} Guests</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Unserved Items Alert */}
                    {unservedItems.length > 0 && (
                      <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <div className="space-y-1">
                          <div className="font-extrabold text-amber-900 dark:text-amber-100">
                            Unresolved Orders ({unservedItems.length} items still in prep)
                          </div>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                            Some items are not yet marked as served. Confirm with kitchen/bar that all items have reached Table {tableNum} before settling payment.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Unserved Items Alert Banner */}
                    {(() => {
                      const unservedCount = (bill.items || []).filter(
                        (it: any) => it.status !== 'SERVED' && it.status !== 'CANCELLED'
                      ).length;

                      if (unservedCount > 0) {
                        return (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>{unservedCount} item(s) are still unserved or preparing. All items must be served or cancelled before proceeding to payment.</span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Itemized Order List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        <span>Ordered Items ({bill.items.length})</span>
                        <span>Item Status</span>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {bill.items.map((item: any, idx: number) => {
                          const isItemServed = item.status === 'SERVED';
                          const isItemReady = item.status === 'READY';
                          const isItemPrep = item.status === 'PREPARING';

                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-xl border border-zinc-200/80 dark:border-white/5 bg-zinc-50/50 dark:bg-[#141416]/50 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <VegBadge type={item.foodType} size="sm" />
                                <div className="min-w-0">
                                  <div className="font-bold text-zinc-900 dark:text-white truncate">
                                    {item.name || item.itemName}
                                  </div>
                                  <div className="text-[10px] text-zinc-400">
                                    ₹{Number(item.unitPrice || item.price || 0).toFixed(2)} × {item.quantity}
                                    {item.station ? ` · ${item.station}` : ''}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {isItemReady && (
                                  <button
                                    type="button"
                                    onClick={() => handleServeItemInline(item.id)}
                                    className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                                    title="Mark this ready item as served"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Serve</span>
                                  </button>
                                )}

                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                                    isItemServed
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                      : isItemReady
                                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                                      : isItemPrep
                                      ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                                      : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10'
                                  }`}
                                >
                                  {item.status || 'PLACED'}
                                </span>

                                <span className="font-mono font-black text-zinc-900 dark:text-white w-16 text-right">
                                  ₹{((item.unitPrice || item.price || 0) * item.quantity).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="pt-3 border-t border-zinc-200 dark:border-white/10 space-y-1.5 text-xs">
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span>Subtotal</span>
                        <span className="font-mono font-semibold">
                          ₹{Number(bill.grossSubtotal || bill.subtotal || 0).toFixed(2)}
                        </span>
                      </div>

                      {Number(bill.serviceChargeTotal || bill.serviceCharge || 0) > 0 && (
                        <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                          <span>Service Charge (5%)</span>
                          <span className="font-mono">
                            ₹{Number(bill.serviceChargeTotal || bill.serviceCharge || 0).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {Number(bill.taxTotal || bill.cgst || bill.sgst || 0) > 0 && (
                        <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                          <span>GST / Taxes (5%)</span>
                          <span className="font-mono">
                            ₹{Number(bill.taxTotal || Number(bill.cgst || 0) + Number(bill.sgst || 0)).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {Number(bill.redemptionDeduction || 0) > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                          <span>Drink Entitlement Offset</span>
                          <span className="font-mono">-₹{Number(bill.redemptionDeduction).toFixed(2)}</span>
                        </div>
                      )}

                      {Number(bill.rounding || 0) !== 0 && (
                        <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                          <span>Rounding Adjustment</span>
                          <span className="font-mono">
                            {Number(bill.rounding) > 0
                              ? `+₹${Number(bill.rounding).toFixed(2)}`
                              : `-₹${Math.abs(Number(bill.rounding)).toFixed(2)}`}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-base font-black pt-2 border-t border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                        <span>Final Amount Payable</span>
                        <span className="text-primary dark:text-[#D4AF37] font-mono text-xl font-black">
                          ₹{Number(bill.grandTotal || bill.total || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  /* ========================================================= */
                  /* STAGE 2: PAYMENT EXECUTION                                */
                  /* ========================================================= */
                  <div className="space-y-4">
                    {/* Back to Review Link */}
                    <button
                      type="button"
                      onClick={handleBackToReview}
                      className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Itemized Review</span>
                    </button>

                    {/* Payable Summary Banner */}
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                          Table {tableNum} · Due Amount
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {bill.items?.length || 0} items confirmed
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black font-mono text-primary dark:text-[#D4AF37]">
                          ₹{Number(bill.grandTotal || bill.total || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="space-y-2">
                      <div className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        Choose Payment Method
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setSelectedPaymentMethod('CASH')}
                          className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                            selectedPaymentMethod === 'CASH'
                              ? 'border-primary dark:border-[#D4AF37] bg-primary/10 dark:bg-[#D4AF37]/15 ring-2 ring-primary/30 dark:ring-[#D4AF37]/30'
                              : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#141416] hover:border-zinc-300 dark:hover:border-white/20'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              selectedPaymentMethod === 'CASH'
                                ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-black'
                                : 'bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            <Banknote className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-extrabold text-xs text-zinc-900 dark:text-white">Cash</div>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Manual Cash</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedPaymentMethod('UPI')}
                          className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                            selectedPaymentMethod === 'UPI'
                              ? 'border-primary dark:border-[#D4AF37] bg-primary/10 dark:bg-[#D4AF37]/15 ring-2 ring-primary/30 dark:ring-[#D4AF37]/30'
                              : 'border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#141416] hover:border-zinc-300 dark:hover:border-white/20'
                          }`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              selectedPaymentMethod === 'UPI'
                                ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-black'
                                : 'bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            <QrCode className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-extrabold text-xs text-zinc-900 dark:text-white">UPI QR</div>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">Scan & Pay</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Mode Guidance */}
                    {selectedPaymentMethod === 'CASH' && (
                      <div className="p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1.5">
                        <div className="font-bold flex items-center gap-1.5">
                          <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Cash Settlement Protocol</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400/85 leading-relaxed">
                          Collect exact cash amount of <strong>₹{Number(bill.grandTotal || bill.total || 0).toFixed(2)}</strong> from the customer at Table {tableNum}. Once received, confirm below to release the table.
                        </p>
                      </div>
                    )}

                    {selectedPaymentMethod === 'UPI' && (
                      <div className="p-4 rounded-2xl border border-primary/20 dark:border-[#D4AF37]/30 bg-primary/5 dark:bg-[#D4AF37]/10 text-center space-y-3">
                        <div className="font-bold text-xs text-zinc-900 dark:text-white flex items-center justify-center gap-1.5">
                          <QrCode className="w-4 h-4 text-primary dark:text-[#D4AF37]" />
                          <span>UPI Simulation QR Code</span>
                        </div>
                        <div className="inline-block p-3 rounded-2xl bg-white shadow-md border border-zinc-200">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                              `upi://pay?pa=tableflow@pegsnbottles&pn=PegsNBottles&am=${Number(
                                bill.grandTotal || bill.total || 0
                              ).toFixed(2)}&cu=INR&tn=Table-${tableNum}`
                            )}`}
                            alt="UPI Simulation QR"
                            className="w-32 h-32 mx-auto"
                          />
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
                          Present this QR code to the customer. Once transfer verification is shown on their UPI app, click <strong>Confirm Payment</strong> to finalize.
                        </p>
                      </div>
                    )}

                    {/* Settlement Error */}
                    {settlementError && (
                      <div className="p-3.5 rounded-2xl border border-rose-400 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span>{settlementError}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-[#141416]/50 flex items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseBillModal}
                  disabled={isSettlingBill || isInitiatingSettlement}
                  className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#18181A] text-zinc-700 dark:text-zinc-300 font-extrabold text-xs hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  Close
                </button>

                {settlementStep === 'review' ? (() => {
                  const unservedCount = (bill.items || []).filter(
                    (it: any) => it.status !== 'SERVED' && it.status !== 'CANCELLED'
                  ).length;
                  const isBlocked = unservedCount > 0 || isBillLoading || isInitiatingSettlement || !bill || Number(bill.grandTotal || bill.total || 0) < 0;

                  return (
                    <button
                      type="button"
                      onClick={handleProceedToPayment}
                      disabled={isBlocked}
                      title={unservedCount > 0 ? `Resolve ${unservedCount} unserved item(s) before proceeding to payment` : undefined}
                      className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-black text-xs shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isInitiatingSettlement ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Locking Table & Initiating...</span>
                        </>
                      ) : (
                        <>
                          <span>Proceed to Payment</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  );
                })() : (
                  <button
                    type="button"
                    onClick={handleConfirmPayment}
                    disabled={isSettlingBill || isBillLoading || !bill || Number(bill.grandTotal || bill.total || 0) < 0}
                    className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-black text-xs shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSettlingBill ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Confirming Settlement...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm Payment ({selectedPaymentMethod})</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reservation Details Modal */}
      {isReservationModalOpen && selectedReservationTable && (() => {
        const tableObj = (selectedReservationTable as any).table || selectedReservationTable;
        const res = (selectedReservationTable as any).reservation || getReservationForTable(tableObj.id);
        const guestName = res?.customerName || tableObj.reservationGuestName || 'Guest';
        const guestPhone = res?.phoneNumber;
        const guestEmail = (res as any)?.email;
        const guestsCount = res?.personsCount || tableObj.capacity;
        const reservationTime = res?.reservationTime || res?.date;
        const reservationNotes = (res as any)?.notes || (res as any)?.specialRequests;

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
            <div className="w-full max-w-md bg-white dark:bg-[#18181A] rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col animate-scale-up">
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-200 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg sm:text-xl text-zinc-900 dark:text-white tracking-tight">
                      Table {tableObj.tableNumber || tableObj.number || '-'}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {tableObj.placeType?.name || (typeof tableObj.placeType === 'string' ? tableObj.placeType : 'Table Reservation')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsReservationModalOpen(false);
                    setSelectedReservationTable(null);
                  }}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Reservation Info Body */}
              <div className="p-5 space-y-4 text-xs">
                <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-sm shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-sm text-zinc-900 dark:text-white truncate">
                      {guestName}
                    </div>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                      {res?.status || 'Confirmed'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {guestsCount ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-[#141416]/50">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <Users className="w-4 h-4 text-zinc-400" />
                        <span className="font-medium">Party Size</span>
                      </div>
                      <span className="font-bold text-zinc-900 dark:text-white">{guestsCount} Guests</span>
                    </div>
                  ) : null}

                  {guestPhone && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-[#141416]/50">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <Phone className="w-4 h-4 text-zinc-400" />
                        <span className="font-medium">Contact Phone</span>
                      </div>
                      <a href={`tel:${guestPhone}`} className="font-bold text-primary dark:text-[#D4AF37] hover:underline">
                        {guestPhone}
                      </a>
                    </div>
                  )}

                  {guestEmail && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-[#141416]/50">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <Mail className="w-4 h-4 text-zinc-400" />
                        <span className="font-medium">Email</span>
                      </div>
                      <span className="font-bold text-zinc-900 dark:text-white truncate max-w-[200px]">{guestEmail}</span>
                    </div>
                  )}

                  {reservationTime && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-[#141416]/50">
                      <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
                        <Clock className="w-4 h-4 text-zinc-400" />
                        <span className="font-medium">Reservation Time</span>
                      </div>
                      <span className="font-bold text-zinc-900 dark:text-white">
                        {new Date(reservationTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                  )}

                  {reservationNotes && (
                    <div className="p-3 rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-[#141416]/50">
                      <span className="text-[11px] font-semibold text-zinc-400 block mb-1">Special Notes</span>
                      <p className="text-zinc-700 dark:text-zinc-300 italic">{reservationNotes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 border-t border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-[#141416]/50 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsReservationModalOpen(false);
                    setSelectedReservationTable(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-extrabold text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default WaiterStationPage;
