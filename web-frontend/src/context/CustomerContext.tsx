import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { joinRoom, onSocketEvent } from '../services/socket';

export interface CartItem {
  id: string;
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
}

export interface CustomerNotification {
  id: string;
  type:
    | 'stock_out_cart'
    | 'stock_out_order'
    | 'stock_in'
    | 'info'
    | 'order_placed'
    | 'order_status'
    | 'ordering_reopened'
    | 'session_extended'
    | 'service_request'
    | 'bill_status';
  title?: string;
  message: string;
  subMessage?: string;
  severity?: 'info' | 'success' | 'warning' | 'error' | 'primary';
  menuItemId?: string;
  itemName?: string;
  orderItemId?: string;
  orderNumber?: string | number;
  itemKey?: string;
  status?: string;
  previousStatus?: string;
  durationMs: number;
  remainingMs?: number;
  visibleStartedAt?: number;
  createdAt: number;
  dedupKey?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface CustomerContextType {
  tokenNumber: string | null;
  tableNumber: string | null;
  tableId: string | null;
  setSession: (tokenNumber: string, tableNumber?: string, tableId?: string) => void;
  menu: any[];
  categories: any[];
  promotions: any[];
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  activeOrders: any[];
  orderHistory: any[];
  isHistoryLoading: boolean;
  refreshOrderHistory: () => Promise<void>;
  activeRequests: any[];
  setActiveRequests: React.Dispatch<React.SetStateAction<any[]>>;
  refreshRequests: () => Promise<void>;
  sessionData: any | null;
  sessionError: string | null;
  refreshSession: () => Promise<void>;
  activeBill: any | null;
  billError: string | null;
  isLoading: boolean;
  isOrdering: boolean;
  placeOrder: () => Promise<any>;
  cancelOrderItem: (orderItemId: string) => Promise<any>;
  refreshOrders: () => Promise<void>;
  refreshBill: () => Promise<any>;
  requestBill: () => Promise<any>;
  isCallWaiterOpen: boolean;
  setIsCallWaiterOpen: (open: boolean) => void;
  tableStatus: string | null;
  refreshMenu: () => Promise<void>;
  isSessionClosed: boolean;
  logout: () => void;
  notifications: CustomerNotification[];
  activeNotification: CustomerNotification | null;
  dismissActiveNotification: () => void;
  showCustomerNotification: (notif: Omit<CustomerNotification, 'id' | 'createdAt'>) => void;
  dismissNotification: (id: string) => void;
  dismissMatchingNotifications: (predicate: (n: CustomerNotification) => boolean) => void;
}

const defaultCustomerContext: CustomerContextType = {
  tokenNumber: null,
  tableNumber: null,
  tableId: null,
  setSession: () => {},
  menu: [],
  categories: [],
  promotions: [],
  cart: [],
  addToCart: () => {},
  updateCartQuantity: () => {},
  removeFromCart: () => {},
  clearCart: () => {},
  cartTotal: 0,
  cartCount: 0,
  activeOrders: [],
  orderHistory: [],
  isHistoryLoading: false,
  refreshOrderHistory: async () => {},
  activeRequests: [],
  setActiveRequests: () => {},
  refreshRequests: async () => {},
  sessionData: null,
  sessionError: null,
  refreshSession: async () => {},
  activeBill: null,
  billError: null,
  isLoading: false,
  isOrdering: false,
  placeOrder: async () => null,
  cancelOrderItem: async () => null,
  refreshOrders: async () => {},
  refreshBill: async () => null,
  requestBill: async () => null,
  refreshMenu: async () => {},
  isCallWaiterOpen: false,
  setIsCallWaiterOpen: () => {},
  tableStatus: null,
  isSessionClosed: false,
  logout: () => {},
  notifications: [],
  activeNotification: null,
  dismissActiveNotification: () => {},
  showCustomerNotification: () => {},
  dismissNotification: () => {},
  dismissMatchingNotifications: () => {},
};

const CustomerContext = createContext<CustomerContextType>(defaultCustomerContext);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tokenNumber, setTokenNumberState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const match = path.match(/^\/(?:customer\/access|t)\/([A-Za-z0-9_-]+)/);
      if (match) return decodeURIComponent(match[1]);
      const params = new URLSearchParams(window.location.search);
      const qToken = params.get('token');
      if (qToken) return qToken;
      return localStorage.getItem('bar_active_token') || null;
    }
    return null;
  });

  const [tableNumber, setTableNumber] = useState<string | null>(() => {
    return typeof localStorage !== 'undefined' ? (localStorage.getItem('bar_active_table_num') || null) : null;
  });

  const [tableId, setTableId] = useState<string | null>(() => {
    return typeof localStorage !== 'undefined' ? (localStorage.getItem('bar_active_table_id') || null) : null;
  });

  const [tableStatus, setTableStatus] = useState<string | null>(null);

  const [menu, setMenu] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('bar_customer_cart');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice || 0),
          quantity: Number(item.quantity || 1),
        }));
      }
      return [];
    } catch {
      return [];
    }
  });

  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [activeBill, setActiveBill] = useState<any | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOrdering, setIsOrdering] = useState<boolean>(false);
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState<boolean>(false);
  const [isSessionClosed, setIsSessionClosed] = useState<boolean>(false);

  // Save cart
  useEffect(() => {
    localStorage.setItem('bar_customer_cart', JSON.stringify(cart));
  }, [cart]);

  const handleSessionClosure = useCallback(() => {
    setIsSessionClosed(true);
    setActiveNotification(null);
    notificationQueueRef.current = [];
    processedEventKeysRef.current.clear();
    setCart([]);
    setActiveOrders([]);
    setOrderHistory([]);
    setSessionData(null);
    setSessionError(null);
    try {
      localStorage.removeItem('bar_active_token');
      localStorage.removeItem('bar_customer_cart');
      localStorage.removeItem('bar_active_table_num');
      localStorage.removeItem('bar_active_table_id');
    } catch {}
    setTimeout(() => {
      window.location.assign('/customer/landing');
    }, 1500);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('bar_active_token');
      localStorage.removeItem('bar_customer_cart');
      localStorage.removeItem('bar_active_table_num');
      localStorage.removeItem('bar_active_table_id');
    } catch {}
    setActiveNotification(null);
    notificationQueueRef.current = [];
    processedEventKeysRef.current.clear();
    setSessionData(null);
    setSessionError(null);
    setCart([]);
    setActiveOrders([]);
    setOrderHistory([]);
    window.location.assign('/customer/landing');
  }, []);

  const setSession = (token: string, tableNum?: string, tblId?: string) => {
    setTokenNumberState(token);
    localStorage.setItem('bar_active_token', token);
    if (tableNum) {
      setTableNumber(tableNum);
      localStorage.setItem('bar_active_table_num', tableNum);
    }
    if (tblId) {
      setTableId(tblId);
      localStorage.setItem('bar_active_table_id', tblId);
    }
  };

  const NOTIFICATION_PROMOTION_GAP_MS = 20;

  const [activeNotification, setActiveNotification] = useState<CustomerNotification | null>(null);
  const [queuedNotifications, setQueuedNotifications] = useState<CustomerNotification[]>([]);
  const notificationQueueRef = useRef<CustomerNotification[]>([]);
  const activeNotifRef = useRef<CustomerNotification | null>(null);
  const promotionGapTimerRef = useRef<any>(null);
  const isPromotionGapActiveRef = useRef<boolean>(false);

  const availabilityMapRef = useRef<Map<string, boolean>>(new Map());
  const processedEventKeysRef = useRef<Map<string, number>>(new Map());
  const previousTableStatusRef = useRef<string | null>(null);

  // Session token change & unmount cleanup
  useEffect(() => {
    if (promotionGapTimerRef.current) {
      clearTimeout(promotionGapTimerRef.current);
      promotionGapTimerRef.current = null;
    }
    isPromotionGapActiveRef.current = false;
    activeNotifRef.current = null;
    setActiveNotification(null);
    notificationQueueRef.current = [];
    setQueuedNotifications([]);
    processedEventKeysRef.current.clear();

    return () => {
      if (promotionGapTimerRef.current) {
        clearTimeout(promotionGapTimerRef.current);
        promotionGapTimerRef.current = null;
      }
    };
  }, [tokenNumber]);

  const isEventDuplicate = useCallback((dedupKey: string, cooldownMs: number = 8000): boolean => {
    if (!dedupKey) return false;
    const now = Date.now();
    const lastTime = processedEventKeysRef.current.get(dedupKey);
    if (lastTime && now - lastTime < cooldownMs) {
      return true;
    }
    processedEventKeysRef.current.set(dedupKey, now);

    // Prune stale keys if map exceeds 200 items
    if (processedEventKeysRef.current.size > 200) {
      for (const [k, time] of processedEventKeysRef.current.entries()) {
        if (now - time > 60000) processedEventKeysRef.current.delete(k);
      }
    }
    return false;
  }, []);

  const dismissActiveNotification = useCallback(() => {
    // 1. Immediately clear the dismissed active notification from the screen
    activeNotifRef.current = null;
    setActiveNotification(null);

    // 2. Clear any pending promotion gap timer
    if (promotionGapTimerRef.current) {
      clearTimeout(promotionGapTimerRef.current);
      promotionGapTimerRef.current = null;
    }

    // 3. If there are pending notifications in queue, initiate the controlled 500ms breathing gap
    if (notificationQueueRef.current.length > 0) {
      isPromotionGapActiveRef.current = true;
      promotionGapTimerRef.current = setTimeout(() => {
        isPromotionGapActiveRef.current = false;
        promotionGapTimerRef.current = null;

        if (notificationQueueRef.current.length > 0) {
          // LIFO: pop newest notification from top of stack and initialize its fresh 3-second visible timer
          const nextNotif = notificationQueueRef.current.shift()!;
          const resumedNotif: CustomerNotification = {
            ...nextNotif,
            visibleStartedAt: Date.now(),
            remainingMs: nextNotif.durationMs || 3000,
          };
          activeNotifRef.current = resumedNotif;
          setActiveNotification(resumedNotif);
          setQueuedNotifications([...notificationQueueRef.current]);
        } else {
          activeNotifRef.current = null;
          setActiveNotification(null);
          setQueuedNotifications([]);
        }
      }, NOTIFICATION_PROMOTION_GAP_MS);
    } else {
      isPromotionGapActiveRef.current = false;
      setQueuedNotifications([]);
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    if (!id) return;
    if (activeNotifRef.current?.id === id) {
      dismissActiveNotification();
    } else {
      notificationQueueRef.current = notificationQueueRef.current.filter((n) => n && n.id !== id);
      setQueuedNotifications([...notificationQueueRef.current]);
    }
  }, [dismissActiveNotification]);

  const dismissMatchingNotifications = useCallback(
    (predicate: (n: CustomerNotification) => boolean) => {
      if (notificationQueueRef.current.length > 0) {
        notificationQueueRef.current = notificationQueueRef.current.filter((n) => n && !predicate(n));
        setQueuedNotifications([...notificationQueueRef.current]);
      }
      if (activeNotifRef.current && predicate(activeNotifRef.current)) {
        dismissActiveNotification();
      }
    },
    [dismissActiveNotification]
  );

  const showCustomerNotification = useCallback(
    (notif: Omit<CustomerNotification, 'id' | 'createdAt' | 'remainingMs'>) => {
      if (!notif) return;
      if (notif.dedupKey && isEventDuplicate(notif.dedupKey, 8000)) {
        return;
      }
      const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const duration = notif.durationMs || 3000;
      const now = Date.now();
      const fullNotif: CustomerNotification = {
        ...notif,
        id,
        createdAt: now,
        durationMs: duration,
        remainingMs: duration,
        visibleStartedAt: now,
      };

      if (!activeNotifRef.current && !isPromotionGapActiveRef.current) {
        // No popup currently visible on screen and no breathing gap active: promote immediately as active
        activeNotifRef.current = fullNotif;
        setActiveNotification(fullNotif);
        setQueuedNotifications([...notificationQueueRef.current]);
      } else {
        // Active popup is currently visible OR post-dismissal breathing gap is in progress:
        // DO NOT overwrite active popup, restart its timer, or interrupt the 500ms breathing gap!
        const currentActive = activeNotifRef.current;

        // If active popup is for the EXACT SAME item and already displaying this identical status, do not queue redundant duplicate
        if (currentActive) {
          const isSameItemAsActive =
            (fullNotif.orderItemId && currentActive.orderItemId === fullNotif.orderItemId) ||
            (fullNotif.itemKey && currentActive.itemKey === fullNotif.itemKey);

          if (isSameItemAsActive && currentActive.status === fullNotif.status && currentActive.type === fullNotif.type) {
            return;
          }
        }

        // Evict any older stale waiting notifications for the SAME order item / itemKey from the queue
        const filteredQueue = notificationQueueRef.current.filter((n) => {
          if (!n) return false;
          if (fullNotif.orderItemId && n.orderItemId === fullNotif.orderItemId) return false;
          if (fullNotif.itemKey && n.itemKey === fullNotif.itemKey) return false;
          if (fullNotif.dedupKey && n.dedupKey === fullNotif.dedupKey) return false;
          return true;
        });

        // Insert latest authoritative notification at FRONT of LIFO queue
        const updatedQueue = [fullNotif, ...filteredQueue].slice(0, 10);
        notificationQueueRef.current = updatedQueue;
        setQueuedNotifications(updatedQueue);

        // If in breathing gap and no gap timer is active for any reason, trigger promotion timer
        if (isPromotionGapActiveRef.current && !promotionGapTimerRef.current) {
          promotionGapTimerRef.current = setTimeout(() => {
            isPromotionGapActiveRef.current = false;
            promotionGapTimerRef.current = null;
            if (notificationQueueRef.current.length > 0) {
              const nextNotif = notificationQueueRef.current.shift()!;
              const resumedNotif: CustomerNotification = {
                ...nextNotif,
                visibleStartedAt: Date.now(),
                remainingMs: nextNotif.durationMs || 3000,
              };
              activeNotifRef.current = resumedNotif;
              setActiveNotification(resumedNotif);
              setQueuedNotifications([...notificationQueueRef.current]);
            }
          }, NOTIFICATION_PROMOTION_GAP_MS);
        }
      }
    },
    [isEventDuplicate]
  );

  const refreshMenu = useCallback(async () => {
    try {
      const [menuData, catData, promoData] = await Promise.all([
        api.getMenu(false),
        api.getCategories(),
        api.getPromotions(),
      ]);
      setMenu(menuData);
      setCategories(catData);
      setPromotions(promoData);

      if (Array.isArray(menuData)) {
        for (const sec of menuData) {
          for (const item of sec.items || []) {
            if (item.id) {
              availabilityMapRef.current.set(item.id, item.isAvailable !== false);
            }
          }
          for (const cat of sec.categories || []) {
            for (const item of cat.items || []) {
              if (item.id) {
                availabilityMapRef.current.set(item.id, item.isAvailable !== false);
              }
            }
            for (const sub of cat.subcategories || []) {
              for (const item of sub.items || []) {
                if (item.id) {
                  availabilityMapRef.current.set(item.id, item.isAvailable !== false);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load menu catalog:', err);
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    if (!tokenNumber) return;
    try {
      const orders = await api.getActiveOrders(tokenNumber);
      setActiveOrders(Array.isArray(orders) ? orders : []);
    } catch (err) {
      console.warn('Failed to load active orders:', err);
    }
  }, [tokenNumber]);

  const refreshOrderHistory = useCallback(async () => {
    if (!tokenNumber) {
      setOrderHistory([]);
      return;
    }
    setIsHistoryLoading(true);
    try {
      const history = await api.getCustomerOrderHistory(tokenNumber);
      setOrderHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      console.warn('Failed to load customer order history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [tokenNumber]);

  const refreshBill = useCallback(async () => {
    if (!tokenNumber) return null;
    try {
      setBillError(null);
      const billData = await api.calculateBill(tokenNumber);
      if (billData && billData.bill) {
        setActiveBill(billData.bill);
        return billData.bill;
      }
    } catch (err: any) {
      console.warn('Failed to calculate bill:', err);
      setBillError(err?.message || 'Failed to calculate table bill');
    }
    return null;
  }, [tokenNumber]);

  const cancelOrderItem = useCallback(async (orderItemId: string) => {
    if (!tokenNumber) return;
    try {
      await api.cancelOrderItem(orderItemId, tokenNumber);
      await Promise.all([
        refreshOrders(),
        refreshBill(),
        refreshOrderHistory(),
      ]);
    } catch (err: any) {
      console.warn('Failed to cancel order item:', err);
      throw err;
    }
  }, [tokenNumber, refreshOrders, refreshBill, refreshOrderHistory]);

  const refreshRequests = useCallback(async () => {
    if (!tokenNumber) return;
    try {
      const requests = await api.getActiveServiceRequests(tokenNumber);
      setActiveRequests(requests);
    } catch (err) {
      console.warn('Failed to load active service requests:', err);
    }
  }, [tokenNumber]);

  const requestBill = useCallback(async () => {
    if (!tokenNumber) return null;
    try {
      setBillError(null);
      const res = await api.requestBill(tokenNumber);
      if (res && res.bill) {
        setActiveBill(res.calculated || res.bill);
      }
      await refreshRequests();
      return res;
    } catch (err: any) {
      console.warn('Failed to submit bill request:', err);
      setBillError(err?.message || 'Failed to request table bill');
      throw err;
    }
  }, [tokenNumber, refreshRequests]);

  const refreshSession = useCallback(async () => {
    if (!tokenNumber) {
      setSessionData(null);
      setTableStatus(null);
      return;
    }
    try {
      setSessionError(null);
      const res = await api.validateCustomerAccess(tokenNumber);
      if (res && res.authorized && res.session) {
        setSessionData(res.session);
        setTableStatus(res.session.tableStatus || (res.session as any).table?.status || null);
        if (res.session.tableNumber) {
          setTableNumber(res.session.tableNumber);
          try {
            localStorage.setItem('bar_active_table_num', res.session.tableNumber);
          } catch {}
        }
        if (res.session.tableId) {
          setTableId(res.session.tableId);
          try {
            localStorage.setItem('bar_active_table_id', res.session.tableId);
          } catch {}
        }
      } else if (res && res.sessionStatus === 'CLOSED') {
        handleSessionClosure();
      } else if (res && res.paymentStatus === 'UNVERIFIED') {
        setSessionError('Payment is not received. Please contact the receptionist to complete your registration.');
      } else if (res && (res as any).error) {
        setSessionError((res as any).error);
      }
    } catch (err: any) {
      console.warn('Failed to validate customer session:', err);
      setSessionError(err?.message || 'Failed to retrieve dining session details.');
    }
  }, [tokenNumber]);

  // Initial Data Load
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    Promise.all([
      refreshMenu(),
      refreshOrders(),
      refreshOrderHistory(),
      refreshBill(),
      refreshRequests(),
      refreshSession(),
    ]).finally(() => {
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [refreshMenu, refreshOrders, refreshOrderHistory, refreshBill, refreshRequests, refreshSession]);

  // Real-Time Socket Room & Event Subscriptions
  useEffect(() => {
    if (!tokenNumber) return;

    // Join isolated customer room
    joinRoom(`customer:token:${tokenNumber}`);
    if (tableId) {
      joinRoom(`table:${tableId}`);
    }

    const unsubOrderCreated = onSocketEvent('order.created', (data: any) => {
      if (data && (data.tokenNumber === tokenNumber || data.tokenId === tokenNumber)) {
        const orderNum = data.orderNumber ? `#${data.orderNumber}` : '';
        const dedupKey = `order_created_${data.orderId || data.orderNumber || tokenNumber}`;
        const itemsCount = Array.isArray(data.items) ? data.items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0) : 0;
        showCustomerNotification({
          type: 'order_placed',
          title: `Order ${orderNum} Placed`.trim(),
          message: itemsCount > 0
            ? `Your order of ${itemsCount} item${itemsCount > 1 ? 's' : ''} was sent to the kitchen/bar.`
            : 'Your order was sent to the kitchen/bar.',
          actionLabel: 'View Order →',
          severity: 'success',
          durationMs: 3000,
          dedupKey,
        });
        refreshOrders();
        refreshOrderHistory();
        refreshBill();
      }
    });

    const unsubItemUpdated = onSocketEvent('order.item.updated', (data: any) => {
      if (
        data &&
        (data.tokenNumber === tokenNumber ||
          data.tokenId === tokenNumber ||
          (tableId && (data.tableId === tableId || data.tableNumber === tableNumber)) ||
          (sessionData && (data.tokenId === sessionData.id || data.tokenNumber === sessionData.tokenNumber)))
      ) {
        const itemDisplayName = data.itemName || 'This item';
        const orderNum = data.orderNumber ? `#${data.orderNumber}` : '';
        const status = data.status;
        const prevStatus = data.previousStatus;
        const itemId = data.orderItemId || data.id || 'item';
        const itemKey = `${tokenNumber || 'session'}_${data.orderId || ''}_${itemId}`;
        const stationLabel = data.station === 'BAR' ? 'Bar' : 'Kitchen';
        const updatedAtSuffix = data.updatedAt ? `_${data.updatedAt}` : '';
        const dedupKey = `item_status_${itemId}_${prevStatus || 'NONE'}_TO_${status}${updatedAtSuffix}`;

        if (status === 'STOCK_OUT') {
          showCustomerNotification({
            type: 'stock_out_order',
            title: 'Item Unavailable',
            message: `${itemDisplayName} is out of stock and was removed from order ${orderNum}. You will not be charged for it.`.trim(),
            menuItemId: data.menuItemId,
            itemName: itemDisplayName,
            orderItemId: itemId,
            orderNumber: orderNum,
            itemKey,
            status,
            previousStatus: prevStatus,
            severity: 'error',
            durationMs: 3000,
            dedupKey,
          });
        } else if (status === 'CANCELLED') {
          showCustomerNotification({
            type: 'order_status',
            title: 'Item Cancelled',
            message: `${itemDisplayName} in order ${orderNum} was cancelled. You will not be charged.`.trim(),
            menuItemId: data.menuItemId,
            itemName: itemDisplayName,
            orderItemId: itemId,
            orderNumber: orderNum,
            itemKey,
            status,
            previousStatus: prevStatus,
            severity: 'error',
            durationMs: 3000,
            dedupKey,
          });
        } else if (status === 'ACCEPTED') {
          if (prevStatus === 'PREPARING' || prevStatus === 'READY') {
            // Revert: PREPARING -> ACCEPTED
            const revertDedupKey = `item_status_${itemId}_REVERT_${prevStatus}_TO_ACCEPTED${updatedAtSuffix}`;
            showCustomerNotification({
              type: 'order_status',
              title: `Order Updated: ${itemDisplayName}`,
              message: `Sorry, your ${itemDisplayName} was moved back to the accepted stage and is waiting to be started again.`,
              actionLabel: 'View Order →',
              menuItemId: data.menuItemId,
              itemName: itemDisplayName,
              orderItemId: itemId,
              orderNumber: orderNum,
              itemKey,
              status,
              previousStatus: prevStatus,
              severity: 'warning',
              durationMs: 3000,
              dedupKey: revertDedupKey,
            });
          } else if (prevStatus !== 'ACCEPTED') {
            // Forward: PLACED -> ACCEPTED
            showCustomerNotification({
              type: 'order_status',
              title: `Order ${orderNum} Accepted`.trim(),
              message: `${itemDisplayName} was accepted by the ${stationLabel}.`,
              actionLabel: 'View Order →',
              menuItemId: data.menuItemId,
              itemName: itemDisplayName,
              orderItemId: itemId,
              orderNumber: orderNum,
              itemKey,
              status,
              previousStatus: prevStatus,
              severity: 'info',
              durationMs: 3000,
              dedupKey,
            });
          }
        } else if (status === 'PREPARING') {
          if (prevStatus === 'READY' || prevStatus === 'SERVED') {
            // Revert: READY -> PREPARING
            const revertDedupKey = `item_status_${itemId}_REVERT_${prevStatus}_TO_PREPARING${updatedAtSuffix}`;
            showCustomerNotification({
              type: 'order_status',
              title: `Order Updated: ${itemDisplayName}`,
              message: `Sorry, your ${itemDisplayName} was moved back to preparation.`,
              actionLabel: 'View Order →',
              menuItemId: data.menuItemId,
              itemName: itemDisplayName,
              orderItemId: itemId,
              orderNumber: orderNum,
              itemKey,
              status,
              previousStatus: prevStatus,
              severity: 'warning',
              durationMs: 3000,
              dedupKey: revertDedupKey,
            });
          } else if (prevStatus !== 'PREPARING') {
            // Forward: ACCEPTED -> PREPARING
            showCustomerNotification({
              type: 'order_status',
              title: `Preparing: ${itemDisplayName}`,
              message: `Order ${orderNum} is now being prepared in the ${stationLabel}.`.trim(),
              actionLabel: 'View Order →',
              menuItemId: data.menuItemId,
              itemName: itemDisplayName,
              orderItemId: itemId,
              orderNumber: orderNum,
              itemKey,
              status,
              previousStatus: prevStatus,
              severity: 'warning',
              durationMs: 3000,
              dedupKey,
            });
          }
        } else if (status === 'READY') {
          if (prevStatus === 'SERVED') {
            // Revert / Undo Serve: SERVED -> READY
            const revertDedupKey = `item_status_${itemId}_UNDO_SERVED_TO_READY${updatedAtSuffix}`;
            showCustomerNotification({
              type: 'order_status',
              title: `Ready to Serve: ${itemDisplayName}`,
              message: `Order ${orderNum} was marked back to ready.`,
              actionLabel: 'View Order →',
              menuItemId: data.menuItemId,
              itemName: itemDisplayName,
              orderItemId: itemId,
              orderNumber: orderNum,
              itemKey,
              status,
              previousStatus: prevStatus,
              severity: 'info',
              durationMs: 3000,
              dedupKey: revertDedupKey,
            });
          } else if (prevStatus !== 'READY') {
            // Forward: PREPARING -> READY
            showCustomerNotification({
              type: 'order_status',
              title: `Ready to Serve: ${itemDisplayName}`,
              message: `Order ${orderNum} is ready and will be served to your table shortly.`.trim(),
              actionLabel: 'View Order →',
              menuItemId: data.menuItemId,
              itemName: itemDisplayName,
              orderItemId: itemId,
              orderNumber: orderNum,
              itemKey,
              status,
              previousStatus: prevStatus,
              severity: 'success',
              durationMs: 3000,
              dedupKey,
            });
          }
        } else if (status === 'SERVED' && prevStatus !== 'SERVED') {
          // Forward: READY -> SERVED
          showCustomerNotification({
            type: 'order_status',
            title: `Served: ${itemDisplayName}`,
            message: `Enjoy your ${itemDisplayName}!`,
            menuItemId: data.menuItemId,
            itemName: itemDisplayName,
            orderItemId: itemId,
            orderNumber: orderNum,
            itemKey,
            status,
            previousStatus: prevStatus,
            severity: 'primary',
            durationMs: 3000,
            dedupKey,
          });
        } else if (status === 'PLACED' && (prevStatus === 'ACCEPTED' || prevStatus === 'PREPARING' || prevStatus === 'READY')) {
          // Revert: ACCEPTED -> PLACED
          const revertDedupKey = `item_status_${itemId}_REVERT_${prevStatus}_TO_PLACED${updatedAtSuffix}`;
          showCustomerNotification({
            type: 'order_status',
            title: `Order Waiting: ${itemDisplayName}`,
            message: `Sorry, ${itemDisplayName} is back in the waiting queue.`,
            actionLabel: 'View Order →',
            menuItemId: data.menuItemId,
            itemName: itemDisplayName,
            orderItemId: itemId,
            orderNumber: orderNum,
            itemKey,
            status,
            previousStatus: prevStatus,
            severity: 'warning',
            durationMs: 3000,
            dedupKey: revertDedupKey,
          });
        }

        try {
          refreshOrders();
          refreshOrderHistory();
          refreshBill();
        } catch (rErr) {
          console.warn('Silent refresh error after item update:', rErr);
        }
      }
    });

    const unsubReqCreated = onSocketEvent('service_request.created', (data: any) => {
      if (data && (data.tokenNumber === tokenNumber || data.tokenId === tokenNumber)) {
        setActiveRequests((prev) => [data, ...prev.filter((r) => r.id !== data.id)]);
      }
    });

    const unsubReqUpdated = onSocketEvent('service_request.updated', (data: any) => {
      if (data && (data.tokenNumber === tokenNumber || data.tokenId === tokenNumber)) {
        if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
          setActiveRequests((prev) => prev.filter((r) => r.id !== data.id));
        } else {
          setActiveRequests((prev) =>
            prev.map((r) => (r.id === data.id ? { ...r, ...data } : r))
          );

          if (data.status === 'ACKNOWLEDGED' || data.status === 'IN_PROGRESS') {
            const staffName = data.assignedStaffName || data.assignedStaff?.fullName || data.assignedStaff?.username;
            const dedupKey = `service_req_ack_${data.id}_${data.status}`;
            const message = staffName && typeof staffName === 'string' && staffName.trim().length > 0 && !staffName.toLowerCase().includes('waiter')
              ? `${staffName} has acknowledged your request and is coming to assist you.`
              : 'Your waiter has acknowledged your request and is coming to assist you.';
            showCustomerNotification({
              type: 'service_request',
              title: 'Request Acknowledged',
              message,
              severity: 'info',
              durationMs: 3000,
              dedupKey,
            });
          }
        }
      }
    });

    const unsubTableUpdated = onSocketEvent('table.updated', (data: any) => {
      if (
        data &&
        (data.id === tableId ||
          data.tableId === tableId ||
          data.tableNumber === tableNumber ||
          data.number === tableNumber ||
          data.tokenNumber === tokenNumber ||
          data.currentTokenNumber === tokenNumber ||
          data.currentTokenId === tokenNumber ||
          (sessionData && (data.tableId === sessionData.tableId || data.id === sessionData.tableId || data.currentTokenId === sessionData.id)))
      ) {
        const newStatus = data.status || null;
        const prevStatus = previousTableStatusRef.current;
        previousTableStatusRef.current = newStatus;

        // Detect Reopen Ordering transition: BILL_REQUESTED -> occupied
        if (prevStatus === 'BILL_REQUESTED' && (newStatus === 'occupied' || newStatus === 'ACTIVE')) {
          const dedupKey = `ordering_reopened_${tokenNumber}`;
          showCustomerNotification({
            type: 'ordering_reopened',
            title: 'Ordering Reopened',
            message: 'Your waiter has reopened ordering for this session. You can now add more items.',
            actionLabel: 'Order More →',
            severity: 'success',
            durationMs: 3000,
            dedupKey,
          });
        } else if (prevStatus === 'occupied' && newStatus === 'BILL_REQUESTED') {
          const dedupKey = `bill_requested_${tokenNumber}`;
          showCustomerNotification({
            type: 'bill_status',
            title: 'Bill Requested',
            message: 'A bill request was submitted for your table. Ordering is now closed.',
            severity: 'warning',
            durationMs: 3000,
            dedupKey,
          });
        }

        setTableStatus(newStatus);
        refreshBill();
        refreshRequests();
      }
    });

    const unsubBillUpdated = onSocketEvent('bill.updated', (data: any) => {
      if (
        data &&
        (data.tokenNumber === tokenNumber ||
          data.tokenId === tokenNumber ||
          (sessionData && (data.tokenId === sessionData.id || data.tokenNumber === sessionData.tokenNumber)))
      ) {
        if (data.status === 'PAID') {
          handleSessionClosure();
        } else {
          if (data.status === 'REQUESTED') {
            const prevStatus = previousTableStatusRef.current;
            if (prevStatus === 'occupied') {
              const dedupKey = `bill_requested_${tokenNumber}`;
              showCustomerNotification({
                type: 'bill_status',
                title: 'Bill Requested',
                message: 'A bill request was submitted for your table. Ordering is now closed.',
                severity: 'warning',
                durationMs: 3000,
                dedupKey,
              });
            }
            previousTableStatusRef.current = 'BILL_REQUESTED';
            setTableStatus('BILL_REQUESTED');
          } else if (data.status === 'DRAFT') {
            const prevStatus = previousTableStatusRef.current;
            if (prevStatus === 'BILL_REQUESTED') {
              previousTableStatusRef.current = 'occupied';
              const dedupKey = `ordering_reopened_${tokenNumber}`;
              showCustomerNotification({
                type: 'ordering_reopened',
                title: 'Ordering Reopened',
                message: 'Your waiter has reopened ordering for this session. You can now add more items.',
                actionLabel: 'Order More →',
                severity: 'success',
                durationMs: 3000,
                dedupKey,
              });
            }
            setTableStatus((prev) => (prev === 'BILL_REQUESTED' ? 'occupied' : prev));
          }
          refreshBill();
          refreshRequests();
        }
      }
    });

    const unsubSessionUpdated = onSocketEvent('session.updated', (data: any) => {
      if (
        data &&
        (data.tokenNumber === tokenNumber ||
          data.tokenId === tokenNumber ||
          (sessionData && (data.tokenId === sessionData.id || data.tokenNumber === sessionData.tokenNumber)))
      ) {
        if (data.status === 'CLOSED' || data.status === 'CANCELLED') {
          handleSessionClosure();
        } else {
          if (data.endTime) {
            const newEndTimeMs = new Date(data.endTime).getTime();
            const prevEndTimeMs = sessionData?.endTime ? new Date(sessionData.endTime).getTime() : null;

            if (prevEndTimeMs && newEndTimeMs > prevEndTimeMs) {
              // 1. Authoritative extension completed: Cleanly remove any stale/matching extension notifications from queue & screen
              dismissMatchingNotifications((n) => n.type === 'session_extended');

              const dedupKey = `session_extended_${tokenNumber}_${data.endTime}`;
              const timeFormatted = new Date(data.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isComp = data.isComplimentary === true || Number(data.additionalAmount || 0) === 0;
              showCustomerNotification({
                type: 'session_extended',
                title: isComp ? 'Complimentary Extension' : 'Session Extended',
                message: `Your dining session has been extended until ${timeFormatted}.`,
                severity: 'primary',
                durationMs: 3000,
                dedupKey,
              });
            } else if (data.status === 'EXTENDED') {
              // Ensure stale extension notifications are dismissed if extension marked without endTime diff
              dismissMatchingNotifications((n) => n.type === 'session_extended');
            }

            setSessionData((prev: any) => {
              if (!prev) return prev;
              return {
                ...prev,
                endTime: data.endTime,
                status: data.status || prev.status,
                totalRedemptionsAllowed: data.totalRedemptionsAllowed ?? prev.totalRedemptionsAllowed,
                session: prev.session
                  ? {
                      ...prev.session,
                      endTime: data.endTime,
                      status: data.status || prev.session.status,
                      totalRedemptionsAllowed: data.totalRedemptionsAllowed ?? prev.session.totalRedemptionsAllowed,
                    }
                  : prev.session,
              };
            });
          }
          refreshBill();
        }
      }
    });

    const unsubSessionClosed = onSocketEvent('table.session.closed', (data: any) => {
      if (data && (data.tokenNumber === tokenNumber || data.tableNumber === tableNumber)) {
        handleSessionClosure();
      }
    });

    const unsubMenuUpdated = onSocketEvent('menu.updated', (payload: any) => {
      if (payload && (payload.action === 'item_availability' || payload.action === 'stock_changed') && payload.itemId) {
        const targetId = payload.itemId;
        const details = payload.details || {};
        const newAvailable = details.isAvailable !== undefined ? Boolean(details.isAvailable) : true;
        const newStock = details.currentStock ?? details.stockQuantity;
        const newAvailStock = details.availableStock;
        const newReservedStock = details.reservedStock;
        const itemName = details.name || '';
        const prevStatus = availabilityMapRef.current.get(targetId);
        availabilityMapRef.current.set(targetId, newAvailable);

        // Case 1: Physical Stock Out or Manual 86
        // Only evict from cart if:
        // a) The item was manually marked unavailable (!newAvailable), OR
        // b) Physical currentStock is explicitly 0 (newStock !== undefined && newStock <= 0)
        // DO NOT evict if availableStock === 0 due to active reservation while physical stock > 0!
        const isPhysicalStockZero = newStock !== undefined && Number(newStock) <= 0;
        const isManualStockOut = !newAvailable;

        if (isManualStockOut || isPhysicalStockZero) {
          setCart((prevCart) => {
            const hasItem = prevCart.some((ci) => ci.menuItemId === targetId);
            if (hasItem) {
              const removedItem = prevCart.find((ci) => ci.menuItemId === targetId);
              const displayName = removedItem?.name || itemName || 'This item';
              showCustomerNotification({
                type: 'stock_out_cart',
                message: `${displayName} is out of stock and was removed from your cart.`,
                menuItemId: targetId,
                itemName: displayName,
                durationMs: 3000,
              });
              return prevCart.filter((ci) => ci.menuItemId !== targetId);
            }
            return prevCart;
          });
        }

        // Case 2: Stock In (genuine transition: prevStatus === false -> newAvailable === true)
        if (newAvailable && prevStatus === false && (newStock === undefined || Number(newStock) > 0)) {
          const displayName = itemName || 'An item';
          const dedupKey = `stock_in_${targetId}_${Date.now()}`;
          showCustomerNotification({
            type: 'stock_in',
            message: `${displayName} is available again. Tap to view.`,
            menuItemId: targetId,
            itemName: displayName,
            durationMs: 3000,
            dedupKey,
          });
        }

        let itemExists = false;
        setMenu((prevMenu) => {
          if (!Array.isArray(prevMenu)) return prevMenu;
          const updated = prevMenu.map((section: any) => {
            const newItems = (section.items || []).map((it: any) => {
              if (it.id === targetId) {
                itemExists = true;
                return {
                  ...it,
                  isAvailable: newAvailable,
                  stockQuantity: newStock ?? it.stockQuantity,
                  availableStock: newAvailStock ?? it.availableStock,
                  reservedStock: newReservedStock ?? it.reservedStock,
                };
              }
              return it;
            });

            const newCategories = (section.categories || []).map((cat: any) => {
              const newCatItems = (cat.items || []).map((it: any) => {
                if (it.id === targetId) {
                  itemExists = true;
                  return {
                    ...it,
                    isAvailable: newAvailable,
                    stockQuantity: newStock ?? it.stockQuantity,
                    availableStock: newAvailStock ?? it.availableStock,
                    reservedStock: newReservedStock ?? it.reservedStock,
                  };
                }
                return it;
              });

              const newSubcats = (cat.subcategories || []).map((sub: any) => {
                const newSubItems = (sub.items || []).map((it: any) => {
                  if (it.id === targetId) {
                    itemExists = true;
                    return {
                      ...it,
                      isAvailable: newAvailable,
                      stockQuantity: newStock ?? it.stockQuantity,
                      availableStock: newAvailStock ?? it.availableStock,
                      reservedStock: newReservedStock ?? it.reservedStock,
                    };
                  }
                  return it;
                });
                return { ...sub, items: newSubItems };
              });

              return { ...cat, items: newCatItems, subcategories: newSubcats };
            });

            return { ...section, items: newItems, categories: newCategories };
          });

          // If the product was newly stocked-in but was not present in menu (e.g. filtered on initial load), refresh full catalog
          if (newAvailable && !itemExists) {
            setTimeout(() => refreshMenu(), 0);
          }

          return updated;
        });
      } else {
        refreshMenu();
      }
    });

    return () => {
      unsubOrderCreated();
      unsubItemUpdated();
      unsubReqCreated();
      unsubReqUpdated();
      unsubTableUpdated();
      unsubBillUpdated();
      unsubSessionUpdated();
      unsubSessionClosed();
      unsubMenuUpdated();
    };
  }, [tokenNumber, tableNumber, tableId, refreshOrders, refreshBill, refreshMenu, handleSessionClosure]);

  // Helper to find item inside menu sections tree
  const findMenuItemInMenu = useCallback(
    (itemId: string, menuList: any[] = menu): any | null => {
      if (!Array.isArray(menuList)) return null;
      for (const section of menuList) {
        if (section.items) {
          const it = section.items.find((i: any) => i.id === itemId);
          if (it) return it;
        }
        if (section.categories) {
          for (const cat of section.categories) {
            if (cat.items) {
              const it = cat.items.find((i: any) => i.id === itemId);
              if (it) return it;
            }
            if (cat.subcategories) {
              for (const sub of cat.subcategories) {
                if (sub.items) {
                  const it = sub.items.find((i: any) => i.id === itemId);
                  if (it) return it;
                }
              }
            }
          }
        }
      }
      return null;
    },
    [menu]
  );

  const reservedItemsRef = useRef<Map<string, number>>(new Map());

  // Sync Cart Stock Reservations in Background with complete lifecycle tracking
  useEffect(() => {
    if (!tokenNumber) return;

    if (cart.length === 0) {
      if (reservedItemsRef.current.size > 0) {
        api.clearCartReservations(tokenNumber).catch(() => {});
        reservedItemsRef.current.clear();
      }
      return;
    }

    const itemQuantities = new Map<string, number>();
    for (const ci of cart) {
      itemQuantities.set(ci.menuItemId, (itemQuantities.get(ci.menuItemId) || 0) + (ci.quantity || 1));
    }

    // Explicitly release reservations for items removed from cart
    for (const [prevItemId] of reservedItemsRef.current.entries()) {
      if (!itemQuantities.has(prevItemId)) {
        api.releaseCartStock(tokenNumber, prevItemId).catch(() => {});
        reservedItemsRef.current.delete(prevItemId);
      }
    }

    // Sync current items whose quantity changed
    itemQuantities.forEach((qty, menuItemId) => {
      const prevQty = reservedItemsRef.current.get(menuItemId);
      if (prevQty === qty) return;

      api.reserveCartStock(tokenNumber, menuItemId, qty)
        .then((res: any) => {
          if (res && res.success === false) {
            const maxAvail = res.availableForToken !== undefined
              ? Number(res.availableForToken)
              : (res.availableStock !== undefined ? Number(res.availableStock) : 0);

            // Roll back / clamp cart to actual available stock if exceeded
            setCart((prevCart) => {
              const currentTotal = prevCart
                .filter((ci) => ci.menuItemId === menuItemId)
                .reduce((sum, ci) => sum + (ci.quantity || 1), 0);

              if (currentTotal > maxAvail) {
                showCustomerNotification({
                  type: 'stock_out_cart',
                  message: res.message || (maxAvail > 0 ? `Only ${maxAvail} units available in stock.` : 'Item is currently reserved by other customers.'),
                  menuItemId,
                  durationMs: 3000,
                });

                if (maxAvail <= 0) {
                  reservedItemsRef.current.delete(menuItemId);
                  return prevCart.filter((ci) => ci.menuItemId !== menuItemId);
                }

                let remainingAllowed = maxAvail;
                reservedItemsRef.current.set(menuItemId, maxAvail);
                return prevCart
                  .map((ci) => {
                    if (ci.menuItemId !== menuItemId) return ci;
                    if (remainingAllowed <= 0) return null;
                    const itemQty = ci.quantity || 1;
                    const clampedQty = Math.min(itemQty, remainingAllowed);
                    remainingAllowed -= clampedQty;
                    return { ...ci, quantity: clampedQty };
                  })
                  .filter(Boolean) as CartItem[];
              }
              return prevCart;
            });
          } else if (res && res.success === true) {
            reservedItemsRef.current.set(menuItemId, qty);
          }
        })
        .catch(() => {});
    });
  }, [cart, tokenNumber]);

  // Cart Handlers
  const areCartItemsEqual = (
    a: { menuItemId: string; variantId?: string | null; modifiers?: any[]; specialInstructions?: string },
    b: { menuItemId: string; variantId?: string | null; modifiers?: any[]; specialInstructions?: string }
  ): boolean => {
    if (a.menuItemId !== b.menuItemId) return false;
    if ((a.variantId || null) !== (b.variantId || null)) return false;
    if ((a.specialInstructions || '').trim().toLowerCase() !== (b.specialInstructions || '').trim().toLowerCase()) return false;

    const aMods = (a.modifiers || [])
      .map((m: any) => `${m.groupId || ''}:${m.optionId || ''}`)
      .sort()
      .join('|');
    const bMods = (b.modifiers || [])
      .map((m: any) => `${m.groupId || ''}:${m.optionId || ''}`)
      .sort()
      .join('|');

    return aMods === bMods;
  };

  const addToCart = (item: Omit<CartItem, 'id'>) => {
    const itemInMenu = findMenuItemInMenu(item.menuItemId);
    const isManualAvailable = itemInMenu?.isAvailable !== false;
    const physicalStock = itemInMenu?.stockQuantity !== undefined ? Number(itemInMenu.stockQuantity) : 50;
    const rawAvailable = itemInMenu?.availableStock !== undefined ? Number(itemInMenu.availableStock) : physicalStock;
    const currentTotalInCart = cart
      .filter((ci) => ci.menuItemId === item.menuItemId)
      .reduce((sum, ci) => sum + (Number(ci.quantity) || 1), 0);

    const maxAllowedForCustomer = isManualAvailable ? Math.min(physicalStock, rawAvailable + currentTotalInCart) : 0;
    const qtyToAdd = Number(item.quantity) || 1;

    if (!isManualAvailable || physicalStock <= 0) {
      showCustomerNotification({
        type: 'stock_out_cart',
        message: `${item.name || 'Item'} is currently out of stock.`,
        menuItemId: item.menuItemId,
        itemName: item.name,
        durationMs: 3000,
      });
      return;
    }

    if (currentTotalInCart + qtyToAdd > maxAllowedForCustomer) {
      const allowedDelta = Math.max(0, maxAllowedForCustomer - currentTotalInCart);
      showCustomerNotification({
        type: 'stock_out_cart',
        message: allowedDelta > 0
          ? `Only ${allowedDelta} more available in stock.`
          : `Maximum stock (${maxAllowedForCustomer}) already in your cart.`,
        menuItemId: item.menuItemId,
        itemName: item.name,
        durationMs: 3000,
      });
      if (allowedDelta <= 0) return;
      item = { ...item, quantity: allowedDelta };
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((ci) => areCartItemsEqual(ci, item));
      if (existingIndex > -1) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated[existingIndex] = {
          ...existing,
          quantity: (existing.quantity || 1) + (item.quantity || 1),
          unitPrice: Number(item.unitPrice || existing.unitPrice || 0),
        };
        return updated;
      }

      const id = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      return [
        ...prev,
        {
          ...item,
          id,
          unitPrice: Number(item.unitPrice || 0),
          quantity: Number(item.quantity || 1),
        },
      ];
    });
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      const targetItem = prev.find((ci) => ci.id === cartItemId);
      if (!targetItem) return prev;

      if (delta > 0) {
        const itemInMenu = findMenuItemInMenu(targetItem.menuItemId);
        const isManualAvailable = itemInMenu?.isAvailable !== false;
        const physicalStock = itemInMenu?.stockQuantity !== undefined ? Number(itemInMenu.stockQuantity) : 50;
        const rawAvailable = itemInMenu?.availableStock !== undefined ? Number(itemInMenu.availableStock) : physicalStock;
        const totalCartQty = prev
          .filter((ci) => ci.menuItemId === targetItem.menuItemId)
          .reduce((sum, ci) => sum + (Number(ci.quantity) || 1), 0);
        const maxAllowedForCustomer = isManualAvailable ? Math.min(physicalStock, rawAvailable + totalCartQty) : 0;

        if (totalCartQty + delta > maxAllowedForCustomer) {
          showCustomerNotification({
            type: 'stock_out_cart',
            message: `Cannot add more. Stock limit of ${maxAllowedForCustomer} reached.`,
            menuItemId: targetItem.menuItemId,
            itemName: targetItem.name,
            durationMs: 2500,
          });
          return prev;
        }
      }

      return prev
        .map((ci) => {
          if (ci.id === cartItemId) {
            const newQty = (ci.quantity || 1) + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.id !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    if (tokenNumber) {
      api.clearCartReservations(tokenNumber).catch(() => {});
      reservedItemsRef.current.clear();
    }
    localStorage.removeItem('bar_customer_cart');
  };

  const cartTotal = Math.round(
    cart.reduce((sum, item) => {
      const itemInMenu = (() => {
        if (!Array.isArray(menu)) return null;
        for (const section of menu) {
          if (section.items) {
            const it = section.items.find((i: any) => i.id === item.menuItemId);
            if (it) return it;
          }
          if (section.categories) {
            for (const cat of section.categories) {
              if (cat.items) {
                const it = cat.items.find((i: any) => i.id === item.menuItemId);
                if (it) return it;
              }
              if (cat.subcategories) {
                for (const sub of cat.subcategories) {
                  if (sub.items) {
                    const it = sub.items.find((i: any) => i.id === item.menuItemId);
                    if (it) return it;
                  }
                }
              }
            }
          }
        }
        return null;
      })();
      const isStockOut = itemInMenu && (itemInMenu.isAvailable === false || Number(itemInMenu.stockQuantity ?? 50) <= 0);
      if (isStockOut) return sum;
      return sum + Number(item.unitPrice || 0) * (Number(item.quantity) || 1);
    }, 0) * 100
  ) / 100;
  const cartCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  // Authoritative Order Placement
  const placeOrder = async () => {
    if (!tokenNumber) throw new Error('Your table session is no longer active.');
    if (cart.length === 0) throw new Error('Cart is empty');
    if (isSessionClosed) {
      throw new Error('Cannot place order: This dining session has concluded.');
    }
    if (activeBill?.status === 'PAID' || activeBill?.status === 'SETTLED' || activeBill?.isPaid === true) {
      throw new Error('Cannot place order: Bill payment has been completed for this session.');
    }
    if (sessionData && sessionData.paymentVerified === false) {
      throw new Error('Cannot place order: Session payment has not been verified yet.');
    }
    if (tableStatus === 'SETTLING') {
      throw new Error('Bill settlement is in progress with your server. Ordering is currently locked.');
    }

    if (sessionData) {
      const endTime = sessionData.endTime || sessionData.session?.endTime;
      const startTime = sessionData.startTime || sessionData.session?.startTime;
      let endTimestamp: number | null = null;
      if (endTime) {
        const parsed = new Date(endTime).getTime();
        if (!isNaN(parsed)) endTimestamp = parsed;
      }
      if (!endTimestamp && startTime) {
        const parsedStart = new Date(startTime).getTime();
        if (!isNaN(parsedStart)) endTimestamp = parsedStart + 2 * 60 * 60 * 1000;
      }
      if (endTimestamp && (endTimestamp - Date.now()) <= 15 * 60 * 1000) {
        throw new Error('Cannot place order: Ordering is closed as session has 15 minutes or less remaining.');
      }
    }

    setIsOrdering(true);
    try {
      const payload = {
        tokenNumber,
        tableId: tableId || undefined,
        orderSource: 'CUSTOMER',
        items: cart.map((ci) => ({
          menuItemId: ci.menuItemId,
          variantName: ci.variantName || undefined,
          selectedModifiers: ci.modifiers,
          specialInstructions: ci.specialInstructions,
          quantity: ci.quantity,
        })),
      };

      const createdOrder = await api.placeOrder(payload);
      clearCart();
      await refreshOrders();
      await refreshBill();
      return createdOrder;
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <CustomerContext.Provider
      value={{
        tokenNumber,
        tableNumber,
        tableId,
        setSession,
        menu,
        categories,
        promotions,
        cart,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        cartTotal,
        cartCount,
        activeOrders,
        orderHistory,
        isHistoryLoading,
        refreshOrderHistory,
        activeRequests,
        setActiveRequests,
        refreshRequests,
        sessionData,
        sessionError,
        refreshSession,
        activeBill,
        billError,
        isLoading,
        isOrdering,
        placeOrder,
        cancelOrderItem,
        refreshOrders,
        refreshBill,
        requestBill,
        refreshMenu,
        isCallWaiterOpen,
        setIsCallWaiterOpen,
        tableStatus,
        isSessionClosed,
        logout,
        notifications: activeNotification ? [activeNotification, ...queuedNotifications] : [],
        activeNotification,
        dismissActiveNotification,
        showCustomerNotification,
        dismissNotification,
        dismissMatchingNotifications,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = (): CustomerContextType => {
  const context = useContext(CustomerContext);
  return context || defaultCustomerContext;
};
