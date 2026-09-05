import React, { useState, useEffect, useMemo } from 'react';
import { CustomerProvider, useCustomer } from '../context/CustomerContext';
import { VegBadge } from '../components/customer/VegBadge';
import { MenuItemCard } from '../components/customer/MenuItemCard';
import { ProductCustomizer, type CustomizerItem } from '../components/customer/ProductCustomizer';
import { CallWaiterSheet } from '../components/customer/CallWaiterSheet';
import {
  Home as HomeIcon,
  PhoneCall,
  RotateCcw,
  ClipboardList,
  Receipt,
  ShoppingCart,
  User,
  Search,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  Flame,
  Star,
  X,
  LogOut,
  Sun,
  Moon,
  Wine,
  UtensilsCrossed,
  ShoppingBag,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  Users,
  MapPin,
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type CustomerNavTab = 'home' | 'eat' | 'drink' | 'merch' | 'search' | 'cart' | 'orders' | 'bill' | 'repeat' | 'account';

const CustomerAppInner: React.FC = () => {
  const { isDark, toggleTheme } = useAuth();
  const {
    tokenNumber,
    tableNumber,
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
    setActiveRequests,
    tableId,
    activeBill,
    billError,
    isLoading,
    isOrdering,
    placeOrder,
    refreshBill,
    isCallWaiterOpen,
    setIsCallWaiterOpen,
    isSessionClosed,
    logout,
    sessionData,
    sessionError,
    refreshSession,
  } = useCustomer();

  // Circular wave theme transition
  const toggleThemeWithWave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (
      !(document as any).startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      toggleTheme();
      return;
    }

    const x = e.clientX;
    const y = e.clientY;
    const right = window.innerWidth - x;
    const bottom = window.innerHeight - y;
    const maxRadius = Math.hypot(Math.max(x, right), Math.max(y, bottom));

    const transition = (document as any).startViewTransition(() => {
      toggleTheme();
    });

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 400,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };

  const getCustomerTabFromPath = (): CustomerNavTab => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (p.includes('/customer/eat')) return 'eat';
      if (p.includes('/customer/drink')) return 'drink';
      if (p.includes('/customer/merch')) return 'merch';
      if (p.includes('/customer/cart')) return 'cart';
      if (p.includes('/customer/orders')) return 'orders';
      if (p.includes('/customer/bill')) return 'bill';
      if (p.includes('/customer/repeat')) return 'repeat';
      if (p.includes('/customer/search')) return 'search';
      if (p.includes('/customer/account')) return 'account';
    }
    return 'home';
  };

  const [activeTab, setActiveTabState] = useState<CustomerNavTab>(getCustomerTabFromPath);

  const setActiveTab = (tab: CustomerNavTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/t/')) {
      const targetPath = tab === 'home' ? '/customer/home' : `/customer/${tab}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTabState(getCustomerTabFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | 'VEG' | 'NON_VEG' | 'EGG'>('ALL');
  const [customizingItem, setCustomizingItem] = useState<CustomizerItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [billRequested, setBillRequested] = useState<boolean>(false);
  const [orderSuccessToast, setOrderSuccessToast] = useState<string | null>(null);
  const [activeOrdersSubTab, setActiveOrdersSubTab] = useState<'pending' | 'done'>('pending');
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  const handleCopyToken = (tokenToCopy: string) => {
    if (!tokenToCopy) return;
    try {
      navigator.clipboard.writeText(tokenToCopy);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {}
  };

  // Isolate background scroll when modal or bottom sheet is open
  useEffect(() => {
    const isModalOpen = isCallWaiterOpen || !!customizingItem;
    if (isModalOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isCallWaiterOpen, customizingItem]);

  // Flatten all menu items
  const allItems: any[] = useMemo(() => {
    const list: any[] = [];
    menu.forEach((section: any) => {
      (section.categories || []).forEach((cat: any) => {
        const catDisplayName =
          section.slug === 'eat' && cat.name.toLowerCase() === 'bar snacks'
            ? 'Starters & Appetizers'
            : cat.name;
        (cat.items || []).forEach((item: any) => {
          list.push({
            ...item,
            sectionSlug: section.slug,
            categoryName: catDisplayName,
            categoryId: cat.id || item.categoryId,
          });
        });
      });
    });
    return list;
  }, [menu]);

  const [eatSearchQuery, setEatSearchQuery] = useState<string>('');
  const [selectedEatCategory, setSelectedEatCategory] = useState<string>('ALL');
  const [drinkSearchQuery, setDrinkSearchQuery] = useState<string>('');
  const [selectedDrinkCategory, setSelectedDrinkCategory] = useState<string>('ALL');
  const [cartToast, setCartToast] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Map menuItemId -> total quantity in cart for instant in-card feedback
  const cartItemQuantityMap = useMemo(() => {
    const map: Record<string, number> = {};
    cart.forEach((item) => {
      map[item.menuItemId] = (map[item.menuItemId] || 0) + item.quantity;
    });
    return map;
  }, [cart]);

  // Expand all categories by default when categories load
  useEffect(() => {
    const exp: Record<string, boolean> = {};
    categories.forEach((c) => {
      exp[c.id] = true;
    });
    setExpandedCategories((prev) => ({ ...exp, ...prev }));
  }, [categories]);

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Helper to reliably extract section slug from category
  const getCategorySectionSlug = (cat: any): string => {
    if (cat.sectionSlug) return cat.sectionSlug;
    if (typeof cat.section === 'string') return cat.section;
    if (cat.section && typeof cat.section === 'object') return cat.section.slug || '';
    return '';
  };

  // Helper to return customer-facing food category display name (replaces "Bar Snacks" with "Starters & Appetizers")
  const getFoodCategoryDisplayName = (cat: any): string => {
    if ((cat.name || '').toLowerCase() === 'bar snacks') {
      return 'Starters & Appetizers';
    }
    return cat.name;
  };

  // Section item filters
  const getSectionItems = (sectionSlug: 'eat' | 'drink' | 'merchandise') => {
    return allItems.filter((i) => {
      if (i.sectionSlug !== sectionSlug) return false;
      // Scoped dietary filtering strictly for the Food Menu
      if (sectionSlug === 'eat') {
        if (dietaryFilter === 'VEG' && i.foodType !== 'VEG') return false;
        if (dietaryFilter === 'NON_VEG' && i.foodType !== 'NON_VEG') return false;
        if (dietaryFilter === 'EGG' && i.foodType !== 'EGG') return false;
      }
      if (sectionSlug === 'eat' && eatSearchQuery.trim()) {
        const q = eatSearchQuery.toLowerCase();
        const matchesName = i.name.toLowerCase().includes(q);
        const matchesDesc = (i.description || '').toLowerCase().includes(q);
        const matchesCat = (i.categoryName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }
      if (sectionSlug === 'drink' && drinkSearchQuery.trim()) {
        const q = drinkSearchQuery.toLowerCase();
        const matchesName = i.name.toLowerCase().includes(q);
        const matchesDesc = (i.description || '').toLowerCase().includes(q);
        const matchesCat = (i.categoryName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }
      return true;
    });
  };

  const popularItems = useMemo(() => allItems.filter((i) => i.popular).slice(0, 6), [allItems]);
  const featuredItems = useMemo(() => allItems.filter((i) => i.featured).slice(0, 6), [allItems]);
  const drinkHighlights = useMemo(() => allItems.filter((i) => i.sectionSlug === 'drink' && i.popular).slice(0, 4), [allItems]);
  const dessertItems = useMemo(() => allItems.filter((i) => (i.categoryName || '').toLowerCase().includes('dessert')), [allItems]);

  // Order Placement
  const handlePlaceOrder = async () => {
    setCheckoutError(null);
    try {
      const order = await placeOrder();
      setOrderSuccessToast(`Order #${order?.orderNumber || '01'} placed successfully!`);
      setActiveTab('orders');
      setTimeout(() => setOrderSuccessToast(null), 4000);
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to place order. Please try again.');
    }
  };

  // Direct Add handler with immediate feedback
  const handleDirectAdd = (item: CustomizerItem) => {
    addToCart({
      menuItemId: item.id,
      name: item.name,
      sectionSlug: item.sectionSlug || 'eat',
      variantId: null,
      variantName: null,
      modifiers: [],
      quantity: 1,
      unitPrice: item.basePrice,
      station: item.station,
      foodType: item.foodType,
    });
    setCartToast(`Added ${item.name} to cart`);
    setTimeout(() => setCartToast(null), 2500);
  };

  // Card increment handler
  const handleCardIncrement = (item: CustomizerItem) => {
    const existingCartItem = cart.find((ci) => ci.menuItemId === item.id);
    if (existingCartItem) {
      updateCartQuantity(existingCartItem.id, 1);
    } else {
      handleDirectAdd(item);
    }
  };

  // Card decrement handler
  const handleCardDecrement = (item: CustomizerItem) => {
    const existingCartItem = cart.find((ci) => ci.menuItemId === item.id);
    if (existingCartItem) {
      updateCartQuantity(existingCartItem.id, -1);
    }
  };

  // Request Bill handler
  const handleRequestBill = async () => {
    await refreshBill();
    setBillRequested(true);
    setTimeout(() => setBillRequested(false), 5000);
  };

  // Reorder items
  const flatHistoryItems = useMemo(() => {
    return activeOrders.flatMap((o) => (o.items || []).map((i: any) => ({ ...i, orderNumber: o.orderNumber })));
  }, [activeOrders]);

  // Billable placed items (excluding cancelled items, preferring backend consolidated items)
  const billableItems = useMemo(() => {
    if (activeBill?.items && Array.isArray(activeBill.items) && activeBill.items.length > 0) {
      return activeBill.items.filter((i: any) => i.status !== 'CANCELLED');
    }
    return activeOrders.flatMap((o) =>
      (o.items || []).filter((i: any) => i.status !== 'CANCELLED').map((i: any) => ({
        ...i,
        orderNumber: o.orderNumber,
      }))
    );
  }, [activeBill, activeOrders]);

  const pendingOrders = activeOrders.filter((o) => o.status !== 'SERVED' && o.status !== 'CANCELLED');
  const completedOrders = activeOrders.filter((o) => o.status === 'SERVED' || o.status === 'CANCELLED');

  const getOrderStatusBadgeClass = (status: string) => {
    const norm = (status || 'PREPARING').toUpperCase();
    switch (norm) {
      case 'SERVED':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      case 'READY':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
      case 'PREPARING':
      case 'ACCEPTED':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      case 'CANCELLED':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
      case 'PLACED':
      default:
        return 'bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] border border-primary/20 dark:border-[#D4AF37]/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3FA] dark:bg-[#111114] text-text-primary dark:text-zinc-100 font-sans antialiased transition-colors duration-200">
      <div className="w-full min-h-screen flex flex-col pb-28 sm:pb-32 lg:pb-12 relative">
        {/* 1. Header (Brand + Session Pill + Desktop Navigation + Quick Actions) */}
        <header className="sticky top-0 z-30 border-b border-border/80 dark:border-white/10 bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-md transition-colors shadow-2xs">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4 py-3">
              {/* Brand & Table PIN */}
              <button
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-3 text-left group cursor-pointer"
              >
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-primary to-primary-hover dark:from-[#D4AF37] dark:to-amber-500 text-white dark:text-black font-black flex items-center justify-center text-sm sm:text-base shadow-sm group-hover:scale-105 transition-transform shrink-0">
                  P
                </div>
                <div>
                  <div className="font-extrabold text-sm sm:text-base text-text-primary dark:text-white leading-tight">
                    Pegs N Bottles
                  </div>
                  <div className="text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 font-medium">
                    {tableNumber ? (
                      <>Table <span className="font-bold text-primary dark:text-[#D4AF37]">{tableNumber}</span></>
                    ) : (
                      <span>Dining Session</span>
                    )}
                  </div>
                </div>
              </button>

              {/* Desktop Navigation Tabs (Hidden on mobile/tablet, shown on lg+) */}
              <nav className="hidden lg:flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-border/60 dark:border-white/10">
                {[
                  { id: 'home', label: 'For You' },
                  { id: 'eat', label: 'Food Menu' },
                  { id: 'drink', label: 'Bar Menu' },
                  { id: 'merch', label: 'Merchandise' },
                  { id: 'repeat', label: 'Repeat' },
                  { id: 'orders', label: 'My Orders', badge: activeOrders.length },
                  { id: 'bill', label: 'Pay Bill' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as CustomerNavTab)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative flex items-center gap-1.5 ${
                      activeTab === tab.id
                        ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs'
                        : 'text-text-muted hover:text-text-primary dark:text-zinc-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                        activeTab === tab.id
                          ? 'bg-white text-primary dark:bg-black dark:text-[#D4AF37]'
                          : 'bg-primary/20 text-primary dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              {/* Right Actions: Call Waiter, Cart, Theme Toggle, Account, Logout */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                {/* Desktop Call Waiter Button */}
                <button
                  onClick={() => setIsCallWaiterOpen(true)}
                  aria-haspopup="dialog"
                  aria-expanded={isCallWaiterOpen}
                  aria-label="Call waiter"
                  className="hidden lg:inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border/80 dark:border-white/10 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 bg-white dark:bg-white/5 hover:bg-primary/5 dark:hover:bg-[#D4AF37]/10 text-xs font-bold text-text-primary dark:text-white transition-all shadow-2xs cursor-pointer relative"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-primary dark:text-[#D4AF37]" />
                  <span>Call Waiter</span>
                  {activeRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                    </span>
                  )}
                </button>

                {/* Cart Button */}
                <button
                  onClick={() => setActiveTab('cart')}
                  className={`relative p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === 'cart'
                      ? 'border-primary bg-primary/10 text-primary dark:border-[#D4AF37] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
                      : 'border-border/80 dark:border-white/10 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 bg-white dark:bg-white/5 text-text-primary dark:text-white'
                  }`}
                  aria-label="Cart"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {cartCount > 0 && (
                    <span className="hidden md:inline text-xs font-extrabold text-primary dark:text-[#D4AF37]">
                      ₹{Number(cartTotal || 0).toFixed(0)}
                    </span>
                  )}
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary dark:bg-[#D4AF37] text-white dark:text-black text-[10px] font-black flex items-center justify-center shadow-xs">
                      {cartCount}
                    </span>
                  )}
                </button>

                {/* Theme Toggle Button with wave transition */}
                <button
                  type="button"
                  onClick={toggleThemeWithWave}
                  className="p-2.5 rounded-xl border border-border/80 dark:border-white/10 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 bg-white dark:bg-white/5 text-text-muted hover:text-text-primary dark:text-zinc-400 dark:hover:text-white transition-all cursor-pointer"
                  title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  aria-label="Toggle Theme"
                >
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
                </button>

                {/* Account Button */}
                <button
                  onClick={() => setActiveTab('account')}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    activeTab === 'account'
                      ? 'border-primary bg-primary/10 text-primary dark:border-[#D4AF37] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
                      : 'border-border/80 dark:border-white/10 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 bg-white dark:bg-white/5 text-text-primary dark:text-white'
                  }`}
                  aria-label="Account"
                >
                  <User className="w-4 h-4" />
                </button>

                {/* Exit Customer View */}
                <button
                  onClick={() => {
                    if (window.confirm('Exit customer ordering view? Your active dining session and table remain open.')) {
                      logout();
                    }
                  }}
                  className="p-2.5 rounded-xl border border-border/80 dark:border-white/10 hover:bg-rose-500/10 hover:border-rose-500/30 text-text-muted hover:text-rose-500 transition-colors cursor-pointer"
                  title="Exit Customer View"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile & Tablet Sub-nav Tabs (Hidden on Desktop lg+) */}
            <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-2.5 pt-1 text-xs scrollbar-none border-t border-border/40 dark:border-white/5">
              {[
                { id: 'home', label: 'For You' },
                { id: 'eat', label: 'Eat' },
                { id: 'drink', label: 'Drink' },
                { id: 'merch', label: 'Merchandise' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as CustomerNavTab)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 font-bold transition-all cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs'
                      : 'text-text-muted hover:text-text-primary dark:text-zinc-400 dark:hover:text-white bg-black/5 dark:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              <div className="ml-auto flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-text-muted dark:text-zinc-400">
                <span className="px-2 py-0.5 rounded-full border border-border/60 dark:border-white/10 bg-black/5 dark:bg-white/5">
                  Food ends 23:00
                </span>
                <span className="px-2 py-0.5 rounded-full border border-border/60 dark:border-white/10 bg-black/5 dark:bg-white/5">
                  Drinks end 23:30
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Bill Status Notice */}
        {billRequested && (
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 animate-fade-in">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2.5 shadow-xs">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Your bill has been requested. Waiter is on the way to {tableNumber ? `Table ${tableNumber}` : 'your table'}.</span>
            </div>
          </div>
        )}

        {/* Order Success Toast */}
        {orderSuccessToast && (
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 animate-fade-in">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2.5 shadow-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{orderSuccessToast}</span>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 flex-1 space-y-8">
        {/* ==================================================================== */}
        {/* VIEW: HOME ("For You")                                              */}
        {/* ==================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-8 animate-fade-in">
            {/* Search link */}
            <button
              onClick={() => setActiveTab('search')}
              className="w-full flex items-center gap-3 rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] px-5 py-3.5 text-xs text-text-muted dark:text-zinc-400 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 transition-all shadow-xs cursor-pointer"
            >
              <Search className="w-4 h-4 text-primary dark:text-[#D4AF37]" />
              <span>Search for a dish, drink or category…</span>
            </button>

            {/* Welcome banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border/60 dark:border-white/10 pb-4">
              <div>
                <h2 className="font-black text-2xl sm:text-3xl text-text-primary dark:text-white tracking-tight">
                  Welcome to Pegs N Bottles
                </h2>
                <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 mt-1">
                  {tableNumber ? `Table ${tableNumber} · ` : ''}You have {activeOrders.length} order{activeOrders.length === 1 ? '' : 's'} in this session.
                </p>
              </div>
            </div>

            {/* Promo Carousel Cards (1-col mobile, 2-col tablet, 3-col desktop) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {(promotions.length > 0 ? promotions : [
                { id: 'p1', title: 'Happy Hour Pitchers', subtitle: 'Complimentary artisanal snacks on craft pitchers before 8 PM.', ctaLabel: 'Explore Pitchers', ctaTarget: 'drink' },
                { id: 'p2', title: "Chef's Tasting Flight", subtitle: 'Three artisanal sliders paired with craft brew samplers.', ctaLabel: 'View Tasting', ctaTarget: 'eat' },
                { id: 'p3', title: 'Late Night Spirits', subtitle: 'Single malt pours paired with smoked dark chocolate.', ctaLabel: 'Browse Spirits', ctaTarget: 'drink' },
              ]).map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => setActiveTab(p.ctaTarget === 'drink' ? 'drink' : 'eat')}
                  className="cursor-pointer rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-5 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 transition-all group flex flex-col justify-between shadow-xs hover:shadow-md"
                >
                  <div>
                    <h4 className="font-extrabold text-sm sm:text-base text-text-primary dark:text-white leading-tight">
                      {p.title}
                    </h4>
                    <p className="text-xs text-text-muted dark:text-zinc-400 mt-1.5 leading-relaxed">
                      {p.subtitle || p.description}
                    </p>
                  </div>
                  <div className="mt-4 text-xs font-bold text-primary dark:text-[#D4AF37] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>{p.ctaLabel || 'Explore'} →</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Recovery Card */}
            {cart.length > 0 && (
              <div
                onClick={() => setActiveTab('cart')}
                className="flex items-center justify-between rounded-2xl border border-primary/30 dark:border-[#D4AF37]/30 bg-primary/5 dark:bg-[#D4AF37]/10 px-5 py-4 cursor-pointer shadow-xs hover:bg-primary/10 transition-all"
              >
                <div>
                  <div className="font-bold text-sm text-text-primary dark:text-white">Continue your order</div>
                  <div className="text-xs text-text-muted dark:text-zinc-400 mt-0.5">
                    {cart.length} item{cart.length === 1 ? '' : 's'} in your table cart (₹{cartTotal.toFixed(2)})
                  </div>
                </div>
                <span className="text-xs font-extrabold text-primary dark:text-[#D4AF37]">Review Cart →</span>
              </div>
            )}

            {/* Curated Sections (1-col mobile, 2-col tablet, 3-col desktop) */}
            {featuredItems.length > 0 && (
              <section className="space-y-4">
                <h3 className="font-black text-lg sm:text-xl text-text-primary dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" /> Tonight's Specials
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                  {featuredItems.map((i) => (
                    <MenuItemCard
                      key={i.id}
                      item={i}
                      onOpenCustomizer={setCustomizingItem}
                      onDirectAdd={handleDirectAdd}
                    />
                  ))}
                </div>
              </section>
            )}

            {popularItems.length > 0 && (
              <section className="space-y-4">
                <h3 className="font-black text-lg sm:text-xl text-text-primary dark:text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-primary dark:text-[#D4AF37]" /> Popular at Pegs N Bottles
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                  {popularItems.map((i) => (
                    <MenuItemCard
                      key={i.id}
                      item={i}
                      onOpenCustomizer={setCustomizingItem}
                      onDirectAdd={handleDirectAdd}
                    />
                  ))}
                </div>
              </section>
            )}

            {drinkHighlights.length > 0 && (
              <section className="space-y-4">
                <h3 className="font-black text-lg sm:text-xl text-text-primary dark:text-white flex items-center gap-2">
                  <Wine className="w-5 h-5 text-primary dark:text-[#D4AF37]" /> Recommended Drinks
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                  {drinkHighlights.map((i) => (
                    <MenuItemCard
                      key={i.id}
                      item={i}
                      onOpenCustomizer={setCustomizingItem}
                      onDirectAdd={handleDirectAdd}
                    />
                  ))}
                </div>
              </section>
            )}

            {dessertItems.length > 0 && (
              <section className="space-y-4">
                <h3 className="font-black text-lg sm:text-xl text-text-primary dark:text-white">Chef's Desserts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                  {dessertItems.map((i) => (
                    <MenuItemCard
                      key={i.id}
                      item={i}
                      onOpenCustomizer={setCustomizingItem}
                      onDirectAdd={handleDirectAdd}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: EAT (Food Menu)                                                */}
        {/* ==================================================================== */}
        {activeTab === 'eat' && (
          <div className="space-y-6 animate-fade-in">
            {/* 1. Header & Live Search Bar */}
            <div className="space-y-3 pb-2 border-b border-border/60 dark:border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-xl sm:text-2xl text-text-primary dark:text-white">
                    Food Menu
                  </h2>
                  <p className="text-xs text-text-muted dark:text-zinc-400">
                    Freshly prepared in our chef's kitchen. Tap any dish to customize or order.
                  </p>
                </div>

                {/* Dietary Toggle Filter (All, Veg, Egg, Non-Veg) */}
                <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl w-fit border border-border/40 dark:border-white/10 shrink-0">
                  {(['ALL', 'VEG', 'EGG', 'NON_VEG'] as const).map((df) => (
                    <button
                      key={df}
                      onClick={() => setDietaryFilter(df)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                        dietaryFilter === df
                          ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs font-extrabold'
                          : 'text-text-muted hover:text-text-primary dark:text-zinc-400 dark:hover:text-white'
                      }`}
                    >
                      {df === 'ALL'
                        ? 'All'
                        : df === 'VEG'
                        ? 'Veg'
                        : df === 'EGG'
                        ? 'Egg'
                        : 'Non-Veg'}
                    </button>
                  ))}
                </div>
              </div>

              {/* In-Menu Instant Search Bar */}
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted dark:text-zinc-500" />
                <input
                  type="text"
                  value={eatSearchQuery}
                  onChange={(e) => setEatSearchQuery(e.target.value)}
                  placeholder="Search dishes by name, spice level, or category..."
                  className="w-full text-xs pl-10 pr-10 py-2.5 rounded-xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] text-text-primary dark:text-white placeholder:text-text-muted/60 dark:placeholder:text-zinc-500 focus:outline-none focus:border-primary dark:focus:border-[#D4AF37] transition-colors"
                />
                {eatSearchQuery && (
                  <button
                    onClick={() => setEatSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Sticky Category Filter Chips (Mobile & Tablet) */}
            <div className="lg:hidden sticky top-[57px] z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-[#F5F3FA]/95 dark:bg-[#111114]/95 backdrop-blur-md border-b border-border/40 dark:border-white/5 overflow-x-auto no-scrollbar flex items-center gap-2">
              <button
                onClick={() => setSelectedEatCategory('ALL')}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-full shrink-0 transition-all cursor-pointer ${
                  selectedEatCategory === 'ALL'
                    ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs font-extrabold'
                    : 'bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 text-text-muted dark:text-zinc-300 hover:text-text-primary'
                }`}
              >
                All Dishes
              </button>
              {categories
                .filter((c) => getCategorySectionSlug(c) === 'eat')
                .filter((c) => getSectionItems('eat').filter((i) => i.categoryId === c.id).length > 0)
                .map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedEatCategory(cat.id)}
                    className={`text-xs font-bold px-3.5 py-1.5 rounded-full shrink-0 transition-all cursor-pointer ${
                      selectedEatCategory === cat.id
                        ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs font-extrabold'
                        : 'bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 text-text-muted dark:text-zinc-300 hover:text-text-primary'
                    }`}
                  >
                    {getFoodCategoryDisplayName(cat)}
                  </button>
                ))}
            </div>

            {/* 3. Main Content Layout: Responsive Desktop Split Rail + Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Desktop Sticky Category Navigation Rail (lg:col-span-3) */}
              <aside className="hidden lg:block lg:col-span-3 sticky top-20 space-y-2">
                <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-3 shadow-xs space-y-1">
                  <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-text-muted dark:text-zinc-500">
                    Categories
                  </div>
                  <button
                    onClick={() => setSelectedEatCategory('ALL')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                      selectedEatCategory === 'ALL'
                        ? 'bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] font-extrabold'
                        : 'text-text-muted dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary dark:hover:text-white'
                    }`}
                  >
                    <span>All Dishes</span>
                    <span className="text-[10px] opacity-70">
                      {getSectionItems('eat').length}
                    </span>
                  </button>
                  {categories
                    .filter((c) => getCategorySectionSlug(c) === 'eat')
                    .filter((c) => getSectionItems('eat').filter((i) => i.categoryId === c.id).length > 0)
                    .map((cat) => {
                      const count = getSectionItems('eat').filter((i) => i.categoryId === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedEatCategory(cat.id)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                            selectedEatCategory === cat.id
                              ? 'bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] font-extrabold'
                              : 'text-text-muted dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary dark:hover:text-white'
                          }`}
                        >
                          <span>{getFoodCategoryDisplayName(cat)}</span>
                          <span className="text-[10px] opacity-70">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </aside>

              {/* Items Display Area (lg:col-span-9 or full on mobile/tablet) */}
              <div className="lg:col-span-9 space-y-6">
                {/* Skeleton Loading State */}
                {isLoading ? (
                  <div className="space-y-4">
                    <div className="h-6 w-48 rounded-lg bg-zinc-200 dark:bg-white/10 animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div
                          key={`eat-skel-${idx}`}
                          className="h-36 rounded-2xl bg-white dark:bg-[#18181B] border border-border/60 dark:border-white/10 p-4 animate-pulse flex justify-between"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-white/10" />
                            <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-white/10" />
                            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-white/10 mt-6" />
                          </div>
                          <div className="w-20 h-16 rounded-xl bg-zinc-200 dark:bg-white/10 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Render Category Accordions / Groups */
                  (() => {
                    const activeCategories = categories
                      .filter((c) => getCategorySectionSlug(c) === 'eat')
                      .filter((c) => selectedEatCategory === 'ALL' || selectedEatCategory === c.id);

                    const totalMatchingItems = activeCategories.reduce((sum, cat) => {
                      return sum + getSectionItems('eat').filter((i) => i.categoryId === cat.id).length;
                    }, 0);

                    if (totalMatchingItems === 0) {
                      return (
                        <div className="rounded-3xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-12 text-center space-y-3">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] flex items-center justify-center mx-auto text-2xl">
                            <UtensilsCrossed className="w-7 h-7" />
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-text-primary dark:text-white">
                            No menu items found
                          </h3>
                          <p className="text-xs text-text-muted dark:text-zinc-400 max-w-sm mx-auto">
                            {eatSearchQuery
                              ? `No dishes matched "${eatSearchQuery}". Try clearing search or switching dietary filters.`
                              : `No dishes available in this category for the selected dietary preference.`}
                          </p>
                          {(eatSearchQuery || dietaryFilter !== 'ALL' || selectedEatCategory !== 'ALL') && (
                            <button
                              onClick={() => {
                                setEatSearchQuery('');
                                setDietaryFilter('ALL');
                                setSelectedEatCategory('ALL');
                              }}
                              className="px-4 py-2 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
                            >
                              Reset Filters
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {activeCategories.map((cat) => {
                          const catItems = getSectionItems('eat').filter((i) => i.categoryId === cat.id);
                          if (catItems.length === 0) return null;
                          const isExpanded = expandedCategories[cat.id] !== false;

                          return (
                            <div
                              key={cat.id}
                              className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] overflow-hidden shadow-xs"
                            >
                              <button
                                onClick={() => toggleCategory(cat.id)}
                                aria-expanded={isExpanded}
                                className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="font-black text-base sm:text-lg text-text-primary dark:text-white">
                                    {getFoodCategoryDisplayName(cat)}
                                  </span>
                                  <span className="text-xs text-text-muted dark:text-zinc-400 font-bold">
                                    ({catItems.length})
                                  </span>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-text-muted" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-text-muted" />
                                )}
                              </button>

                              {isExpanded && (
                                <div className="p-4 sm:p-5 pt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 border-t border-border/40 dark:border-white/5">
                                  {catItems.map((item) => (
                                    <MenuItemCard
                                      key={item.id}
                                      item={item}
                                      cartQuantity={cartItemQuantityMap[item.id] || 0}
                                      onOpenCustomizer={setCustomizingItem}
                                      onDirectAdd={handleDirectAdd}
                                      onIncrement={handleCardIncrement}
                                      onDecrement={handleCardDecrement}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: DRINK (Bar Menu, Cocktails & Spirits)                         */}
        {/* ==================================================================== */}
        {activeTab === 'drink' && (
          <div className="space-y-6 animate-fade-in">
            {/* 1. Header & Live Search Bar */}
            <div className="space-y-3 pb-2 border-b border-border/60 dark:border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-black text-xl sm:text-2xl text-text-primary dark:text-white">
                    Bar Menu
                  </h2>
                  <p className="text-xs text-text-muted dark:text-zinc-400">
                    Handcrafted cocktails, single malts, craft beers, and fine wines from our master bartender.
                  </p>
                </div>
              </div>

              {/* In-Menu Instant Search Bar */}
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted dark:text-zinc-500" />
                <input
                  type="text"
                  value={drinkSearchQuery}
                  onChange={(e) => setDrinkSearchQuery(e.target.value)}
                  placeholder="Search beers, whiskies, cocktails, wines..."
                  className="w-full text-xs pl-10 pr-10 py-2.5 rounded-xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] text-text-primary dark:text-white placeholder:text-text-muted/60 dark:placeholder:text-zinc-500 focus:outline-none focus:border-primary dark:focus:border-[#D4AF37] transition-colors"
                />
                {drinkSearchQuery && (
                  <button
                    onClick={() => setDrinkSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Sticky Category Filter Chips (Mobile & Tablet) */}
            <div className="lg:hidden sticky top-[57px] z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 bg-[#F5F3FA]/95 dark:bg-[#111114]/95 backdrop-blur-md border-b border-border/40 dark:border-white/5 overflow-x-auto no-scrollbar flex items-center gap-2">
              <button
                onClick={() => setSelectedDrinkCategory('ALL')}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-full shrink-0 transition-all cursor-pointer ${
                  selectedDrinkCategory === 'ALL'
                    ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs font-extrabold'
                    : 'bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 text-text-muted dark:text-zinc-300 hover:text-text-primary'
                }`}
              >
                All Drinks
              </button>
              {categories
                .filter((c) => getCategorySectionSlug(c) === 'drink')
                .filter((c) => getSectionItems('drink').filter((i) => i.categoryId === c.id).length > 0)
                .map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedDrinkCategory(cat.id)}
                    className={`text-xs font-bold px-3.5 py-1.5 rounded-full shrink-0 transition-all cursor-pointer ${
                      selectedDrinkCategory === cat.id
                        ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs font-extrabold'
                        : 'bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 text-text-muted dark:text-zinc-300 hover:text-text-primary'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
            </div>

            {/* 3. Main Content Layout: Responsive Desktop Split Rail + Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Desktop Sticky Category Navigation Rail (lg:col-span-3) */}
              <aside className="hidden lg:block lg:col-span-3 sticky top-20 space-y-2">
                <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-3 shadow-xs space-y-1">
                  <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-text-muted dark:text-zinc-500">
                    Bar Categories
                  </div>
                  <button
                    onClick={() => setSelectedDrinkCategory('ALL')}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                      selectedDrinkCategory === 'ALL'
                        ? 'bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] font-extrabold'
                        : 'text-text-muted dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary dark:hover:text-white'
                    }`}
                  >
                    <span>All Drinks</span>
                    <span className="text-[10px] opacity-70">
                      {getSectionItems('drink').length}
                    </span>
                  </button>
                  {categories
                    .filter((c) => getCategorySectionSlug(c) === 'drink')
                    .filter((c) => getSectionItems('drink').filter((i) => i.categoryId === c.id).length > 0)
                    .map((cat) => {
                      const count = getSectionItems('drink').filter((i) => i.categoryId === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedDrinkCategory(cat.id)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                            selectedDrinkCategory === cat.id
                              ? 'bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] font-extrabold'
                              : 'text-text-muted dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary dark:hover:text-white'
                          }`}
                        >
                          <span>{cat.name}</span>
                          <span className="text-[10px] opacity-70">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </aside>

              {/* Items Display Area (lg:col-span-9 or full on mobile/tablet) */}
              <div className="lg:col-span-9 space-y-6">
                {/* Skeleton Loading State */}
                {isLoading ? (
                  <div className="space-y-4">
                    <div className="h-6 w-48 rounded-lg bg-zinc-200 dark:bg-white/10 animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div
                          key={`drink-skel-${idx}`}
                          className="h-36 rounded-2xl bg-white dark:bg-[#18181B] border border-border/60 dark:border-white/10 p-4 animate-pulse flex justify-between"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-white/10" />
                            <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-white/10" />
                            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-white/10 mt-6" />
                          </div>
                          <div className="w-20 h-16 rounded-xl bg-zinc-200 dark:bg-white/10 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Render Category Accordions / Groups */
                  (() => {
                    const activeCategories = categories
                      .filter((c) => getCategorySectionSlug(c) === 'drink')
                      .filter((c) => selectedDrinkCategory === 'ALL' || selectedDrinkCategory === c.id);

                    const totalMatchingItems = activeCategories.reduce((sum, cat) => {
                      return sum + getSectionItems('drink').filter((i) => i.categoryId === cat.id).length;
                    }, 0);

                    if (totalMatchingItems === 0) {
                      return (
                        <div className="rounded-3xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-12 text-center space-y-3">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] flex items-center justify-center mx-auto text-2xl">
                            <Wine className="w-7 h-7" />
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-text-primary dark:text-white">
                            No bar items found
                          </h3>
                          <p className="text-xs text-text-muted dark:text-zinc-400 max-w-sm mx-auto">
                            {drinkSearchQuery
                              ? `No beverages matched "${drinkSearchQuery}". Try adjusting your search query.`
                              : `No beverages currently available in this category.`}
                          </p>
                          {(drinkSearchQuery || selectedDrinkCategory !== 'ALL') && (
                            <button
                              onClick={() => {
                                setDrinkSearchQuery('');
                                setSelectedDrinkCategory('ALL');
                              }}
                              className="px-4 py-2 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5"
                            >
                              Reset Filters
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-4">
                        {activeCategories.map((cat) => {
                          const catItems = getSectionItems('drink').filter((i) => i.categoryId === cat.id);
                          if (catItems.length === 0) return null;
                          const isExpanded = expandedCategories[cat.id] !== false;

                          return (
                            <div
                              key={cat.id}
                              className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] overflow-hidden shadow-xs"
                            >
                              <button
                                onClick={() => toggleCategory(cat.id)}
                                aria-expanded={isExpanded}
                                className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="font-black text-base sm:text-lg text-text-primary dark:text-white">
                                    {cat.name}
                                  </span>
                                  <span className="text-xs text-text-muted dark:text-zinc-400 font-bold">
                                    ({catItems.length})
                                  </span>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-text-muted" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-text-muted" />
                                )}
                              </button>

                              {isExpanded && (
                                <div className="p-4 sm:p-5 pt-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 border-t border-border/40 dark:border-white/5">
                                  {catItems.map((item) => (
                                    <MenuItemCard
                                      key={item.id}
                                      item={item}
                                      cartQuantity={cartItemQuantityMap[item.id] || 0}
                                      onOpenCustomizer={setCustomizingItem}
                                      onDirectAdd={handleDirectAdd}
                                      onIncrement={handleCardIncrement}
                                      onDecrement={handleCardDecrement}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: MERCHANDISE                                                    */}
        {/* ==================================================================== */}
        {activeTab === 'merch' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header & Page Context */}
            <div className="space-y-1 pb-3 border-b border-border/60 dark:border-white/10">
              <h2 className="font-black text-xl sm:text-2xl text-text-primary dark:text-white tracking-tight">
                Venue Merchandise
              </h2>
              <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400">
                Exclusive merchandise, glassware, and signature gifts to take home.
              </p>
            </div>

            {/* Content Area: Skeleton Loading -> Products Grid -> Clean Empty State */}
            {isLoading ? (
              /* Skeleton Loading State (responsive: 1-col mobile, 2-col tablet, 3-col desktop) */
              <div className="space-y-4">
                <div className="h-5 w-40 rounded-lg bg-zinc-200 dark:bg-white/10 animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={`merch-skel-${idx}`}
                      className="h-36 rounded-2xl bg-white dark:bg-[#18181B] border border-border/60 dark:border-white/10 p-4 animate-pulse flex justify-between"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-white/10" />
                        <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-white/10" />
                        <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-white/10 mt-6" />
                      </div>
                      <div className="w-20 h-16 rounded-xl bg-zinc-200 dark:bg-white/10 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (() => {
              const merchItems = getSectionItems('merchandise');
              if (merchItems.length === 0) {
                return (
                  <div className="rounded-3xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-8 sm:p-12 text-center space-y-4 shadow-xs max-w-xl mx-auto my-6">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] flex items-center justify-center mx-auto">
                      <ShoppingBag className="w-7 h-7 sm:w-8 sm:h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-base sm:text-lg font-black text-text-primary dark:text-white">
                        Merchandise Coming Soon
                      </h3>
                      <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                        Exclusive Pegs N Bottles apparel, artisanal bar glassware, and takeaway collectibles are currently being prepared for our collection.
                      </p>
                    </div>
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                      <button
                        onClick={() => setActiveTab('eat')}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                      >
                        Explore Food Menu
                      </button>
                      <button
                        onClick={() => setActiveTab('drink')}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border/80 dark:border-white/10 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 bg-black/5 dark:bg-white/5 text-text-primary dark:text-white font-extrabold text-xs transition-colors cursor-pointer"
                      >
                        Browse Bar Menu
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                  {merchItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      cartQuantity={cartItemQuantityMap[item.id] || 0}
                      onOpenCustomizer={setCustomizingItem}
                      onDirectAdd={handleDirectAdd}
                      onIncrement={handleCardIncrement}
                      onDecrement={handleCardDecrement}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: SEARCH                                                         */}
        {/* ==================================================================== */}
        {activeTab === 'search' && (
          <div className="space-y-6 animate-fade-in">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food, cocktails, spirits, merch..."
                className="w-full text-sm pl-12 pr-10 py-3.5 rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] text-text-primary dark:text-white placeholder:text-text-muted focus:outline-none focus:border-primary dark:focus:border-[#D4AF37] shadow-xs"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
              {allItems
                .filter((i) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    i.name.toLowerCase().includes(q) ||
                    (i.description || '').toLowerCase().includes(q) ||
                    (i.categoryName || '').toLowerCase().includes(q)
                  );
                })
                .map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onOpenCustomizer={setCustomizingItem}
                    onDirectAdd={handleDirectAdd}
                  />
                ))}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: CART (Split 2-Column on Desktop)                                */}
        {/* ==================================================================== */}
        {/* ==================================================================== */}
        {/* VIEW: CART (Split 2-Column on Tablet & Desktop)                       */}
        {/* ==================================================================== */}
        {activeTab === 'cart' && (
          <div className="space-y-6 animate-fade-in pb-28 sm:pb-32">
            {/* Header with Title, Context Subtitle, Session Context & Items Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="font-black text-2xl sm:text-3xl text-text-primary dark:text-white tracking-tight">
                    Your Table Cart
                  </h2>
                  {cart.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]">
                      {cartCount} {cartCount === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 mt-1">
                  Review your selected unplaced items before dispatching to the floor.
                </p>
              </div>

              {/* Table / Dining Session Context */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] text-xs font-bold text-text-muted dark:text-zinc-300 w-fit shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>{tableNumber ? `Table ${tableNumber}` : 'Active Session'}</span>
                {tokenNumber && (
                  <>
                    <span className="text-border dark:text-white/20">|</span>
                    <span className="font-mono text-[11px] text-primary dark:text-[#D4AF37]">
                      {tokenNumber}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Inline Dismissible Checkout Error Banner */}
            {checkoutError && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="break-words">{checkoutError}</span>
                </div>
                <button
                  onClick={() => setCheckoutError(null)}
                  className="p-1.5 rounded-lg hover:bg-rose-500/15 transition-colors cursor-pointer shrink-0 text-rose-600 dark:text-rose-400"
                  aria-label="Dismiss error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {cart.length === 0 ? (
              <div className="max-w-xl mx-auto p-8 sm:p-12 text-center border border-dashed border-border/80 dark:border-white/10 rounded-3xl bg-white dark:bg-[#18181B] shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/15 flex items-center justify-center mx-auto mb-3">
                  <ShoppingCart className="w-7 h-7 text-primary dark:text-[#D4AF37]" />
                </div>
                <h3 className="font-bold text-base text-text-primary dark:text-white">Your cart is empty</h3>
                <p className="text-xs text-text-muted dark:text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Browse our Food or Bar Menu to add items to your table session.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => setActiveTab('eat')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-black text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    Browse Food Menu
                  </button>
                  <button
                    onClick={() => setActiveTab('drink')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border/80 dark:border-white/10 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 bg-white dark:bg-white/5 hover:bg-primary/5 dark:hover:bg-[#D4AF37]/10 text-xs font-bold text-text-primary dark:text-white transition-colors cursor-pointer"
                  >
                    Browse Bar Menu
                  </button>
                </div>
                <div className="mt-5 pt-4 border-t border-border/60 dark:border-white/10 text-[11px] text-text-muted dark:text-zinc-500">
                  Previously placed orders can be tracked in{' '}
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-primary dark:text-[#D4AF37] font-bold hover:underline cursor-pointer"
                  >
                    My Orders
                  </button>
                  .
                </div>
              </div>
            ) : (
              <div className="md:grid md:grid-cols-12 md:gap-6 lg:gap-8 items-start space-y-6 md:space-y-0">
                {/* Left Column: Cart Items List */}
                <div className="md:col-span-7 lg:col-span-7 xl:col-span-8 space-y-3">
                  {cart.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-4 sm:p-5 shadow-xs transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <VegBadge type={c.foodType} size="sm" />
                            <div className="font-extrabold text-sm sm:text-base text-text-primary dark:text-white truncate sm:whitespace-normal">
                              {c.name}
                            </div>
                          </div>
                          {(c.variantName || (c.modifiers && c.modifiers.length > 0)) && (
                            <div className="mt-1 text-xs text-text-muted dark:text-zinc-400 break-words">
                              {[c.variantName, ...(c.modifiers || []).map((m: any) => m.optionName)].filter(Boolean).join(' · ')}
                            </div>
                          )}
                          {c.specialInstructions && (
                            <div className="mt-1 text-xs italic text-amber-500 break-words">"{c.specialInstructions}"</div>
                          )}
                        </div>

                        <button
                          disabled={isOrdering}
                          onClick={() => removeFromCart(c.id)}
                          aria-label={`Remove ${c.name} from cart`}
                          className="min-h-[44px] min-w-[44px] -mr-2 -mt-1 flex items-center justify-center rounded-xl text-text-muted hover:text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/60 dark:border-white/10 gap-3">
                        {/* Stepper with comfortable touch targets (44x44px mobile touch area) */}
                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={isOrdering}
                            onClick={() => updateCartQuantity(c.id, -1)}
                            aria-label={c.quantity === 1 ? `Remove ${c.name} from cart` : `Decrease quantity of ${c.name}`}
                            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg border border-border/80 dark:border-white/10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer text-text-primary dark:text-white"
                          >
                            {c.quantity === 1 ? (
                              <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-rose-500" />
                            ) : (
                              <Minus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                            )}
                          </button>
                          <span className="w-8 text-center font-black text-sm text-primary dark:text-[#D4AF37]">
                            {c.quantity}
                          </span>
                          <button
                            disabled={isOrdering}
                            onClick={() => updateCartQuantity(c.id, 1)}
                            aria-label={`Increase quantity of ${c.name}`}
                            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg border border-border/80 dark:border-white/10 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer text-text-primary dark:text-white"
                          >
                            <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                          </button>
                        </div>

                        {/* Unit price & Line Total */}
                        <div className="text-right">
                          <div className="text-[11px] text-text-muted dark:text-zinc-400">
                            ₹{Number(c.unitPrice || 0).toFixed(2)} each
                          </div>
                          <div className="text-base font-black text-primary dark:text-[#D4AF37]">
                            ₹{(Number(c.unitPrice || 0) * (c.quantity || 1)).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Column: Order Summary Card */}
                <div className="md:col-span-5 lg:col-span-5 xl:col-span-4 md:sticky md:top-24 space-y-4">
                  <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-5 space-y-3.5 text-xs shadow-xs">
                    <h3 className="font-black text-base text-text-primary dark:text-white pb-2 border-b border-border/60 dark:border-white/10">
                      Order Summary
                    </h3>

                    <div className="flex justify-between text-text-muted dark:text-zinc-400 font-medium">
                      <span>Total Items</span>
                      <span className="font-bold text-text-primary dark:text-white">
                        {cartCount} {cartCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <div className="flex justify-between text-text-primary dark:text-white font-extrabold text-sm pt-1">
                      <span>Cart Subtotal</span>
                      <span className="text-base text-primary dark:text-[#D4AF37]">
                        ₹{Number(cartTotal || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="border-t border-border/60 dark:border-white/10 pt-3 text-[11px] text-text-muted dark:text-zinc-400 leading-relaxed">
                      Taxes, service charge, and applicable discounts are calculated as part of your final table bill.
                    </div>

                    <button
                      disabled={isOrdering || cart.length === 0}
                      onClick={handlePlaceOrder}
                      className="w-full h-13 mt-2 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-black disabled:opacity-50 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-between px-5 cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        {isOrdering && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{isOrdering ? 'Placing Order...' : 'Place Order'}</span>
                      </span>
                      <span>₹{Number(cartTotal || 0).toFixed(2)}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: MY ORDERS (Responsive Grid)                                    */}
        {/* ==================================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-6 animate-fade-in pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60 dark:border-white/10">
              <div>
                <h2 className="font-black text-2xl sm:text-3xl text-text-primary dark:text-white tracking-tight">
                  My Orders
                </h2>
                <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 mt-1">
                  Track live status and order details for your current table session.
                </p>
              </div>

              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 w-fit shrink-0">
                <button
                  onClick={() => setActiveOrdersSubTab('pending')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeOrdersSubTab === 'pending'
                      ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs'
                      : 'text-text-muted dark:text-zinc-400 hover:text-text-primary dark:hover:text-white'
                  }`}
                >
                  Pending ({pendingOrders.length})
                </button>
                <button
                  onClick={() => setActiveOrdersSubTab('done')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    activeOrdersSubTab === 'done'
                      ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs'
                      : 'text-text-muted dark:text-zinc-400 hover:text-text-primary dark:hover:text-white'
                  }`}
                >
                  Completed ({completedOrders.length})
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                  {[1, 2, 3].map((idx) => (
                    <div
                      key={`orders-skel-${idx}`}
                      className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-5 space-y-4 shadow-xs animate-pulse flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        {/* Header: Order Number & Time + Status Pill */}
                        <div className="flex items-center justify-between pb-3 border-b border-border/60 dark:border-white/10">
                          <div className="space-y-1.5">
                            <div className="h-5 w-24 rounded bg-zinc-200 dark:bg-white/10" />
                            <div className="h-3 w-28 rounded bg-zinc-200 dark:bg-white/10" />
                          </div>
                          <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-white/10" />
                        </div>

                        {/* Item Rows Placeholder */}
                        <div className="space-y-3">
                          {[1, 2].map((itemIdx) => (
                            <div key={itemIdx} className="flex items-start justify-between gap-3 py-1">
                              <div className="space-y-1.5 flex-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-3.5 h-3.5 rounded bg-zinc-200 dark:bg-white/10 shrink-0" />
                                  <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-white/10" />
                                </div>
                                <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-white/10" />
                              </div>
                              <div className="space-y-1.5 text-right shrink-0">
                                <div className="h-4 w-14 rounded bg-zinc-200 dark:bg-white/10 ml-auto" />
                                <div className="h-4 w-12 rounded bg-zinc-200 dark:bg-white/10 ml-auto" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Footer Placeholder */}
                      <div className="pt-3 border-t border-border/60 dark:border-white/10 flex items-center justify-between">
                        <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-white/10" />
                        <div className="h-5 w-20 rounded bg-zinc-200 dark:bg-white/10" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (activeOrdersSubTab === 'pending' ? pendingOrders : completedOrders).length === 0 ? (
              <div className="rounded-3xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-8 sm:p-12 text-center space-y-4 shadow-xs max-w-xl mx-auto my-4">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] flex items-center justify-center mx-auto">
                  <ClipboardList className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-black text-base sm:text-lg text-text-primary dark:text-white">
                    {activeOrdersSubTab === 'pending' ? 'No pending orders' : 'No completed orders'}
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                    {activeOrdersSubTab === 'pending'
                      ? `Your active orders${tableNumber ? ` for Table ${tableNumber}` : ''} being prepared by the kitchen or bar will appear here.`
                      : `Orders that have been served or completed${tableNumber ? ` for Table ${tableNumber}` : ''} will show up here.`}
                  </p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    onClick={() => setActiveTab('eat')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs min-h-[40px] flex items-center justify-center"
                  >
                    Explore Food Menu
                  </button>
                  <button
                    onClick={() => setActiveTab('drink')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border/80 dark:border-white/10 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 bg-black/5 dark:bg-white/5 text-text-primary dark:text-white font-extrabold text-xs transition-colors cursor-pointer min-h-[40px] flex items-center justify-center"
                  >
                    Browse Bar Menu
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
                {(activeOrdersSubTab === 'pending' ? pendingOrders : completedOrders).map((o, idx) => {
                  const totalItemsCount = (o.items || []).reduce(
                    (acc: number, item: any) => acc + (Number(item.quantity) || 1),
                    0
                  );
                  const orderTotalAmount = o.subtotal
                    ? Number(o.subtotal)
                    : (o.items || []).reduce(
                        (acc: number, item: any) =>
                          acc + Number(item.lineTotal || item.unitPrice * item.quantity || 0),
                        0
                      );

                  return (
                    <div
                      key={o.id || idx}
                      className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-5 space-y-3 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between pb-3 border-b border-border/60 dark:border-white/10">
                          <div>
                            <div className="font-black text-base text-text-primary dark:text-white">
                              Order #{String(o.orderNumber || idx + 1).padStart(2, '0')}
                            </div>
                            <div className="text-[11px] text-text-muted dark:text-zinc-400 mt-0.5">
                              Placed {new Date(o.placedAt || o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${getOrderStatusBadgeClass(
                              o.status
                            )}`}
                          >
                            {o.status || 'PREPARING'}
                          </span>
                        </div>

                        <div className="divide-y divide-border/40 dark:divide-white/5 mt-2">
                          {(o.items || []).map((item: any) => (
                            <div key={item.id} className="flex items-start justify-between gap-3 py-2.5 text-xs">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {item.foodType && (
                                    <VegBadge type={item.foodType} size="sm" />
                                  )}
                                  <span className="font-bold text-text-primary dark:text-white break-words">
                                    {item.itemName || item.name}
                                  </span>
                                  {item.variantName && (
                                    <span className="text-text-muted dark:text-zinc-400 text-[11px]">
                                      · {item.variantName}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-text-muted dark:text-zinc-400 mt-0.5">
                                  Qty {item.quantity} · {item.station?.toLowerCase()}
                                </div>
                                {item.specialInstructions && (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400 italic mt-0.5">
                                    Note: {item.specialInstructions}
                                  </div>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                                    item.status === 'SERVED'
                                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                      : item.status === 'READY'
                                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                      : item.status === 'CANCELLED'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {item.status || 'PREPARING'}
                                </span>
                                <div className="mt-1 font-bold text-text-primary dark:text-white">
                                  ₹{Number(item.lineTotal || item.unitPrice * item.quantity).toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Card Footer */}
                      <div className="pt-3 border-t border-border/60 dark:border-white/10 mt-2 space-y-1.5">
                        {o.notes && (
                          <div className="text-[11px] text-text-muted dark:text-zinc-400 italic">
                            Order Note: {o.notes}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-muted dark:text-zinc-400 font-medium">
                            {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[11px] text-text-muted dark:text-zinc-400 font-medium">
                              Order Total:
                            </span>
                            <span className="font-black text-sm text-primary dark:text-[#D4AF37]">
                              ₹{orderTotalAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: PAY BILL (Split 2-Column on Desktop)                           */}
        {/* ==================================================================== */}
        {/* ==================================================================== */}
        {/* VIEW: PAY BILL (Split 2-Column on Desktop & Tablet)                  */}
        {/* ==================================================================== */}
        {activeTab === 'bill' && (() => {
          const foodSub = Number(activeBill?.foodSubtotal || 0);
          const drinkSub = Number(activeBill?.drinkSubtotal || 0);
          const merchSub = Number(activeBill?.merchandiseSubtotal || 0);
          const serviceCharge = Number(activeBill?.serviceChargeTotal ?? activeBill?.serviceCharge ?? 0);
          const taxTotal = Number(activeBill?.taxTotal ?? activeBill?.gst ?? 0);
          const discountTotal = Number(activeBill?.discountTotal || 0);
          const redemptionDeduction = Number(activeBill?.redemptionDeduction || 0);
          const rounding = Number(activeBill?.rounding || 0);
          const grandTotal = Number(activeBill?.grandTotal || 0);

          return (
            <div className="space-y-6 animate-fade-in pb-8">
              {/* Header & Subtitle */}
              <div className="space-y-1 pb-3 border-b border-border/60 dark:border-white/10">
                <h2 className="font-black text-2xl sm:text-3xl text-text-primary dark:text-white tracking-tight">
                  Itemized Table Bill
                </h2>
                <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400">
                  Review your table session charges, itemized breakdown, and taxes.
                </p>
              </div>

              {isLoading ? (
                /* Skeleton Loading State (Responsive: 1-col mobile, 2-col tablet/desktop) */
                <div className="md:grid md:grid-cols-12 md:gap-6 lg:gap-8 items-start space-y-6 md:space-y-0">
                  {/* Left Column Skeleton */}
                  <div className="md:col-span-7 xl:col-span-8 space-y-4">
                    <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-5 space-y-4 shadow-xs animate-pulse">
                      <div className="h-5 w-36 rounded bg-zinc-200 dark:bg-white/10" />
                      <div className="space-y-3 pt-2">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex justify-between items-start py-2.5 border-b border-border/40 dark:border-white/5">
                            <div className="space-y-1.5 flex-1">
                              <div className="h-4 w-40 rounded bg-zinc-200 dark:bg-white/10" />
                              <div className="h-3 w-28 rounded bg-zinc-200 dark:bg-white/10" />
                            </div>
                            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-white/10" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column Skeleton */}
                  <div className="md:col-span-5 xl:col-span-4 space-y-4">
                    <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-6 text-center space-y-3 shadow-xs animate-pulse">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-white/10 mx-auto" />
                      <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-white/10 mx-auto" />
                      <div className="h-3 w-48 rounded bg-zinc-200 dark:bg-white/10 mx-auto" />
                      <div className="h-9 w-28 rounded bg-zinc-200 dark:bg-white/10 mx-auto mt-2" />
                      <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-white/10 mx-auto" />
                    </div>

                    <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-5 space-y-3 shadow-xs animate-pulse">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex justify-between">
                          <div className="h-3.5 w-24 rounded bg-zinc-200 dark:bg-white/10" />
                          <div className="h-3.5 w-16 rounded bg-zinc-200 dark:bg-white/10" />
                        </div>
                      ))}
                      <div className="h-11 w-full rounded-xl bg-zinc-200 dark:bg-white/10 mt-3" />
                    </div>
                  </div>
                </div>
              ) : billError && billableItems.length === 0 ? (
                /* Error State with Retry */
                <div className="rounded-3xl border border-rose-500/20 bg-white dark:bg-[#18181B] p-8 sm:p-12 text-center space-y-4 shadow-xs max-w-xl mx-auto my-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-black text-base sm:text-lg text-text-primary dark:text-white">
                      Unable to Load Table Bill
                    </h3>
                    <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                      {billError || 'We encountered a problem calculating your table bill. Please try again.'}
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => refreshBill()}
                      className="px-6 py-2.5 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs min-h-[40px]"
                    >
                      Retry Calculation
                    </button>
                  </div>
                </div>
              ) : billableItems.length === 0 ? (
                /* Intentional Empty / No-Bill State */
                <div className="rounded-3xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-8 sm:p-12 text-center space-y-4 shadow-xs max-w-xl mx-auto my-6">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] flex items-center justify-center mx-auto">
                    <Receipt className="w-7 h-7 sm:w-8 sm:h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-black text-base sm:text-lg text-text-primary dark:text-white">
                      No active bill{tableNumber ? ` for Table ${tableNumber}` : ''}
                    </h3>
                    <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                      You have no placed orders in this dining session. Once dishes or beverages are ordered, your itemized table bill will appear here for review and settlement.
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                    <button
                      onClick={() => setActiveTab('eat')}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs min-h-[40px] flex items-center justify-center"
                    >
                      Explore Food Menu
                    </button>
                    <button
                      onClick={() => setActiveTab('drink')}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border/80 dark:border-white/10 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 bg-black/5 dark:bg-white/5 text-text-primary dark:text-white font-extrabold text-xs transition-colors cursor-pointer min-h-[40px] flex items-center justify-center"
                    >
                      Browse Bar Menu
                    </button>
                  </div>
                </div>
              ) : (
                /* Actual Itemized Bill View */
                <div className="md:grid md:grid-cols-12 md:gap-6 lg:gap-8 xl:gap-10 items-start space-y-6 md:space-y-0">
                  {/* Left Column: Itemized Placed Items */}
                  <div className="md:col-span-7 xl:col-span-8 space-y-4">
                    <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-4 sm:p-5 text-xs space-y-3 shadow-xs">
                      <div className="flex items-center justify-between pb-2.5 border-b border-border/60 dark:border-white/10">
                        <h3 className="font-black text-base text-text-primary dark:text-white">
                          Placed Items ({billableItems.length})
                        </h3>
                        <span className="text-[11px] text-text-muted dark:text-zinc-400 font-medium">
                          {tableNumber ? `Table ${tableNumber}` : 'Active Table'}
                        </span>
                      </div>

                      <div className="divide-y divide-border/40 dark:divide-white/5">
                        {billableItems.map((item: any, idx: number) => (
                          <div key={item.id || idx} className="flex items-start justify-between py-2.5 gap-3 text-xs">
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-text-primary dark:text-white break-words">
                                {item.quantity} × {item.itemName || item.name}
                              </div>
                              <div className="text-[11px] text-text-muted dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>Order #{String(item.orderNumber || 1).padStart(2, '0')}</span>
                                {item.variantName && <span>· {item.variantName}</span>}
                                <span>· @ ₹{Number(item.unitPrice).toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="font-bold text-text-primary dark:text-white shrink-0 text-right">
                              ₹{Number(item.lineTotal || item.unitPrice * item.quantity).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Hero Settlement Card & Financial Breakdown */}
                  <div className="md:col-span-5 xl:col-span-4 md:sticky md:top-24 space-y-4 pb-8">
                    {/* Hero Grand Total Box */}
                    <div className="rounded-2xl border border-primary/30 dark:border-[#D4AF37]/30 bg-primary/5 dark:bg-[#D4AF37]/10 p-5 sm:p-6 text-center shadow-xs">
                      <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/20 flex items-center justify-center text-primary dark:text-[#D4AF37]">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="font-black text-xl text-text-primary dark:text-white">
                        {billRequested ? 'Bill Requested' : 'Settlement Total'}
                      </h3>
                      <p className="mt-1 text-xs text-text-muted dark:text-zinc-400">
                        {billRequested
                          ? `A floor staff member is approaching ${tableNumber ? `Table ${tableNumber}` : 'your table'}.`
                          : 'Review charges below. Cash, Card, or UPI accepted.'}
                      </p>
                      <div className="mt-3 font-black text-3xl sm:text-4xl text-primary dark:text-[#D4AF37]">
                        ₹{grandTotal.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-text-muted dark:text-zinc-400 mt-1.5 font-medium">
                        {tableNumber ? (
                          <>Table <span className="font-bold text-text-primary dark:text-white">{tableNumber}</span></>
                        ) : (
                          <span>Active Session</span>
                        )}
                        {tokenNumber && (
                          <> · <span className="font-mono">{tokenNumber}</span></>
                        )}
                      </div>
                    </div>

                    {/* Financial Breakdown */}
                    <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-5 text-xs space-y-2.5 shadow-xs">
                      {foodSub > 0 && (
                        <div className="flex justify-between text-text-muted dark:text-zinc-400">
                          <span>Food Subtotal</span>
                          <span className="font-semibold text-text-primary dark:text-white">
                            ₹{foodSub.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {drinkSub > 0 && (
                        <div className="flex justify-between text-text-muted dark:text-zinc-400">
                          <span>Drink Subtotal</span>
                          <span className="font-semibold text-text-primary dark:text-white">
                            ₹{drinkSub.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {merchSub > 0 && (
                        <div className="flex justify-between text-text-muted dark:text-zinc-400">
                          <span>Merchandise Subtotal</span>
                          <span className="font-semibold text-text-primary dark:text-white">
                            ₹{merchSub.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {serviceCharge > 0 && (
                        <div className="flex justify-between text-text-muted dark:text-zinc-400">
                          <span>Service Charge (5%)</span>
                          <span className="font-semibold text-text-primary dark:text-white">
                            ₹{serviceCharge.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {taxTotal > 0 && (
                        <div className="flex justify-between text-text-muted dark:text-zinc-400">
                          <span>GST / Taxes (5%)</span>
                          <span className="font-semibold text-text-primary dark:text-white">
                            ₹{taxTotal.toFixed(2)}
                          </span>
                        </div>
                      )}
                      {discountTotal > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                          <span>Discount Applied</span>
                          <span>-₹{discountTotal.toFixed(2)}</span>
                        </div>
                      )}
                      {redemptionDeduction > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                          <span>Entry Fee / Drink Offset</span>
                          <span>-₹{redemptionDeduction.toFixed(2)}</span>
                        </div>
                      )}
                      {rounding !== 0 && (
                        <div className="flex justify-between text-text-muted dark:text-zinc-400 text-[11px]">
                          <span>Rounding Adjustment</span>
                          <span>{rounding > 0 ? `+₹${rounding.toFixed(2)}` : `-₹${Math.abs(rounding).toFixed(2)}`}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-border/60 dark:border-white/10 flex justify-between items-baseline">
                        <span className="font-bold text-sm text-text-primary dark:text-white">Total Payable</span>
                        <span className="font-black text-base text-primary dark:text-[#D4AF37]">
                          ₹{grandTotal.toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={handleRequestBill}
                        disabled={billRequested || grandTotal <= 0}
                        className="w-full mt-3 py-3.5 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-black text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Receipt className="w-4 h-4" />
                        <span>{billRequested ? 'Staff Notified' : 'Request Bill from Waiter'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ==================================================================== */}
        {/* VIEW: REPEAT (Quick Reorder Grid)                                   */}
        {/* ==================================================================== */}
        {activeTab === 'repeat' && (
          <div className="space-y-6 animate-fade-in pb-8">
            {/* Header & Context Subtitle */}
            <div className="space-y-1 pb-3 border-b border-border/60 dark:border-white/10">
              <h2 className="font-black text-xl sm:text-2xl text-text-primary dark:text-white tracking-tight">
                Repeat Past Items
              </h2>
              <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400">
                Quickly re-order favorite food and drinks from your current dining session.
              </p>
            </div>

            {/* Content Area: Skeleton Loading -> Repeat Items Grid -> Professional Empty State */}
            {isLoading ? (
              /* Skeleton Loading State (responsive: 1-col mobile, 2-col tablet, 3-col desktop) */
              <div className="space-y-4">
                <div className="h-5 w-44 rounded-lg bg-zinc-200 dark:bg-white/10 animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={`repeat-skel-${idx}`}
                      className="h-24 rounded-2xl bg-white dark:bg-[#18181B] border border-border/60 dark:border-white/10 p-4 animate-pulse flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-white/10" />
                        <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-white/10" />
                      </div>
                      <div className="w-20 h-9 rounded-xl bg-zinc-200 dark:bg-white/10 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ) : flatHistoryItems.length === 0 ? (
              <div className="rounded-3xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-8 sm:p-12 text-center space-y-4 shadow-xs max-w-xl mx-auto my-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] flex items-center justify-center mx-auto">
                  <RotateCcw className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-black text-text-primary dark:text-white">
                    Nothing to repeat yet
                  </h3>
                  <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                    Once you place an order in this dining session, your dishes and drinks will appear here for seamless 1-tap reordering.
                  </p>
                </div>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    onClick={() => setActiveTab('eat')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                  >
                    Explore Food Menu
                  </button>
                  <button
                    onClick={() => setActiveTab('drink')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-border/80 dark:border-white/10 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 bg-black/5 dark:bg-white/5 text-text-primary dark:text-white font-extrabold text-xs transition-colors cursor-pointer"
                  >
                    Browse Bar Menu
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
                {flatHistoryItems.map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-4 flex items-center justify-between gap-3 shadow-xs hover:border-primary/40 dark:hover:border-[#D4AF37]/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-text-primary dark:text-white truncate">
                        {item.itemName || item.name}
                      </div>
                      <div className="text-xs text-primary dark:text-[#D4AF37] font-extrabold mt-0.5">
                        ₹{Number(item.unitPrice).toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        handleDirectAdd({
                          id: item.menuItemId,
                          name: item.itemName || item.name,
                          basePrice: Number(item.unitPrice),
                          station: item.station || 'KITCHEN',
                          foodType: item.foodType || 'VEG',
                        });
                        setActiveTab('cart');
                      }}
                      className="shrink-0 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37] dark:hover:text-black font-extrabold text-xs transition-colors cursor-pointer min-h-[38px] flex items-center justify-center"
                    >
                      Re-order
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: ACCOUNT (Dining Session Details)                              */}
        {/* ==================================================================== */}
        {activeTab === 'account' && (
          <div className="space-y-6 animate-fade-in pb-28 sm:pb-32 max-w-4xl mx-auto">
            {/* Header with Title & Active Status */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60 dark:border-white/10">
              <div>
                <h2 className="font-black text-2xl sm:text-3xl text-text-primary dark:text-white tracking-tight flex items-center gap-2.5">
                  <User className="w-7 h-7 text-primary dark:text-[#D4AF37]" />
                  Account &amp; Dining Session
                </h2>
                <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 mt-1">
                  View your active table session details, guest profile, and preferences.
                </p>
              </div>
              {(sessionData || tokenNumber) && (
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40 w-fit">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    {sessionData?.tableNumber || tableNumber
                      ? `Table ${sessionData?.tableNumber || tableNumber} Active`
                      : 'Active Session'}
                  </span>
                </div>
              )}
            </div>

            {/* Error Banner */}
            {sessionError && (
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300 text-xs sm:text-sm flex items-start justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-semibold">Unable to refresh session details</p>
                    <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">{sessionError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => refreshSession()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-200/60 dark:bg-amber-800/40 hover:bg-amber-200 dark:hover:bg-amber-800/60 transition-colors shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            )}

            {/* Loading Skeletons */}
            {isLoading && !sessionData ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-2xl border border-border/60 dark:border-white/10 bg-white dark:bg-[#18181B] p-6 space-y-4 animate-pulse">
                    <div className="h-5 w-32 bg-zinc-200 dark:bg-white/10 rounded" />
                    <div className="space-y-3 pt-2">
                      <div className="h-4 w-full bg-zinc-100 dark:bg-white/5 rounded" />
                      <div className="h-4 w-3/4 bg-zinc-100 dark:bg-white/5 rounded" />
                      <div className="h-4 w-5/6 bg-zinc-100 dark:bg-white/5 rounded" />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/60 dark:border-white/10 bg-white dark:bg-[#18181B] p-6 space-y-4 animate-pulse">
                    <div className="h-5 w-36 bg-zinc-200 dark:bg-white/10 rounded" />
                    <div className="space-y-3 pt-2">
                      <div className="h-4 w-full bg-zinc-100 dark:bg-white/5 rounded" />
                      <div className="h-4 w-2/3 bg-zinc-100 dark:bg-white/5 rounded" />
                      <div className="h-4 w-4/5 bg-zinc-100 dark:bg-white/5 rounded" />
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 dark:border-white/10 bg-white dark:bg-[#18181B] p-6 space-y-4 animate-pulse">
                  <div className="h-5 w-40 bg-zinc-200 dark:bg-white/10 rounded" />
                  <div className="h-12 w-full bg-zinc-100 dark:bg-white/5 rounded" />
                </div>
              </div>
            ) : !tokenNumber && !sessionData ? (
              /* Missing Session Empty State */
              <div className="rounded-2xl border border-dashed border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-8 sm:p-12 text-center max-w-lg mx-auto shadow-xs">
                <div className="w-16 h-16 rounded-full bg-primary/10 dark:bg-[#D4AF37]/10 flex items-center justify-center text-primary dark:text-[#D4AF37] mx-auto mb-4">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-text-primary dark:text-white mb-2">
                  No Active Dining Session
                </h3>
                <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 mb-6 leading-relaxed">
                  We could not detect an active table session on this device. Please scan the QR code at your dining table to join or view your table order.
                </p>
                <button
                  type="button"
                  onClick={() => window.location.assign('/customer/landing')}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white bg-primary hover:bg-primary/90 dark:bg-[#D4AF37] dark:hover:bg-[#D4AF37]/90 dark:text-black shadow-md transition-all cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  Return to Welcome Page
                </button>
              </div>
            ) : (
              /* Active Session Cards */
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card 1: Guest Information */}
                  <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-border/40 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-primary dark:text-[#D4AF37]" />
                        <h3 className="font-bold text-sm sm:text-base text-text-primary dark:text-white">
                          Guest Information
                        </h3>
                      </div>
                      {sessionData?.customerName && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/10 text-text-muted dark:text-zinc-300">
                          Registered
                        </span>
                      )}
                    </div>

                    <div className="space-y-3.5 text-xs sm:text-sm">
                      <div className="flex items-center justify-between py-1.5 border-b border-border/40 dark:border-white/5">
                        <span className="text-text-muted dark:text-zinc-400">Customer Name</span>
                        <span className="font-bold text-text-primary dark:text-white">
                          {sessionData?.customerName || 'Dine-In Guest'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-border/40 dark:border-white/5">
                        <span className="text-text-muted dark:text-zinc-400 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-zinc-400" />
                          Phone Number
                        </span>
                        <span className="font-medium text-text-primary dark:text-white">
                          {sessionData?.phoneNumber || 'Not provided'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-border/40 dark:border-white/5">
                        <span className="text-text-muted dark:text-zinc-400 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-zinc-400" />
                          Email Address
                        </span>
                        <span
                          className="font-medium text-text-primary dark:text-white truncate max-w-[180px] sm:max-w-[220px]"
                          title={sessionData?.email || ''}
                        >
                          {sessionData?.email || 'Not provided'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-text-muted dark:text-zinc-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-zinc-400" />
                          Party Size
                        </span>
                        <span className="font-semibold text-text-primary dark:text-white">
                          {sessionData?.personsCount
                            ? `${sessionData.personsCount} ${sessionData.personsCount === 1 ? 'Guest' : 'Guests'}`
                            : '1 Guest'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Table & Dining Session */}
                  <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-6 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-border/40 dark:border-white/5">
                      <div className="flex items-center gap-2">
                        <UtensilsCrossed className="w-4 h-4 text-primary dark:text-[#D4AF37]" />
                        <h3 className="font-bold text-sm sm:text-base text-text-primary dark:text-white">
                          Table &amp; Session
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {sessionData?.status ? String(sessionData.status).toUpperCase() : 'ACTIVE'}
                      </span>
                    </div>

                    <div className="space-y-3.5 text-xs sm:text-sm">
                      <div className="flex items-center justify-between py-1.5 border-b border-border/40 dark:border-white/5">
                        <span className="text-text-muted dark:text-zinc-400">Table</span>
                        <span className="font-bold text-text-primary dark:text-white">
                          {sessionData?.tableNumber || tableNumber
                            ? `Table ${sessionData?.tableNumber || tableNumber}`
                            : 'Unassigned Table'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-border/40 dark:border-white/5">
                        <span className="text-text-muted dark:text-zinc-400 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                          Dining Area
                        </span>
                        <span className="font-medium text-text-primary dark:text-white capitalize">
                          {sessionData?.placeType
                            ? String(sessionData.placeType).toLowerCase().replace(/_/g, ' ')
                            : 'Dine-In'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-border/40 dark:border-white/5">
                        <span className="text-text-muted dark:text-zinc-400">Session Token</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-primary dark:text-[#D4AF37]">
                            {tokenNumber || sessionData?.tokenNumber || '—'}
                          </span>
                          {(tokenNumber || sessionData?.tokenNumber) && (
                            <button
                              type="button"
                              onClick={() => handleCopyToken(tokenNumber || sessionData?.tokenNumber || '')}
                              className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-white/10 text-zinc-400 hover:text-text-primary dark:hover:text-white transition-colors cursor-pointer"
                              title="Copy session token"
                            >
                              {copiedToken ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-b border-border/40 dark:border-white/5">
                        <span className="text-text-muted dark:text-zinc-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-zinc-400" />
                          Check-In Time
                        </span>
                        <span className="font-medium text-text-primary dark:text-white">
                          {sessionData?.startTime
                            ? (() => {
                                try {
                                  return new Date(sessionData.startTime).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  });
                                } catch {
                                  return sessionData.startTime;
                                }
                              })()
                            : 'Active'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-1.5">
                        <span className="text-text-muted dark:text-zinc-400">Active Orders</span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('orders')}
                          className="font-bold text-primary dark:text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>{activeOrders.length} {activeOrders.length === 1 ? 'ticket' : 'tickets'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 3: Preferences & Session Actions */}
                <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-6 space-y-6 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-border/40 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary dark:text-[#D4AF37]" />
                      <h3 className="font-bold text-sm sm:text-base text-text-primary dark:text-white">
                        Preferences &amp; Actions
                      </h3>
                    </div>
                  </div>

                  {/* Theme Switcher Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-zinc-50 dark:bg-white/5 border border-border/60 dark:border-white/5">
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-text-primary dark:text-white">
                        Customer Appearance
                      </p>
                      <p className="text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 mt-0.5">
                        Toggle between Light (Clean Purple) and Dark (Gold Luxury) mode
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleThemeWithWave}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] hover:bg-zinc-100 dark:hover:bg-white/10 text-text-primary dark:text-white shadow-xs transition-colors cursor-pointer w-full sm:w-auto"
                    >
                      {isDark ? (
                        <>
                          <Sun className="w-4 h-4 text-[#D4AF37]" />
                          <span>Switch to Light Mode</span>
                        </>
                      ) : (
                        <>
                          <Moon className="w-4 h-4 text-primary" />
                          <span>Switch to Dark Mode</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Quick Navigation Shortcuts */}
                  <div>
                    <h4 className="text-xs font-bold text-text-muted dark:text-zinc-400 uppercase tracking-wider mb-3">
                      Session Shortcuts
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setActiveTab('orders')}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 dark:border-white/10 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 bg-white dark:bg-[#18181B] hover:bg-zinc-50 dark:hover:bg-white/5 transition-all group text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-[#D4AF37]/10 flex items-center justify-center text-primary dark:text-[#D4AF37]">
                            <ClipboardList className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-text-primary dark:text-white">
                              My Orders
                            </span>
                            <span className="block text-[11px] text-text-muted dark:text-zinc-400">
                              {activeOrders.length} active
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-text-primary dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('bill')}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 dark:border-white/10 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 bg-white dark:bg-[#18181B] hover:bg-zinc-50 dark:hover:bg-white/5 transition-all group text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-[#D4AF37]/10 flex items-center justify-center text-primary dark:text-[#D4AF37]">
                            <Receipt className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-text-primary dark:text-white">
                              Table Bill
                            </span>
                            <span className="block text-[11px] text-text-muted dark:text-zinc-400">
                              Review summary
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-text-primary dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsCallWaiterOpen(true)}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 dark:border-white/10 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 bg-white dark:bg-[#18181B] hover:bg-zinc-50 dark:hover:bg-white/5 transition-all group text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-[#D4AF37]/10 flex items-center justify-center text-primary dark:text-[#D4AF37]">
                            <PhoneCall className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-text-primary dark:text-white">
                              Call Waiter
                            </span>
                            <span className="block text-[11px] text-text-muted dark:text-zinc-400">
                              Assistance &amp; service
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-text-primary dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                      </button>
                    </div>
                  </div>

                  {/* Exit Session Section */}
                  <div className="pt-4 border-t border-border/40 dark:border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-text-primary dark:text-white">
                        Exit Dining Session
                      </p>
                      <p className="text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 mt-0.5">
                        Clears your active session from this device. Re-scan your table QR code at any time to resume.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={logout}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800/40 transition-colors cursor-pointer shrink-0"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Exit Session</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Live Feedback Toast */}
      {cartToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-zinc-900/95 dark:bg-white/95 text-white dark:text-black text-xs font-black shadow-xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{cartToast}</span>
        </div>
      )}

      {/* Floating Mobile Cart Summary Bar (Positioned above bottom nav on mobile/tablet) */}
      {cartCount > 0 && activeTab !== 'cart' && (
        <div className="lg:hidden fixed bottom-[68px] inset-x-0 z-30 px-4 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto">
            <button
              onClick={() => setActiveTab('cart')}
              className="w-full py-3 px-4 rounded-2xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-lg shadow-primary/25 dark:shadow-[#D4AF37]/20 flex items-center justify-between font-extrabold text-xs transition-transform active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-white/20 dark:bg-black/20 flex items-center justify-center text-[11px]">
                  {cartCount}
                </span>
                <span>{cartCount === 1 ? '1 item' : `${cartCount} items`}</span>
                <span className="opacity-70">·</span>
                <span>₹{Number(cartTotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>View Cart</span>
                <span className="text-sm">→</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 2. Bottom Navigation Bar (Shown on mobile & tablet, hidden on desktop lg+) */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/80 dark:border-white/10 bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-md">
        <div className="max-w-md md:max-w-xl mx-auto grid grid-cols-5 gap-1 px-2 pt-1.5 pb-2 text-[11px]">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'home' || activeTab === 'eat' || activeTab === 'drink' || activeTab === 'merch'
                ? 'text-primary dark:text-[#D4AF37] font-black'
                : 'text-text-muted dark:text-zinc-400 hover:text-text-primary'
            }`}
          >
            <HomeIcon className="w-5 h-5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => setIsCallWaiterOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={isCallWaiterOpen}
            aria-label="Call waiter"
            className="flex flex-col items-center gap-1 py-1.5 rounded-xl text-text-muted dark:text-zinc-400 hover:text-text-primary transition-colors relative cursor-pointer"
          >
            <PhoneCall className="w-5 h-5" />
            {activeRequests.length > 0 && (
              <span className="absolute top-1 right-3 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[8px] font-black flex items-center justify-center animate-pulse">
                {activeRequests.length}
              </span>
            )}
            <span>Call Waiter</span>
          </button>

          <button
            onClick={() => setActiveTab('repeat')}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'repeat' ? 'text-primary dark:text-[#D4AF37] font-black' : 'text-text-muted dark:text-zinc-400 hover:text-text-primary'
            }`}
          >
            <RotateCcw className="w-5 h-5" />
            <span>Repeat</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors relative cursor-pointer ${
              activeTab === 'orders' ? 'text-primary dark:text-[#D4AF37] font-black' : 'text-text-muted dark:text-zinc-400 hover:text-text-primary'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            {activeOrders.length > 0 && (
              <span className="absolute top-1 right-3 w-3.5 h-3.5 rounded-full bg-primary dark:bg-[#D4AF37] text-white dark:text-black text-[8px] font-black flex items-center justify-center">
                {activeOrders.length}
              </span>
            )}
            <span>My Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('bill')}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'bill' ? 'text-primary dark:text-[#D4AF37] font-black' : 'text-text-muted dark:text-zinc-400 hover:text-text-primary'
            }`}
          >
            <Receipt className="w-5 h-5" />
            <span>Pay Bill</span>
          </button>
        </div>
      </nav>

      {/* Product Customizer Sheet */}
      <ProductCustomizer
        item={customizingItem}
        open={!!customizingItem}
        onClose={() => setCustomizingItem(null)}
        onAddToCart={addToCart}
      />

      {/* Call Waiter Sheet */}
      <CallWaiterSheet
        open={isCallWaiterOpen}
        onClose={() => setIsCallWaiterOpen(false)}
        tokenNumber={tokenNumber || ''}
        tableId={tableId || undefined}
        activeRequests={activeRequests}
        onRequestSubmitted={(newReq) =>
          setActiveRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)])
        }
      />

      {/* Session Closed Auto-Exit Notification Overlay */}
      {isSessionClosed && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 text-center animate-in fade-in">
          <div className="max-w-sm w-full rounded-3xl bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 p-6 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-text-primary dark:text-white mb-2">Session Ended</h3>
            <p className="text-xs text-text-muted dark:text-zinc-400 leading-relaxed mb-4">
              Your dining session at Pegs N Bottles has concluded. Thank you for visiting!
            </p>
            <div className="text-[11px] text-primary dark:text-[#D4AF37] font-bold">
              Returning to welcome page...
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export const CustomerApp: React.FC = () => {
  return (
    <CustomerProvider>
      <CustomerAppInner />
    </CustomerProvider>
  );
};

export default CustomerApp;
