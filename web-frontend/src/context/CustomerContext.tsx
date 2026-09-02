import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  activeRequests: any[];
  activeBill: any | null;
  isLoading: boolean;
  isOrdering: boolean;
  placeOrder: () => Promise<any>;
  refreshOrders: () => Promise<void>;
  refreshBill: () => Promise<any>;
  refreshMenu: () => Promise<void>;
  isCallWaiterOpen: boolean;
  setIsCallWaiterOpen: (open: boolean) => void;
  isSessionClosed: boolean;
  logout: () => void;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tokenNumber, setTokenNumberState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const match = path.match(/^\/t\/([A-Za-z0-9_-]+)/);
      if (match) return match[1];
      return localStorage.getItem('bar_active_token') || null;
    }
    return null;
  });

  const [tableNumber, setTableNumber] = useState<string | null>(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('bar_active_table_num') : null;
  });

  const [tableId, setTableId] = useState<string | null>(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('bar_active_table_id') : null;
  });

  const [menu, setMenu] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('bar_customer_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [activeBill, setActiveBill] = useState<any | null>(null);
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

  const refreshBill = useCallback(async () => {
    if (!tokenNumber) return null;
    try {
      const billData = await api.calculateBill(tokenNumber);
      if (billData && billData.bill) {
        setActiveBill(billData.bill);
        return billData.bill;
      }
    } catch (err) {
      console.warn('Failed to calculate bill:', err);
    }
    return null;
  }, [tokenNumber]);

  // Initial Data Load
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    Promise.all([refreshMenu(), refreshOrders(), refreshBill()]).finally(() => {
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [refreshMenu, refreshOrders, refreshBill]);

  // Real-Time Socket Room & Event Subscriptions
  useEffect(() => {
    if (!tokenNumber) return;

    // Join isolated customer room
    joinRoom(`customer:token:${tokenNumber}`);

    const unsubOrderCreated = onSocketEvent('order.created', (data: any) => {
      if (data && (data.tokenNumber === tokenNumber || data.tokenId === tokenNumber)) {
        refreshOrders();
        refreshBill();
      }
    });

    const unsubItemUpdated = onSocketEvent('order.item.updated', (data: any) => {
      refreshOrders();
    });

    const unsubReqCreated = onSocketEvent('service_request.created', (data: any) => {
      if (data && data.tokenNumber === tokenNumber) {
        setActiveRequests((prev) => [data, ...prev.filter((r) => r.id !== data.id)]);
      }
    });

    const unsubReqUpdated = onSocketEvent('service_request.updated', (data: any) => {
      if (data) {
        setActiveRequests((prev) =>
          prev.map((r) => (r.id === data.id ? { ...r, ...data } : r))
        );
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

    return () => {
      unsubOrderCreated();
      unsubItemUpdated();
      unsubReqCreated();
      unsubReqUpdated();
      unsubBillUpdated();
      unsubSessionUpdated();
      unsubSessionClosed();
    };
  }, [tokenNumber, tableNumber, refreshOrders, refreshBill, handleSessionClosure]);

  // Cart Handlers
  const addToCart = (item: Omit<CartItem, 'id'>) => {
    const id = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    setCart((prev) => [...prev, { ...item, id }]);
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => {
          if (ci.id === cartItemId) {
            const newQty = ci.quantity + delta;
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

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Authoritative Order Placement
  const placeOrder = async () => {
    if (!tokenNumber) throw new Error('No active dining token found');
    if (cart.length === 0) throw new Error('Cart is empty');

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
        activeRequests,
        activeBill,
        isLoading,
        isOrdering,
        placeOrder,
        refreshOrders,
        refreshBill,
        refreshMenu,
        isCallWaiterOpen,
        setIsCallWaiterOpen,
        isSessionClosed,
        logout,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = (): CustomerContextType => {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
};
