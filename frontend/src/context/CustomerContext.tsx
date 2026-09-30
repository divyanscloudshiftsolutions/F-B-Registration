import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { joinRoom, leaveRoom, onSocketEvent } from '../services/socket';

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  sectionSlug?: string;
  variantId?: string | null;
  variantName?: string | null;
  modifiers?: Array<{
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

export interface CustomerNotificationItem {
  id: string;
  title: string;
  message: string;
  subMessage?: string;
  type: string;
  severity?: 'success' | 'warning' | 'error' | 'info' | 'primary';
  actionLabel?: string;
  menuItemId?: string;
  remainingMs?: number;
  durationMs?: number;
  onAction?: () => void;
}

interface CustomerContextType {
  tokenNumber: string;
  tableNumber: string;
  tableId: string;
  tableStatus: string;
  sessionData: any | null;
  sessionError: string | null;
  isSessionClosed: boolean;
  isLoading: boolean;
  isOrdering: boolean;
  menu: any[];
  categories: any[];
  promotions: any[];
  cart: CartItem[];
  cartCount: number;
  cartTotal: number;
  activeOrders: any[];
  orderHistory: any[];
  isHistoryLoading: boolean;
  activeRequests: any[];
  activeBill: any | null;
  billError: string | null;
  isCallWaiterOpen: boolean;
  notifications: CustomerNotificationItem[];
  activeNotification: CustomerNotificationItem | null;
  
  // Actions
  setTokenNumber: (token: string) => void;
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  placeOrder: (notes?: string) => Promise<any>;
  cancelOrderItem: (orderItemId: string) => Promise<any>;
  requestBill: () => Promise<any>;
  refreshOrders: () => Promise<void>;
  refreshOrderHistory: () => Promise<void>;
  refreshBill: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setIsCallWaiterOpen: (open: boolean) => void;
  dismissActiveNotification: () => void;
  dismissNotification: (id: string) => void;
  triggerNotification: (notif: Omit<CustomerNotificationItem, 'id'>) => void;
  logout: () => Promise<void>;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider: React.FC<{ children: React.ReactNode; initialToken?: string }> = ({
  children,
  initialToken,
}) => {
  const [tokenNumber, setTokenNumberState] = useState<string>(initialToken || '');
  const [tableNumber, setTableNumber] = useState<string>('');
  const [tableId, setTableId] = useState<string>('');
  const [tableStatus, setTableStatus] = useState<string>('occupied');
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSessionClosed, setIsSessionClosed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOrdering, setIsOrdering] = useState<boolean>(false);

  const [menu, setMenu] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [activeBill, setActiveBill] = useState<any | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [isCallWaiterOpen, setIsCallWaiterOpen] = useState<boolean>(false);

  const [notifications, setNotifications] = useState<CustomerNotificationItem[]>([]);
  const [activeNotification, setActiveNotification] = useState<CustomerNotificationItem | null>(null);

  // Load active token & cart from AsyncStorage on mount
  useEffect(() => {
    const init = async () => {
      try {
        const savedToken = initialToken || (await AsyncStorage.getItem('@bar_active_token')) || '';
        if (savedToken) {
          setTokenNumberState(savedToken);
        }
        const savedCart = await AsyncStorage.getItem(`@bar_cart_${savedToken}`);
        if (savedCart) {
          setCart(JSON.parse(savedCart));
        }
      } catch (err) {
        console.warn('CustomerContext init error:', err);
      }
    };
    init();
  }, [initialToken]);

  // Persist cart
  useEffect(() => {
    if (tokenNumber) {
      AsyncStorage.setItem(`@bar_cart_${tokenNumber}`, JSON.stringify(cart)).catch(() => {});
    }
  }, [cart, tokenNumber]);

  const setTokenNumber = (token: string) => {
    setTokenNumberState(token);
    AsyncStorage.setItem('@bar_active_token', token).catch(() => {});
  };

  const fetchSessionAndMenu = useCallback(async () => {
    if (!tokenNumber) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setSessionError(null);

      const [accessRes, menuRes] = await Promise.all([
        api.validateCustomerAccess(tokenNumber).catch((e) => ({ authorized: false, error: e.message })),
        api.getMenu(false).catch(() => []),
      ]);

      if (accessRes.authorized && accessRes.session) {
        setSessionData(accessRes.session);
        setTableNumber(accessRes.session.tableNumber || '');
        setTableId(accessRes.session.tableId || '');
        setTableStatus(accessRes.session.tableStatus || accessRes.session.status || 'occupied');
        setIsSessionClosed(accessRes.session.status === 'CLOSED' || accessRes.session.status === 'SETTLED');
      } else if (accessRes.sessionStatus === 'CLOSED') {
        setIsSessionClosed(true);
        setSessionData(accessRes);
      } else if (accessRes.paymentStatus === 'UNVERIFIED') {
        setSessionData(accessRes);
      } else {
        setSessionError(accessRes.error || 'Unable to load dining session.');
      }

      setMenu(menuRes || []);

      // Extract categories from menu
      const cats: any[] = [];
      (menuRes || []).forEach((sec: any) => {
        (sec.categories || []).forEach((c: any) => {
          cats.push({ ...c, sectionSlug: sec.slug });
        });
      });
      setCategories(cats);
    } catch (err: any) {
      setSessionError(err.message || 'Connection failed.');
    } finally {
      setIsLoading(false);
    }
  }, [tokenNumber]);

  const refreshOrders = useCallback(async () => {
    if (!tokenNumber) return;
    try {
      const orders = await api.getActiveOrders(tokenNumber);
      setActiveOrders(Array.isArray(orders) ? orders : []);
    } catch (err) {
      console.warn('refreshOrders error:', err);
    }
  }, [tokenNumber]);

  const refreshOrderHistory = useCallback(async () => {
    if (!tokenNumber) return;
    try {
      setIsHistoryLoading(true);
      const history = await api.getOrderHistory(tokenNumber);
      setOrderHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      console.warn('refreshOrderHistory error:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, [tokenNumber]);

  const refreshBill = useCallback(async () => {
    if (!tokenNumber) return;
    try {
      setBillError(null);
      const billData = await api.getBillCalculation(tokenNumber);
      setActiveBill(billData);
    } catch (err: any) {
      setBillError(err.message || 'Failed to load bill.');
    }
  }, [tokenNumber]);

  const refreshRequests = useCallback(async () => {
    if (!tokenNumber) return;
    try {
      const allReqs = await api.getActiveServiceRequests();
      const myReqs = (Array.isArray(allReqs) ? allReqs : []).filter(
        (r: any) => r.tokenNumber === tokenNumber || r.tokenId === tokenNumber
      );
      setActiveRequests(myReqs);
    } catch (err) {
      console.warn('refreshRequests error:', err);
    }
  }, [tokenNumber]);

  useEffect(() => {
    fetchSessionAndMenu();
    refreshOrders();
    refreshRequests();
  }, [fetchSessionAndMenu, refreshOrders, refreshRequests]);

  // Realtime Socket subscription
  useEffect(() => {
    if (!tokenNumber) return;

    joinRoom(`customer:token:${tokenNumber}`);
    if (tableId) joinRoom(`table:${tableId}`);

    const unsubOrderCreated = onSocketEvent('order.created', () => {
      refreshOrders();
      refreshBill();
    });

    const unsubOrderItemUpdated = onSocketEvent('order.item.updated', (payload) => {
      refreshOrders();
      refreshBill();
      if (payload?.itemName) {
        triggerNotification({
          title: 'Order Status Update',
          message: `${payload.itemName} is now ${payload.status}`,
          type: 'order_status',
          severity: payload.status === 'READY' || payload.status === 'SERVED' ? 'success' : 'info',
        });
      }
    });

    const unsubTableUpdated = onSocketEvent('table.updated', (payload) => {
      if (payload?.status) {
        setTableStatus(payload.status);
      }
    });

    const unsubSessionClosed = onSocketEvent('table.session.closed', () => {
      setIsSessionClosed(true);
      triggerNotification({
        title: 'Session Concluded',
        message: 'Your dining session has been concluded. Thank you for visiting!',
        type: 'session_closed',
        severity: 'info',
      });
    });

    const unsubBillUpdated = onSocketEvent('bill.updated', () => {
      refreshBill();
    });

    const unsubBillSettled = onSocketEvent('bill.settled', () => {
      refreshBill();
      setIsSessionClosed(true);
    });

    const unsubServiceReq = onSocketEvent('service_request.updated', () => {
      refreshRequests();
    });

    const unsubMenuUpdated = onSocketEvent('menu.updated', () => {
      fetchSessionAndMenu();
    });

    return () => {
      leaveRoom(`customer:token:${tokenNumber}`);
      if (tableId) leaveRoom(`table:${tableId}`);
      unsubOrderCreated();
      unsubOrderItemUpdated();
      unsubTableUpdated();
      unsubSessionClosed();
      unsubBillUpdated();
      unsubBillSettled();
      unsubServiceReq();
      unsubMenuUpdated();
    };
  }, [tokenNumber, tableId, refreshOrders, refreshBill, refreshRequests, fetchSessionAndMenu]);

  // Cart operations
  const addToCart = (item: Omit<CartItem, 'id'>) => {
    const id = `${item.menuItemId}-${item.variantId || 'base'}-${(item.modifiers || []).map((m) => m.optionId).sort().join('_')}-${(item.specialInstructions || '').trim()}`;
    setCart((prev) => {
      const idx = prev.findIndex((ci) => ci.id === id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx].quantity += item.quantity;
        return updated;
      }
      return [...prev, { ...item, id }];
    });
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.id === cartItemId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const placeOrder = async (notes?: string) => {
    if (cart.length === 0) throw new Error('Your cart is empty.');
    if (!tokenNumber) throw new Error('No active table session found.');

    setIsOrdering(true);
    try {
      const payload = {
        tokenNumber,
        items: cart.map((ci) => ({
          menuItemId: ci.menuItemId,
          variantId: ci.variantId || null,
          quantity: ci.quantity,
          specialInstructions: ci.specialInstructions,
          selectedModifiers: ci.modifiers,
        })),
        notes,
      };

      const res = await api.createOrder(payload);
      clearCart();
      await refreshOrders();
      await refreshBill();
      return res;
    } finally {
      setIsOrdering(false);
    }
  };

  const cancelOrderItem = async (orderItemId: string) => {
    const res = await api.cancelOrderItem(orderItemId);
    await refreshOrders();
    await refreshBill();
    return res;
  };

  const requestBill = async () => {
    if (!tokenNumber) return;
    const res = await api.requestBill(tokenNumber);
    setTableStatus('BILL_REQUESTED');
    await refreshBill();
    return res;
  };

  // Notification queue management
  const triggerNotification = (notif: Omit<CustomerNotificationItem, 'id'>) => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newNotif = { ...notif, id };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);
    setActiveNotification(newNotif);
  };

  const dismissActiveNotification = () => {
    if (!activeNotification) return;
    const dismissedId = activeNotification.id;
    setNotifications((prev) => {
      const remaining = prev.filter((n) => n.id !== dismissedId);
      setActiveNotification(remaining.length > 0 ? remaining[0] : null);
      return remaining;
    });
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => {
      const remaining = prev.filter((n) => n.id !== id);
      if (activeNotification?.id === id) {
        setActiveNotification(remaining.length > 0 ? remaining[0] : null);
      }
      return remaining;
    });
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('@bar_active_token');
      if (tokenNumber) {
        await AsyncStorage.removeItem(`@bar_cart_${tokenNumber}`);
      }
    } catch {}
    setTokenNumberState('');
    setSessionData(null);
    setCart([]);
  };

  return (
    <CustomerContext.Provider
      value={{
        tokenNumber,
        tableNumber,
        tableId,
        tableStatus,
        sessionData,
        sessionError,
        isSessionClosed,
        isLoading,
        isOrdering,
        menu,
        categories,
        promotions,
        cart,
        cartCount,
        cartTotal,
        activeOrders,
        orderHistory,
        isHistoryLoading,
        activeRequests,
        activeBill,
        billError,
        isCallWaiterOpen,
        notifications,
        activeNotification,
        setTokenNumber,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        placeOrder,
        cancelOrderItem,
        requestBill,
        refreshOrders,
        refreshOrderHistory,
        refreshBill,
        refreshRequests,
        refreshSession: fetchSessionAndMenu,
        setIsCallWaiterOpen,
        dismissActiveNotification,
        dismissNotification,
        triggerNotification,
        logout,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = () => {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
};

export default CustomerProvider;
