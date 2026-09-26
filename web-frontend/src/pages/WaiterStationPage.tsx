import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  History,
  Utensils,
  ChevronRight,
  Wine,
  Trash2,
} from 'lucide-react';
import { VegBadge } from '../components/customer/VegBadge';
import { ProductCustomizer, type CustomizerItem } from '../components/customer/ProductCustomizer';
import { useServedUndo } from '../services/servedUndoManager';
import { useData } from '../context/DataContext';
import { ExtendSessionModal } from '../components/modals/ExtendSessionModal';
import { useEnterKey } from '../hooks/useEnterKey';
import { useModalKeyboard } from '../hooks/useModalKeyboard';
import { useRovingSelection } from '../hooks/useRovingSelection';
import type { Token } from '../types';

export type WaiterTab = 'overview' | 'tables' | 'requests' | 'ready' | 'bills';

const formatPassNumber = (token?: string | null): string => {
  if (!token) return '';
  const cleaned = String(token).trim();
  if (cleaned.length > 12) {
    return `#${cleaned.slice(-6).toUpperCase()}`;
  }
  return cleaned;
};

interface WaiterStationPageProps {
  initialTab?: WaiterTab;
  onTabChange?: (tab: WaiterTab) => void;
}

export const WaiterStationPage: React.FC<WaiterStationPageProps> = ({ initialTab = 'overview', onTabChange }) => {
  const { user } = useAuth();
  const { tokens, rates, refreshTokens, refreshTables } = useData();
  const [activeTab, setActiveTabState] = useState<WaiterTab>(initialTab);
  const [extendingTable, setExtendingTable] = useState<any | null>(null);
  const [extendingToken, setExtendingToken] = useState<Token | null>(null);

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTabState(initialTab);
    }
  }, [initialTab]);

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
  const [customizerTargetItem, setCustomizerTargetItem] = useState<any | null>(null);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState<boolean>(false);
  const [selectedAssistedCategory, setSelectedAssistedCategory] = useState<string>('ALL');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [drawerDragY, setDrawerDragY] = useState<number>(0);
  const [isDrawerDragging, setIsDrawerDragging] = useState<boolean>(false);
  const [isDrawerClosing, setIsDrawerClosing] = useState<boolean>(false);
  const drawerTouchStartY = useRef<number | null>(null);
  const drawerTouchStartScrollTop = useRef<number>(0);
  const drawerScrollRef = useRef<HTMLDivElement>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'CASH' | 'UPI'>('CASH');
  const [isSettlingBill, setIsSettlingBill] = useState<boolean>(false);
  const [isInitiatingSettlement, setIsInitiatingSettlement] = useState<boolean>(false);
  const [settlementError, setSettlementError] = useState<string | null>(null);

  // In-Flight Action Tracking
  const [updatingItemIds, setUpdatingItemIds] = useState<Set<string>>(new Set());
  const [updatingRequestIds, setUpdatingRequestIds] = useState<Set<string>>(new Set());

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
  const [showPaymentConfirmationAlert, setShowPaymentConfirmationAlert] = useState<boolean>(false);
  const [reopenConfirmTable, setReopenConfirmTable] = useState<any | null>(null);
  const [isReopeningOrdering, setIsReopeningOrdering] = useState<boolean>(false);
  const [isBillDrawerClosing, setIsBillDrawerClosing] = useState<boolean>(false);
  const [isBillDrawerDragging, setIsBillDrawerDragging] = useState<boolean>(false);
  const [billDrawerDragY, setBillDrawerDragY] = useState<number>(0);
  const billDrawerTouchStartY = useRef<number | null>(null);
  const billDrawerTouchStartScrollTop = useRef<number>(0);
  const billDrawerScrollRef = useRef<HTMLDivElement>(null);

  // Table-Wise Waiter Service & Ready State
  const [readyStationFilter, setReadyStationFilter] = useState<'ALL' | 'KITCHEN' | 'BAR'>('ALL');
  const [isServingBatch, setIsServingBatch] = useState<boolean>(false);
  const [selectedServiceTable, setSelectedServiceTable] = useState<any | null>(null);
  const [tableActiveOrders, setTableActiveOrders] = useState<any[]>([]);
  const [isTableOrdersLoading, setIsTableOrdersLoading] = useState<boolean>(false);
  const [isServiceDrawerClosing, setIsServiceDrawerClosing] = useState<boolean>(false);
  const [isServiceDrawerDragging, setIsServiceDrawerDragging] = useState<boolean>(false);
  const [serviceDrawerDragY, setServiceDrawerDragY] = useState<number>(0);
  const serviceDrawerTouchStartY = useRef<number | null>(null);
  const serviceDrawerTouchStartScrollTop = useRef<number>(0);
  const serviceDrawerScrollRef = useRef<HTMLDivElement>(null);

  // 5-Second Tab-Resilient Inline Undo Hook
  const {
    isPending: isServedUndoPending,
    getRemainingSeconds: getServedUndoSeconds,
    startUndo: startServedUndo,
    cancelUndo: cancelServedUndo,
  } = useServedUndo();

  // Active Live Ticker (15s update for elapsed time display without network fetches)
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
      }
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // In-Flight Request Deduplication Refs
  const isFetchingTablesRef = useRef<boolean>(false);
  const pendingFetchTablesRef = useRef<boolean>(false);

  const isFetchingReservationsRef = useRef<boolean>(false);
  const pendingFetchReservationsRef = useRef<boolean>(false);

  const isFetchingRequestsRef = useRef<boolean>(false);
  const pendingFetchRequestsRef = useRef<boolean>(false);

  const isFetchingReadyRef = useRef<boolean>(false);
  const pendingFetchReadyRef = useRef<boolean>(false);

  const isFetchingMenuRef = useRef<boolean>(false);
  const pendingFetchMenuRef = useRef<boolean>(false);

  const isFetchingActiveBillsRef = useRef<boolean>(false);
  const pendingFetchActiveBillsRef = useRef<boolean>(false);

  const isFetchingSettledBillsRef = useRef<boolean>(false);
  const pendingFetchSettledBillsRef = useRef<boolean>(false);

  const selectedServiceTableRef = useRef<any | null>(null);
  const tablesRef = useRef<any[]>([]);
  const billsSubTabRef = useRef<'active' | 'history'>('active');

  // Deduplicated Fetchers
  const fetchTables = useCallback(async (silent: boolean = false) => {
    if (isFetchingTablesRef.current) {
      pendingFetchTablesRef.current = true;
      return;
    }
    isFetchingTablesRef.current = true;
    try {
      const data: any = await api.getTables();
      const list = Array.isArray(data) ? data : data?.tables || [];
      tablesRef.current = list;
      setTables(list);
    } catch (err) {
      console.warn('Failed to load tables:', err);
    } finally {
      isFetchingTablesRef.current = false;
      if (pendingFetchTablesRef.current) {
        pendingFetchTablesRef.current = false;
        fetchTables(true);
      }
    }
  }, []);

  const fetchReservations = useCallback(async (silent: boolean = false) => {
    if (isFetchingReservationsRef.current) {
      pendingFetchReservationsRef.current = true;
      return;
    }
    isFetchingReservationsRef.current = true;
    try {
      const data: any = await api.getReservations();
      setReservations(Array.isArray(data) ? data : data?.reservations || []);
    } catch (err) {
      console.warn('Failed to load reservations:', err);
    } finally {
      isFetchingReservationsRef.current = false;
      if (pendingFetchReservationsRef.current) {
        pendingFetchReservationsRef.current = false;
        fetchReservations(true);
      }
    }
  }, []);

  const fetchRequests = useCallback(async (silent: boolean = false) => {
    if (isFetchingRequestsRef.current) {
      pendingFetchRequestsRef.current = true;
      return;
    }
    isFetchingRequestsRef.current = true;
    try {
      const data = await api.getActiveServiceRequests();
      setRequests(data);
    } catch (err) {
      console.warn('Failed to load service requests:', err);
    } finally {
      isFetchingRequestsRef.current = false;
      if (pendingFetchRequestsRef.current) {
        pendingFetchRequestsRef.current = false;
        fetchRequests(true);
      }
    }
  }, []);

  const fetchReadyItems = useCallback(async (silent: boolean = false) => {
    if (isFetchingReadyRef.current) {
      pendingFetchReadyRef.current = true;
      return;
    }
    isFetchingReadyRef.current = true;
    try {
      const data = await api.getReadyItems();
      setReadyItems(data);
    } catch (err) {
      console.warn('Failed to load ready items:', err);
    } finally {
      isFetchingReadyRef.current = false;
      if (pendingFetchReadyRef.current) {
        pendingFetchReadyRef.current = false;
        fetchReadyItems(true);
      }
    }
  }, []);

  const fetchMenu = useCallback(async (silent: boolean = false) => {
    if (isFetchingMenuRef.current) {
      pendingFetchMenuRef.current = true;
      return;
    }
    isFetchingMenuRef.current = true;
    try {
      const data = await api.getMenu(false);
      setMenu(data);
    } catch (err) {
      console.warn('Failed to load menu:', err);
    } finally {
      isFetchingMenuRef.current = false;
      if (pendingFetchMenuRef.current) {
        pendingFetchMenuRef.current = false;
        fetchMenu(true);
      }
    }
  }, []);

  const fetchActiveBills = useCallback(async (showLoading = true) => {
    if (isFetchingActiveBillsRef.current) {
      pendingFetchActiveBillsRef.current = true;
      return;
    }
    isFetchingActiveBillsRef.current = true;
    if (showLoading) setIsBillsLoading(true);
    try {
      const active = await api.getActiveBills().catch(() => []);
      setActiveBills(Array.isArray(active) ? active : []);
    } catch (err) {
      console.warn('Failed to load active bills:', err);
    } finally {
      if (showLoading) setIsBillsLoading(false);
      isFetchingActiveBillsRef.current = false;
      if (pendingFetchActiveBillsRef.current) {
        pendingFetchActiveBillsRef.current = false;
        fetchActiveBills(false);
      }
    }
  }, []);

  const fetchSettledBills = useCallback(async (showLoading = true) => {
    if (isFetchingSettledBillsRef.current) {
      pendingFetchSettledBillsRef.current = true;
      return;
    }
    isFetchingSettledBillsRef.current = true;
    if (showLoading) setIsBillsLoading(true);
    try {
      const settled: any = await api.getSettledBills(50).catch(() => ({ bills: [], summary: { completedTodayCount: 0, completedTodayRevenue: 0 } }));
      setSettledBills(Array.isArray(settled?.bills) ? settled.bills : []);
      if (settled?.summary) {
        setSettledSummary(settled.summary);
      }
    } catch (err) {
      console.warn('Failed to load settled bills:', err);
    } finally {
      if (showLoading) setIsBillsLoading(false);
      isFetchingSettledBillsRef.current = false;
      if (pendingFetchSettledBillsRef.current) {
        pendingFetchSettledBillsRef.current = false;
        fetchSettledBills(false);
      }
    }
  }, []);

  const fetchBillsData = useCallback(async (showLoading = true) => {
    await Promise.all([fetchActiveBills(showLoading), fetchSettledBills(showLoading)]);
  }, [fetchActiveBills, fetchSettledBills]);

  const fetchTableServiceOrders = useCallback(async (tableInfo?: any) => {
    const target = tableInfo || selectedServiceTableRef.current;
    if (!target) return;
    setIsTableOrdersLoading(true);
    try {
      const currentTables = tablesRef.current;
      const matchedTable = currentTables.find(
        (t: any) =>
          (target.tableId && t.id === target.tableId) ||
          (target.tableNumber && String(t.tableNumber).trim().toUpperCase() === String(target.tableNumber).trim().toUpperCase())
      );
      const tokenNumber =
        target.tokenNumber ||
        matchedTable?.tokenNumber ||
        matchedTable?.activeSession?.tokenNumber ||
        matchedTable?.currentTokenId;
      const tableId = target.tableId || matchedTable?.id;
      const tableNumber = target.tableNumber || matchedTable?.tableNumber;

      const orders = await api.getActiveOrders(tokenNumber, tableId, tableNumber);
      setTableActiveOrders(Array.isArray(orders) ? orders : []);
    } catch (err) {
      console.warn('Failed to load active orders for table service:', err);
    } finally {
      setIsTableOrdersLoading(false);
    }
  }, []);

  // Tab change handler with on-demand data fetching
  const setActiveTab = (tab: WaiterTab) => {
    setActiveTabState(tab);
    onTabChange?.(tab);

    if (tab === 'tables' && reservations.length === 0) {
      fetchReservations(true);
    } else if (tab === 'bills') {
      fetchActiveBills(true);
      if (billsSubTabRef.current === 'history' && settledBills.length === 0) {
        fetchSettledBills(true);
      }
    } else if (tab === 'requests') {
      fetchRequests(true);
    } else if (tab === 'ready') {
      fetchReadyItems(true);
    }
  };

  const handleSetBillsSubTab = (subTab: 'active' | 'history') => {
    setBillsSubTab(subTab);
    billsSubTabRef.current = subTab;
    if (subTab === 'history' && settledBills.length === 0) {
      fetchSettledBills(true);
    }
  };

  const handleOpenTableService = (tableGroup: any) => {
    setSelectedServiceTable(tableGroup);
    selectedServiceTableRef.current = tableGroup;
    setIsServiceDrawerClosing(false);
    setIsServiceDrawerDragging(false);
    setServiceDrawerDragY(0);
    fetchTableServiceOrders(tableGroup);
  };

  const handleServeFromOverview = (tableGroup: any) => {
    setActiveTab('ready');
    handleOpenTableService(tableGroup);
  };

  const handleCloseTableService = useCallback(() => {
    setIsServiceDrawerClosing(true);
    setTimeout(() => {
      setSelectedServiceTable(null);
      selectedServiceTableRef.current = null;
      setTableActiveOrders([]);
      setIsServiceDrawerClosing(false);
      setIsServiceDrawerDragging(false);
      setServiceDrawerDragY(0);
      serviceDrawerTouchStartY.current = null;
    }, 280);
  }, []);

  const handleServiceTouchStart = (e: React.TouchEvent) => {
    serviceDrawerTouchStartY.current = e.touches[0].clientY;
    serviceDrawerTouchStartScrollTop.current = serviceDrawerScrollRef.current ? serviceDrawerScrollRef.current.scrollTop : 0;
  };

  const handleServiceTouchMove = (e: React.TouchEvent) => {
    if (serviceDrawerTouchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - serviceDrawerTouchStartY.current;
    const currentScrollTop = serviceDrawerScrollRef.current ? serviceDrawerScrollRef.current.scrollTop : 0;

    // Only allow downward drag when scroll is at top
    if (deltaY > 0 && currentScrollTop <= 0 && serviceDrawerTouchStartScrollTop.current <= 0) {
      setServiceDrawerDragY(deltaY);
      setIsServiceDrawerDragging(true);
    } else if (isServiceDrawerDragging && deltaY <= 0) {
      setServiceDrawerDragY(0);
      setIsServiceDrawerDragging(false);
    }
  };

  const handleServiceTouchEnd = () => {
    if (serviceDrawerTouchStartY.current === null) return;
    if (serviceDrawerDragY > 70) {
      handleCloseTableService();
    } else {
      setServiceDrawerDragY(0);
      setIsServiceDrawerDragging(false);
    }
    serviceDrawerTouchStartY.current = null;
  };

  const handleServeItemFromModal = (orderItemId: string) => {
    startServedUndo(orderItemId, user?.id, async () => {
      setReadyItems((prev) => prev.filter((i: any) => i.id !== orderItemId));
      setTableActiveOrders((prev) =>
        prev.map((order) => ({
          ...order,
          items: (order.items || []).map((it: any) =>
            it.id === orderItemId ? { ...it, status: 'SERVED', servedAt: new Date().toISOString() } : it
          ),
        }))
      );
      await Promise.all([fetchReadyItems(true), fetchTables(true), fetchActiveBills(false)]);
      if (selectedServiceTableRef.current) {
        await fetchTableServiceOrders(selectedServiceTableRef.current);
      }
    });
  };

  const handleServeBatchItemsFromModal = (orderItemIds: string[]) => {
    if (!orderItemIds || orderItemIds.length === 0) return;
    orderItemIds.forEach((id) => {
      handleServeItemFromModal(id);
    });
  };

  useEffect(() => {
    setIsLoading(true);
    // Initial mount: load critical operational data
    Promise.all([
      fetchTables(true),
      fetchRequests(true),
      fetchReadyItems(true),
      fetchActiveBills(false),
      fetchReservations(true),
    ]).finally(() => {
      setIsLoading(false);
    });

    // Real-Time Room Subscriptions
    joinRoom('tables:all');
    joinRoom('staff:requests');
    joinRoom('staff:ready');
    joinRoom('staff:billing');
    joinRoom('staff:orders');
    joinRoom('staff:all');

    const unsubReqCreated = onSocketEvent('service_request.created', () => {
      fetchRequests(true);
    });
    const unsubReqUpdated = onSocketEvent('service_request.updated', () => {
      fetchRequests(true);
    });
    const unsubItemUpdated = onSocketEvent('order.item.updated', () => {
      fetchReadyItems(true);
      fetchTables(true);
      if (selectedServiceTableRef.current) {
        fetchTableServiceOrders(selectedServiceTableRef.current);
      }
    });
    const unsubOrderCreated = onSocketEvent('order.created', () => {
      fetchReadyItems(true);
      fetchTables(true);
      if (selectedServiceTableRef.current) {
        fetchTableServiceOrders(selectedServiceTableRef.current);
      }
    });
    const unsubBillSettled = onSocketEvent('bill.settled', () => {
      fetchActiveBills(false);
      fetchTables(true);
      if (billsSubTabRef.current === 'history') {
        fetchSettledBills(false);
      }
    });
    const unsubSessionClosed = onSocketEvent('table.session.closed', () => {
      fetchActiveBills(false);
      fetchTables(true);
    });
    const unsubTableEv = onSocketEvent('table.updated', () => {
      fetchTables(true);
    });

    const handleGlobalRefresh = () => {
      fetchTables(true);
      fetchRequests(true);
      fetchReadyItems(true);
      fetchReservations(true);
      fetchActiveBills(false);
      if (billsSubTabRef.current === 'history') {
        fetchSettledBills(false);
      }
      if (selectedServiceTableRef.current) {
        fetchTableServiceOrders(selectedServiceTableRef.current);
      }
    };
    window.addEventListener('app:global-refresh', handleGlobalRefresh);

    // Tab visibility listener: refresh active data when returning to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTables(true);
        fetchRequests(true);
        fetchReadyItems(true);
        fetchActiveBills(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Fallback polling (only runs when tab is visible)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchTables(true);
        fetchRequests(true);
        fetchReadyItems(true);
        fetchActiveBills(false);
      }
    }, 10000);

    return () => {
      leaveRoom('tables:all');
      leaveRoom('staff:requests');
      leaveRoom('staff:ready');
      leaveRoom('staff:billing');
      leaveRoom('staff:orders');
      leaveRoom('staff:all');
      unsubTableEv();
      unsubReqCreated();
      unsubReqUpdated();
      unsubItemUpdated();
      unsubOrderCreated();
      unsubBillSettled();
      unsubSessionClosed();
      window.removeEventListener('app:global-refresh', handleGlobalRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [fetchTables, fetchRequests, fetchReadyItems, fetchReservations, fetchActiveBills, fetchSettledBills, fetchTableServiceOrders]);

  const formatRequestType = (type?: string) => {
    if (!type) return 'Request';
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getWaitMinutes = (createdAt: string) => {
    return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000));
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

  // Helper to format staff identity name e.g. "Divyan (@divyan)" or "Divyan" or "@divyan"
  const getStaffDisplayName = (
    staff?: { fullName?: string | null; username?: string | null } | string | null,
    fallback = 'Staff'
  ) => {
    if (!staff) return fallback;
    if (typeof staff === 'string') {
      const trimmed = staff.trim();
      return trimmed || fallback;
    }
    const name = staff.fullName?.trim();
    const username = staff.username?.trim();
    if (name && username) return `${name} (@${username})`;
    if (name) return name;
    if (username) return `@${username}`;
    return fallback;
  };

  // Helper to determine if the staff assigned/responsible is the current authenticated user
  const isCurrentUserStaff = (
    staff?: { id?: string | null; username?: string | null; fullName?: string | null } | string | null
  ) => {
    if (!staff || !user) return false;
    if (typeof staff === 'string') {
      const normalized = staff.toLowerCase().trim();
      return (
        staff === user.id ||
        (user.username && normalized === user.username.toLowerCase().trim()) ||
        (user.fullName && normalized === user.fullName.toLowerCase().trim()) ||
        (user.username && normalized.includes(`@${user.username.toLowerCase().trim()}`))
      );
    }
    return (
      (staff.id && staff.id === user.id) ||
      (staff.username && user.username && staff.username.toLowerCase().trim() === user.username.toLowerCase().trim()) ||
      (staff.fullName && user.fullName && staff.fullName.toLowerCase().trim() === user.fullName.toLowerCase().trim())
    );
  };

  // 3-Second Undo for Service Request Completion (Mark Done)
  const [pendingReqUndoMap, setPendingReqUndoMap] = useState<Map<string, { expiresAt: number; timeoutId: any }>>(new Map());
  const [reqUndoTick, setReqUndoTick] = useState<number>(Date.now());

  useEffect(() => {
    if (pendingReqUndoMap.size === 0) return;
    const interval = setInterval(() => {
      setReqUndoTick(Date.now());
    }, 200);
    return () => clearInterval(interval);
  }, [pendingReqUndoMap.size]);

  const isReqUndoPending = useCallback((requestId: string): boolean => {
    const entry = pendingReqUndoMap.get(requestId);
    return !!entry && entry.expiresAt > Date.now();
  }, [pendingReqUndoMap, reqUndoTick]);

  const getReqUndoSeconds = useCallback((requestId: string): number => {
    const entry = pendingReqUndoMap.get(requestId);
    if (!entry) return 0;
    const remaining = entry.expiresAt - Date.now();
    return Math.max(1, Math.ceil(remaining / 1000));
  }, [pendingReqUndoMap, reqUndoTick]);

  const startReqUndo = useCallback((requestId: string) => {
    const existing = pendingReqUndoMap.get(requestId);
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }

    const expiresAt = Date.now() + 3000;
    const timeoutId = setTimeout(async () => {
      setPendingReqUndoMap((prev) => {
        const next = new Map(prev);
        next.delete(requestId);
        return next;
      });

      try {
        await api.updateServiceRequestStatus(requestId, 'COMPLETED', user?.id);
        await fetchRequests(true);
      } catch (err: any) {
        console.warn('Failed to complete service request on timeout:', err);
      }
    }, 3000);

    setPendingReqUndoMap((prev) => {
      const next = new Map(prev);
      next.set(requestId, { expiresAt, timeoutId });
      return next;
    });
  }, [user?.id, fetchRequests, pendingReqUndoMap]);

  const cancelReqUndo = useCallback((requestId: string) => {
    const existing = pendingReqUndoMap.get(requestId);
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }
    setPendingReqUndoMap((prev) => {
      const next = new Map(prev);
      next.delete(requestId);
      return next;
    });
  }, [pendingReqUndoMap]);

  // Actions: Service Request Lifecycle
  const handleUpdateReqStatus = async (requestId: string, status: 'ACKNOWLEDGED' | 'COMPLETED') => {
    if (status === 'COMPLETED') {
      startReqUndo(requestId);
      return;
    }
    if (updatingRequestIds.has(requestId)) return;
    setUpdatingRequestIds((prev) => new Set(prev).add(requestId));
    try {
      await api.updateServiceRequestStatus(requestId, status, user?.id);
      await fetchRequests(true);
    } catch (err: any) {
      alert(err.message || 'Failed to update request.');
    } finally {
      setUpdatingRequestIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  // Actions: Ready Item Lifecycle
  const handleMarkItemServed = (orderItemId: string) => {
    startServedUndo(orderItemId, user?.id, async () => {
      setReadyItems((prev) => prev.filter((i: any) => i.id !== orderItemId));
      await Promise.all([fetchReadyItems(true), fetchTables(true), fetchActiveBills(false)]);
    });
  };

  // Table Session Active Token & Remaining Time Resolution
  const getActiveTokenForTable = useCallback(
    (table: any): Token | null => {
      if (!table) return null;
      const targetId = table.id || table.tableId || table._id;
      const targetNum = (table.tableNumber || table.number || '').toString().trim().toUpperCase();
      const currentTokenId = table.currentTokenId || table.currentSessionId || table.activeSession?.tokenNumber;

      // 1. Direct match by token number
      if (currentTokenId) {
        const matched = (tokens || []).find((tk) => tk.tokenNumber === currentTokenId || tk.id === currentTokenId);
        if (matched) return matched;
      }

      // 2. Match by table ID
      if (targetId) {
        const matched = (tokens || []).find((tk) => tk.tableId === targetId || (tk.table && tk.table.id === targetId));
        if (matched) return matched;
      }

      // 3. Match by table number
      if (targetNum) {
        const matched = (tokens || []).find((tk) => {
          const tkNum = (tk.tableNumber || tk.table?.tableNumber || '').toString().trim().toUpperCase();
          return tkNum && tkNum === targetNum;
        });
        if (matched) return matched;
      }

      return null;
    },
    [tokens]
  );

  // Assisted Ordering Handlers (Lazy loads menu on first open & integrates ProductCustomizer)
  const handleOpenAssistedOrdering = (table: any) => {
    setSelectedTable(table);
    setIsAssistedOrderingOpen(true);
    setDrawerDragY(0);
    setIsDrawerDragging(false);
    setIsDrawerClosing(false);
    if (menu.length === 0) {
      fetchMenu(false);
    }
  };

  const handleCloseAssistedOrdering = useCallback(() => {
    setIsDrawerClosing(true);
    setTimeout(() => {
      setIsAssistedOrderingOpen(false);
      setAssistedCart([]);
      setSearchQuery('');
      setSelectedAssistedCategory('ALL');
      setDrawerDragY(0);
      setIsDrawerDragging(false);
      setIsDrawerClosing(false);
      drawerTouchStartY.current = null;
    }, 280);
  }, []);

  const handleDrawerTouchStart = (e: React.TouchEvent) => {
    if (isCustomizerOpen) return;
    drawerTouchStartY.current = e.touches[0].clientY;
    drawerTouchStartScrollTop.current = drawerScrollRef.current ? drawerScrollRef.current.scrollTop : 0;
  };

  const handleDrawerTouchMove = (e: React.TouchEvent) => {
    if (isCustomizerOpen || drawerTouchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - drawerTouchStartY.current;
    const currentScrollTop = drawerScrollRef.current ? drawerScrollRef.current.scrollTop : 0;

    // Only allow downward drag when scroll is at top
    if (deltaY > 0 && currentScrollTop <= 0 && drawerTouchStartScrollTop.current <= 0) {
      setDrawerDragY(deltaY);
      setIsDrawerDragging(true);
    } else if (isDrawerDragging && deltaY <= 0) {
      setDrawerDragY(0);
      setIsDrawerDragging(false);
    }
  };

  const handleDrawerTouchEnd = () => {
    if (isCustomizerOpen || drawerTouchStartY.current === null) return;
    
    if (drawerDragY > 70) {
      handleCloseAssistedOrdering();
    } else {
      setDrawerDragY(0);
      setIsDrawerDragging(false);
    }
    drawerTouchStartY.current = null;
  };

  const handleOpenCustomizerForItem = (menuItem: any) => {
    setCustomizerTargetItem(menuItem);
    setIsCustomizerOpen(true);
  };

  const handleAddToCartFromCustomizer = (configuredItem: {
    menuItemId: string;
    name: string;
    sectionSlug?: string;
    variantId?: string | null;
    variantName?: string | null;
    modifiers: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
      priceDelta: number;
    }>;
    specialInstructions?: string;
    quantity: number;
    unitPrice: number;
    station: string;
    foodType: string;
  }) => {
    const itemInMenu = allMenuItems.find((m) => m.id === configuredItem.menuItemId);
    const isManualAvailable = itemInMenu?.isAvailable !== false;
    const physicalStock = itemInMenu?.stockQuantity !== undefined ? Number(itemInMenu.stockQuantity) : 50;
    const rawAvailable = itemInMenu?.availableStock !== undefined ? Number(itemInMenu.availableStock) : physicalStock;
    const currentTotalInCart = assistedCart
      .filter((ci) => ci.menuItemId === configuredItem.menuItemId)
      .reduce((sum, ci) => sum + (Number(ci.quantity) || 1), 0);

    const maxAllowed = isManualAvailable ? Math.min(physicalStock, rawAvailable + currentTotalInCart) : 0;
    const qtyToAdd = Number(configuredItem.quantity) || 1;

    if (!isManualAvailable || physicalStock <= 0) {
      setFeedbackMsg(`${configuredItem.name || 'Item'} is currently out of stock.`);
      setTimeout(() => setFeedbackMsg(null), 3000);
      return;
    }

    if (currentTotalInCart + qtyToAdd > maxAllowed) {
      const allowedDelta = Math.max(0, maxAllowed - currentTotalInCart);
      setFeedbackMsg(
        allowedDelta > 0
          ? `Only ${allowedDelta} more available in stock.`
          : `Maximum stock (${maxAllowed}) already in your cart.`
      );
      setTimeout(() => setFeedbackMsg(null), 3000);
      if (allowedDelta <= 0) return;
      configuredItem = { ...configuredItem, quantity: allowedDelta };
    }

    setAssistedCart((prev) => {
      const existingIndex = prev.findIndex((i) => {
        if (i.menuItemId !== configuredItem.menuItemId) return false;
        if ((i.variantId || null) !== (configuredItem.variantId || null)) return false;
        if ((i.specialInstructions || '') !== (configuredItem.specialInstructions || '')) return false;
        const prevMods = (i.modifiers || []).map((m: any) => `${m.groupId}:${m.optionId}`).sort().join('|');
        const nextMods = (configuredItem.modifiers || []).map((m: any) => `${m.groupId}:${m.optionId}`).sort().join('|');
        return prevMods === nextMods;
      });

      if (existingIndex >= 0) {
        const copy = [...prev];
        copy[existingIndex] = {
          ...copy[existingIndex],
          quantity: copy[existingIndex].quantity + configuredItem.quantity,
        };
        return copy;
      }

      return [
        ...prev,
        {
          id: `${configuredItem.menuItemId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          ...configuredItem,
        },
      ];
    });

    setIsCustomizerOpen(false);
    setCustomizerTargetItem(null);
  };

  const handleUpdateAssistedQty = (cartIndex: number, delta: number) => {
    setAssistedCart((prev) => {
      const targetItem = prev[cartIndex];
      if (!targetItem) return prev;

      if (delta > 0) {
        const itemInMenu = allMenuItems.find((m) => m.id === targetItem.menuItemId);
        const isManualAvailable = itemInMenu?.isAvailable !== false;
        const physicalStock = itemInMenu?.stockQuantity !== undefined ? Number(itemInMenu.stockQuantity) : 50;
        const rawAvailable = itemInMenu?.availableStock !== undefined ? Number(itemInMenu.availableStock) : physicalStock;
        const totalCartQty = prev
          .filter((ci) => ci.menuItemId === targetItem.menuItemId)
          .reduce((sum, ci) => sum + (Number(ci.quantity) || 1), 0);
        const maxAllowed = isManualAvailable ? Math.min(physicalStock, rawAvailable + totalCartQty) : 0;

        if (totalCartQty + delta > maxAllowed) {
          setFeedbackMsg(`Cannot add more. Stock limit of ${maxAllowed} reached.`);
          setTimeout(() => setFeedbackMsg(null), 2500);
          return prev;
        }
      }

      return prev
        .map((item, idx) => (idx === cartIndex ? { ...item, quantity: item.quantity + delta } : item))
        .filter((item) => item.quantity > 0);
    });
  };

  const handleRemoveAssistedItem = (cartIndex: number) => {
    setAssistedCart((prev) => prev.filter((_, idx) => idx !== cartIndex));
  };

  const handleSubmitAssistedOrder = async () => {
    if (!selectedTable || assistedCart.length === 0 || isSubmittingOrder) return;
    setIsSubmittingOrder(true);
    setFeedbackMsg(null);
    try {
      // 1. Authoritative Token Resolution from active floor tokens
      const activeToken = getActiveTokenForTable(selectedTable);
      let resolvedTokenNumber: string | null = activeToken?.tokenNumber || null;

      // 2. Direct session property fallback
      if (!resolvedTokenNumber) {
        if (selectedTable.activeSession?.tokenNumber) {
          resolvedTokenNumber = selectedTable.activeSession.tokenNumber;
        } else if (typeof selectedTable.tokenNumber === 'string' && selectedTable.tokenNumber.trim().startsWith('TK-')) {
          resolvedTokenNumber = selectedTable.tokenNumber.trim();
        } else if (selectedTable.currentTokenId) {
          const matchedToken = (tokens || []).find(
            (t) => t.id === selectedTable.currentTokenId || t.tokenNumber === selectedTable.currentTokenId
          );
          if (matchedToken?.tokenNumber) {
            resolvedTokenNumber = matchedToken.tokenNumber;
          }
        }
      }

      // 3. Fallback: Query active session endpoint
      if (!resolvedTokenNumber) {
        try {
          const tblIdentifier = selectedTable.tableNumber || selectedTable.number || selectedTable.id;
          const sessionRes = await api.getTableActiveSession(tblIdentifier);
          if (sessionRes?.success && sessionRes.session?.tokenNumber) {
            resolvedTokenNumber = sessionRes.session.tokenNumber;
          }
        } catch (e) {
          console.warn('Failed to query table active session for assisted order:', e);
        }
      }

      // 4. Fallback: Query active tokens list
      if (!resolvedTokenNumber) {
        try {
          const activeTokens = await api.getActiveTokens();
          const targetId = selectedTable.id || selectedTable._id;
          const targetNum = (selectedTable.tableNumber || selectedTable.number || '').toString().trim().toUpperCase();
          const matched = activeTokens.find(
            (t) =>
              (targetId && (t.tableId === targetId || t.table?.id === targetId)) ||
              (targetNum && (t.tableNumber || t.table?.tableNumber || '').toString().trim().toUpperCase() === targetNum) ||
              (selectedTable.currentTokenId && (t.id === selectedTable.currentTokenId || t.tokenNumber === selectedTable.currentTokenId))
          );
          if (matched?.tokenNumber) {
            resolvedTokenNumber = matched.tokenNumber;
          }
        } catch (e) {
          console.warn('Failed to query active tokens list for assisted order:', e);
        }
      }

      if (!resolvedTokenNumber) {
        setFeedbackMsg(
          `Cannot place order: Table ${selectedTable.tableNumber || selectedTable.number} has no active dining session. Please check in guests at Reception first.`
        );
        setIsSubmittingOrder(false);
        return;
      }

      const payload = {
        tokenNumber: resolvedTokenNumber,
        tableId: selectedTable.id || activeToken?.tableId,
        orderSource: 'SERVER' as const,
        handlerId: user?.id,
        items: assistedCart.map((i) => ({
          menuItemId: i.menuItemId,
          variantName: i.variantName || undefined,
          selectedModifiers: (i.modifiers || []).map((m: any) => ({
            groupId: m.groupId,
            groupName: m.groupName,
            optionId: m.optionId,
            optionName: m.optionName,
            priceDelta: Number(m.priceDelta || 0),
          })),
          specialInstructions: i.specialInstructions || undefined,
          quantity: Number(i.quantity) || 1,
        })),
      };

      const placedOrder = await api.placeOrder(payload);
      if (!placedOrder) {
        throw new Error('Server returned empty response during order placement.');
      }

      const totalCount = assistedCart.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
      setFeedbackMsg(`Assisted order placed for Table ${selectedTable.tableNumber || selectedTable.number} (${totalCount} item${totalCount > 1 ? 's' : ''})!`);
      setAssistedCart([]);
      setIsAssistedOrderingOpen(false);
      setDrawerDragY(0);
      setTimeout(() => setFeedbackMsg(null), 4000);
      await Promise.all([fetchTables(true), fetchActiveBills(false), fetchReadyItems(true)]);
    } catch (err: any) {
      console.error('Assisted order placement failed:', err);
      setFeedbackMsg(`Order submission failed: ${err?.message || 'Please verify table session.'}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const getTableRemainingMinutes = useCallback(
    (table: any): number | null => {
      if (!table) return null;
      const token = getActiveTokenForTable(table);
      const endTimeStr = token?.endTime || table.activeSession?.endTime || table.endTime;
      if (!endTimeStr) return null;
      const endMs = new Date(endTimeStr).getTime();
      if (isNaN(endMs)) return null;
      const diffMs = endMs - now;
      return Math.max(0, Math.round(diffMs / 60000));
    },
    [getActiveTokenForTable, now]
  );

  const handleOpenExtendModal = useCallback(
    async (table: any, explicitToken?: Token | null) => {
      if (!table) return;
      const token = explicitToken || getActiveTokenForTable(table);
      if (token) {
        setExtendingToken(token);
        setExtendingTable(table);
        return;
      }

      // Fetch active session fallback
      try {
        const tblIdOrNum = table.tableNumber || table.number || table.id;
        const sessionRes: any = await api.getTableActiveSession(tblIdOrNum);
        if (sessionRes?.success && sessionRes?.session) {
          const s = sessionRes.session;
          const constructedToken: Token = {
            id: s.id || s._id || s.tokenNumber,
            tokenNumber: s.tokenNumber,
            tableId: table.id || s.tableId,
            tableNumber: table.tableNumber || table.number || s.tableNumber,
            placeTypeId: s.placeTypeId || table.placeTypeId,
            placeType: s.placeType || table.placeType,
            personsCount: s.personsCount || s.guestCount || table.capacity || 1,
            startTime: s.startTime,
            endTime: s.endTime,
            durationMinutes: s.durationMinutes,
            status: s.status || 'ACTIVE',
            customer: s.customer || { name: s.customerName, phone: s.customerPhone },
          } as any;
          setExtendingToken(constructedToken);
          setExtendingTable(table);
          return;
        }
      } catch (e) {
        console.warn('Failed to fetch table active session fallback:', e);
      }

      setExtendingToken({
        id: table.currentTokenId || table.id,
        tokenNumber: table.currentTokenId || table.activeSession?.tokenNumber || '',
        tableId: table.id,
        tableNumber: table.tableNumber || table.number,
        placeTypeId: table.placeTypeId,
        placeType: table.placeType?.name || table.placeType,
        personsCount: table.capacity || 1,
        endTime: table.activeSession?.endTime,
        status: 'ACTIVE',
      } as any);
      setExtendingTable(table);
    },
    [getActiveTokenForTable]
  );

  // Auto-inspect & navigate to table extension on urgent session alert click
  useEffect(() => {
    const handleAutoInspect = (e: Event) => {
      const customEvent = e as CustomEvent;
      const tableId = customEvent.detail?.tableId;
      const tableNum = customEvent.detail?.tableNumber;
      const tokenId = customEvent.detail?.tokenId;

      const targetTable = (tables || []).find(
        (t) =>
          (tableId && (t.id === tableId || t._id === tableId)) ||
          (tableNum && (t.tableNumber === tableNum || t.number === tableNum)) ||
          (tokenId && (t.currentTokenId === tokenId || t.activeSession?.tokenNumber === tokenId))
      );

      if (targetTable) {
        localStorage.removeItem('bar_auto_inspect_table_id');
        setActiveTabState('tables');
        handleOpenExtendModal(targetTable);
      }
    };

    const autoInspectId = localStorage.getItem('bar_auto_inspect_table_id');
    if (autoInspectId && (tables || []).length > 0) {
      const targetTable = (tables || []).find(
        (t) => t.id === autoInspectId || t._id === autoInspectId || t.tableNumber === autoInspectId
      );
      if (targetTable) {
        localStorage.removeItem('bar_auto_inspect_table_id');
        setActiveTabState('tables');
        handleOpenExtendModal(targetTable);
      }
    }

    window.addEventListener('bar_auto_inspect', handleAutoInspect);
    return () => {
      window.removeEventListener('bar_auto_inspect', handleAutoInspect);
    };
  }, [tables, tokens, handleOpenExtendModal]);

  const handleOpenBillModal = async (tableOrBill: any) => {
    setSelectedBillTable(tableOrBill);
    setIsBillDetailsOpen(true);
    setIsBillLoading(true);
    setBillFetchError(null);
    setActiveTableBill(null);
    setSelectedPaymentMethod('CASH');
    setSettlementError(null);
    setSettlementStep('review');
    setShowPaymentConfirmationAlert(false);
    setIsBillDrawerClosing(false);
    setIsBillDrawerDragging(false);
    setBillDrawerDragY(0);

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
    setShowPaymentConfirmationAlert(false);
  };

  const handleCloseBillModal = useCallback(async () => {
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
    setIsBillDrawerClosing(true);
    setTimeout(() => {
      setIsBillDetailsOpen(false);
      setSelectedBillTable(null);
      setSettlementError(null);
      setSettlementStep('review');
      setShowPaymentConfirmationAlert(false);
      setIsBillDrawerClosing(false);
      setIsBillDrawerDragging(false);
      setBillDrawerDragY(0);
      billDrawerTouchStartY.current = null;
    }, 280);
  }, [settlementStep, activeTableBill, selectedBillTable]);

  const handleBillTouchStart = (e: React.TouchEvent) => {
    billDrawerTouchStartY.current = e.touches[0].clientY;
    billDrawerTouchStartScrollTop.current = billDrawerScrollRef.current ? billDrawerScrollRef.current.scrollTop : 0;
  };

  const handleBillTouchMove = (e: React.TouchEvent) => {
    if (billDrawerTouchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - billDrawerTouchStartY.current;
    const currentScrollTop = billDrawerScrollRef.current ? billDrawerScrollRef.current.scrollTop : 0;

    // Only allow downward drag when scroll is at top
    if (deltaY > 0 && currentScrollTop <= 0 && billDrawerTouchStartScrollTop.current <= 0) {
      setBillDrawerDragY(deltaY);
      setIsBillDrawerDragging(true);
    } else if (isBillDrawerDragging && deltaY <= 0) {
      setBillDrawerDragY(0);
      setIsBillDrawerDragging(false);
    }
  };

  const handleBillTouchEnd = () => {
    if (billDrawerTouchStartY.current === null) return;
    if (billDrawerDragY > 70) {
      handleCloseBillModal();
    } else {
      setBillDrawerDragY(0);
      setIsBillDrawerDragging(false);
    }
    billDrawerTouchStartY.current = null;
  };

  const handleOpenReopenConfirm = (table: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReopenConfirmTable(table);
  };

  const handleConfirmReopenOrdering = async () => {
    if (!reopenConfirmTable || isReopeningOrdering) return;
    const targetTable = reopenConfirmTable;
    const lookup =
      targetTable.currentTokenId ||
      targetTable.id ||
      targetTable.tokenNumber ||
      targetTable.activeSession?.tokenNumber;

    if (!lookup) {
      alert('Unable to identify active session for this table.');
      return;
    }

    setIsReopeningOrdering(true);
    try {
      const res = await api.reopenOrdering(lookup);
      if (res && res.success) {
        setReopenConfirmTable(null);
        setIsBillDetailsOpen(false);
        setSelectedBillTable(null);
        await Promise.all([
          fetchTables(true),
          fetchActiveBills(false),
          fetchRequests(true),
        ]);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to reopen ordering for table.');
    } finally {
      setIsReopeningOrdering(false);
    }
  };

  const handleServeItemInline = async (orderItemId: string) => {
    if (updatingItemIds.has(orderItemId)) return;
    setUpdatingItemIds((prev) => new Set(prev).add(orderItemId));
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
      fetchReadyItems(true);
      fetchTables(true);
      fetchActiveBills(false);
    } catch (err: any) {
      alert(err.message || 'Failed to serve item.');
    } finally {
      setUpdatingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(orderItemId);
        return next;
      });
    }
  };

  const handleConfirmPayment = async () => {
    setShowPaymentConfirmationAlert(false);
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

      await Promise.all([fetchTables(true), fetchRequests(true), fetchActiveBills(true), fetchSettledBills(false)]);
      setTimeout(() => setFeedbackMsg(null), 5000);
    } catch (err: any) {
      console.error('Settlement error:', err);
      setSettlementError(err.message || 'Failed to settle bill and confirm payment.');
    } finally {
      setIsSettlingBill(false);
    }
  };

  const waiterPaymentMethods = ['CASH', 'UPI'] as const;
  const waiterPaymentRoving = useRovingSelection<'CASH' | 'UPI'>({
    items: [...waiterPaymentMethods],
    selectedIndex: waiterPaymentMethods.indexOf(selectedPaymentMethod),
    orientation: 'horizontal',
    enabled: isBillDetailsOpen && settlementStep === 'payment' && !showPaymentConfirmationAlert,
    onSelect: (pm) => setSelectedPaymentMethod(pm),
  });

  // Modal keyboard for payment confirmation alert
  useModalKeyboard({
    isOpen: showPaymentConfirmationAlert,
    onConfirm: handleConfirmPayment,
    onClose: () => setShowPaymentConfirmationAlert(false),
    isSubmitting: isSettlingBill,
  });

  // Modal keyboard for reopen ordering confirmation modal (Enter Concept)
  useModalKeyboard({
    isOpen: !!reopenConfirmTable,
    onConfirm: handleConfirmReopenOrdering,
    onClose: () => {
      if (!isReopeningOrdering) setReopenConfirmTable(null);
    },
    isSubmitting: isReopeningOrdering,
  });

  // Global escape handling for service and reservation modals
  useEffect(() => {
    const handleModalEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPaymentConfirmationAlert) return; // Handled by useModalKeyboard
        if (isBillDetailsOpen) {
          e.preventDefault();
          if (settlementStep === 'payment') {
            handleBackToReview();
          } else {
            handleCloseBillModal();
          }
        } else if (selectedServiceTable) {
          e.preventDefault();
          setSelectedServiceTable(null);
        } else if (isReservationModalOpen) {
          e.preventDefault();
          setIsReservationModalOpen(false);
          setSelectedReservationTable(null);
        } else if (isAssistedOrderingOpen && !isCustomizerOpen) {
          e.preventDefault();
          handleCloseAssistedOrdering();
        }
      }
    };
    window.addEventListener('keydown', handleModalEscape);
    return () => window.removeEventListener('keydown', handleModalEscape);
  }, [showPaymentConfirmationAlert, isBillDetailsOpen, settlementStep, selectedServiceTable, isReservationModalOpen, isAssistedOrderingOpen, isCustomizerOpen, handleCloseAssistedOrdering]);

  // Flattened Menu Items for Assisted Order Modal (Memoized)
  const allMenuItems = useMemo(() => {
    const list: any[] = [];
    menu.forEach((section: any) => {
      (section.categories || []).forEach((cat: any) => {
        (cat.items || []).forEach((item: any) => {
          list.push({ ...item, categoryName: cat.name });
        });
      });
    });
    return list;
  }, [menu]);

  const assistedCategories = useMemo(() => {
    const cats = new Set<string>();
    allMenuItems.forEach((i) => {
      if (i.categoryName) cats.add(i.categoryName);
    });
    return ['ALL', ...Array.from(cats)];
  }, [allMenuItems]);

  const filteredMenuItems = useMemo(() => {
    return allMenuItems.filter((i) => {
      const matchesCat = selectedAssistedCategory === 'ALL' || i.categoryName === selectedAssistedCategory;
      if (!matchesCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        i.name.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.categoryName || '').toLowerCase().includes(q)
      );
    });
  }, [allMenuItems, selectedAssistedCategory, searchQuery]);

  const assistedCartTotal = useMemo(() => {
    return assistedCart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  }, [assistedCart]);

  // Station Classification Helpers: KITCHEN + DESSERT -> Kitchen / Food, BAR -> Bar / Drinks
  const isBarStation = (station?: string) => (station || '').toUpperCase() === 'BAR';
  const isKitchenStation = (station?: string) => !isBarStation(station);

  // Helper to group ready items table-wise with station breakdowns
  const groupReadyItemsByTable = useCallback((items: any[]) => {
    const tableMap = new Map<string, {
      tableKey: string;
      tableId?: string;
      tableNumber: string;
      placeType?: string;
      tokenNumber?: string;
      readyCount: number;
      kitchenCount: number;
      barCount: number;
      readyItems: any[];
      earliestReadyAt?: string;
      stations: Set<string>;
    }>();

    items.forEach((item) => {
      const tableNumber = String(item.tableNumber || item.order?.table?.tableNumber || item.table?.tableNumber || 'Unknown');
      const tableId = item.tableId || item.order?.tableId || item.order?.table?.id || item.table?.id;
      const key = tableId || tableNumber;

      if (!tableMap.has(key)) {
        tableMap.set(key, {
          tableKey: key,
          tableId,
          tableNumber,
          placeType: item.placeType || item.order?.table?.placeType?.name || item.table?.placeType?.name,
          tokenNumber: item.tokenNumber || item.order?.token?.tokenNumber || item.order?.tokenNumber || item.token?.tokenNumber,
          readyCount: 0,
          kitchenCount: 0,
          barCount: 0,
          readyItems: [],
          earliestReadyAt: undefined,
          stations: new Set<string>(),
        });
      }

      const entry = tableMap.get(key)!;
      const qty = item.quantity || 1;
      entry.readyCount += qty;
      if (isBarStation(item.station)) {
        entry.barCount += qty;
      } else {
        entry.kitchenCount += qty;
      }
      entry.readyItems.push(item);
      if (item.station) {
        entry.stations.add(item.station);
      }
      const itemReadyTime = item.readyAt || item.createdAt;
      if (itemReadyTime) {
        if (!entry.earliestReadyAt || new Date(itemReadyTime) < new Date(entry.earliestReadyAt)) {
          entry.earliestReadyAt = itemReadyTime;
        }
      }
    });

    return Array.from(tableMap.values()).sort((a, b) => {
      if (a.earliestReadyAt && b.earliestReadyAt) {
        return new Date(a.earliestReadyAt).getTime() - new Date(b.earliestReadyAt).getTime();
      }
      return b.readyCount - a.readyCount;
    });
  }, []);

  // Station-specific ready items collections (Memoized)
  const kitchenReadyItems = useMemo(() => {
    return readyItems.filter((i) => isKitchenStation(i.station));
  }, [readyItems]);

  const barReadyItems = useMemo(() => {
    return readyItems.filter((i) => isBarStation(i.station));
  }, [readyItems]);

  // Derived ready queues (Memoized)
  const readyTables = useMemo(() => groupReadyItemsByTable(readyItems), [groupReadyItemsByTable, readyItems]);
  const kitchenReadyTables = useMemo(() => groupReadyItemsByTable(kitchenReadyItems), [groupReadyItemsByTable, kitchenReadyItems]);
  const barReadyTables = useMemo(() => groupReadyItemsByTable(barReadyItems), [groupReadyItemsByTable, barReadyItems]);

  const displayedReadyTables = useMemo(() => {
    if (readyStationFilter === 'KITCHEN') return kitchenReadyTables;
    if (readyStationFilter === 'BAR') return barReadyTables;
    return readyTables;
  }, [readyStationFilter, kitchenReadyTables, barReadyTables, readyTables]);

  // Statistics (Memoized)
  const openRequests = useMemo(() => {
    return requests.filter((r) => r.status !== 'COMPLETED');
  }, [requests]);

  const activeTables = useMemo(() => {
    return tables.filter((t) => {
      const s = (t.status || '').toUpperCase();
      return s === 'OCCUPIED' || s === 'IN_CHECKIN' || s === 'BILL_REQUESTED' || t.isBillRequested;
    });
  }, [tables]);

  const billRequestedTables = useMemo(() => {
    return tables.filter((t) => {
      const s = (t.status || '').toUpperCase();
      return s === 'BILL_REQUESTED' || t.isBillRequested;
    });
  }, [tables]);

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
  const getReservationForTable = useCallback((tableId: string) => {
    return reservations.find(
      (r) =>
        (r.tableId === tableId || r.table?.id === tableId) &&
        (r.status === 'PENDING' || r.status === 'CONFIRMED' || r.status === 'RESERVED')
    );
  }, [reservations]);

  const isTableReserved = useCallback((t: any) => {
    const s = (t.status || '').toUpperCase();
    if (s === 'RESERVED') return true;
    return reservations.some(
      (r) =>
        (r.tableId === t.id || r.table?.id === t.id) &&
        (r.status === 'PENDING' || r.status === 'CONFIRMED')
    );
  }, [reservations]);

  // 1. Reserved tables (Part 1 of /waiter/tables) (Memoized)
  const reservedTables = useMemo(() => {
    return tables.filter((t) => {
      const s = (t.status || '').toUpperCase();
      if (s === 'AVAILABLE' && !reservations.some((r) => (r.tableId === t.id || r.table?.id === t.id) && (r.status === 'PENDING' || r.status === 'CONFIRMED'))) {
        return false;
      }
      return isTableReserved(t);
    });
  }, [tables, reservations, isTableReserved]);

  // 2. Billing & active occupied tables (Part 2 of /waiter/tables - excluding available & reserved) (Memoized)
  const billingTables = useMemo(() => {
    return tables.filter((t) => {
      const s = (t.status || '').toUpperCase();
      if (s === 'AVAILABLE' || s === '') return false;
      if (isTableReserved(t)) return false;
      return true;
    });
  }, [tables, isTableReserved]);

  // Sort billing tables so BILL_REQUESTED tables appear first (Memoized)
  const sortedBillingTables = useMemo(() => {
    return [...billingTables].sort((a, b) => {
      const aBillReq = a.status === 'BILL_REQUESTED' || a.isBillRequested ? 1 : 0;
      const bBillReq = b.status === 'BILL_REQUESTED' || b.isBillRequested ? 1 : 0;
      return bBillReq - aBillReq;
    });
  }, [billingTables]);

  // Total non-available tables (reservations + bills) (Memoized)
  const nonAvailableTables = useMemo(() => {
    return [...reservedTables, ...sortedBillingTables];
  }, [reservedTables, sortedBillingTables]);

  return (
    <div className="flex flex-col min-h-full h-full overflow-y-auto md:overflow-hidden dark:bg-[#111114] bg-[#F5F3FA] p-3 sm:p-4 lg:p-6 space-y-3.5 sm:space-y-4">
      {/* Top Tab Navigation */}
      <div className="border-b border-zinc-200 dark:border-white/10 pb-3 sm:pb-3.5">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl dark:bg-[#18181A] bg-white border border-zinc-300 dark:border-white/10 shadow-xs self-stretch sm:self-start overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
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
            className={`flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap relative ${
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
            className={`flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap relative ${
              activeTab === 'ready'
                ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold shadow-xs'
                : 'text-zinc-600 dark:text-text-muted hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Ready ({readyTables.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tables')}
            className={`flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
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
            className={`flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
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
        <div className="flex-1 min-h-0 space-y-3.5 sm:space-y-5 animate-fade-in overflow-y-auto pr-0.5">
          {/* ================================================================= */}
          {/* SECTION 1: REQUESTS — FIRST PRIORITY                              */}
          {/* ================================================================= */}
          <section
            className={`rounded-2xl border p-3 sm:p-4 lg:p-5 transition-all shadow-xs ${
              openRequests.length > 0
                ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/10 ring-1 ring-amber-400/20'
                : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A]'
            }`}
          >
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 mb-2.5 sm:mb-3 border-b border-zinc-200/80 dark:border-white/10">
              <div
                onClick={() => setActiveTab('requests')}
                className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group select-none"
                role="button"
                tabIndex={0}
                title="View All Requests"
              >
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 ${
                    openRequests.length > 0
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-400/30'
                      : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <BellRing className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors flex items-center gap-1">
                    <span>Service Requests</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-zinc-400 dark:text-zinc-500" />
                  </h2>
                  <p className="hidden sm:block text-[11px] text-zinc-500 dark:text-text-muted">High-priority table calls requiring immediate waiter response</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('requests')}
                className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50 cursor-pointer transition-colors shrink-0"
              >
                {openRequests.length} {openRequests.length === 1 ? 'Request' : 'Requests'}
              </button>
            </div>

            {openRequests.length === 0 ? (
              <div className="py-5 sm:py-6 text-center border border-dashed border-zinc-200 dark:border-white/10 rounded-xl bg-zinc-50/50 dark:bg-[#141416]/40 flex flex-col items-center justify-center">
                <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 dark:text-emerald-400 mb-1" />
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No Active Requests</p>
                <p className="hidden sm:block text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">All tables are attended. Calls will alert here in real time.</p>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-2.5">
                {openRequests.map((req) => {
                  const reqTable =
                    (tables || []).find(
                      (t) =>
                        (req.tableId && (t.id === req.tableId || t._id === req.tableId)) ||
                        (req.tableNumber && (t.tableNumber === req.tableNumber || t.number === req.tableNumber)) ||
                        (req.tokenNumber && (t.currentTokenId === req.tokenNumber || t.activeSession?.tokenNumber === req.tokenNumber))
                    ) || req.table || (req.tableId ? { id: req.tableId, tableNumber: req.tableNumber, currentTokenId: req.tokenNumber, status: 'BILL_REQUESTED' } : null);

                  const isReqTableBillRequested =
                    reqTable?.status === 'BILL_REQUESTED' ||
                    reqTable?.isBillRequested ||
                    req.type === 'BILL_REQUEST' ||
                    (req.type === 'ORDER_ASSISTANCE' && (reqTable?.status === 'BILL_REQUESTED' || (req.note && req.note.toLowerCase().includes('reopen'))));

                  return (
                    <div
                      key={req.id}
                      className="p-2.5 sm:p-3 rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-white dark:bg-[#141416] flex items-center justify-between gap-2.5 sm:gap-3 shadow-xs hover:border-amber-400/80 transition-colors"
                    >
                      <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white">
                            Table {req.tableNumber || req.table?.tableNumber || '-'}
                          </span>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                            {formatRequestType(req.type)}
                          </span>
                        </div>
                        {req.note && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 italic truncate max-w-xs mt-0.5 sm:mt-0">
                            &quot;{req.note}&quot;
                          </p>
                        )}
                        
                        {/* Waiter Ownership / Responsibility Tag */}
                        {req.status === 'ACKNOWLEDGED' && (
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary dark:text-purple-300 mt-0.5 sm:mt-0">
                            <User className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {isCurrentUserStaff(req.assignedStaff || req.assignedStaffName)
                                ? `Assigned to You (${user?.fullName || user?.username})`
                                : `Handled by ${getStaffDisplayName(req.assignedStaff || req.assignedStaffName)}`}
                            </span>
                          </div>
                        )}

                        <div className="text-[10px] text-zinc-500 dark:text-text-muted flex items-center gap-1 font-medium sm:ml-auto mt-0.5 sm:mt-0">
                          <Clock className="w-3 h-3" />
                          <span>{getRelativeWaitTime(req.createdAt)}</span>
                          <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500 font-normal">
                            ({new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
                        {isReqTableBillRequested && (
                          <button
                            type="button"
                            aria-label="Reopen ordering for table"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (reqTable) handleOpenReopenConfirm(reqTable, e);
                            }}
                            className="h-8 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
                            title="Reopen Ordering for Table"
                          >
                            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden sm:inline">Reopen</span>
                          </button>
                        )}
                        {req.status === 'NEW' ? (
                          <button
                            type="button"
                            disabled={updatingRequestIds.has(req.id)}
                            aria-label="Acknowledge request"
                            onClick={() => handleUpdateReqStatus(req.id, 'ACKNOWLEDGED')}
                            className="h-8 px-3 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 dark:text-amber-300 font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 border border-amber-300 dark:border-amber-800/60 shrink-0"
                          >
                            {updatingRequestIds.has(req.id) ? (
                              <Loader2 size={13} className="animate-spin shrink-0" />
                            ) : (
                              <BellRing size={13} className="shrink-0" />
                            )}
                            <span>{updatingRequestIds.has(req.id) ? 'Updating...' : 'Acknowledge'}</span>
                          </button>
                        ) : isReqUndoPending(req.id) ? (
                          <button
                            type="button"
                            aria-label="Undo request completion"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelReqUndo(req.id);
                            }}
                            className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 animate-pulse"
                            title="Undo completion (3s)"
                          >
                            <RotateCcw size={13} className="shrink-0" />
                            <span>Undo {getReqUndoSeconds(req.id)}s</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={updatingRequestIds.has(req.id)}
                            aria-label="Mark request as done"
                            onClick={() => handleUpdateReqStatus(req.id, 'COMPLETED')}
                            className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                          >
                            {updatingRequestIds.has(req.id) ? (
                              <Loader2 size={13} className="animate-spin shrink-0" />
                            ) : (
                              <CheckCircle2 size={13} className="shrink-0" />
                            )}
                            <span>{updatingRequestIds.has(req.id) ? 'Updating...' : 'Mark Done'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ================================================================= */}
          {/* SECTION 2: READY TO SERVE + ACTIVE TABLES (Secondary Ops Row)     */}
          {/* ================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5">
            {/* Panel 2A: Ready to Serve (Kitchen Food & Bar Drinks) */}
            <section className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-3 sm:p-4 lg:p-5 shadow-xs flex flex-col min-h-[220px] sm:min-h-[300px]">
              <div className="flex items-center justify-between pb-2.5 sm:pb-3 mb-2.5 sm:mb-3 border-b border-zinc-200/80 dark:border-white/10 gap-2">
                <div
                  onClick={() => setActiveTab('ready')}
                  className="flex items-center gap-2 cursor-pointer group select-none"
                  role="button"
                  tabIndex={0}
                  title="Go to Ready Tab"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary dark:bg-[#D4AF37]/15 dark:border-[#D4AF37]/20 dark:text-[#D4AF37] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                    <ChefHat className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors flex items-center gap-1">
                      <span>Ready to Serve</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-zinc-400 dark:text-zinc-500" />
                    </h2>
                    <p className="hidden sm:block text-[11px] text-zinc-500 dark:text-text-muted">Prepared dishes &amp; drinks ready for pickup</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ready')}
                    className="text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50 flex items-center gap-1 cursor-pointer transition-colors"
                    title="View Kitchen Food in Ready Tab"
                  >
                    <Utensils className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>{kitchenReadyItems.length} Food</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ready')}
                    className="text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 flex items-center gap-1 cursor-pointer transition-colors"
                    title="View Bar Drinks in Ready Tab"
                  >
                    <Wine className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>{barReadyItems.length} Drinks</span>
                  </button>
                </div>
              </div>

              {readyTables.length === 0 ? (
                <div className="flex-1 py-6 sm:py-8 border border-dashed border-zinc-200 dark:border-white/10 rounded-xl bg-zinc-50/50 dark:bg-[#141416]/40 flex flex-col items-center justify-center text-center">
                  <ChefHat className="w-6 h-6 sm:w-7 sm:h-7 text-zinc-400 dark:text-zinc-500 mb-1" />
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Ready Queue is Empty</p>
                  <p className="hidden sm:block text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">Plated food at Kitchen Pass and poured drinks at Bar Counter will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-2.5 max-h-72 sm:max-h-80 md:max-h-96 overflow-y-auto pr-1">
                  {readyTables.map((tbl) => (
                    <div
                      key={tbl.tableKey}
                      onClick={() => handleServeFromOverview(tbl)}
                      className="p-2.5 sm:p-3 rounded-xl border border-emerald-500/30 dark:border-emerald-500/30 dark:bg-[#141416] bg-emerald-50/30 flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xs hover:border-emerald-500 cursor-pointer transition-all"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white">
                            Table {tbl.tableNumber}
                          </span>
                          {tbl.kitchenCount > 0 && (
                            <span className="text-[9px] font-black uppercase px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50 flex items-center gap-1">
                              <Utensils className="w-2.5 h-2.5" />
                              <span>Pass: {tbl.kitchenCount}</span>
                            </span>
                          )}
                          {tbl.barCount > 0 && (
                            <span className="text-[9px] font-black uppercase px-1.5 sm:px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-800/50 flex items-center gap-1">
                              <Wine className="w-2.5 h-2.5" />
                              <span>Bar: {tbl.barCount}</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 sm:mt-1 truncate">
                          {tbl.readyItems.map((i: any) => `${i.quantity}× ${i.itemName || i.name}`).join(', ')}
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label="Serve items to table"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleServeFromOverview(tbl);
                        }}
                        className="min-h-[36px] min-w-[36px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      >
                        <ChefHat className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">Serve</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Panel 2B: Active Tables */}
            <section className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-3 sm:p-4 lg:p-5 shadow-xs flex flex-col min-h-[220px] sm:min-h-[300px]">
              <div className="flex items-center justify-between pb-2.5 sm:pb-3 mb-2.5 sm:mb-3 border-b border-zinc-200/80 dark:border-white/10">
                <div
                  onClick={() => setActiveTab('tables')}
                  className="flex items-center gap-2 cursor-pointer group select-none"
                  role="button"
                  tabIndex={0}
                  title="Go to Tables Tab"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors flex items-center gap-1">
                      <span>Active Tables</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-zinc-400 dark:text-zinc-500" />
                    </h2>
                    <p className="hidden sm:block text-[11px] text-zinc-500 dark:text-text-muted">Current seated guests and open dining sessions</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('tables')}
                  className="text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 cursor-pointer transition-colors"
                >
                  {activeTables.length} Active
                </button>
              </div>

              {activeTables.length === 0 ? (
                <div className="flex-1 py-6 sm:py-8 border border-dashed border-zinc-200 dark:border-white/10 rounded-xl bg-zinc-50/50 dark:bg-[#141416]/40 flex flex-col items-center justify-center text-center">
                  <Users className="w-6 h-6 sm:w-7 sm:h-7 text-zinc-400 dark:text-zinc-500 mb-1" />
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No Active Tables</p>
                  <p className="hidden sm:block text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">Floor tables will populate here as guests are seated.</p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-2.5 max-h-72 sm:max-h-80 md:max-h-96 overflow-y-auto pr-1">
                  {activeTables.map((table) => {
                    const isBillReq = table.status === 'BILL_REQUESTED' || table.isBillRequested;
                    const placeTypeName = table.placeType?.name || (typeof table.placeType === 'string' ? table.placeType : table.categoryName);
                    const remainingMins = getTableRemainingMinutes(table);
                    const isUrgent = remainingMins !== null && remainingMins <= 15;

                    return (
                      <div
                        key={table.id}
                        onClick={() => setSelectedTable(table)}
                        className={`p-2.5 sm:p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 transition-colors cursor-pointer shadow-2xs ${
                          isBillReq
                            ? 'border-amber-400 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20 hover:border-amber-500'
                            : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#141416] hover:border-primary/40 dark:hover:border-[#D4AF37]/40'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white">
                              Table {table.tableNumber || table.number || '-'}
                            </span>
                            <span
                              className={`text-[9px] font-extrabold uppercase px-1.5 sm:px-2 py-0.5 rounded-full ${
                                isBillReq
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/50'
                                  : 'bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] border border-primary/20 dark:border-[#D4AF37]/30'
                              }`}
                            >
                              {table.status || 'OCCUPIED'}
                            </span>
                            {remainingMins !== null && (
                              <span
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black ${
                                  isUrgent
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse'
                                    : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                                }`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                {remainingMins}m left
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 dark:text-text-muted mt-0.5 font-medium truncate">
                            {table.capacity ? `Cap: ${table.capacity}` : ''} {placeTypeName ? `· ${placeTypeName}` : ''}
                          </div>
                        </div>

                        {/* Standard 4-Action Row: Compact icon buttons with tooltips */}
                        <div className="flex items-center gap-1.5 shrink-0 justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-white/5">
                          {/* 1. REOPEN BUTTON */}
                          <button
                            type="button"
                            disabled={!isBillReq}
                            aria-label="Reopen ordering for table"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isBillReq) {
                                handleOpenReopenConfirm(table, e);
                              }
                            }}
                            className={`w-9 h-9 min-h-[36px] min-w-[36px] rounded-xl font-extrabold text-xs flex items-center justify-center shadow-xs active:scale-95 transition-all border shrink-0 ${
                              isBillReq
                                ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 border-amber-400 cursor-pointer'
                                : 'bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-zinc-600 border-zinc-200/60 dark:border-white/5 cursor-not-allowed opacity-50'
                            }`}
                            title={isBillReq ? 'Reopen Ordering for Table' : 'Ordering is already open'}
                          >
                            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                          </button>

                          {/* 2. ADD CARD (WAITER-ASSISTED ORDER) BUTTON */}
                          <button
                            type="button"
                            aria-label="Add Card / Take Table Order"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAssistedOrdering(table);
                            }}
                            className="w-9 h-9 min-h-[36px] min-w-[36px] rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] text-white dark:text-black font-extrabold text-xs flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-all shrink-0"
                            title="Take Table Order"
                          >
                            <Plus className="w-4 h-4 shrink-0" />
                          </button>

                          {/* 3. EXTEND SESSION BUTTON */}
                          <button
                            type="button"
                            aria-label="Extend session time"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenExtendModal(table);
                            }}
                            className="w-9 h-9 min-h-[36px] min-w-[36px] rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-zinc-200 text-xs font-bold flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-all border border-zinc-200 dark:border-white/10 shrink-0"
                            title="Extend Session Time"
                          >
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                          </button>

                          {/* 4. VIEW BILL BUTTON */}
                          <button
                            type="button"
                            aria-label="View bill details"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenBillModal(table);
                            }}
                            className="w-9 h-9 min-h-[36px] min-w-[36px] rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-zinc-200 text-xs font-bold flex items-center justify-center cursor-pointer shadow-xs active:scale-95 transition-all border border-zinc-200 dark:border-white/10 shrink-0"
                            title="View Bill Details"
                          >
                            <Receipt className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        </div>
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
          <section className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-3 sm:p-4 lg:p-5 shadow-xs">
            <div className="flex items-center justify-between pb-2.5 sm:pb-3 mb-2.5 sm:mb-3 border-b border-zinc-200/80 dark:border-white/10">
              <div
                onClick={() => setActiveTab('bills')}
                className="flex items-center gap-2 cursor-pointer group select-none"
                role="button"
                tabIndex={0}
                title="Go to Bills Tab"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/50 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white group-hover:text-primary dark:group-hover:text-primary transition-colors flex items-center gap-1">
                    <span>Bill &amp; Payment Requests</span>
                    <ChevronRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-zinc-400 dark:text-zinc-500" />
                  </h2>
                  <p className="hidden sm:block text-[11px] text-zinc-500 dark:text-text-muted">Settlement calls from dining guests requesting their check</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('bills')}
                className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 cursor-pointer transition-colors"
              >
                {billRequestedTables.length} Bills
              </button>
            </div>

            {billRequestedTables.length === 0 ? (
              <div className="py-5 sm:py-6 border border-dashed border-zinc-200 dark:border-white/10 rounded-xl bg-zinc-50/50 dark:bg-[#141416]/40 flex flex-col items-center justify-center text-center">
                <Receipt className="w-6 h-6 sm:w-7 sm:h-7 text-zinc-400 dark:text-zinc-500 mb-1" />
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No Pending Bill Requests</p>
                <p className="hidden sm:block text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">Tables requesting payment settlement will display here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                {billRequestedTables.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 sm:p-4 rounded-xl border border-indigo-500/30 dark:bg-[#141416] bg-indigo-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shadow-2xs"
                  >
                    <div>
                      <div className="font-black text-sm text-zinc-900 dark:text-white">
                        Table {t.tableNumber || t.number || '-'}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-text-muted mt-0.5 font-medium" title={t.currentTokenId || t.activeSession?.tokenNumber || ''}>
                        Pass: {formatPassNumber(t.currentTokenId || t.activeSession?.tokenNumber) || '—'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 justify-end w-full sm:w-auto pt-1.5 sm:pt-0 border-t sm:border-t-0 border-indigo-100 dark:border-white/5">
                      <button
                        type="button"
                        aria-label="Reopen ordering for table"
                        onClick={(e) => handleOpenReopenConfirm(t, e)}
                        className="min-h-[36px] min-w-[36px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-1 cursor-pointer shadow-xs active:scale-95 transition-all shrink-0"
                        title="Reopen Ordering for Table"
                      >
                        <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">Reopen</span>
                      </button>
                      <button
                        type="button"
                        aria-label="View bill details"
                        onClick={() => handleOpenBillModal(t)}
                        className="min-h-[36px] min-w-[36px] px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-extrabold text-xs shadow-xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
                      >
                        <Receipt className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">View Bill</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}


      {/* ==================================================================== */}
      {/* 2. FLOOR TABLES TAB — ACTIVE DINING TABLES & BILLS                    */}
      {/* ==================================================================== */}
      {activeTab === 'tables' && (
        <div className="flex-1 min-h-0 overflow-y-auto animate-fade-in pr-0.5 space-y-4">
          {isLoading ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-white/10">
                <div className="h-6 w-32 bg-zinc-200 dark:bg-white/10 rounded-md animate-pulse" />
                <div className="h-5 w-12 bg-zinc-200 dark:bg-white/10 rounded-full animate-pulse" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
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
          ) : (
            <section className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] p-3.5 sm:p-4 lg:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-base font-black text-zinc-900 dark:text-white tracking-tight">
                        Active Tables &amp; Bills
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
                      Active dining sessions, table occupancy and bill settlement status
                    </p>
                  </div>
                </div>
              </div>

              {sortedBillingTables.length === 0 ? (
                <div className="py-12 px-4 text-center border border-dashed border-zinc-300 dark:border-white/15 rounded-xl bg-zinc-50/70 dark:bg-[#141416]/50">
                  <Receipt className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
                  <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">No Active Tables</h4>
                  <p className="text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">
                    There are currently no active dining sessions or bill requests on the floor.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
                    {sortedBillingTables.map((table) => {
                      const isBillReq = table.status === 'BILL_REQUESTED' || table.isBillRequested;
                      const statusStyles = getTableStatusClasses(table.status);
                      const displayStatus = formatTableStatus(table.status);
                      const remainingMins = getTableRemainingMinutes(table);
                      const isUrgent = remainingMins !== null && remainingMins <= 15;

                      return (
                        <div
                          key={table.id}
                          onClick={() => handleOpenBillModal(table)}
                          className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[140px] shadow-xs ${
                            isBillReq
                              ? 'border-amber-400/60 dark:border-amber-500/40 bg-amber-50/25 dark:bg-amber-950/15 hover:border-amber-500'
                              : 'border-zinc-200 dark:border-white/10 bg-zinc-50/40 dark:bg-[#141416] hover:border-primary/50 dark:hover:border-[#D4AF37]/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <span className="font-black text-lg text-zinc-900 dark:text-white truncate block">
                                Table {table.tableNumber || table.number || '-'}
                              </span>
                              <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium truncate flex items-center gap-1.5 flex-wrap">
                                <span title={table.currentTokenId || undefined}>
                                  {table.currentTokenId ? `Pass: ${formatPassNumber(table.currentTokenId)}` : (table.capacity ? `Cap: ${table.capacity} guests` : '')}
                                </span>
                                {remainingMins !== null && (
                                  <span
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black ${
                                      isUrgent
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse'
                                        : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                                    }`}
                                  >
                                    <Clock className="w-2.5 h-2.5" />
                                    {remainingMins}m left
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full shrink-0 ${statusStyles.badge}`}
                            >
                              {displayStatus}
                            </span>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between text-[11px] gap-1.5">
                            <span className="text-zinc-500 dark:text-zinc-400 truncate font-medium max-w-[90px]">
                              {table.placeType?.name || (typeof table.placeType === 'string' ? table.placeType : table.section || '')}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0 justify-end">
                              {/* 1. REOPEN BUTTON */}
                              <button
                                type="button"
                                disabled={!isBillReq}
                                aria-label="Reopen ordering for table"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isBillReq) {
                                    handleOpenReopenConfirm(table, e);
                                  }
                                }}
                                className={`w-8.5 h-8.5 min-h-[34px] min-w-[34px] rounded-xl font-extrabold text-[11px] shadow-xs active:scale-95 transition-all shrink-0 flex items-center justify-center border ${
                                  isBillReq
                                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 dark:text-amber-300 border-amber-300 dark:border-amber-800/60 cursor-pointer'
                                    : 'bg-zinc-100 dark:bg-white/5 text-zinc-400 dark:text-zinc-600 border-zinc-200/60 dark:border-white/5 cursor-not-allowed opacity-50'
                                }`}
                                title={isBillReq ? 'Reopen Ordering for Table' : 'Ordering is already open'}
                              >
                                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                              </button>

                              {/* 2. ADD CARD (ASSISTED ORDER) BUTTON */}
                              <button
                                type="button"
                                aria-label="Add Card / Take Table Order"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAssistedOrdering(table);
                                }}
                                className="w-8.5 h-8.5 min-h-[34px] min-w-[34px] rounded-xl font-extrabold text-[11px] shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black flex items-center justify-center"
                                title="Take Table Order"
                              >
                                <Plus className="w-3.5 h-3.5 shrink-0" />
                              </button>

                              {/* 3. EXTEND SESSION BUTTON */}
                              <button
                                type="button"
                                aria-label="Extend session time"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenExtendModal(table);
                                }}
                                className="w-8.5 h-8.5 min-h-[34px] min-w-[34px] rounded-xl font-extrabold text-[11px] shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-zinc-200 flex items-center justify-center border border-zinc-200 dark:border-white/10"
                                title="Extend Session Time"
                              >
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                              </button>

                              {/* 4. VIEW BILL BUTTON */}
                              <button
                                type="button"
                                aria-label="View bill details"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenBillModal(table);
                                }}
                                className={`w-8.5 h-8.5 min-h-[34px] min-w-[34px] rounded-xl font-extrabold text-[11px] shadow-xs active:scale-95 transition-all shrink-0 cursor-pointer flex items-center justify-center ${
                                  isBillReq
                                    ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950'
                                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-zinc-200 border border-zinc-200 dark:border-white/10'
                                }`}
                                title="View Bill Details"
                              >
                                <Receipt className="w-3.5 h-3.5 shrink-0" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. REQUESTS TAB — High-Density Mobile/Tablet Operational Interface    */}
      {/* ==================================================================== */}
      {activeTab === 'requests' && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 sm:space-y-4 animate-fade-in pr-0.5">
          {isLoading ? (
            <div className="space-y-2 sm:space-y-2.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="p-3 sm:p-3.5 rounded-xl border border-zinc-200 dark:border-white/10 dark:bg-[#18181A] bg-white animate-pulse flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 flex-1">
                    <div className="h-5 w-20 bg-zinc-200 dark:bg-white/10 rounded-md" />
                    <div className="h-4 w-16 bg-zinc-200 dark:bg-white/10 rounded-full" />
                    <div className="h-3 w-28 bg-zinc-100 dark:bg-white/5 rounded-md hidden sm:block" />
                  </div>
                  <div className="h-8 w-24 bg-zinc-200 dark:bg-white/10 rounded-lg shrink-0" />
                </div>
              ))}
            </div>
          ) : openRequests.length === 0 ? (
            <div className="py-10 px-4 sm:py-16 text-center border border-dashed border-zinc-300 dark:border-white/15 rounded-2xl bg-zinc-50/70 dark:bg-[#141416]/50">
              <BellRing className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-zinc-400 dark:text-zinc-500 mb-2.5" />
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">No Pending Service Requests</h3>
              <p className="text-xs text-zinc-500 dark:text-text-muted mt-1 max-w-sm mx-auto">Guest calls for water, cutlery, assistance, and cleanup will appear here in real time.</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-2.5">
              {openRequests.map((req) => {
                const reqTable =
                  (tables || []).find(
                    (t) =>
                      (req.tableId && (t.id === req.tableId || t._id === req.tableId)) ||
                      (req.tableNumber && (t.tableNumber === req.tableNumber || t.number === req.tableNumber)) ||
                      (req.tokenNumber && (t.currentTokenId === req.tokenNumber || t.activeSession?.tokenNumber === req.tokenNumber))
                  ) || req.table || (req.tableId ? { id: req.tableId, tableNumber: req.tableNumber, currentTokenId: req.tokenNumber, status: 'BILL_REQUESTED' } : null);

                const isReqTableBillRequested =
                  reqTable?.status === 'BILL_REQUESTED' ||
                  reqTable?.isBillRequested ||
                  req.type === 'BILL_REQUEST' ||
                  (req.type === 'ORDER_ASSISTANCE' && (reqTable?.status === 'BILL_REQUESTED' || (req.note && req.note.toLowerCase().includes('reopen'))));

                return (
                  <div
                    key={req.id}
                    className="p-2.5 sm:p-3 rounded-xl border border-amber-300/60 dark:border-amber-500/30 bg-white dark:bg-[#141416] flex items-center justify-between gap-2.5 sm:gap-3 shadow-xs hover:border-amber-400/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white">
                          Table {req.tableNumber || req.table?.tableNumber || '-'}
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                          {formatRequestType(req.type)}
                        </span>
                      </div>
                      {req.note && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 italic truncate max-w-xs mt-0.5 sm:mt-0">
                          &quot;{req.note}&quot;
                        </p>
                      )}
                      
                      {/* Waiter Ownership / Responsibility Tag */}
                      {req.status === 'ACKNOWLEDGED' && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary dark:text-purple-300 mt-0.5 sm:mt-0">
                          <User className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {isCurrentUserStaff(req.assignedStaff || req.assignedStaffName)
                              ? `Assigned to You (${user?.fullName || user?.username})`
                              : `Handled by ${getStaffDisplayName(req.assignedStaff || req.assignedStaffName)}`}
                          </span>
                        </div>
                      )}

                      <div className="text-[10px] text-zinc-500 dark:text-text-muted flex items-center gap-1 font-medium sm:ml-auto mt-0.5 sm:mt-0">
                        <Clock className="w-3 h-3" />
                        <span>{getRelativeWaitTime(req.createdAt)}</span>
                        <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500 font-normal">
                          ({new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
                      {isReqTableBillRequested && (
                        <button
                          type="button"
                          aria-label="Reopen ordering for table"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (reqTable) handleOpenReopenConfirm(reqTable, e);
                          }}
                          className="h-8 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0"
                          title="Reopen Ordering for Table"
                        >
                          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                          <span className="hidden sm:inline">Reopen</span>
                        </button>
                      )}
                      {req.status === 'NEW' ? (
                        <button
                          type="button"
                          disabled={updatingRequestIds.has(req.id)}
                          aria-label="Acknowledge request"
                          onClick={() => handleUpdateReqStatus(req.id, 'ACKNOWLEDGED')}
                          className="h-8 px-3 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/60 dark:hover:bg-amber-900/80 dark:text-amber-300 font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 border border-amber-300 dark:border-amber-800/60 shrink-0"
                        >
                          {updatingRequestIds.has(req.id) ? (
                            <Loader2 size={13} className="animate-spin shrink-0" />
                          ) : (
                            <BellRing size={13} className="shrink-0" />
                          )}
                          <span>{updatingRequestIds.has(req.id) ? 'Updating...' : 'Acknowledge'}</span>
                        </button>
                      ) : isReqUndoPending(req.id) ? (
                        <button
                          type="button"
                          aria-label="Undo request completion"
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelReqUndo(req.id);
                          }}
                          className="h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 animate-pulse"
                          title="Undo completion (3s)"
                        >
                          <RotateCcw size={13} className="shrink-0" />
                          <span>Undo {getReqUndoSeconds(req.id)}s</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={updatingRequestIds.has(req.id)}
                          aria-label="Mark request as done"
                          onClick={() => handleUpdateReqStatus(req.id, 'COMPLETED')}
                          className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                        >
                          {updatingRequestIds.has(req.id) ? (
                            <Loader2 size={13} className="animate-spin shrink-0" />
                          ) : (
                            <CheckCircle2 size={13} className="shrink-0" />
                          )}
                          <span>{updatingRequestIds.has(req.id) ? 'Updating...' : 'Mark Done'}</span>
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
      {/* 4. READY QUEUE TAB (TABLE-WISE ARCHITECTURE - KITCHEN & BAR CHANNELS) */}
      {/* ==================================================================== */}
      {activeTab === 'ready' && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 sm:space-y-4 animate-fade-in pr-0.5">
          {/* Station Filter Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-[#18181A] border border-zinc-200/90 dark:border-white/10 shadow-2xs">
            <div className="flex items-center gap-2 px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Filter Station:
              </span>
            </div>

            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200/80 dark:border-white/10 overflow-x-auto max-w-full no-scrollbar">
              <button
                type="button"
                onClick={() => setReadyStationFilter('ALL')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  readyStationFilter === 'ALL'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <span>All Ready</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-black/15 dark:bg-white/20">
                  {readyItems.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReadyStationFilter('KITCHEN')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  readyStationFilter === 'KITCHEN'
                    ? 'bg-amber-500 text-zinc-950 shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Kitchen Food</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-black/15 dark:bg-black/20">
                  {kitchenReadyItems.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setReadyStationFilter('BAR')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                  readyStationFilter === 'BAR'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Wine className="w-3.5 h-3.5" />
                <span>Bar Drinks</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-black/15 dark:bg-white/20">
                  {barReadyItems.length}
                </span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-3.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="p-4 rounded-2xl border border-zinc-200/90 dark:border-white/10 dark:bg-[#18181A] bg-white animate-pulse space-y-3 shadow-2xs"
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
          ) : displayedReadyTables.length === 0 ? (
            <div className="py-10 px-4 sm:py-16 text-center border border-dashed border-zinc-300 dark:border-white/15 rounded-2xl bg-zinc-50/70 dark:bg-[#141416]/50">
              {readyStationFilter === 'BAR' ? (
                <Wine className="w-10 h-10 mx-auto text-zinc-400 dark:text-zinc-500 mb-2.5" />
              ) : (
                <ChefHat className="w-10 h-10 mx-auto text-zinc-400 dark:text-zinc-500 mb-2.5" />
              )}
              <h3 className="font-bold text-sm text-zinc-900 dark:text-white">
                {readyStationFilter === 'KITCHEN'
                  ? 'Kitchen Food Queue is Empty'
                  : readyStationFilter === 'BAR'
                  ? 'Bar Drinks Queue is Empty'
                  : 'Ready Queue is Empty'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-text-muted mt-1 max-w-md mx-auto">
                {readyStationFilter === 'KITCHEN'
                  ? 'Dishes plated by the chef at the Kitchen Pass will appear here for pickup.'
                  : readyStationFilter === 'BAR'
                  ? 'Cocktails and beverages prepared by the bartender at the Bar Counter will appear here for pickup.'
                  : 'Dishes plated by the kitchen and drinks prepared by the bar will appear here grouped by table for pickup.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-3.5">
              {displayedReadyTables.map((tbl) => {
                const waitMins = tbl.earliestReadyAt ? getWaitMinutes(tbl.earliestReadyAt) : 0;
                const waitTimeColor =
                  waitMins >= 10
                    ? 'text-rose-700 dark:text-rose-400 font-bold'
                    : waitMins >= 5
                    ? 'text-amber-700 dark:text-amber-400 font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400';

                return (
                  <div
                    key={tbl.tableKey}
                    onClick={() => handleOpenTableService(tbl)}
                    className="p-3 sm:p-3.5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] hover:border-primary/50 dark:hover:border-primary/50 transition-all shadow-2xs hover:shadow-xs cursor-pointer flex flex-col justify-between gap-2.5 group"
                  >
                    <div>
                      {/* Top Header: Table Identity + Ready Count Badge */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-black text-xs sm:text-sm px-2.5 py-1 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 tracking-tight shadow-2xs">
                            Table {tbl.tableNumber}
                          </span>
                          {tbl.placeType && (
                            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 truncate">
                              {tbl.placeType}
                            </span>
                          )}
                        </div>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 shadow-2xs shrink-0">
                          <ChefHat className="w-3.5 h-3.5" />
                          <span>Ready: {tbl.readyCount}</span>
                        </span>
                      </div>

                      {/* Breakdown: Kitchen Food & Bar Drinks Count + Ready Time */}
                      <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between gap-2 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {tbl.kitchenCount > 0 && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 flex items-center gap-1">
                              <Utensils className="w-3 h-3" />
                              <span>{tbl.kitchenCount} Kitchen</span>
                            </span>
                          )}
                          {tbl.barCount > 0 && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60 flex items-center gap-1">
                              <Wine className="w-3 h-3" />
                              <span>{tbl.barCount} Bar</span>
                            </span>
                          )}
                        </div>

                        {tbl.earliestReadyAt && (
                          <div className={`text-[11px] flex items-center gap-1 font-medium ${waitTimeColor}`}>
                            <Clock className="w-3 h-3 shrink-0" />
                            <span>{getRelativeWaitTime(tbl.earliestReadyAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenTableService(tbl);
                      }}
                      className="w-full h-8.5 px-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-2xs active:scale-[0.98] transition-all cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <ChefHat className="w-3.5 h-3.5" />
                        <span>View Table Service</span>
                      </div>
                      <ChevronRight className="w-4 h-4" />
                    </button>
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
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 animate-fade-in pr-0.5">
            {/* Control & Navigation Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 sm:pb-3 border-b border-zinc-200 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                    Bills &amp; Checkout
                  </h2>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live Queue</span>
                  </div>
                </div>
                <p className="hidden sm:block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Verify customer bills, check unserved items, collect payment, and release dining tables.
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                {/* Sub-tab Navigation */}
                <div className="flex items-center gap-1 p-0.5 sm:p-1 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex-1 sm:flex-none">
                  <button
                    type="button"
                    onClick={() => handleSetBillsSubTab('active')}
                    className={`h-8 px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-none whitespace-nowrap ${
                      billsSubTab === 'active'
                        ? 'bg-primary text-white shadow-2xs font-black'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Active</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        billsSubTab === 'active'
                          ? 'bg-white/20 text-white'
                          : 'bg-zinc-200 dark:bg-white/10 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {activeBills.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetBillsSubTab('history')}
                    className={`h-8 px-2.5 sm:px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 sm:flex-none whitespace-nowrap ${
                      billsSubTab === 'history'
                        ? 'bg-primary text-white shadow-2xs font-black'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Settled</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        billsSubTab === 'history'
                          ? 'bg-white/20 text-white'
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
                  onClick={() => fetchBillsData()}
                  disabled={isBillsLoading}
                  title="Refresh bills data"
                  className="h-8 w-8 p-1.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] hover:bg-zinc-100 dark:hover:bg-white/5 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isBillsLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Operational Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              <div className="p-2.5 sm:p-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] flex items-center gap-2 sm:gap-2.5 shadow-2xs">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate">
                    Active
                  </div>
                  <div className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                    {activeBills.length}
                  </div>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] flex items-center gap-2 sm:gap-2.5 shadow-2xs">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate">
                    Ready
                  </div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {readyToSettleCount}
                  </div>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] flex items-center gap-2 sm:gap-2.5 shadow-2xs">
                <div
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    inPrepCount > 0
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      : 'bg-zinc-100 dark:bg-white/5 text-zinc-400'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate">
                    In Prep
                  </div>
                  <div
                    className={`text-base sm:text-lg font-black ${
                      inPrepCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-900 dark:text-white'
                    }`}
                  >
                    {inPrepCount}
                  </div>
                </div>
              </div>

              <div className="p-2.5 sm:p-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] flex items-center gap-2 sm:gap-2.5 shadow-2xs">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary/10 text-primary dark:text-purple-300 flex items-center justify-center shrink-0">
                  <History className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider truncate">
                    Settled Today
                  </div>
                  <div className="text-base sm:text-lg font-black text-zinc-900 dark:text-white flex items-baseline gap-1 truncate">
                    <span>{settledSummary.completedTodayCount}</span>
                    <span className="text-[11px] font-normal text-zinc-500 dark:text-zinc-400">
                      (₹{Number(settledSummary.completedTodayRevenue).toFixed(0)})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filter Row */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  billsSubTab === 'active'
                    ? 'Search bills by table, pass, or guest name...'
                    : 'Search settled history by table, bill #, reference...'
                }
                value={billsSearchQuery}
                onChange={(e) => setBillsSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-white dark:bg-[#18181A] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-hidden focus:border-primary transition-colors shadow-2xs"
              />
              {billsSearchQuery && (
                <button
                  type="button"
                  onClick={() => setBillsSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* TAB 1: ACTIVE REQUESTS */}
            {billsSubTab === 'active' && (
              <div className="space-y-3">
                {filteredActiveBills.length === 0 ? (
                  <div className="p-8 sm:p-12 text-center border border-dashed border-zinc-300 dark:border-white/15 rounded-2xl bg-zinc-50/70 dark:bg-[#141416]/50">
                    <Receipt className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
                    <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                      {billsSearchQuery ? 'No Matching Active Bill Requests' : 'No Pending Bill Requests'}
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-text-muted mt-0.5 max-w-sm mx-auto">
                      {billsSearchQuery
                        ? 'No active bill requests match your search.'
                        : 'Tables requesting bill settlement will appear here instantly.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3.5">
                    {filteredActiveBills.map((b) => {
                      const waitMins = b.requestedAt ? getWaitMinutes(b.requestedAt) : 0;
                      const waitBadgeColor =
                        waitMins >= 15
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border-rose-300 dark:border-rose-800 font-bold'
                          : waitMins >= 10
                          ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400 border-amber-300 dark:border-amber-800 font-bold'
                          : 'bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10';

                      const isUnserved = (b.unservedCount || 0) > 0;

                      return (
                        <div
                          key={b.id || b.tableId}
                          onClick={() => handleOpenBillModal(b)}
                          className={`p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 shadow-2xs hover:shadow-xs ${
                            isUnserved
                              ? 'border-amber-400/80 dark:border-amber-500/40 bg-amber-50/20 dark:bg-[#18181A] hover:border-amber-500'
                              : 'border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] hover:border-primary/50'
                          }`}
                        >
                          <div>
                            {/* Card Header: Table + Area + Wait Time */}
                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-zinc-100 dark:border-white/5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="font-black text-xs px-2 py-0.5 rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shrink-0">
                                  Table {b.tableNumber}
                                </span>
                                {b.placeType && (
                                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 truncate">
                                    {b.placeType}
                                  </span>
                                )}
                              </div>

                              <div className={`px-2 py-0.5 rounded-full text-[10px] border flex items-center gap-1 shrink-0 ${waitBadgeColor}`}>
                                <Clock className="w-2.5 h-2.5" />
                                <span>{waitMins}m wait</span>
                              </div>
                            </div>

                            {/* Session & Guest Info */}
                            <div className="flex items-center justify-between gap-2 mt-2 text-xs">
                              <div className="truncate">
                                <span className="text-[10px] text-zinc-400 uppercase font-bold mr-1">Pass:</span>
                                <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{b.tokenNumber || '—'}</span>
                              </div>
                              <div className="truncate text-right">
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">{b.customerName || 'Guest'}</span>
                                {b.personsCount ? <span className="text-[10px] text-zinc-400 ml-1">({b.personsCount}p)</span> : null}
                              </div>
                            </div>

                            {/* Kitchen/Bar Status Pill */}
                            <div className="mt-2">
                              {isUnserved ? (
                                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1.5">
                                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                  <span>{b.unservedCount} in prep ({b.itemCount} items)</span>
                                </div>
                              ) : (
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>All {b.itemCount} items served</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Footer: Financials & Action */}
                          <div className="pt-2 border-t border-zinc-100 dark:border-white/5 flex items-center justify-between gap-2">
                            <div>
                              <div className="text-[9px] font-bold text-zinc-400 uppercase">Payable</div>
                              <div className="font-mono font-black text-sm sm:text-base text-zinc-900 dark:text-white">
                                ₹{Number(b.grandTotal || 0).toFixed(2)}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenBillModal(b);
                              }}
                              className="h-8 px-3 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
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
                  <div className="p-8 sm:p-12 text-center border border-dashed border-zinc-300 dark:border-white/15 rounded-2xl bg-zinc-50/70 dark:bg-[#141416]/50">
                    <History className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
                    <h3 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                      {billsSearchQuery ? 'No Matching Settled Bills' : 'No Settled Bills Today'}
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-text-muted mt-0.5 max-w-sm mx-auto">
                      {billsSearchQuery
                        ? 'No settled bills match your search.'
                        : 'Bills settled during today’s shift will appear here.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile Card View (sm:hidden) */}
                    <div className="space-y-2 block sm:hidden">
                      {filteredSettledBills.map((b) => (
                        <div
                          key={b.id}
                          className="p-3 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-black text-xs px-2 py-0.5 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shrink-0">
                                Table {b.tableNumber}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                                {b.billNumber}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-mono font-black text-sm text-zinc-900 dark:text-white">
                                ₹{Number(b.grandTotal || 0).toFixed(2)}
                              </div>
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                                PAID
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-zinc-100 dark:border-white/5 text-zinc-600 dark:text-zinc-400">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-zinc-900 dark:text-white">{b.customerName || 'Guest'}</span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold ${
                                  b.paymentMethod === 'UPI'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                }`}
                              >
                                {b.paymentMethod}
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-400 shrink-0">
                              {b.paidAt ? getRelativeWaitTime(b.paidAt) : 'Today'}
                            </div>
                          </div>

                          {(b.settler || b.settledBy) && (
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 pt-0.5">
                              <User className="w-3 h-3 text-purple-500 shrink-0" />
                              <span>By: {getStaffDisplayName(b.settler || b.settledBy)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table View (hidden sm:block) */}
                    <div className="hidden sm:block border border-zinc-200 dark:border-white/10 rounded-2xl bg-white dark:bg-[#18181A] overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider">
                              <th className="py-2.5 px-3.5">Bill & Table</th>
                              <th className="py-2.5 px-3.5">Guest</th>
                              <th className="py-2.5 px-3.5">Method & Ref</th>
                              <th className="py-2.5 px-3.5">Settled By</th>
                              <th className="py-2.5 px-3.5">Time</th>
                              <th className="py-2.5 px-3.5 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-200/70 dark:divide-white/5">
                            {filteredSettledBills.map((b) => (
                              <tr key={b.id} className="hover:bg-zinc-50/50 dark:hover:bg-white/5 transition-colors">
                                <td className="py-2.5 px-3.5">
                                  <div className="font-bold text-zinc-900 dark:text-white">Table {b.tableNumber}</div>
                                  <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{b.billNumber}</div>
                                </td>
                                <td className="py-2.5 px-3.5">
                                  <div className="font-medium text-zinc-800 dark:text-zinc-200">{b.customerName || 'Guest'}</div>
                                  {b.customerPhone && (
                                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">{b.customerPhone}</div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3.5">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                                        b.paymentMethod === 'UPI'
                                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
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
                                <td className="py-2.5 px-3.5 text-zinc-700 dark:text-zinc-300 font-medium">
                                  <div className="flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-primary dark:text-purple-400 shrink-0" />
                                    <span className="font-semibold truncate">{getStaffDisplayName(b.settler || b.settledBy)}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3.5 text-zinc-500 dark:text-zinc-400">
                                  {b.paidAt ? getRelativeWaitTime(b.paidAt) : 'Today'}
                                </td>
                                <td className="py-2.5 px-3.5 text-right">
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
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ==================================================================== */}
      {/* 5. ASSISTED ORDER DRAWER (WAITER-ASSISTED ORDER PLACEMENT)            */}
      {/* ==================================================================== */}
      {isAssistedOrderingOpen && selectedTable && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-stretch justify-center sm:justify-end overscroll-contain"
          style={{
            opacity: isDrawerClosing ? 0 : isDrawerDragging ? Math.max(0.1, 1 - drawerDragY / 400) : 1,
            transition: isDrawerDragging ? 'none' : 'opacity 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isCustomizerOpen) {
              handleCloseAssistedOrdering();
            }
          }}
        >
          <div
            onTouchStart={handleDrawerTouchStart}
            onTouchMove={handleDrawerTouchMove}
            onTouchEnd={handleDrawerTouchEnd}
            style={{
              transform: isDrawerDragging
                ? `translateY(${drawerDragY}px)`
                : isDrawerClosing
                ? 'translateY(100%)'
                : 'translateY(0)',
              transition: isDrawerDragging ? 'none' : 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
              touchAction: 'pan-y',
              overscrollBehavior: 'contain',
            }}
            className="w-full max-w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl rounded-t-3xl sm:rounded-none bg-white dark:bg-[#141416] border-t sm:border-t-0 sm:border-l border-zinc-200 dark:border-white/10 max-h-[92vh] sm:max-h-full h-auto sm:h-full flex flex-col p-4 sm:p-6 shadow-2xl overflow-hidden select-none sm:select-auto will-change-transform overscroll-contain animate-slide-up sm:animate-slide-left"
          >
            {/* Mobile Drag Indicator / Pull Handle */}
            <div className="w-full pt-1 pb-2 flex justify-center sm:hidden cursor-grab active:cursor-grabbing shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-white/20 hover:bg-zinc-400 dark:hover:bg-white/40 transition-colors" />
            </div>

            {/* Header: Table identity & close */}
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200 dark:border-white/10 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-lg sm:text-xl text-zinc-900 dark:text-white">
                    Assisted Order — Table {selectedTable.tableNumber || selectedTable.number}
                  </h3>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] border border-primary/20 dark:border-[#D4AF37]/30">
                    {selectedTable.placeType?.name || (typeof selectedTable.placeType === 'string' ? selectedTable.placeType : 'Dine-In')}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-text-muted mt-0.5">
                  {selectedTable.currentTokenId || selectedTable.activeSession?.tokenNumber
                    ? `Active Pass: ${formatPassNumber(selectedTable.currentTokenId || selectedTable.activeSession?.tokenNumber)}`
                    : 'Table-side order entry directly for guests'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close assisted ordering drawer"
                onClick={handleCloseAssistedOrdering}
                className="p-2 rounded-xl text-zinc-500 dark:text-text-muted hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Search & Category Filter */}
            <div className="pt-3 pb-2 space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search dishes, drinks, appetizers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-8 py-2.5 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#18181A] text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-primary dark:focus:border-[#D4AF37] shadow-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Horizontal Category Chips */}
              {assistedCategories.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                  {assistedCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedAssistedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                        selectedAssistedCategory === cat
                          ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs'
                          : 'bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {cat === 'ALL' ? 'All Items' : cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Menu Items Catalog Section */}
            <div
              ref={drawerScrollRef}
              className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[140px] overscroll-contain"
            >
              <div className="flex items-center justify-between pb-1 px-0.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Select Items to Add ({filteredMenuItems.length})
                </span>
              </div>

              {filteredMenuItems.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-zinc-200 dark:border-white/10 rounded-xl bg-zinc-50/50 dark:bg-[#141416]/40 flex flex-col items-center justify-center">
                  <Search className="w-6 h-6 text-zinc-400 dark:text-zinc-500 mb-1" />
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">No matching items found</p>
                  <p className="text-[11px] text-zinc-500 dark:text-text-muted mt-0.5">Try searching with a different term or category.</p>
                </div>
              ) : (
                filteredMenuItems.map((item) => {
                  const hasCustomizations = (item.variants && item.variants.length > 0) || (item.modifierGroups && item.modifierGroups.length > 0);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenCustomizerForItem(item)}
                      className="p-3 rounded-xl border border-zinc-200 dark:border-white/10 dark:bg-[#18181A] bg-white flex items-center justify-between gap-2.5 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 transition-all cursor-pointer shadow-2xs group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <VegBadge type={item.foodType} size="sm" />
                          <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white group-hover:text-primary dark:group-hover:text-[#D4AF37] transition-colors">
                            {item.name}
                          </span>
                          {hasCustomizations && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-primary dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                              Customizable
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-zinc-500 dark:text-text-muted mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                        <div className="text-xs text-primary dark:text-[#D4AF37] font-black mt-1">
                          ₹{Number(item.basePrice).toFixed(2)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCustomizerForItem(item);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-extrabold text-xs shadow-xs cursor-pointer active:scale-95 transition-all shrink-0 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>{hasCustomizations ? 'Customize' : 'Add'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Assisted Cart Summary & Submission Panel (Distinct Visual Boundary) */}
            {assistedCart.length > 0 && (
              <div className="mt-3 pt-3.5 border-t-2 border-primary/20 dark:border-[#D4AF37]/30 bg-zinc-50/90 dark:bg-[#18181A]/95 -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 p-4 sm:p-5 rounded-t-2xl shadow-lg space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                      Order Summary ({assistedCart.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0)} items)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssistedCart([])}
                    className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                <div className="space-y-2 max-h-36 sm:max-h-48 md:max-h-56 overflow-y-auto pr-1">
                  {assistedCart.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-[#141416] flex items-start justify-between gap-2.5 text-xs shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <VegBadge type={item.foodType} size="sm" />
                          <span className="font-bold text-zinc-900 dark:text-white">
                            {item.name}
                          </span>
                          {item.variantName && (
                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                              ({item.variantName})
                            </span>
                          )}
                        </div>

                        {/* Modifiers List */}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            {item.modifiers.map((m: any, mIdx: number) => (
                              <span
                                key={mIdx}
                                className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300"
                              >
                                {m.optionName || m.name}
                                {m.priceDelta > 0 ? ` (+₹${m.priceDelta})` : ''}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Special Instructions */}
                        {item.specialInstructions && (
                          <p className="text-[10px] text-amber-700 dark:text-amber-400 italic mt-0.5 truncate">
                            Note: &quot;{item.specialInstructions}&quot;
                          </p>
                        )}

                        <div className="text-[11px] font-black text-primary dark:text-[#D4AF37] mt-1">
                          ₹{(item.unitPrice * item.quantity).toFixed(2)}
                        </div>
                      </div>

                      {/* Quantity Stepper & Remove */}
                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        <button
                          type="button"
                          aria-label="Decrease quantity"
                          onClick={() => handleUpdateAssistedQty(idx, -1)}
                          className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-white/20 bg-white dark:bg-[#18181A] hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-800 dark:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-2xs"
                          title="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center font-bold text-xs text-zinc-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Increase quantity"
                          onClick={() => handleUpdateAssistedQty(idx, 1)}
                          className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-white/20 bg-white dark:bg-[#18181A] hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-800 dark:text-white flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-2xs"
                          title="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Remove item"
                          onClick={() => handleRemoveAssistedItem(idx)}
                          className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center cursor-pointer active:scale-95 transition-all ml-0.5"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center text-xs font-black pt-1 border-t border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                  <span className="text-zinc-500 dark:text-zinc-400">Order Subtotal</span>
                  <span className="text-primary dark:text-[#D4AF37] font-mono text-base">₹{assistedCartTotal.toFixed(2)}</span>
                </div>

                <button
                  type="button"
                  disabled={isSubmittingOrder}
                  onClick={handleSubmitAssistedOrder}
                  className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-extrabold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {isSubmittingOrder ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Order for Table {selectedTable.tableNumber || selectedTable.number}...</span>
                    </>
                  ) : (
                    <span>Place Order for Table {selectedTable.tableNumber || selectedTable.number} — ₹{assistedCartTotal.toFixed(2)}</span>
                  )}
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
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-6 overscroll-contain"
            style={{
              opacity: isBillDrawerClosing ? 0 : isBillDrawerDragging ? Math.max(0.1, 1 - billDrawerDragY / 400) : 1,
              transition: isBillDrawerDragging ? 'none' : 'opacity 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseBillModal();
              }
            }}
          >
            <div
              onTouchStart={handleBillTouchStart}
              onTouchMove={handleBillTouchMove}
              onTouchEnd={handleBillTouchEnd}
              style={{
                transform: isBillDrawerDragging
                  ? `translateY(${billDrawerDragY}px)`
                  : isBillDrawerClosing
                  ? 'translateY(100%)'
                  : 'translateY(0)',
                transition: isBillDrawerDragging ? 'none' : 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
                touchAction: 'pan-y',
                overscrollBehavior: 'contain',
              }}
              className="w-full max-w-md sm:max-w-lg md:max-w-xl max-h-[92vh] sm:max-h-[90vh] bg-white dark:bg-[#18181A] rounded-t-3xl sm:rounded-3xl border-t sm:border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col will-change-transform overscroll-contain animate-slide-up sm:animate-scale-up"
            >
              {/* Mobile Drag Indicator / Pull Handle */}
              <div className="w-full pt-2.5 pb-1 flex justify-center sm:hidden cursor-grab active:cursor-grabbing shrink-0">
                <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-white/20 hover:bg-zinc-400 dark:hover:bg-white/40 transition-colors" />
              </div>

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
                      Pass: <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{tokenNum}</span>
                      {selectedBillTable.placeType?.name || selectedBillTable.placeType ? ` · ${selectedBillTable.placeType?.name || selectedBillTable.placeType}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseBillModal}
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
              <div
                ref={billDrawerScrollRef}
                className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 overscroll-contain"
              >
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
                      <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="text-[11px] sm:text-xs leading-tight">
                          <strong className="font-bold text-amber-900 dark:text-amber-100">
                            {unservedItems.length} item{unservedItems.length === 1 ? '' : 's'} in prep:
                          </strong>{' '}
                          All items must be served or cancelled before payment.
                        </span>
                      </div>
                    )}

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
                          const isStockOut = item.status === 'STOCK_OUT';
                          const isCancelled = item.status === 'CANCELLED';

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
                                      : isStockOut || isCancelled
                                      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                                      : 'bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10'
                                  }`}
                                >
                                  {isStockOut ? 'STOCK OUT' : isCancelled ? 'CANCELLED' : (item.status || 'PLACED')}
                                </span>

                                <span className={`font-mono font-black w-16 text-right ${isStockOut || isCancelled ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-900 dark:text-white'}`}>
                                  ₹{isStockOut || isCancelled ? '0.00' : ((item.unitPrice || item.price || 0) * item.quantity).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Financial Summary */}
                    {(() => {
                      const subtotal = Number(bill.grossSubtotal || bill.subtotal || 0);
                      const initialCheckInAmount = Number(
                        bill.initialCheckInAmount ??
                        bill.amountPaid ??
                        bill.confirmedCheckInAmount ??
                        bill.entryFeePaid ??
                        selectedBillTable?.initialCheckInAmount ??
                        selectedBillTable?.amountPaid ??
                        selectedBillTable?.session?.initialCheckInAmount ??
                        selectedBillTable?.session?.amountPaid ??
                        0
                      );
                      const checkInPayment = Number(
                        bill.prepaidCreditApplied ??
                        bill.redemptionDeduction ??
                        (initialCheckInAmount > 0 ? Math.min(initialCheckInAmount, subtotal) : 0)
                      );
                      const extensions: any[] = Array.isArray(bill.extensions)
                        ? bill.extensions
                        : Array.isArray(selectedBillTable?.extensions)
                        ? selectedBillTable.extensions
                        : Array.isArray(selectedBillTable?.session?.extensions)
                        ? selectedBillTable.session.extensions
                        : [];
                      const balanceBeforeCharges = Math.max(0, subtotal - checkInPayment);
                      const serviceCharge = Number(bill.serviceChargeTotal || bill.serviceCharge || 0);
                      const taxTotal = Number(bill.taxTotal || (Number(bill.cgst || 0) + Number(bill.sgst || 0)) || 0);
                      const rounding = Number(bill.rounding || 0);
                      const grandTotal = Number(bill.grandTotal || bill.total || 0);

                      return (
                        <div className="pt-3 border-t border-zinc-200 dark:border-white/10 space-y-1.5 text-xs">
                          {/* 1. Subtotal */}
                          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                            <span>Subtotal</span>
                            <span className="font-mono font-semibold">
                              ₹{subtotal.toFixed(2)}
                            </span>
                          </div>

                          {/* 2. Initial Check-in Amount Paid & Deduction */}
                          {initialCheckInAmount > 0 && (
                            <>
                              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                                <span>Initial Check-in Amount Paid</span>
                                <span className="font-mono font-semibold">₹{initialCheckInAmount.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                                <span>Less Check-in Payment</span>
                                <span className="font-mono">-₹{checkInPayment.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-zinc-700 dark:text-zinc-300 font-semibold">
                                <span>Balance Before Charges</span>
                                <span className="font-mono">₹{balanceBeforeCharges.toFixed(2)}</span>
                              </div>
                            </>
                          )}

                          {/* 3. Itemized Session Extensions */}
                          {extensions.length > 0 && (
                            <div className="pt-2 pb-1 border-t border-zinc-200 dark:border-white/10 space-y-1.5">
                              <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                <span>Session Extensions ({extensions.length})</span>
                                <span>Status</span>
                              </div>
                              <div className="space-y-1">
                                {extensions.map((ext: any, idx: number) => {
                                  const isComplimentary = ext.isComplimentary || Number(ext.additionalAmount || 0) === 0;
                                  return (
                                    <div key={ext.id || idx} className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                                      <span className="font-semibold text-zinc-900 dark:text-white">
                                        Extension #{ext.sequence || idx + 1} (+{ext.extraMinutes} min)
                                      </span>
                                      <span className={isComplimentary ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'font-mono font-semibold text-zinc-900 dark:text-white'}>
                                        {isComplimentary ? 'Complimentary' : `₹${Number(ext.additionalAmount).toFixed(2)} (Paid)`}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 4. Service Charge */}
                          {serviceCharge > 0 && (
                            <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                              <span>Service Charge (5%)</span>
                              <span className="font-mono">
                                ₹{serviceCharge.toFixed(2)}
                              </span>
                            </div>
                          )}

                          {/* 5. GST */}
                          {taxTotal > 0 && (
                            <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                              <span>GST / Taxes (5%)</span>
                              <span className="font-mono">
                                ₹{taxTotal.toFixed(2)}
                              </span>
                            </div>
                          )}

                          {rounding !== 0 && (
                            <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                              <span>Rounding Adjustment</span>
                              <span className="font-mono">
                                {rounding > 0
                                  ? `+₹${rounding.toFixed(2)}`
                                  : `-₹${Math.abs(rounding).toFixed(2)}`}
                              </span>
                            </div>
                          )}

                          {/* 6. Final Amount Payable */}
                          <div className="flex justify-between items-center text-base font-black pt-2 border-t border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
                            <span>Final Amount Payable</span>
                            <span className="text-primary dark:text-[#D4AF37] font-mono text-xl font-black">
                              ₹{grandTotal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
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

                      <div 
                        className="grid grid-cols-2 gap-2.5 focus:outline-none"
                        onKeyDown={waiterPaymentRoving.handleKeyDown}
                      >
                        <button
                          type="button"
                          tabIndex={waiterPaymentRoving.getItemProps(0).tabIndex}
                          onClick={() => setSelectedPaymentMethod('CASH')}
                          onFocus={waiterPaymentRoving.getItemProps(0).onFocus}
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
                          tabIndex={waiterPaymentRoving.getItemProps(1).tabIndex}
                          onClick={() => setSelectedPaymentMethod('UPI')}
                          onFocus={waiterPaymentRoving.getItemProps(1).onFocus}
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseBillModal}
                    disabled={isSettlingBill || isInitiatingSettlement}
                    className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#18181A] text-zinc-700 dark:text-zinc-300 font-extrabold text-xs hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Close
                  </button>

                  {settlementStep === 'review' && (selectedBillTable?.status === 'BILL_REQUESTED' || (selectedBillTable as any)?.isBillReq || (bill as any)?.status === 'REQUESTED') && (
                    <button
                      type="button"
                      onClick={() => {
                        const tableToReopen = selectedBillTable;
                        handleCloseBillModal();
                        handleOpenReopenConfirm(tableToReopen);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-amber-500/40 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 font-extrabold text-xs hover:bg-amber-100 dark:hover:bg-amber-900/40 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reopen Ordering</span>
                    </button>
                  )}
                </div>

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
                    onClick={() => setShowPaymentConfirmationAlert(true)}
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

              {/* Payment Receipt Confirmation Alert Modal */}
              {showPaymentConfirmationAlert && (
                <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                  <div className="w-full max-w-md bg-white dark:bg-[#18181A] rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl p-5 sm:p-6 space-y-4 animate-scale-up text-zinc-900 dark:text-white">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div className="space-y-1 flex-1">
                        <h3 className="font-black text-base text-zinc-900 dark:text-white">
                          Confirm Payment
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-semibold">
                          Are you sure the payment has been received?
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#141416] border border-zinc-200/80 dark:border-white/5 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 dark:text-zinc-400">Table:</span>
                        <span className="font-bold text-zinc-900 dark:text-white">
                          Table {tableNum}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 dark:text-zinc-400">Payment Method:</span>
                        <span className="font-bold text-zinc-900 dark:text-white">
                          {selectedPaymentMethod}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-zinc-200/60 dark:border-white/5">
                        <span className="text-zinc-500 dark:text-zinc-400 font-medium">Total Amount:</span>
                        <span className="font-mono font-black text-sm text-primary dark:text-[#D4AF37]">
                          ₹{Number(bill.grandTotal || bill.total || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowPaymentConfirmationAlert(false)}
                        disabled={isSettlingBill}
                        className="flex-1 py-2.5 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#18181A] text-zinc-700 dark:text-zinc-300 font-extrabold text-xs hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmPayment}
                        disabled={isSettlingBill}
                        className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-black text-xs shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isSettlingBill ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Confirming...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Yes / Confirm</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
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

      {/* ==================================================================== */}
      {/* 6. TABLE SERVICE DETAILS MODAL (TABLE-WISE FLOW)                     */}
      {/* ==================================================================== */}
      {selectedServiceTable && (() => {
        // Collect and organize all items from active orders for this table
        const allItems: any[] = [];
        tableActiveOrders.forEach((order: any) => {
          (order.items || []).forEach((item: any) => {
            allItems.push({
              ...item,
              orderNumber: order.orderNumber,
              orderCreatedAt: order.createdAt,
              orderHandler: order.handler,
            });
          });
        });

        const readyList = allItems.filter((i) => i.status === 'READY');
        const readyFoodItems = readyList.filter((i) => isKitchenStation(i.station));
        const readyDrinkItems = readyList.filter((i) => isBarStation(i.station));
        const preparingList = allItems.filter((i) => i.status === 'PREPARING');
        const acceptedList = allItems.filter((i) => i.status === 'ACCEPTED' || i.status === 'PLACED');
        const servedList = allItems.filter((i) => i.status === 'SERVED');

        return (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-6 overscroll-contain"
            style={{
              opacity: isServiceDrawerClosing ? 0 : isServiceDrawerDragging ? Math.max(0.1, 1 - serviceDrawerDragY / 400) : 1,
              transition: isServiceDrawerDragging ? 'none' : 'opacity 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleCloseTableService();
              }
            }}
          >
            <div
              onTouchStart={handleServiceTouchStart}
              onTouchMove={handleServiceTouchMove}
              onTouchEnd={handleServiceTouchEnd}
              style={{
                transform: isServiceDrawerDragging
                  ? `translateY(${serviceDrawerDragY}px)`
                  : isServiceDrawerClosing
                  ? 'translateY(100%)'
                  : 'translateY(0)',
                transition: isServiceDrawerDragging ? 'none' : 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
                touchAction: 'pan-y',
                overscrollBehavior: 'contain',
              }}
              className="w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] bg-white dark:bg-[#18181A] rounded-t-3xl sm:rounded-3xl border-t sm:border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col will-change-transform overscroll-contain animate-slide-up sm:animate-scale-up"
            >
              {/* Mobile Drag Indicator / Pull Handle */}
              <div className="w-full pt-2.5 pb-1 flex justify-center sm:hidden cursor-grab active:cursor-grabbing shrink-0">
                <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-white/20 hover:bg-zinc-400 dark:hover:bg-white/40 transition-colors" />
              </div>

              {/* Modal Header */}
              <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-[#141416]/50 shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-base shrink-0">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base sm:text-lg text-zinc-900 dark:text-white tracking-tight">
                        Table {selectedServiceTable.tableNumber}
                      </h3>
                      {selectedServiceTable.placeType && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                          {selectedServiceTable.placeType}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {selectedServiceTable.tokenNumber ? `Session: ${selectedServiceTable.tokenNumber}` : 'Active Floor Service'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const targetTable = (tables || []).find(
                        (t) =>
                          t.id === selectedServiceTable.tableId ||
                          t.tableNumber === selectedServiceTable.tableNumber ||
                          t.number === selectedServiceTable.tableNumber
                      );
                      handleOpenExtendModal(
                        targetTable || {
                          id: selectedServiceTable.tableId,
                          tableNumber: selectedServiceTable.tableNumber,
                          currentTokenId: selectedServiceTable.tokenNumber,
                          placeType: selectedServiceTable.placeType,
                        }
                      );
                    }}
                    className="h-8 px-2.5 sm:px-3 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 dark:text-purple-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors border border-purple-200 dark:border-purple-800/40 active:scale-95"
                    title="Extend Session Time"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline sm:inline">Extend</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseTableService}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
                    title="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Waiter Responsibility / Order Handler Info Bar */}
              {tableActiveOrders.length > 0 && (() => {
                const handlerMap = new Map();
                tableActiveOrders.forEach((o: any) => {
                  if (o.handler && (o.handler.fullName || o.handler.username)) {
                    handlerMap.set(o.handler.id || o.handler.username, o.handler);
                  }
                });
                const handlers = Array.from(handlerMap.values());
                if (handlers.length === 0) return null;
                return (
                  <div className="px-3.5 sm:px-4 py-2 bg-purple-50/70 dark:bg-purple-950/20 border-b border-purple-200/60 dark:border-purple-800/30 flex items-center gap-1.5 text-xs text-purple-800 dark:text-purple-300">
                    <User className="w-3.5 h-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                    <span className="font-semibold">Order Taker:</span>
                    <span className="font-bold text-zinc-900 dark:text-white truncate">
                      {handlers.map((h: any) => getStaffDisplayName(h)).join(', ')}
                    </span>
                  </div>
                );
              })()}

              {/* Status Summary Chips */}
              <div className="px-3.5 sm:px-4 py-2 border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] flex items-center gap-1.5 overflow-x-auto text-xs font-bold scrollbar-none">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 shrink-0 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Ready: {readyList.reduce((acc, i) => acc + (i.quantity || 1), 0)}</span>
                  {readyFoodItems.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                      {readyFoodItems.reduce((acc, i) => acc + (i.quantity || 1), 0)} Kitchen
                    </span>
                  )}
                  {readyDrinkItems.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                      {readyDrinkItems.reduce((acc, i) => acc + (i.quantity || 1), 0)} Bar
                    </span>
                  )}
                </span>
                {preparingList.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 shrink-0 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Prep: {preparingList.reduce((acc, i) => acc + (i.quantity || 1), 0)}
                  </span>
                )}
                {acceptedList.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 shrink-0 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    Queued: {acceptedList.reduce((acc, i) => acc + (i.quantity || 1), 0)}
                  </span>
                )}
                {servedList.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300 border border-zinc-200 dark:border-white/10 shrink-0 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                    Served: {servedList.reduce((acc, i) => acc + (i.quantity || 1), 0)}
                  </span>
                )}
              </div>

              {/* Items Body */}
              <div
                ref={serviceDrawerScrollRef}
                className="p-3.5 sm:p-4 overflow-y-auto space-y-4 flex-1 overscroll-contain"
              >
                {isTableOrdersLoading ? (
                  <div className="py-10 flex flex-col items-center justify-center text-center space-y-2">
                    <Loader2 className="w-7 h-7 text-primary dark:text-[#D4AF37] animate-spin" />
                    <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Loading table orders...</p>
                  </div>
                ) : allItems.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-zinc-200 dark:border-white/10 rounded-xl bg-zinc-50/50 dark:bg-[#141416]/40">
                    <Utensils className="w-8 h-8 mx-auto text-zinc-400 mb-1.5" />
                    <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200">No Active Order Items</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">There are currently no active orders for this table.</p>
                  </div>
                ) : (
                  <>
                    {/* SECTION 1A: KITCHEN / FOOD READY */}
                    {readyFoodItems.length > 0 && (
                      <div className="space-y-2.5 p-3 rounded-xl border border-amber-300/80 dark:border-amber-700/50 bg-amber-50/30 dark:bg-amber-950/10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0"></span>
                            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5 truncate">
                              <Utensils className="w-3.5 h-3.5 shrink-0" />
                              <span>Kitchen Ready ({readyFoodItems.reduce((acc, i) => acc + (i.quantity || 1), 0)})</span>
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={isServingBatch}
                            onClick={() => handleServeBatchItemsFromModal(readyFoodItems.map((i) => i.id))}
                            className="h-7 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Deliver All ({readyFoodItems.reduce((acc, i) => acc + (i.quantity || 1), 0)})</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {readyFoodItems.map((item) => {
                            const readyTime = item.readyAt || item.createdAt;
                            const waitMins = readyTime ? getWaitMinutes(readyTime) : 0;
                            const waitColor =
                              waitMins >= 10
                                ? 'text-rose-700 dark:text-rose-400 font-bold'
                                : waitMins >= 5
                                ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                : 'text-zinc-500 dark:text-zinc-400';

                            return (
                              <div
                                key={item.id}
                                className="p-2.5 sm:p-3 rounded-xl border border-amber-200/80 dark:border-amber-800/40 bg-white dark:bg-[#141416] flex items-center justify-between gap-2.5 shadow-2xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <VegBadge type={item.foodType} size="sm" />
                                    <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                                      {item.quantity} × {item.itemName || item.name}
                                    </span>
                                    {item.variantName && (
                                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                                        ({item.variantName})
                                      </span>
                                    )}
                                  </div>

                                  {item.selectedModifiers && Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium mt-0.5 pl-4">
                                      {item.selectedModifiers.map((m: any) => m.optionName || m.name || m).join(', ')}
                                    </div>
                                  )}

                                  {item.specialInstructions && (
                                    <div className="text-[11px] font-semibold italic text-amber-700 dark:text-amber-400 mt-0.5 pl-4">
                                      &quot;{item.specialInstructions}&quot;
                                    </div>
                                  )}

                                  {readyTime && (
                                    <div className={`text-[10px] mt-1 pl-4 flex items-center gap-1 ${waitColor}`}>
                                      <Clock className="w-3 h-3" />
                                      <span>Ready {getRelativeWaitTime(readyTime)}</span>
                                    </div>
                                  )}
                                </div>

                                {isServedUndoPending(item.id) ? (
                                  <button
                                    type="button"
                                    onClick={() => cancelServedUndo(item.id)}
                                    className="h-8 px-2.5 sm:px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 animate-pulse"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Undo {getServedUndoSeconds(item.id)}s</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={updatingItemIds.has(item.id) || isServingBatch}
                                    onClick={() => handleServeItemFromModal(item.id)}
                                    className="h-8 px-2.5 sm:px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 disabled:opacity-50"
                                  >
                                    {updatingItemIds.has(item.id) ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>Deliver</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SECTION 1B: BAR / DRINKS READY */}
                    {readyDrinkItems.length > 0 && (
                      <div className="space-y-2.5 p-3 rounded-xl border border-blue-300/80 dark:border-blue-700/50 bg-blue-50/30 dark:bg-blue-950/10">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping shrink-0"></span>
                            <span className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5 truncate">
                              <Wine className="w-3.5 h-3.5 shrink-0" />
                              <span>Bar Ready ({readyDrinkItems.reduce((acc, i) => acc + (i.quantity || 1), 0)})</span>
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={isServingBatch}
                            onClick={() => handleServeBatchItemsFromModal(readyDrinkItems.map((i) => i.id))}
                            className="h-7 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Deliver All ({readyDrinkItems.reduce((acc, i) => acc + (i.quantity || 1), 0)})</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {readyDrinkItems.map((item) => {
                            const readyTime = item.readyAt || item.createdAt;
                            const waitMins = readyTime ? getWaitMinutes(readyTime) : 0;
                            const waitColor =
                              waitMins >= 10
                                ? 'text-rose-700 dark:text-rose-400 font-bold'
                                : waitMins >= 5
                                ? 'text-amber-700 dark:text-amber-400 font-semibold'
                                : 'text-zinc-500 dark:text-zinc-400';

                            return (
                              <div
                                key={item.id}
                                className="p-2.5 sm:p-3 rounded-xl border border-blue-200/80 dark:border-blue-800/40 bg-white dark:bg-[#141416] flex items-center justify-between gap-2.5 shadow-2xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <VegBadge type={item.foodType} size="sm" />
                                    <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                                      {item.quantity} × {item.itemName || item.name}
                                    </span>
                                    {item.variantName && (
                                      <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                                        ({item.variantName})
                                      </span>
                                    )}
                                  </div>

                                  {item.selectedModifiers && Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                                    <div className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium mt-0.5 pl-4">
                                      {item.selectedModifiers.map((m: any) => m.optionName || m.name || m).join(', ')}
                                    </div>
                                  )}

                                  {item.specialInstructions && (
                                    <div className="text-[11px] font-semibold italic text-amber-700 dark:text-amber-400 mt-0.5 pl-4">
                                      &quot;{item.specialInstructions}&quot;
                                    </div>
                                  )}

                                  {readyTime && (
                                    <div className={`text-[10px] mt-1 pl-4 flex items-center gap-1 ${waitColor}`}>
                                      <Clock className="w-3 h-3" />
                                      <span>Ready {getRelativeWaitTime(readyTime)}</span>
                                    </div>
                                  )}
                                </div>

                                {isServedUndoPending(item.id) ? (
                                  <button
                                    type="button"
                                    onClick={() => cancelServedUndo(item.id)}
                                    className="h-8 px-2.5 sm:px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 animate-pulse"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Undo {getServedUndoSeconds(item.id)}s</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={updatingItemIds.has(item.id) || isServingBatch}
                                    onClick={() => handleServeItemFromModal(item.id)}
                                    className="h-8 px-2.5 sm:px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 shrink-0 disabled:opacity-50"
                                  >
                                    {updatingItemIds.has(item.id) ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>Deliver</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SECTION: IN PREPARATION */}
                    {preparingList.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                          In Preparation ({preparingList.length})
                        </span>

                        <div className="space-y-1.5">
                          {preparingList.map((item) => (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/20 dark:bg-[#141416]/60 flex items-center justify-between gap-2.5 text-xs"
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                <VegBadge type={item.foodType} size="sm" />
                                <span className="font-bold text-zinc-900 dark:text-white truncate">
                                  {item.quantity} × {item.itemName || item.name}
                                </span>
                                {item.variantName && (
                                  <span className="text-zinc-500 dark:text-zinc-400 text-[11px] shrink-0">({item.variantName})</span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/50 shrink-0">
                                {item.station || 'Preparing'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SECTION: ACCEPTED / QUEUED */}
                    {acceptedList.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-bold text-blue-800 dark:text-blue-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          In Queue ({acceptedList.length})
                        </span>

                        <div className="space-y-1.5">
                          {acceptedList.map((item) => (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50/50 dark:bg-[#141416]/40 flex items-center justify-between gap-2.5 text-xs"
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                <VegBadge type={item.foodType} size="sm" />
                                <span className="font-bold text-zinc-900 dark:text-white truncate">
                                  {item.quantity} × {item.itemName || item.name}
                                </span>
                                {item.variantName && (
                                  <span className="text-zinc-500 dark:text-zinc-400 text-[11px] shrink-0">({item.variantName})</span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-white/10 shrink-0">
                                Queued
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SECTION: ALREADY SERVED */}
                    {servedList.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
                          Served Items ({servedList.length})
                        </span>

                        <div className="space-y-1 opacity-75">
                          {servedList.map((item) => (
                            <div
                              key={item.id}
                              className="p-2 rounded-lg border border-zinc-200/60 dark:border-white/5 bg-zinc-50/30 dark:bg-[#141416]/20 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                <VegBadge type={item.foodType} size="sm" />
                                <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate">
                                  {item.quantity} × {item.itemName || item.name}
                                </span>
                                {item.variantName && (
                                  <span className="text-zinc-400 text-[11px] shrink-0">({item.variantName})</span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 shrink-0">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                Served
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 sm:p-4 border-t border-zinc-200 dark:border-white/10 bg-zinc-50/70 dark:bg-[#141416]/50 flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  {readyList.length > 0
                    ? `${readyList.length} ready item${readyList.length === 1 ? '' : 's'} remaining`
                    : 'All ready items delivered'}
                </span>
                <button
                  type="button"
                  onClick={handleCloseTableService}
                  className="h-8 px-4 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-2xs active:scale-95 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================================================================== */}
      {/* 7. EXTEND SESSION MODAL (CANONICAL TIME EXTENSION)                    */}
      {/* ==================================================================== */}
      {extendingTable && (
        <ExtendSessionModal
          isOpen={!!extendingTable}
          token={extendingToken}
          rates={rates || []}
          onClose={() => {
            setExtendingTable(null);
            setExtendingToken(null);
          }}
          onSuccess={() => {
            setExtendingTable(null);
            setExtendingToken(null);
            refreshTables();
            refreshTokens();
            fetchTables(true);
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* 8. REOPEN ORDERING CONFIRMATION MODAL                                 */}
      {/* ==================================================================== */}
      {reopenConfirmTable && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reopen-ordering-title"
          onClick={() => {
            if (!isReopeningOrdering) setReopenConfirmTable(null);
          }}
        >
          <div
            className="w-full max-w-sm sm:max-w-md rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181B] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="space-y-1">
                  <h3 id="reopen-ordering-title" className="text-base font-black text-zinc-900 dark:text-white leading-tight">
                    Reopen Ordering for Table {reopenConfirmTable.tableNumber || reopenConfirmTable.number || 'Table'}?
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Active Session: <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{reopenConfirmTable.currentTokenId || reopenConfirmTable.activeSession?.tokenNumber || 'Active'}</span>
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/[0.03] space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                <p>
                  This will unlock the customer portal, allowing guests to add items and place new orders.
                </p>
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                  Existing orders and bill history remain saved. Any active bill requests will be cleared.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setReopenConfirmTable(null)}
                  disabled={isReopeningOrdering}
                  className="px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-[#18181A] text-zinc-700 dark:text-zinc-300 font-extrabold text-xs hover:bg-zinc-100 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReopenOrdering}
                  disabled={isReopeningOrdering}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black font-black text-xs shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isReopeningOrdering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Reopening...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>Reopen</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 9. PRODUCT CUSTOMIZER MODAL (ASSISTED ORDERING ITEM CUSTOMIZATION)    */}
      {/* ==================================================================== */}
      {isCustomizerOpen && customizerTargetItem && (
        <ProductCustomizer
          item={customizerTargetItem}
          open={isCustomizerOpen}
          onClose={() => {
            setIsCustomizerOpen(false);
            setCustomizerTargetItem(null);
          }}
          onAddToCart={handleAddToCartFromCustomizer}
        />
      )}
    </div>
  );
};

export default WaiterStationPage;

