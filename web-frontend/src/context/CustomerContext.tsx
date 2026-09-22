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
  type: 'stock_out_cart' | 'stock_out_order' | 'stock_in' | 'info';
  message: string;
  subMessage?: string;
  menuItemId?: string;
  itemName?: string;
  durationMs: number;
  createdAt: number;
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
  showCustomerNotification: (notif: Omit<CustomerNotification, 'id' | 'createdAt'>) => void;
  dismissNotification: (id: string) => void;
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
  showCustomerNotification: () => {},
  dismissNotification: () => {},
};

const CustomerContext = createContext<CustomerContextType>(defaultCustomerContext);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tokenNumber, setTokenNumberState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const match = path.match(/^\/(?:customer\/access|t)\/([A-Za-z0-9_-]+)/);
      if (match) return decodeURIComponent(match[1]);
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

  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const availabilityMapRef = useRef<Map<string, boolean>>(new Map());

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const showCustomerNotification = useCallback(
    (notif: Omit<CustomerNotification, 'id' | 'createdAt'>) => {
      const id = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const fullNotif: CustomerNotification = {
        ...notif,
        id,
        createdAt: Date.now(),
      };
      setNotifications((prev) => [
        fullNotif,
        ...prev.filter((p) => p.menuItemId !== notif.menuItemId).slice(0, 3),
      ]);
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, notif.durationMs || 3000);
    },
    []
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
      setActiveOrders(orders);
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
      setOrderHistory(history);
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

    const unsubOrderCreated = onSocketEvent('order.created', (data: any) => {
      if (data && (data.tokenNumber === tokenNumber || data.tokenId === tokenNumber)) {
        refreshOrders();
        refreshOrderHistory();
        refreshBill();
      }
    });

    const unsubItemUpdated = onSocketEvent('order.item.updated', (data: any) => {
      if (data && data.status === 'STOCK_OUT' && data.previousStatus === 'PLACED') {
        const itemDisplayName = data.itemName || 'This item';
        showCustomerNotification({
          type: 'stock_out_order',
          message: `${itemDisplayName} became unavailable and was removed from your order. You will not be charged for it.`,
          menuItemId: data.menuItemId,
          itemName: itemDisplayName,
          durationMs: 3000,
        });
      }
      refreshOrders();
      refreshOrderHistory();
      refreshBill();
    });

    const unsubReqCreated = onSocketEvent('service_request.created', (data: any) => {
      if (data && data.tokenNumber === tokenNumber) {
        setActiveRequests((prev) => [data, ...prev.filter((r) => r.id !== data.id)]);
      }
    });

    const unsubReqUpdated = onSocketEvent('service_request.updated', (data: any) => {
      if (data) {
        if (data.status === 'COMPLETED' || data.status === 'CANCELLED') {
          setActiveRequests((prev) => prev.filter((r) => r.id !== data.id));
        } else {
          setActiveRequests((prev) =>
            prev.map((r) => (r.id === data.id ? { ...r, ...data } : r))
          );
        }
      }
    });

    const unsubTableUpdated = onSocketEvent('table.updated', (data: any) => {
      if (data && (data.id === tableId || data.tableNumber === tableNumber || data.number === tableNumber)) {
        setTableStatus(data.status || null);
      }
    });

    const unsubBillUpdated = onSocketEvent('bill.updated', (data: any) => {
      if (data && (data.tokenNumber === tokenNumber || data.tokenId === tokenNumber)) {
        if (data.status === 'PAID') {
          handleSessionClosure();
        } else {
          refreshBill();
        }
      }
    });

    const unsubSessionUpdated = onSocketEvent('session.updated', (data: any) => {
      if (data && (data.tokenNumber === tokenNumber || data.tokenId === tokenNumber)) {
        if (data.status === 'CLOSED' || data.status === 'CANCELLED') {
          handleSessionClosure();
        } else {
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
        const itemName = details.name || '';
        const prevStatus = availabilityMapRef.current.get(targetId);
        availabilityMapRef.current.set(targetId, newAvailable);

        // Case 1: Stock Out (!newAvailable or availableStock === 0)
        if (!newAvailable || (newAvailStock !== undefined && newAvailStock <= 0)) {
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
        if (newAvailable && prevStatus === false && (newAvailStock === undefined || newAvailStock > 0)) {
          const displayName = itemName || 'An item';
          showCustomerNotification({
            type: 'stock_in',
            message: `${displayName} is available again. Tap to view.`,
            menuItemId: targetId,
            itemName: displayName,
            durationMs: 5000,
          });
        }

        setMenu((prevMenu) => {
          if (!Array.isArray(prevMenu)) return prevMenu;
          return prevMenu.map((section: any) => ({
            ...section,
            items: (section.items || []).map((it: any) =>
              it.id === targetId
                ? {
                    ...it,
                    isAvailable: newAvailable,
                    stockQuantity: newStock ?? it.stockQuantity,
                    availableStock: newAvailStock ?? it.availableStock,
                  }
                : it
            ),
            categories: (section.categories || []).map((cat: any) => ({
              ...cat,
              items: (cat.items || []).map((it: any) =>
                it.id === targetId
                  ? {
                      ...it,
                      isAvailable: newAvailable,
                      stockQuantity: newStock ?? it.stockQuantity,
                      availableStock: newAvailStock ?? it.availableStock,
                    }
                  : it
              ),
              subcategories: (cat.subcategories || []).map((sub: any) => ({
                ...sub,
                items: (sub.items || []).map((it: any) =>
                  it.id === targetId
                    ? {
                        ...it,
                        isAvailable: newAvailable,
                        stockQuantity: newStock ?? it.stockQuantity,
                        availableStock: newAvailStock ?? it.availableStock,
                      }
                    : it
                ),
              })),
            })),
          }));
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

  // Sync Cart Stock Reservations in Background
  useEffect(() => {
    if (!tokenNumber) return;

    if (cart.length === 0) {
      api.clearCartReservations(tokenNumber).catch(() => {});
      return;
    }

    const itemQuantities = new Map<string, number>();
    for (const ci of cart) {
      itemQuantities.set(ci.menuItemId, (itemQuantities.get(ci.menuItemId) || 0) + (ci.quantity || 1));
    }

    itemQuantities.forEach((qty, menuItemId) => {
      api.reserveCartStock(tokenNumber, menuItemId, qty).catch(() => {});
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
    setCart((prev) =>
      prev
        .map((ci) => {
          if (ci.id === cartItemId) {
            const newQty = (ci.quantity || 1) + delta;
            return newQty > 0 ? { ...ci, quantity: newQty } : null;
          }
          return ci;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (cartItemId: string) => {
    setCart((prev) => prev.filter((ci) => ci.id !== cartItemId));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('bar_customer_cart');
  };

  const cartTotal = Math.round(
    cart.reduce((sum, item) => sum + Number(item.unitPrice || 0) * (Number(item.quantity) || 1), 0) * 100
  ) / 100;
  const cartCount = cart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

  // Authoritative Order Placement
  const placeOrder = async () => {
    if (!tokenNumber) throw new Error('No active dining token found');
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
        notifications,
        showCustomerNotification,
        dismissNotification,
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
