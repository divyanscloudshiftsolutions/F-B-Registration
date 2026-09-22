import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CustomerProvider, useCustomer } from '../context/CustomerContext';
import { VegBadge } from '../components/customer/VegBadge';
import { MenuItemCard } from '../components/customer/MenuItemCard';
import { ProductCustomizer, type CustomizerItem, type ProductCustomizerInitialConfig } from '../components/customer/ProductCustomizer';
import { CallWaiterSheet } from '../components/customer/CallWaiterSheet';
import { formatImageUrl } from '../utils/imageUrl';
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
  ArrowLeft,
  History,
  Calendar,
  RefreshCw,
  Square,
  CheckSquare,
  Timer,
  ChevronRight,
  Ban,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type CustomerNavTab = 'home' | 'eat' | 'drink' | 'merch' | 'search' | 'cart' | 'orders' | 'bill' | 'repeat' | 'account' | 'history';

// Live countdown timer component for customer dining session
const CustomerSessionTimer: React.FC<{ endTime?: string | null; startTime?: string | null }> = ({ endTime, startTime }) => {
  const [timeLeft, setTimeLeft] = useState<string>('--:--:--');
  const [isWarning, setIsWarning] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    // Resolve timestamp: Use real authoritative endTime from database Token
    let endTimestamp: number | null = null;
    if (endTime) {
      const parsed = new Date(endTime).getTime();
      if (!isNaN(parsed)) endTimestamp = parsed;
    }
    // Fallback: If only startTime is available, default dining session duration is 2 hours
    if (!endTimestamp && startTime) {
      const parsedStart = new Date(startTime).getTime();
      if (!isNaN(parsedStart)) endTimestamp = parsedStart + 2 * 60 * 60 * 1000;
    }

    if (!endTimestamp) {
      setTimeLeft('--:--:--');
      return;
    }

    const calculate = () => {
      const diffMs = endTimestamp! - Date.now();
      if (diffMs <= 0) {
        setTimeLeft('00:00:00');
        setIsWarning(false);
        setIsExpired(true);
        return;
      }
      setIsExpired(false);
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;

      setIsWarning(totalSecs <= 15 * 60); // warning when <= 15 minutes remain
      setTimeLeft(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [endTime, startTime]);

  if (isExpired) {
    return (
      <span className="text-[11px] sm:text-xs font-mono font-bold text-rose-600 dark:text-rose-400 select-none">
        Session Ended
      </span>
    );
  }

  return (
    <span
      title="Remaining Dining Session Time"
      className={`text-[11px] sm:text-xs font-mono font-bold tabular-nums tracking-tight select-none ${
        isWarning
          ? 'text-amber-600 dark:text-amber-400 animate-pulse'
          : 'text-primary dark:text-[#D4AF37]'
      }`}
    >
      {timeLeft}
    </span>
  );
};

const CustomerAppInner: React.FC = () => {
  const { isDark, toggleTheme } = useAuth();

  const [selectedImageModal, setSelectedImageModal] = useState<{ url: string; name: string } | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);

  // Swipe-down to dismiss state for Product Details sheet
  const [detailDragY, setDetailDragY] = useState<number>(0);
  const [isDetailDragging, setIsDetailDragging] = useState<boolean>(false);
  const [isDetailClosing, setIsDetailClosing] = useState<boolean>(false);
  const detailTouchStartY = useRef<number | null>(null);
  const detailTouchStartScrollTop = useRef<number>(0);
  const detailScrollRef = useRef<HTMLDivElement>(null);

  const handleDetailTouchStart = (e: React.TouchEvent) => {
    detailTouchStartY.current = e.touches[0].clientY;
    detailTouchStartScrollTop.current = detailScrollRef.current ? detailScrollRef.current.scrollTop : 0;
  };

  const handleDetailTouchMove = (e: React.TouchEvent) => {
    if (detailTouchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - detailTouchStartY.current;
    const currentScrollTop = detailScrollRef.current ? detailScrollRef.current.scrollTop : 0;

    if (deltaY > 0 && currentScrollTop <= 0 && detailTouchStartScrollTop.current <= 0) {
      setDetailDragY(deltaY);
      setIsDetailDragging(true);
    } else if (isDetailDragging && deltaY <= 0) {
      setDetailDragY(0);
      setIsDetailDragging(false);
    }
  };

  const handleDetailTouchEnd = () => {
    if (detailDragY > 70) {
      setIsDetailClosing(true);
      setTimeout(() => {
        setDetailDragY(0);
        setIsDetailDragging(false);
        setIsDetailClosing(false);
        setSelectedDetailItem(null);
      }, 200);
    } else {
      setDetailDragY(0);
      setIsDetailDragging(false);
    }
    detailTouchStartY.current = null;
  };
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
    orderHistory,
    isHistoryLoading,
    refreshOrderHistory,
    activeRequests,
    setActiveRequests,
    tableId,
    activeBill,
    billError,
    isLoading,
    isOrdering,
    placeOrder,
    cancelOrderItem,
    refreshOrders,
    refreshBill,
    requestBill,
    isCallWaiterOpen,
    setIsCallWaiterOpen,
    isSessionClosed,
    logout,
    sessionData,
    sessionError,
    refreshSession,
    tableStatus,
    notifications,
    dismissNotification,
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

    const rect = (e.currentTarget as HTMLElement)?.getBoundingClientRect?.();
    const x = e.clientX && e.clientX > 0 ? e.clientX : (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const y = e.clientY && e.clientY > 0 ? e.clientY : (rect ? rect.top + rect.height / 2 : window.innerHeight / 2);

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
          duration: 450,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
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
      if (p.includes('/customer/history') || p.includes('/customer/order-history')) return 'account';
    }
    return 'home';
  };

  const [activeTab, setActiveTabState] = useState<CustomerNavTab>(getCustomerTabFromPath);
  const [accountSubTab, setAccountSubTab] = useState<'profile' | 'history'>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname.toLowerCase();
      if (p.includes('/customer/history') || p.includes('/customer/order-history')) return 'history';
    }
    return 'profile';
  });

  const setActiveTab = (tab: CustomerNavTab) => {
    if (tab === 'history') {
      setActiveTabState('account');
      setAccountSubTab('history');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/t/')) {
        const targetPath = '/customer/account';
        if (window.location.pathname !== targetPath) {
          window.history.pushState(null, '', targetPath);
        }
      }
      return;
    }
    if (tab === 'account') {
      setAccountSubTab('profile');
    }
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
      const tab = getCustomerTabFromPath();
      setActiveTabState(tab);
      const p = window.location.pathname.toLowerCase();
      if (p.includes('/customer/history') || p.includes('/customer/order-history')) {
        setAccountSubTab('history');
      } else if (p.includes('/customer/account')) {
        setAccountSubTab('profile');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Synchronize orders and bill data whenever switching to relevant tabs
  useEffect(() => {
    if (activeTab === 'orders') {
      refreshOrders();
      refreshOrderHistory();
    } else if (activeTab === 'bill') {
      refreshBill();
      refreshOrders();
    }
  }, [activeTab, refreshOrders, refreshOrderHistory, refreshBill]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | 'VEG' | 'NON_VEG' | 'EGG'>('ALL');
  const [customizingItem, setCustomizingItem] = useState<CustomizerItem | null>(null);
  const [customizingInitialConfig, setCustomizingInitialConfig] = useState<any | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [billRequested, setBillRequested] = useState<boolean>(false);
  const [orderSuccessToast, setOrderSuccessToast] = useState<string | null>(null);
  const [activeOrdersSubTab, setActiveOrdersSubTab] = useState<'pending' | 'done'>('pending');
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState<boolean>(false);
  const [cancellingItemId, setCancellingItemId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [selectedHistorySession, setSelectedHistorySession] = useState<any | null>(null);

  const handleDeleteOrderItem = (orderItemId: string, itemName: string) => {
    if (cancellingItemId) return;
    setItemToDelete({ id: orderItemId, name: itemName });
  };

  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete || cancellingItemId) return;
    const targetId = itemToDelete.id;
    const targetName = itemToDelete.name;

    setCancellingItemId(targetId);
    try {
      await cancelOrderItem(targetId);
      setItemToDelete(null);
      setOrderSuccessToast(`"${targetName}" removed from order`);
      setTimeout(() => setOrderSuccessToast(null), 3000);
    } catch (err: any) {
      setCheckoutError(err?.message || 'Failed to remove item from order.');
      setTimeout(() => setCheckoutError(null), 4000);
      setItemToDelete(null);
    } finally {
      setCancellingItemId(null);
    }
  };

  const handleCopyToken = async (tokenToCopy: string) => {
    if (!tokenToCopy) return;
    let copied = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(tokenToCopy);
        copied = true;
      }
    } catch {}
    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = tokenToCopy;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch {}
    }
    if (copied) {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  // Isolate background scroll when modal or bottom sheet is open
  useEffect(() => {
    const isModalOpen = isCallWaiterOpen || isLogoutModalOpen || !!customizingItem || !!selectedImageModal || !!selectedDetailItem;
    if (isModalOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isCallWaiterOpen, isLogoutModalOpen, customizingItem, selectedImageModal, selectedDetailItem]);

  // Global Escape key listener for active modal overlays
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLogoutModalOpen) {
          setIsLogoutModalOpen(false);
        } else if (selectedImageModal) {
          setSelectedImageModal(null);
        } else if (selectedDetailItem) {
          setSelectedDetailItem(null);
        } else if (customizingItem) {
          setCustomizingItem(null);
          setCustomizingInitialConfig(null);
        } else if (isCallWaiterOpen) {
          setIsCallWaiterOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLogoutModalOpen, selectedImageModal, selectedDetailItem, customizingItem, isCallWaiterOpen]);

  // Flatten all menu items (including subcategories and unassigned items)
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
            featured: Boolean(item.isFeatured ?? item.featured),
            popular: Boolean(item.isPopular ?? item.popular),
            sectionSlug: section.slug,
            categoryName: catDisplayName,
            categoryId: cat.id || item.categoryId,
          });
        });
        (cat.subcategories || []).forEach((sub: any) => {
          (sub.items || []).forEach((item: any) => {
            list.push({
              ...item,
              featured: Boolean(item.isFeatured ?? item.featured),
              popular: Boolean(item.isPopular ?? item.popular),
              sectionSlug: section.slug,
              categoryName: `${catDisplayName} · ${sub.name}`,
              categoryId: cat.id || item.categoryId,
            });
          });
        });
      });
      // Unassigned items directly under section:
      (section.items || []).forEach((item: any) => {
        list.push({
          ...item,
          featured: Boolean(item.isFeatured ?? item.featured),
          popular: Boolean(item.isPopular ?? item.popular),
          sectionSlug: section.slug,
          categoryName: 'None',
          categoryId: null,
        });
      });
    });
    return list;
  }, [menu]);

  const handleNotificationClick = (notif: any) => {
    if (notif.type === 'stock_in' && notif.menuItemId) {
      const target = allItems.find((i) => String(i.id) === String(notif.menuItemId));
      if (target) {
        if (target.sectionSlug === 'eat' || target.station === 'KITCHEN' || target.station === 'DESSERT') {
          setActiveTab('eat');
          if (target.categoryId) {
            setSelectedEatCategory(target.categoryId);
          }
        } else if (target.sectionSlug === 'drink' || target.station === 'BAR') {
          setActiveTab('drink');
          if (target.categoryId) {
            setSelectedDrinkCategory(target.categoryId);
          }
        } else if (target.sectionSlug === 'merchandise') {
          setActiveTab('merch');
        }

        setSelectedDetailItem(target);
      }
      dismissNotification(notif.id);
    }
  };

  const [eatSearchQuery, setEatSearchQuery] = useState<string>('');
  const [selectedEatCategory, setSelectedEatCategory] = useState<string>('ALL');
  const [drinkSearchQuery, setDrinkSearchQuery] = useState<string>('');
  const [selectedDrinkCategory, setSelectedDrinkCategory] = useState<string>('ALL');
  const [cartToast, setCartToast] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // 1-second live ticker to evaluate 15-minute ordering cutoff dynamically against session timer
  const [currentNow, setCurrentNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setCurrentNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const sessionEndTime = sessionData?.endTime || (sessionData?.session?.endTime ?? null);
  const sessionStartTime = sessionData?.startTime || (sessionData?.session?.startTime ?? null);

  const remainingSessionSeconds = useMemo(() => {
    let endTimestamp: number | null = null;
    if (sessionEndTime) {
      const parsed = new Date(sessionEndTime).getTime();
      if (!isNaN(parsed)) endTimestamp = parsed;
    }
    if (!endTimestamp && sessionStartTime) {
      const parsedStart = new Date(sessionStartTime).getTime();
      if (!isNaN(parsedStart)) endTimestamp = parsedStart + 2 * 60 * 60 * 1000;
    }
    if (!endTimestamp) return null;
    return Math.floor((endTimestamp - currentNow) / 1000);
  }, [sessionEndTime, sessionStartTime, currentNow]);

  const isSessionExpired = remainingSessionSeconds !== null && remainingSessionSeconds <= 0;
  // Strict Business Rule: Remaining session time <= 15 minutes (900 seconds) = Ordering blocked
  const isOrderingCutoffReached = remainingSessionSeconds !== null && remainingSessionSeconds <= 15 * 60;

  // Strict Business Rule: Final bill payment completed = permanently locked
  const isBillPaidOrSettled = Boolean(
    isSessionClosed ||
    tableStatus === 'SETTLING' ||
    sessionData?.session?.status === 'CLOSED' ||
    sessionData?.session?.status === 'SETTLED' ||
    activeBill?.status === 'PAID' ||
    activeBill?.status === 'SETTLED' ||
    activeBill?.isPaid === true
  );

  const isOrderingBlocked = isOrderingCutoffReached || isBillPaidOrSettled || isSessionExpired;

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

  // Subcategory Multi-Filter state per Category: { [categoryId]: string[] }
  const [selectedSubcategories, setSelectedSubcategories] = useState<Record<string, string[]>>({});

  const handleToggleSubcategory = (catId: string, subcatId: string) => {
    setSelectedSubcategories((prev) => {
      const current = prev[catId] || [];
      const next = current.includes(subcatId)
        ? current.filter((id) => id !== subcatId)
        : [...current, subcatId];
      return { ...prev, [catId]: next };
    });
  };

  const handleClearSubcategories = (catId: string) => {
    setSelectedSubcategories((prev) => ({ ...prev, [catId]: [] }));
  };

  const handleSelectEatCategory = (catId: string) => {
    setSelectedEatCategory(catId);
    setSelectedSubcategories({}); // Immediately reset subcategory selections on parent category switch!
  };

  const handleSelectDrinkCategory = (catId: string) => {
    setSelectedDrinkCategory(catId);
    setSelectedSubcategories({}); // Immediately reset subcategory selections on parent category switch!
  };

  // Recalculate and prune invalid subcategories when dietary filter changes
  useEffect(() => {
    setSelectedSubcategories((prev) => {
      let changed = false;
      const updated: Record<string, string[]> = {};
      Object.entries(prev).forEach(([catId, subcatIds]) => {
        if (subcatIds.length === 0) return;
        const validItems = getSectionItems('eat').filter((i) => i.categoryId === catId);
        const validSubcatIds = new Set(validItems.map((i) => i.subcategoryId).filter(Boolean));
        const filtered = subcatIds.filter((id) => validSubcatIds.has(id));
        if (filtered.length !== subcatIds.length) {
          changed = true;
        }
        if (filtered.length > 0) {
          updated[catId] = filtered;
        }
      });
      return changed ? updated : prev;
    });
  }, [dietaryFilter]);

  const popularItems = useMemo(() => allItems.filter((i) => i.popular).slice(0, 6), [allItems]);
  const featuredItems = useMemo(() => allItems.filter((i) => i.featured).slice(0, 6), [allItems]);
  const drinkHighlights = useMemo(() => allItems.filter((i) => i.sectionSlug === 'drink' && i.popular).slice(0, 4), [allItems]);
  const dessertItems = useMemo(() => allItems.filter((i) => (i.categoryName || '').toLowerCase().includes('dessert')), [allItems]);

  // Order Placement
  const handlePlaceOrder = async () => {
    setCheckoutError(null);
    if (isOrderingBlocked) {
      setCheckoutError(
        isOrderingCutoffReached
          ? 'Ordering is closed: 15 minutes or less remaining in your dining session.'
          : isBillPaidOrSettled
          ? 'Ordering is closed: Bill payment has been completed for this session.'
          : 'Ordering is currently unavailable.'
      );
      return;
    }
    try {
      const order = await placeOrder();
      setOrderSuccessToast(`Order #${order?.orderNumber || '01'} placed successfully!`);
      setActiveTab('orders');
      setTimeout(() => setOrderSuccessToast(null), 4000);
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to place order. Please try again.');
    }
  };

  // Unified handler to open Product Customizer with prefilled latest configuration
  const handleOpenCustomizer = (item: CustomizerItem, customConfig?: ProductCustomizerInitialConfig | null) => {
    if (isOrderingBlocked) {
      setCartToast(
        isOrderingCutoffReached
          ? 'Ordering is closed (15 min or less remaining in session)'
          : 'Ordering is closed for this settled session'
      );
      setTimeout(() => setCartToast(null), 3000);
      return;
    }

    let initialConfig: ProductCustomizerInitialConfig | null = customConfig || null;

    if (!initialConfig) {
      const matchingCartItems = cart.filter((ci) => ci.menuItemId === item.id);
      if (matchingCartItems.length > 0) {
        const latest = matchingCartItems[matchingCartItems.length - 1];
        initialConfig = {
          variantId: latest.variantId || null,
          variantName: latest.variantName || null,
          modifiers: (latest.modifiers || []).map((m: any) => ({
            groupId: m.groupId,
            groupName: m.groupName,
            optionId: m.optionId,
            optionName: m.optionName,
            name: m.optionName,
            priceDelta: Number(m.priceDelta || 0),
          })),
          specialInstructions: latest.specialInstructions || '',
          quantity: 1, // Start quantity at 1 for the new customization instance
        };
      }
    }

    setCustomizingInitialConfig(initialConfig);
    setCustomizingItem(item);
  };

  // Direct Add handler with immediate feedback
  const handleDirectAdd = (item: CustomizerItem) => {
    if (isOrderingBlocked) {
      setCartToast(
        isOrderingCutoffReached
          ? 'Ordering is closed (15 min or less remaining in session)'
          : 'Ordering is closed for this settled session'
      );
      setTimeout(() => setCartToast(null), 3000);
      return;
    }
    addToCart({
      menuItemId: item.id,
      name: item.name,
      sectionSlug: item.sectionSlug || 'eat',
      variantId: null,
      variantName: null,
      modifiers: [],
      quantity: 1,
      unitPrice: Number(item.finalPrice ?? item.basePrice),
      station: item.station,
      foodType: item.foodType,
    });
    setCartToast(`Added ${item.name} to cart`);
    setTimeout(() => setCartToast(null), 2500);
  };

  // Card increment handler
  const handleCardIncrement = (item: CustomizerItem) => {
    if (isOrderingBlocked) {
      setCartToast(
        isOrderingCutoffReached
          ? 'Ordering is closed (15 min or less remaining in session)'
          : 'Ordering is closed for this settled session'
      );
      setTimeout(() => setCartToast(null), 3000);
      return;
    }

    const hasModifiers =
      (item.variants && item.variants.length > 0) ||
      (item.modifierGroups && item.modifierGroups.length > 0);

    if (hasModifiers) {
      handleOpenCustomizer(item);
      return;
    }

    const matchingCartItems = cart.filter((ci) => ci.menuItemId === item.id);
    if (matchingCartItems.length > 0) {
      const targetItem = matchingCartItems[matchingCartItems.length - 1];
      updateCartQuantity(targetItem.id, 1);
    } else {
      handleDirectAdd(item);
    }
  };

  // Card decrement handler
  const handleCardDecrement = (item: CustomizerItem) => {
    const matchingCartItems = cart.filter((ci) => ci.menuItemId === item.id);
    if (matchingCartItems.length > 0) {
      const targetItem = matchingCartItems[matchingCartItems.length - 1];
      updateCartQuantity(targetItem.id, -1);
    }
  };

  // Request Bill handler
  const [isRequestingBill, setIsRequestingBill] = useState<boolean>(false);
  const handleRequestBill = async () => {
    if (isRequestingBill || billRequested) return;
    setIsRequestingBill(true);
    try {
      await requestBill();
      setBillRequested(true);
      setOrderSuccessToast('Bill request sent! A waiter has been alerted.');
      setTimeout(() => setOrderSuccessToast(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to request bill from waiter.');
    } finally {
      setIsRequestingBill(false);
    }
  };

  // Reorder / Repeat helpers & Presentation Deduplication
  interface RepeatItemConfig {
    key: string;
    menuItemId: string;
    itemName: string;
    image?: string | null;
    variantId: string | null;
    variantName: string | null;
    selectedModifiers: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
      priceDelta: number;
    }>;
    specialInstructions: string;
    station: string;
    foodType: string;
    sectionSlug: string;
    unitPrice: number;
    isAvailable: boolean;
    totalQuantityOrdered: number;
    orderCount: number;
  }

  const resolveOrderItemConfig = (orderItem: any, catalogItems: any[]): RepeatItemConfig => {
    const menuItemId = orderItem.menuItemId || orderItem.itemId || orderItem.menuItem?.id || orderItem.id;
    const catalogItem =
      catalogItems.find(
        (ci: any) =>
          ci.id === menuItemId ||
          (orderItem.itemName && ci.name?.toLowerCase() === orderItem.itemName.toLowerCase()) ||
          (orderItem.name && ci.name?.toLowerCase() === orderItem.name.toLowerCase())
      ) || null;

    // 1. Availability check: item must exist in catalog and not be disabled
    const isAvailable = catalogItem ? catalogItem.isAvailable !== false : true;

    // 2. Variant resolution against current catalog
    let variantId: string | null = null;
    let variantName: string | null = orderItem.variantName || null;
    let variantDelta = 0;

    if (catalogItem && Array.isArray(catalogItem.variants) && catalogItem.variants.length > 0) {
      let matchedVariant = null;
      if (variantName) {
        matchedVariant = catalogItem.variants.find(
          (v: any) =>
            v.name?.toLowerCase() === variantName!.toLowerCase() ||
            (orderItem.variantId && v.id === orderItem.variantId)
        );
      }
      if (matchedVariant) {
        variantId = matchedVariant.id;
        variantName = matchedVariant.name;
        variantDelta = Number(matchedVariant.priceDelta || 0);
      }
    }

    // 3. Modifier resolution against current catalog options
    const rawModifiers = Array.isArray(orderItem.selectedModifiers)
      ? orderItem.selectedModifiers
      : [];
    let totalModDelta = 0;
    const normalizedModifiers = rawModifiers.map((mod: any) => {
      let priceDelta = Number(mod.priceDelta || 0);
      let groupId = mod.groupId || '';
      let groupName = mod.groupName || '';
      let optionId = mod.optionId || '';
      let optionName = mod.optionName || mod.name || '';

      if (catalogItem && Array.isArray(catalogItem.modifierGroups)) {
        for (const mg of catalogItem.modifierGroups) {
          const foundOpt = mg.options?.find(
            (o: any) =>
              (optionId && o.id === optionId) ||
              (optionName && o.name?.toLowerCase() === optionName.toLowerCase())
          );
          if (foundOpt) {
            groupId = mg.id;
            groupName = mg.name;
            optionId = foundOpt.id;
            optionName = foundOpt.name;
            priceDelta = Number(foundOpt.priceDelta || 0);
            break;
          }
        }
      }
      totalModDelta += priceDelta;
      return {
        groupId,
        groupName,
        optionId,
        optionName,
        priceDelta,
      };
    });

    // 4. Live authoritative catalog pricing
    const basePrice = catalogItem
      ? Number(catalogItem.finalPrice ?? catalogItem.basePrice ?? orderItem.unitPrice ?? 0)
      : Number(orderItem.unitPrice || 0);
    const calculatedUnitPrice = Math.round((basePrice + variantDelta + totalModDelta) * 100) / 100;
    const currentUnitPrice = calculatedUnitPrice > 0 ? calculatedUnitPrice : Number(orderItem.unitPrice || 0);

    // 5. Normalization of instructions, image, and metadata
    const specialInstructions = (orderItem.specialInstructions || orderItem.notes || '').trim();
    const station = catalogItem?.station || orderItem.station || 'KITCHEN';
    const foodType = catalogItem?.foodType || orderItem.foodType || 'VEG';
    const sectionSlug = catalogItem?.sectionSlug || orderItem.sectionSlug || 'eat';
    const itemName = catalogItem?.name || orderItem.itemName || orderItem.name || 'Menu Item';
    const image = catalogItem?.image || catalogItem?.imageUrl || orderItem.image || orderItem.imageUrl || null;

    // 6. Unique grouping key (menuItemId + variant + sorted modifiers + specialInstructions)
    const modsKey = normalizedModifiers
      .map((m: any) => `${m.groupId || m.groupName}:${m.optionId || m.optionName}`)
      .sort()
      .join('|');
    const key = `${menuItemId}::${variantName || ''}::${modsKey}::${specialInstructions.toLowerCase()}`;

    return {
      key,
      menuItemId,
      itemName,
      image,
      variantId,
      variantName,
      selectedModifiers: normalizedModifiers,
      specialInstructions,
      station,
      foodType,
      sectionSlug,
      unitPrice: currentUnitPrice,
      isAvailable,
      totalQuantityOrdered: Number(orderItem.quantity || 1),
      orderCount: 1,
    };
  };

  // Reorder items from current active session (deduplicated & filtered)
  const flatHistoryItems = useMemo(() => {
    const validItems: any[] = [];
    activeOrders.forEach((o) => {
      if (o.status === 'CANCELLED') return;
      (o.items || []).forEach((i: any) => {
        if (i.status === 'CANCELLED' || i.status === 'STOCK_OUT') return;
        validItems.push({ ...i, orderNumber: o.orderNumber });
      });
    });

    const groupedMap = new Map<string, RepeatItemConfig>();
    for (const item of validItems) {
      const resolved = resolveOrderItemConfig(item, allItems);
      if (groupedMap.has(resolved.key)) {
        const existing = groupedMap.get(resolved.key)!;
        existing.totalQuantityOrdered += resolved.totalQuantityOrdered;
        existing.orderCount += 1;
      } else {
        groupedMap.set(resolved.key, resolved);
      }
    }

    return Array.from(groupedMap.values());
  }, [activeOrders, allItems]);

  // Authoritative session-wise order history grouping
  const sessionHistory = useMemo(() => {
    if (!Array.isArray(orderHistory) || orderHistory.length === 0) return [];

    const map = new Map<string, {
      sessionId: string;
      sessionTokenNumber: string;
      tableNumber: string;
      areaName: string;
      sessionStatus: string;
      sessionStartTime: string | null;
      sessionClosedAt: string | null;
      placedAt: string;
      formattedDate: string;
      formattedTime: string;
      orders: any[];
      totalOrdersCount: number;
      totalItemsCount: number;
      totalAmount: number;
      hasServedItems: boolean;
      isAllCancelled: boolean;
    }>();

    orderHistory.forEach((order: any) => {
      // Authoritative session key based on token/session relationship
      const key =
        order.sessionId ||
        order.tokenId ||
        order.sessionTokenNumber ||
        (order.token?.id) ||
        (order.token?.tokenNumber) ||
        order.id;

      const orderSubtotal = Number(order.subtotal || order.totalAmount || 0);
      const orderItems = order.items || [];
      const orderItemsCount = orderItems.reduce(
        (sum: number, it: any) => sum + (Number(it.quantity) || 1),
        0
      );
      const placedAtTime = order.placedAt
        ? new Date(order.placedAt).getTime()
        : new Date(order.createdAt).getTime();

      if (!map.has(key)) {
        const orderDate = order.placedAt ? new Date(order.placedAt) : new Date(order.createdAt);
        map.set(key, {
          sessionId: key,
          sessionTokenNumber:
            order.sessionTokenNumber ||
            order.token?.tokenNumber ||
            (typeof key === 'string' && key.startsWith('T-') ? key : 'N/A'),
          tableNumber: order.table?.tableNumber || order.tableNumber || 'N/A',
          areaName: order.areaName || order.table?.placeType?.name || 'Dine-In',
          sessionStatus: order.sessionStatus || order.token?.status || 'CLOSED',
          sessionStartTime: order.sessionStartTime || order.token?.startTime || null,
          sessionClosedAt: order.sessionClosedAt || order.token?.closedAt || null,
          placedAt: order.placedAt || order.createdAt,
          formattedDate: orderDate.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          formattedTime: orderDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          orders: [order],
          totalOrdersCount: 1,
          totalItemsCount: orderItemsCount,
          totalAmount: orderSubtotal,
          hasServedItems: order.status === 'SERVED',
          isAllCancelled: order.status === 'CANCELLED',
        });
      } else {
        const group = map.get(key)!;
        group.orders.push(order);
        group.totalOrdersCount += 1;
        group.totalItemsCount += orderItemsCount;
        group.totalAmount += orderSubtotal;
        if (order.status === 'SERVED') group.hasServedItems = true;
        if (order.status !== 'CANCELLED') group.isAllCancelled = false;

        const currentGroupTime = new Date(group.placedAt).getTime();
        if (placedAtTime > currentGroupTime) {
          group.placedAt = order.placedAt || order.createdAt;
          const newDate = new Date(group.placedAt);
          group.formattedDate = newDate.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          group.formattedTime = newDate.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
        }
      }
    });

    const list = Array.from(map.values());
    // Sort sessions newest first
    list.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

    // Inside each session, sort orders by orderNumber asc / placedAt asc
    list.forEach((session) => {
      session.orders.sort((a, b) => {
        if (a.orderNumber && b.orderNumber) return a.orderNumber - b.orderNumber;
        return (
          new Date(a.placedAt || a.createdAt).getTime() -
          new Date(b.placedAt || b.createdAt).getTime()
        );
      });
    });

    return list;
  }, [orderHistory]);

  const handleRepeatItem = (repeatItem: RepeatItemConfig) => {
    if (isOrderingBlocked) {
      setCartToast(
        isOrderingCutoffReached
          ? 'Ordering is closed (15 min or less remaining in session)'
          : 'Ordering is closed for this settled session'
      );
      setTimeout(() => setCartToast(null), 3000);
      return;
    }
    if (!repeatItem.isAvailable) {
      setCartToast(`Sorry, ${repeatItem.itemName} is currently out of stock`);
      setTimeout(() => setCartToast(null), 3000);
      return;
    }

    // Find catalog item to provide complete variant & modifier schema
    const catalogItem = allItems.find((it) => it.id === repeatItem.menuItemId);
    const customizerItem: CustomizerItem = catalogItem
      ? {
          id: catalogItem.id,
          name: catalogItem.name,
          description: catalogItem.description,
          basePrice: Number(catalogItem.basePrice || 0),
          finalPrice: Number(catalogItem.finalPrice ?? catalogItem.basePrice ?? 0),
          discountMode: catalogItem.discountMode,
          discountValue: Number(catalogItem.discountValue || 0),
          foodType: catalogItem.foodType || repeatItem.foodType || 'VEG',
          station: catalogItem.station || repeatItem.station || 'KITCHEN',
          image: catalogItem.image || repeatItem.image || undefined,
          imageUrl: catalogItem.imageUrl || undefined,
          sectionSlug: catalogItem.sectionSlug || repeatItem.sectionSlug,
          variants: catalogItem.variants,
          modifierGroups: catalogItem.modifierGroups,
        }
      : {
          id: repeatItem.menuItemId,
          name: repeatItem.itemName,
          basePrice: repeatItem.unitPrice,
          finalPrice: repeatItem.unitPrice,
          foodType: repeatItem.foodType,
          station: repeatItem.station,
          image: repeatItem.image || undefined,
          sectionSlug: repeatItem.sectionSlug,
          variants: repeatItem.variantId
            ? [{ id: repeatItem.variantId, name: repeatItem.variantName || 'Selected', priceDelta: 0 }]
            : [],
          modifierGroups: [],
        };

    setCustomizingInitialConfig({
      variantId: repeatItem.variantId,
      variantName: repeatItem.variantName,
      modifiers: repeatItem.selectedModifiers,
      specialInstructions: repeatItem.specialInstructions,
      quantity: 1,
    });
    setCustomizingItem(customizerItem);
  };

  const handleReorderHistoricalOrder = (order: any) => {
    if (isOrderingBlocked) {
      setCartToast(
        isOrderingCutoffReached
          ? 'Ordering is closed (15 min or less remaining in session)'
          : 'Ordering is closed for this settled session'
      );
      setTimeout(() => setCartToast(null), 3000);
      return;
    }

    const validItems = (order.items || []).filter((it: any) => it.status !== 'CANCELLED');
    if (validItems.length === 0) {
      setCartToast('No active items to reorder from this past order');
      setTimeout(() => setCartToast(null), 2500);
      return;
    }

    let addedCount = 0;
    let unavailableCount = 0;

    for (const item of validItems) {
      const resolved = resolveOrderItemConfig(item, allItems);
      if (!resolved.isAvailable) {
        unavailableCount++;
        continue;
      }
      addToCart({
        menuItemId: resolved.menuItemId,
        name: resolved.itemName,
        sectionSlug: resolved.sectionSlug,
        variantId: resolved.variantId,
        variantName: resolved.variantName,
        modifiers: resolved.selectedModifiers,
        specialInstructions: resolved.specialInstructions,
        quantity: 1,
        unitPrice: resolved.unitPrice,
        station: resolved.station,
        foodType: resolved.foodType,
      });
      addedCount++;
    }

    if (addedCount > 0) {
      setCartToast(
        unavailableCount > 0
          ? `Added ${addedCount} item(s) to cart (${unavailableCount} unavailable item(s) skipped)`
          : `Added ${addedCount} item(s) to cart`
      );
      setActiveTab('cart');
    } else {
      setCartToast('All items in this order are currently unavailable');
    }
    setTimeout(() => setCartToast(null), 3000);
  };

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
      case 'STOCK_OUT':
      case 'CANCELLED':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20';
      case 'PLACED':
      default:
        return 'bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] border border-primary/20 dark:border-[#D4AF37]/20';
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F3FA] dark:bg-[#111114] text-text-primary dark:text-zinc-100 font-sans antialiased transition-colors duration-200 w-full max-w-full overflow-x-clip">
      <div className="w-full max-w-full min-h-screen flex flex-col pb-28 sm:pb-32 lg:pb-12 relative">
        {/* 1. Header (Brand + Session Pill + Desktop Navigation + Quick Actions) */}
        <header className="sticky top-0 z-30 border-b border-border/80 dark:border-white/10 bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-md transition-colors shadow-2xs">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between gap-4 py-3">
              {/* Brand & Inline Table / Session Timer Info */}
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('home')}
                  className="flex items-center gap-2.5 sm:gap-3 text-left group cursor-pointer"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-primary to-primary-hover dark:from-[#D4AF37] dark:to-amber-500 text-white dark:text-black font-black flex items-center justify-center text-sm sm:text-base shadow-sm group-hover:scale-105 transition-transform shrink-0">
                    P
                  </div>
                  <div>
                    <div className="font-extrabold text-sm sm:text-base text-text-primary dark:text-white leading-tight">
                      Pegs N Bottles
                    </div>
                    <div className="text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 font-medium flex items-center gap-1.5 whitespace-nowrap mt-0.5">
                      <span>{tableNumber ? `Table ${tableNumber}` : 'Dining Session'}</span>
                      <span className="text-border dark:text-white/20 font-normal">|</span>
                      <CustomerSessionTimer
                        endTime={sessionData?.endTime || (sessionData?.session?.endTime ?? null)}
                        startTime={sessionData?.startTime || (sessionData?.session?.startTime ?? null)}
                      />
                    </div>
                  </div>
                </button>
              </div>

              {/* Desktop Navigation Tabs (Hidden on mobile/tablet, shown on lg+) */}
              <nav className="hidden lg:flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-2xl border border-border/60 dark:border-white/10">
                {[
                  { id: 'home', label: 'For You' },
                  { id: 'eat', label: 'Food Menu' },
                  { id: 'drink', label: 'Bar Menu' },
                  { id: 'merch', label: 'Merchandise' },
                  { id: 'repeat', label: 'Repeat' },
                  { id: 'orders', label: 'My Orders', badge: pendingOrders.length },
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
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 dark:bg-[#7C3AED] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-600 dark:bg-[#7C3AED]" />
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
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-primary" />}
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
                  type="button"
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="p-2.5 rounded-xl border border-border/80 dark:border-white/10 bg-white dark:bg-white/5 text-text-muted hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/15 hover:border-rose-500/30 dark:hover:border-rose-500/30 transition-all cursor-pointer"
                  title="Exit Customer View"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile & Tablet Sub-nav Tabs (Hidden on Desktop lg+) */}
            <div className="lg:hidden flex items-center justify-between gap-2 overflow-x-auto py-1 text-xs scrollbar-none no-scrollbar overscroll-x-contain border-t border-border/40 dark:border-white/5">
              <div className="flex items-center gap-1.5 shrink-0">
                {[
                  { id: 'home', label: 'For You' },
                  { id: 'eat', label: 'Food' },
                  { id: 'drink', label: 'Drink' },
                  { id: 'merch', label: 'Merchandise' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as CustomerNavTab)}
                    className={`shrink-0 rounded-xl px-3 py-1 text-xs font-bold transition-all cursor-pointer select-none ${
                      activeTab === tab.id
                        ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs font-black'
                        : 'text-text-muted hover:text-text-primary dark:text-zinc-400 dark:hover:text-white bg-black/5 dark:bg-white/5 border border-border/40 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-text-muted dark:text-zinc-400">
                <span className="px-2 py-0.5 rounded-lg border border-border/50 dark:border-white/5 bg-black/5 dark:bg-white/5 whitespace-nowrap">
                  Food ~23:00
                </span>
                <span className="px-2 py-0.5 rounded-lg border border-border/50 dark:border-white/5 bg-black/5 dark:bg-white/5 whitespace-nowrap">
                  Drinks ~23:30
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

        {/* Ordering Cutoff Notice (15-Minute Remaining Business Rule) */}
        {isOrderingCutoffReached && !isBillPaidOrSettled && (
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 animate-fade-in">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2.5 shadow-xs">
              <Clock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Ordering is closed as there are 15 minutes or less remaining in your table session. You can still view your bill and call the waiter.</span>
            </div>
          </div>
        )}

        {/* Session Settled Notice */}
        {isBillPaidOrSettled && (
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 animate-fade-in">
            <div className="rounded-2xl border border-primary/30 dark:border-[#D4AF37]/30 bg-primary/5 dark:bg-[#D4AF37]/10 p-4 text-xs font-bold text-primary dark:text-[#D4AF37] flex items-center gap-2.5 shadow-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Your dining session bill is settled. Thank you for dining at Pegs N Bottles!</span>
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
        <main className="w-full max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-3.5 sm:pt-5 pb-6 flex-1 space-y-5 sm:space-y-6">
        {/* ==================================================================== */}
        {/* VIEW: HOME ("For You")                                              */}
        {/* ==================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-7 sm:space-y-8 animate-fade-in pb-4">
            {/* Search link */}
            <button
              onClick={() => setActiveTab('search')}
              className="w-full flex items-center gap-3 rounded-2xl border border-primary/30 hover:border-primary/60 dark:border-[#D4AF37]/50 dark:hover:border-[#E5C158] bg-white dark:bg-[#18181B] px-5 py-3.5 text-xs text-text-muted dark:text-zinc-400 hover:shadow-md transition-all shadow-xs dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)] cursor-pointer"
            >
              <Search className="w-4 h-4 text-primary dark:text-[#D4AF37]" />
              <span>Search for a dish, drink or category…</span>
            </button>

            {/* Welcome banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-primary/20 dark:border-white/10 pb-4">
              <div>
                <h2 className="font-black text-2xl sm:text-3xl text-text-primary dark:text-white tracking-tight">
                  Welcome to Pegs N Bottles
                </h2>
                <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 mt-1">
                  {tableNumber ? `Table ${tableNumber} · ` : ''}{pendingOrders.length > 0 ? `You have ${pendingOrders.length} pending order${pendingOrders.length === 1 ? '' : 's'}` : `You have ${activeOrders.length} placed order${activeOrders.length === 1 ? '' : 's'}`} in this session.
                </p>
              </div>
            </div>

            {/* Unified Explore Category Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5">
              {/* Explore Food Card */}
              <div
                onClick={() => setActiveTab('eat')}
                className="group relative h-40 sm:h-44 md:h-48 rounded-2xl overflow-hidden border border-primary/30 hover:border-primary/70 dark:border-[#D4AF37]/50 dark:hover:border-[#E5C158] shadow-xs hover:shadow-md dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)] transition-all duration-300 cursor-pointer bg-zinc-950 flex flex-col justify-end p-4 sm:p-5"
              >
                {/* Background Image with natural gradient blend */}
                <img
                  src="https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80"
                  alt="Explore Food"
                  className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-75 dark:opacity-65"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-transparent to-transparent pointer-events-none" />

                {/* Content Overlay */}
                <div className="relative z-10 space-y-1">
                  <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-primary/80 text-white border border-white/20 dark:bg-[#D4AF37]/25 dark:text-[#E5C158] dark:border-[#D4AF37]/40 backdrop-blur-md">
                    Kitchen
                  </span>
                  <h3 className="font-black text-base sm:text-lg md:text-xl text-white leading-tight drop-shadow-md">
                    Explore Food
                  </h3>
                  <p className="text-xs text-zinc-200 font-medium line-clamp-1">
                    Starters, gourmet mains &amp; artisanal desserts
                  </p>
                  <div className="pt-0.5 flex items-center gap-1 text-xs font-bold text-purple-300 hover:text-white dark:text-[#E5C158] dark:hover:text-amber-300 group-hover:translate-x-1 transition-transform">
                    <span>Browse Menu</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>

              {/* Explore Bar Card */}
              <div
                onClick={() => setActiveTab('drink')}
                className="group relative h-40 sm:h-44 md:h-48 rounded-2xl overflow-hidden border border-primary/30 hover:border-primary/70 dark:border-[#D4AF37]/50 dark:hover:border-[#E5C158] shadow-xs hover:shadow-md dark:shadow-[0_2px_12px_rgba(0,0,0,0.35)] transition-all duration-300 cursor-pointer bg-zinc-950 flex flex-col justify-end p-4 sm:p-5"
              >
                {/* Background Image with natural gradient blend */}
                <img
                  src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=600&q=80"
                  alt="Explore Bar"
                  className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-75 dark:opacity-65"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-transparent to-transparent pointer-events-none" />

                {/* Content Overlay */}
                <div className="relative z-10 space-y-1">
                  <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-primary/80 text-white border border-white/20 dark:bg-[#D4AF37]/25 dark:text-[#E5C158] dark:border-[#D4AF37]/40 backdrop-blur-md">
                    Bar &amp; Spirits
                  </span>
                  <h3 className="font-black text-base sm:text-lg md:text-xl text-white leading-tight drop-shadow-md">
                    Explore Bar
                  </h3>
                  <p className="text-xs text-zinc-200 font-medium line-clamp-1">
                    Craft cocktails, single malts, beers &amp; wines
                  </p>
                  <div className="pt-0.5 flex items-center gap-1 text-xs font-bold text-purple-300 hover:text-white dark:text-[#E5C158] dark:hover:text-amber-300 group-hover:translate-x-1 transition-transform">
                    <span>View Bar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Cart Recovery Card */}
            {cart.length > 0 && (
              <div
                onClick={() => setActiveTab('cart')}
                className="flex items-center justify-between rounded-2xl border border-primary/40 dark:border-[#D4AF37]/50 bg-primary/5 dark:bg-[#D4AF37]/10 px-5 py-4 cursor-pointer shadow-xs hover:bg-primary/10 dark:hover:bg-[#D4AF37]/15 transition-all"
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

            {/* Curated Sections: Horizontal Scrolling on Mobile, Grid on Tablet/Desktop */}
            {featuredItems.length > 0 && (
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-lg sm:text-xl text-text-primary dark:text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" /> Tonight's Specials
                  </h3>
                  <button
                    onClick={() => setActiveTab('eat')}
                    className="text-xs font-bold text-primary dark:text-[#D4AF37] hover:underline cursor-pointer"
                  >
                    View All →
                  </button>
                </div>
                <div className="flex md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-3.5 lg:gap-4 overflow-x-auto md:overflow-visible no-scrollbar overscroll-x-contain -mx-3.5 sm:-mx-6 px-3.5 sm:px-6 md:mx-0 md:px-0 pb-2 pt-0.5 snap-x snap-mandatory scroll-smooth">
                  {featuredItems.map((i) => (
                    <div key={i.id} className="w-[124px] xs:w-[132px] sm:w-[140px] shrink-0 md:w-auto snap-start h-full flex">
                      <MenuItemCard
                        item={i}
                        variant="home"
                        cartQuantity={cartItemQuantityMap[i.id] || 0}
                        isOrderingDisabled={isOrderingBlocked}
                        onOpenCustomizer={handleOpenCustomizer}
                        onDirectAdd={handleDirectAdd}
                        onIncrement={handleCardIncrement}
                        onDecrement={handleCardDecrement}
                        onOpenDetails={setSelectedDetailItem}
                        onOpenImageModal={(url, name) => setSelectedImageModal({ url, name })}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {popularItems.length > 0 && (
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-lg sm:text-xl text-text-primary dark:text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-primary dark:text-[#D4AF37]" /> Popular at Pegs N Bottles
                  </h3>
                  <button
                    onClick={() => setActiveTab('eat')}
                    className="text-xs font-bold text-primary dark:text-[#D4AF37] hover:underline cursor-pointer"
                  >
                    View All →
                  </button>
                </div>
                <div className="flex md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-3.5 lg:gap-4 overflow-x-auto md:overflow-visible no-scrollbar overscroll-x-contain -mx-3.5 sm:-mx-6 px-3.5 sm:px-6 md:mx-0 md:px-0 pb-2 pt-0.5 snap-x snap-mandatory scroll-smooth">
                  {popularItems.map((i) => (
                    <div key={i.id} className="w-[124px] xs:w-[132px] sm:w-[140px] shrink-0 md:w-auto snap-start h-full flex">
                      <MenuItemCard
                        item={i}
                        variant="home"
                        cartQuantity={cartItemQuantityMap[i.id] || 0}
                        isOrderingDisabled={isOrderingBlocked}
                        onOpenCustomizer={handleOpenCustomizer}
                        onDirectAdd={handleDirectAdd}
                        onIncrement={handleCardIncrement}
                        onDecrement={handleCardDecrement}
                        onOpenDetails={setSelectedDetailItem}
                        onOpenImageModal={(url, name) => setSelectedImageModal({ url, name })}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {drinkHighlights.length > 0 && (
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-lg sm:text-xl text-text-primary dark:text-white flex items-center gap-2">
                    <Wine className="w-5 h-5 text-primary dark:text-[#D4AF37]" /> Recommended Drinks
                  </h3>
                  <button
                    onClick={() => setActiveTab('drink')}
                    className="text-xs font-bold text-primary dark:text-[#D4AF37] hover:underline cursor-pointer"
                  >
                    View Bar →
                  </button>
                </div>
                <div className="flex md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-3.5 lg:gap-4 overflow-x-auto md:overflow-visible no-scrollbar overscroll-x-contain -mx-3.5 sm:-mx-6 px-3.5 sm:px-6 md:mx-0 md:px-0 pb-2 pt-0.5 snap-x snap-mandatory scroll-smooth">
                  {drinkHighlights.map((i) => (
                    <div key={i.id} className="w-[124px] xs:w-[132px] sm:w-[140px] shrink-0 md:w-auto snap-start h-full flex">
                      <MenuItemCard
                        item={i}
                        variant="home"
                        cartQuantity={cartItemQuantityMap[i.id] || 0}
                        isOrderingDisabled={isOrderingBlocked}
                        onOpenCustomizer={handleOpenCustomizer}
                        onDirectAdd={handleDirectAdd}
                        onIncrement={handleCardIncrement}
                        onDecrement={handleCardDecrement}
                        onOpenDetails={setSelectedDetailItem}
                        onOpenImageModal={(url, name) => setSelectedImageModal({ url, name })}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {dessertItems.length > 0 && (
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-lg sm:text-xl text-text-primary dark:text-white">Chef's Desserts</h3>
                  <button
                    onClick={() => setActiveTab('eat')}
                    className="text-xs font-bold text-primary dark:text-[#D4AF37] hover:underline cursor-pointer"
                  >
                    View All →
                  </button>
                </div>
                <div className="flex md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-3.5 lg:gap-4 overflow-x-auto md:overflow-visible no-scrollbar overscroll-x-contain -mx-3.5 sm:-mx-6 px-3.5 sm:px-6 md:mx-0 md:px-0 pb-2 pt-0.5 snap-x snap-mandatory scroll-smooth">
                  {dessertItems.map((i) => (
                    <div key={i.id} className="w-[124px] xs:w-[132px] sm:w-[140px] shrink-0 md:w-auto snap-start h-full flex">
                      <MenuItemCard
                        item={i}
                        variant="home"
                        cartQuantity={cartItemQuantityMap[i.id] || 0}
                        isOrderingDisabled={isOrderingBlocked}
                        onOpenCustomizer={handleOpenCustomizer}
                        onDirectAdd={handleDirectAdd}
                        onIncrement={handleCardIncrement}
                        onDecrement={handleCardDecrement}
                        onOpenDetails={setSelectedDetailItem}
                        onOpenImageModal={(url, name) => setSelectedImageModal({ url, name })}
                      />
                    </div>
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
          <div className="space-y-4 sm:space-y-5 animate-fade-in">
            {/* 1. Header & Live Search Bar */}
            <div className="space-y-2.5 pb-2 border-b border-border/60 dark:border-white/10">
              <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                <div className="min-w-0">
                  <h2 className="font-black text-lg sm:text-xl text-text-primary dark:text-white leading-tight">
                    Food Menu
                  </h2>
                  <p className="hidden sm:block text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 mt-0.5">
                    Freshly prepared in our chef's kitchen. Tap any dish to customize or order.
                  </p>
                </div>

                {/* Dietary Toggle Filter (All, Veg, Egg, Non-Veg) - Aligned to right of Food Menu */}
                <div className="flex items-center gap-0.5 sm:gap-1 bg-black/5 dark:bg-white/5 p-0.5 sm:p-1 rounded-xl border border-border/40 dark:border-white/10 shrink-0">
                  {(['ALL', 'VEG', 'EGG', 'NON_VEG'] as const).map((df) => (
                    <button
                      key={df}
                      onClick={() => setDietaryFilter(df)}
                      className={`text-[10px] xs:text-[11px] sm:text-xs font-bold px-1.5 xs:px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 select-none ${
                        dietaryFilter === df
                          ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs font-extrabold'
                          : 'text-text-muted hover:text-text-primary hover:bg-black/5 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/5'
                      }`}
                    >
                      {df === 'VEG' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                      {df === 'EGG' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                      {df === 'NON_VEG' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />}
                      <span>
                        {df === 'ALL'
                          ? 'All'
                          : df === 'VEG'
                          ? 'Veg'
                          : df === 'EGG'
                          ? 'Egg'
                          : 'Non-Veg'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <p className="sm:hidden text-[11px] text-text-muted dark:text-zinc-400">
                Freshly prepared in our chef's kitchen. Tap any dish to customize or order.
              </p>

              {/* In-Menu Instant Search Bar */}
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted dark:text-zinc-500" />
                <input
                  type="text"
                  value={eatSearchQuery}
                  onChange={(e) => setEatSearchQuery(e.target.value)}
                  placeholder="Search dishes by name, spice level, or category..."
                  className="w-full text-xs pl-10 pr-10 py-2 rounded-xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] text-text-primary dark:text-white placeholder:text-text-muted/60 dark:placeholder:text-zinc-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:focus:border-[#D4AF37] dark:focus:ring-[#D4AF37]/20 transition-all shadow-2xs"
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

            {/* 2. Category Filter Chips (Mobile & Tablet - Natural scroll) */}
            <div className="lg:hidden -mx-3.5 sm:-mx-6 px-3.5 sm:px-6 py-1.5 overflow-x-auto overscroll-x-contain no-scrollbar flex items-center gap-1.5">
              <button
                onClick={() => handleSelectEatCategory('ALL')}
                className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 transition-all cursor-pointer ${
                  selectedEatCategory === 'ALL'
                    ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs font-extrabold'
                    : 'bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 text-text-muted dark:text-zinc-300 hover:text-text-primary hover:border-primary/40 dark:hover:border-[#D4AF37]/40'
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
                    onClick={() => handleSelectEatCategory(cat.id)}
                    className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 transition-all cursor-pointer ${
                      selectedEatCategory === cat.id
                        ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs font-extrabold'
                        : 'bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 text-text-muted dark:text-zinc-300 hover:text-text-primary hover:border-primary/40 dark:hover:border-[#D4AF37]/40'
                    }`}
                  >
                    {getFoodCategoryDisplayName(cat)}
                  </button>
                ))}
            </div>

            {/* 3. Main Content Layout: Responsive Desktop Split Rail + Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
              {/* Desktop Sticky Category Navigation Rail (lg:col-span-3) */}
              <aside className="hidden lg:block lg:col-span-3 sticky top-16 space-y-1.5">
                <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-2.5 shadow-xs space-y-0.5 max-h-[calc(100vh-5.5rem)] overflow-y-auto no-scrollbar">
                  <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-text-muted dark:text-zinc-500">
                    Categories
                  </div>
                  <button
                    onClick={() => handleSelectEatCategory('ALL')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                      selectedEatCategory === 'ALL'
                        ? 'bg-primary/10 text-primary border border-primary/20 dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] dark:border-[#D4AF37]/30 font-extrabold shadow-2xs'
                        : 'text-text-muted dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary dark:hover:text-white border border-transparent'
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
                          onClick={() => handleSelectEatCategory(cat.id)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
                            selectedEatCategory === cat.id
                              ? 'bg-primary/10 text-primary border border-primary/20 dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] dark:border-[#D4AF37]/30 font-extrabold shadow-2xs'
                              : 'text-text-muted dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-text-primary dark:hover:text-white border border-transparent'
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

                    const unassignedEatItems = selectedEatCategory === 'ALL'
                      ? getSectionItems('eat').filter((i) => !i.categoryId)
                      : [];

                    const totalMatchingItems = activeCategories.reduce((sum, cat) => {
                      return sum + getSectionItems('eat').filter((i) => i.categoryId === cat.id).length;
                    }, 0) + unassignedEatItems.length;

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
                                handleSelectEatCategory('ALL');
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
                      <div className="space-y-2.5 sm:space-y-3">
                        {activeCategories.map((cat) => {
                          const catItems = getSectionItems('eat').filter((i) => i.categoryId === cat.id);
                          if (catItems.length === 0) return null;
                          const isExpanded = expandedCategories[cat.id] !== false;

                          // Derive unique subcategories from products currently matching this category view
                          const subcatMap = new Map<string, { id: string; name: string; sortOrder: number }>();
                          catItems.forEach((item) => {
                            if (item.subcategory && item.subcategory.id && item.subcategory.name) {
                              subcatMap.set(item.subcategory.id, {
                                id: item.subcategory.id,
                                name: item.subcategory.name,
                                sortOrder: item.subcategory.sortOrder || 0,
                              });
                            } else if (item.subcategoryId) {
                              const found = (cat.subcategories || []).find((s: any) => s.id === item.subcategoryId);
                              if (found) {
                                subcatMap.set(found.id, {
                                  id: found.id,
                                  name: found.name,
                                  sortOrder: found.sortOrder || 0,
                                });
                              }
                            }
                          });
                          const availableSubcategories = Array.from(subcatMap.values()).sort(
                            (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name)
                          );

                          // Active subcategory filters for this specific category
                          const activeSubcatIds = selectedSubcategories[cat.id] || [];

                          // Filter items: if no subcategories selected, show all items (including subcategoryId === null)
                          // If subcategories are selected, show only items matching selected subcategories
                          const displayedItems = catItems.filter((item) => {
                            if (activeSubcatIds.length === 0) return true;
                            return item.subcategoryId && activeSubcatIds.includes(item.subcategoryId);
                          });

                          return (
                            <div
                              key={cat.id}
                              className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] overflow-hidden shadow-xs"
                            >
                              <button
                                onClick={() => toggleCategory(cat.id)}
                                aria-expanded={isExpanded}
                                className="w-full flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-sm sm:text-base text-text-primary dark:text-white">
                                    {getFoodCategoryDisplayName(cat)}
                                  </span>
                                  <span className="text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 font-bold">
                                    ({catItems.length})
                                  </span>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-text-muted group-hover:text-text-primary dark:group-hover:text-white transition-colors" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-text-primary dark:group-hover:text-white transition-colors" />
                                )}
                              </button>

                              {isExpanded && (
                                <div>
                                  {/* Subcategory Multi-Filter Chips Bar */}
                                  {availableSubcategories.length > 0 && (
                                    <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-black/[0.02] dark:bg-white/[0.02] border-t border-b border-border/40 dark:border-white/5 flex items-center justify-between gap-2.5">
                                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1">
                                        {availableSubcategories.map((sub) => {
                                          const isSelected = activeSubcatIds.includes(sub.id);
                                          const subCount = catItems.filter((i) => i.subcategoryId === sub.id).length;
                                          return (
                                            <button
                                              key={sub.id}
                                              type="button"
                                              onClick={() => handleToggleSubcategory(cat.id, sub.id)}
                                              className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                                                isSelected
                                                  ? 'bg-primary/10 border border-primary text-primary dark:bg-[#D4AF37]/15 dark:border-[#D4AF37] dark:text-[#D4AF37] shadow-xs font-extrabold'
                                                  : 'bg-white dark:bg-white/5 border border-border/70 dark:border-white/10 text-text-muted dark:text-zinc-300 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 hover:text-text-primary dark:hover:text-white'
                                              }`}
                                              aria-pressed={isSelected}
                                            >
                                              {isSelected ? (
                                                <CheckSquare className="w-3 h-3 text-primary dark:text-[#D4AF37] shrink-0" />
                                              ) : (
                                                <Square className="w-3 h-3 text-text-muted/60 dark:text-zinc-500 shrink-0" />
                                              )}
                                              <span>{sub.name}</span>
                                              <span className={`text-[10px] ${isSelected ? 'text-primary/80 dark:text-[#D4AF37]/80' : 'opacity-60'}`}>
                                                ({subCount})
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                      {activeSubcatIds.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() => handleClearSubcategories(cat.id)}
                                          className="text-[11px] font-bold text-text-muted hover:text-rose-500 dark:text-zinc-400 dark:hover:text-rose-400 shrink-0 flex items-center gap-1 transition-colors cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
                                          title="Clear subcategory filters"
                                        >
                                          <X className="w-3 h-3" />
                                          <span>Clear</span>
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Products Grid */}
                                  {displayedItems.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-text-muted dark:text-zinc-400 space-y-2">
                                      <p>No dishes match the selected subcategories.</p>
                                      <button
                                        type="button"
                                        onClick={() => handleClearSubcategories(cat.id)}
                                        className="px-3.5 py-1.5 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                                      >
                                        Show All in {getFoodCategoryDisplayName(cat)}
                                      </button>
                                    </div>
                                  ) : (
                                    <div className={`p-2.5 sm:p-3.5 flex md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-3.5 overflow-x-auto md:overflow-visible no-scrollbar overscroll-x-contain snap-x snap-mandatory scroll-smooth pb-2 pt-0.5 ${
                                      availableSubcategories.length === 0 ? 'border-t border-border/40 dark:border-white/5' : ''
                                    }`}>
                                      {displayedItems.map((item) => (
                                        <div key={item.id} className="w-[124px] xs:w-[132px] sm:w-[140px] shrink-0 md:w-auto snap-start h-full flex">
                                          <MenuItemCard
                                            item={item}
                                            cartQuantity={cartItemQuantityMap[item.id] || 0}
                                            isOrderingDisabled={isOrderingBlocked}
                                            onOpenCustomizer={handleOpenCustomizer}
                                            onDirectAdd={handleDirectAdd}
                                            onIncrement={handleCardIncrement}
                                            onDecrement={handleCardDecrement}
                                            onOpenDetails={setSelectedDetailItem}
                                            onOpenImageModal={(url, name) => setSelectedImageModal({ url, name })}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {unassignedEatItems.length > 0 && (() => {
                          const isExpanded = expandedCategories['unassigned-eat'] !== false;
                          return (
                            <div
                              key="unassigned-eat"
                              className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] overflow-hidden shadow-xs"
                            >
                              <button
                                onClick={() => toggleCategory('unassigned-eat')}
                                aria-expanded={isExpanded}
                                className="w-full flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-sm sm:text-base text-text-primary dark:text-white">
                                    Other Dishes
                                  </span>
                                  <span className="text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 font-bold">
                                    ({unassignedEatItems.length})
                                  </span>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-text-muted group-hover:text-text-primary dark:group-hover:text-white transition-colors" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-text-primary dark:group-hover:text-white transition-colors" />
                                )}
                              </button>

                              {isExpanded && (
                                <div className="p-2.5 sm:p-3.5 flex md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-3.5 border-t border-border/40 dark:border-white/5 overflow-x-auto md:overflow-visible no-scrollbar overscroll-x-contain snap-x snap-mandatory scroll-smooth pb-2 pt-0.5">
                                  {unassignedEatItems.map((item) => (
                                    <div key={item.id} className="w-[124px] xs:w-[132px] sm:w-[140px] shrink-0 md:w-auto snap-start h-full flex">
                                      <MenuItemCard
                                        item={item}
                                        cartQuantity={cartItemQuantityMap[item.id] || 0}
                                        isOrderingDisabled={isOrderingBlocked}
                                        onOpenCustomizer={handleOpenCustomizer}
                                        onDirectAdd={handleDirectAdd}
                                        onIncrement={handleCardIncrement}
                                        onDecrement={handleCardDecrement}
                                        onOpenDetails={setSelectedDetailItem}
                                        onOpenImageModal={(url, name) => setSelectedImageModal({ url, name })}
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
          <div className="space-y-4 sm:space-y-5 animate-fade-in">
            {/* 1. Header & Live Search Bar */}
            <div className="space-y-2.5 pb-2 border-b border-border/60 dark:border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <div>
                  <h2 className="font-black text-lg sm:text-xl text-text-primary dark:text-white leading-tight">
                    Bar Menu
                  </h2>
                  <p className="text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 mt-0.5">
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
                  className="w-full text-xs pl-10 pr-10 py-2 rounded-xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] text-text-primary dark:text-white placeholder:text-text-muted/60 dark:placeholder:text-zinc-500 focus:outline-none focus:border-primary dark:focus:border-[#D4AF37] transition-colors shadow-2xs"
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

            {/* 2. Category Filter Chips (Mobile & Tablet - Natural scroll) */}
            <div className="lg:hidden -mx-3.5 sm:-mx-6 px-3.5 sm:px-6 py-1.5 overflow-x-auto overscroll-x-contain no-scrollbar flex items-center gap-1.5">
              <button
                onClick={() => handleSelectDrinkCategory('ALL')}
                className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 transition-all cursor-pointer ${
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
                    onClick={() => handleSelectDrinkCategory(cat.id)}
                    className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 transition-all cursor-pointer ${
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
              {/* Desktop Sticky Category Navigation Rail (lg:col-span-3) */}
              <aside className="hidden lg:block lg:col-span-3 sticky top-16 space-y-1.5">
                <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-2.5 shadow-xs space-y-0.5 max-h-[calc(100vh-5.5rem)] overflow-y-auto no-scrollbar">
                  <div className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-text-muted dark:text-zinc-500">
                    Bar Categories
                  </div>
                  <button
                    onClick={() => handleSelectDrinkCategory('ALL')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
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
                          onClick={() => handleSelectDrinkCategory(cat.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-between ${
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
              <div className="lg:col-span-9 space-y-4 sm:space-y-5">
                {/* Skeleton Loading State */}
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="h-5 w-40 rounded-lg bg-zinc-200 dark:bg-white/10 animate-pulse" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-2.5 sm:gap-3 lg:gap-3.5">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div
                          key={`drink-skel-${idx}`}
                          className="h-28 rounded-2xl bg-white dark:bg-[#18181B] border border-border/60 dark:border-white/10 p-3 animate-pulse flex justify-between"
                        >
                          <div className="space-y-2 flex-1">
                            <div className="h-3.5 w-24 rounded bg-zinc-200 dark:bg-white/10" />
                            <div className="h-2.5 w-36 rounded bg-zinc-200 dark:bg-white/10" />
                            <div className="h-3.5 w-14 rounded bg-zinc-200 dark:bg-white/10 mt-4" />
                          </div>
                          <div className="w-16 h-16 rounded-xl bg-zinc-200 dark:bg-white/10 shrink-0" />
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

                    const unassignedDrinkItems = selectedDrinkCategory === 'ALL'
                      ? getSectionItems('drink').filter((i) => !i.categoryId)
                      : [];

                    const totalMatchingItems = activeCategories.reduce((sum, cat) => {
                      return sum + getSectionItems('drink').filter((i) => i.categoryId === cat.id).length;
                    }, 0) + unassignedDrinkItems.length;

                    if (totalMatchingItems === 0) {
                      return (
                        <div className="rounded-3xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-8 sm:p-10 text-center space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/15 text-primary dark:text-[#D4AF37] flex items-center justify-center mx-auto text-xl">
                            <Wine className="w-6 h-6" />
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-text-primary dark:text-white">
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
                                handleSelectDrinkCategory('ALL');
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                            >
                              Reset Filters
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2.5 sm:space-y-3">
                        {activeCategories.map((cat) => {
                          const catItems = getSectionItems('drink').filter((i) => i.categoryId === cat.id);
                          if (catItems.length === 0) return null;
                          const isExpanded = expandedCategories[cat.id] !== false;

                          // Derive unique subcategories from products currently matching this category view
                          const subcatMap = new Map<string, { id: string; name: string; sortOrder: number }>();
                          catItems.forEach((item) => {
                            if (item.subcategory && item.subcategory.id && item.subcategory.name) {
                              subcatMap.set(item.subcategory.id, {
                                id: item.subcategory.id,
                                name: item.subcategory.name,
                                sortOrder: item.subcategory.sortOrder || 0,
                              });
                            } else if (item.subcategoryId) {
                              const found = (cat.subcategories || []).find((s: any) => s.id === item.subcategoryId);
                              if (found) {
                                subcatMap.set(found.id, {
                                  id: found.id,
                                  name: found.name,
                                  sortOrder: found.sortOrder || 0,
                                });
                              }
                            }
                          });
                          const availableSubcategories = Array.from(subcatMap.values()).sort(
                            (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name)
                          );

                          // Active subcategory filters for this specific category
                          const activeSubcatIds = selectedSubcategories[cat.id] || [];

                          // Filter items: if no subcategories selected, show all items (including subcategoryId === null)
                          // If subcategories are selected, show only items matching selected subcategories
                          const displayedItems = catItems.filter((item) => {
                            if (activeSubcatIds.length === 0) return true;
                            return item.subcategoryId && activeSubcatIds.includes(item.subcategoryId);
                          });

                          return (
                            <div
                              key={cat.id}
                              className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] overflow-hidden shadow-xs"
                              >
                                <button
                                  onClick={() => toggleCategory(cat.id)}
                                  aria-expanded={isExpanded}
                                  className="w-full flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-sm sm:text-base text-text-primary dark:text-white">
                                      {cat.name}
                                    </span>
                                    <span className="text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 font-bold">
                                      ({catItems.length})
                                    </span>
                                  </div>
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-text-muted" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-text-muted" />
                                  )}
                                </button>

                                {isExpanded && (
                                  <div>
                                    {/* Subcategory Multi-Filter Chips Bar */}
                                    {availableSubcategories.length > 0 && (
                                      <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-black/[0.02] dark:bg-white/[0.02] border-t border-b border-border/40 dark:border-white/5 flex items-center justify-between gap-2.5">
                                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1">
                                          {availableSubcategories.map((sub) => {
                                            const isSelected = activeSubcatIds.includes(sub.id);
                                            const subCount = catItems.filter((i) => i.subcategoryId === sub.id).length;
                                            return (
                                              <button
                                                key={sub.id}
                                                type="button"
                                                onClick={() => handleToggleSubcategory(cat.id, sub.id)}
                                                className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                                                  isSelected
                                                    ? 'bg-primary/10 border border-primary text-primary dark:bg-[#D4AF37]/15 dark:border-[#D4AF37] dark:text-[#D4AF37] shadow-xs font-extrabold'
                                                    : 'bg-white dark:bg-white/5 border border-border/70 dark:border-white/10 text-text-muted dark:text-zinc-300 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 hover:text-text-primary dark:hover:text-white'
                                                }`}
                                                aria-pressed={isSelected}
                                              >
                                                {isSelected ? (
                                                  <CheckSquare className="w-3 h-3 text-primary dark:text-[#D4AF37] shrink-0" />
                                                ) : (
                                                  <Square className="w-3 h-3 text-text-muted/60 dark:text-zinc-500 shrink-0" />
                                                )}
                                                <span>{sub.name}</span>
                                                <span className={`text-[10px] ${isSelected ? 'text-primary/80 dark:text-[#D4AF37]/80' : 'opacity-60'}`}>
                                                  ({subCount})
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                        {activeSubcatIds.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => handleClearSubcategories(cat.id)}
                                            className="text-[11px] font-bold text-text-muted hover:text-rose-500 dark:text-zinc-400 dark:hover:text-rose-400 shrink-0 flex items-center gap-1 transition-colors cursor-pointer px-1.5 py-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5"
                                            title="Clear subcategory filters"
                                          >
                                            <X className="w-3 h-3" />
                                            <span>Clear</span>
                                          </button>
                                        )}
                                      </div>
                                    )}

                                    {/* Products Grid */}
                                    {displayedItems.length === 0 ? (
                                      <div className="p-6 text-center text-xs text-text-muted dark:text-zinc-400 space-y-2">
                                        <p>No dishes match the selected subcategories.</p>
                                        <button
                                          type="button"
                                          onClick={() => handleClearSubcategories(cat.id)}
                                          className="px-3.5 py-1.5 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                                        >
                                          Show All in {cat.name}
                                        </button>
                                      </div>
                                    ) : (
                                        <div className={`p-2.5 sm:p-3.5 flex md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-3.5 overflow-x-auto md:overflow-visible no-scrollbar overscroll-x-contain snap-x snap-mandatory scroll-smooth pb-2 pt-0.5 ${
                                          availableSubcategories.length === 0 ? 'border-t border-border/40 dark:border-white/5' : ''
                                        }`}>
                                          {displayedItems.map((item) => (
                                            <div key={item.id} className="w-[124px] xs:w-[132px] sm:w-[140px] shrink-0 md:w-auto snap-start h-full flex">
                                              <MenuItemCard
                                                item={item}
                                                cartQuantity={cartItemQuantityMap[item.id] || 0}
                                                isOrderingDisabled={isOrderingBlocked}
                                                onOpenCustomizer={handleOpenCustomizer}
                                                onDirectAdd={handleDirectAdd}
                                                onIncrement={handleCardIncrement}
                                                onDecrement={handleCardDecrement}
                                                onOpenDetails={setSelectedDetailItem}
                                                onOpenImageModal={(url, name) => setSelectedImageModal({ url, name })}
                                              />
                                            </div>
                                          ))}
                                        </div>
                                     )}
                                   </div>
                                 )}
                              </div>
                            );
                          })}

                          {unassignedDrinkItems.length > 0 && (() => {
                            const isExpanded = expandedCategories['unassigned-drink'] !== false;
                            return (
                              <div
                                key="unassigned-drink"
                                className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] overflow-hidden shadow-xs"
                              >
                                <button
                                  onClick={() => toggleCategory('unassigned-drink')}
                                  aria-expanded={isExpanded}
                                  className="w-full flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-sm sm:text-base text-text-primary dark:text-white">
                                      Other Beverages
                                    </span>
                                    <span className="text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 font-bold">
                                      ({unassignedDrinkItems.length})
                                    </span>
                                  </div>
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-text-muted" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-text-muted" />
                                  )}
                                </button>

                                {isExpanded && (
                                  <div className="p-2.5 sm:p-3.5 flex md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-3.5 border-t border-border/40 dark:border-white/5 overflow-x-auto md:overflow-visible no-scrollbar overscroll-x-contain snap-x snap-mandatory scroll-smooth pb-2 pt-0.5">
                                    {unassignedDrinkItems.map((item) => (
                                      <div key={item.id} className="w-[124px] xs:w-[132px] sm:w-[140px] shrink-0 md:w-auto snap-start h-full flex">
                                        <MenuItemCard
                                          item={item}
                                          cartQuantity={cartItemQuantityMap[item.id] || 0}
                                          isOrderingDisabled={isOrderingBlocked}
                                          onOpenCustomizer={handleOpenCustomizer}
                                          onDirectAdd={handleDirectAdd}
                                          onIncrement={handleCardIncrement}
                                          onDecrement={handleCardDecrement}
                                          onOpenDetails={setSelectedDetailItem}
                                          onOpenImageModal={(url, name) => setSelectedImageModal({ url, name })}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 sm:landscape:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3.5 lg:gap-4">
                  {merchItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      cartQuantity={cartItemQuantityMap[item.id] || 0}
                      isOrderingDisabled={isOrderingBlocked}
                      onOpenCustomizer={handleOpenCustomizer}
                      onDirectAdd={handleDirectAdd}
                      onIncrement={handleCardIncrement}
                      onDecrement={handleCardDecrement}
                      onOpenDetails={setSelectedDetailItem}
                      onOpenImageModal={(url, name) => setSelectedImageModal({ url, name })}
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

            <div className="grid grid-cols-2 sm:grid-cols-3 sm:landscape:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3.5 lg:gap-4">
              {allItems
                .filter((i) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase().trim();
                  const cleanQ = q.replace(/[-\s_]/g, '');

                  const matchesName = i.name.toLowerCase().includes(q);
                  const matchesDesc = (i.description || '').toLowerCase().includes(q);
                  const matchesCat = (i.categoryName || '').toLowerCase().includes(q);
                  const matchesSubcat = (i.subcategory?.name || '').toLowerCase().includes(q);

                  let matchesDietary = false;
                  if (i.foodType) {
                    const ft = i.foodType.toLowerCase();
                    const cleanFt = ft.replace(/[_-\s]/g, '');
                    if (cleanQ === 'veg' || cleanQ === 'vegetarian') {
                      matchesDietary = ft === 'veg' || ft === 'vegan';
                    } else if (cleanQ === 'nonveg' || cleanQ === 'nonvegetarian') {
                      matchesDietary = ft === 'non_veg';
                    } else if (cleanQ === 'egg' || cleanQ === 'eggetarian') {
                      matchesDietary = ft === 'egg';
                    } else if (cleanQ === 'vegan') {
                      matchesDietary = ft === 'vegan';
                    } else {
                      matchesDietary = ft.includes(q) || cleanFt.includes(cleanQ);
                    }
                  }

                  const matchesTags = Array.isArray(i.tags) && i.tags.some((t: string) => t.toLowerCase().includes(q));
                  const matchesAllergens = Array.isArray(i.allergens) && i.allergens.some((a: string) => a.toLowerCase().includes(q));
                  const matchesStation = (i.station || '').toLowerCase().includes(q);

                  return (
                    matchesName ||
                    matchesDesc ||
                    matchesCat ||
                    matchesSubcat ||
                    matchesDietary ||
                    matchesTags ||
                    matchesAllergens ||
                    matchesStation
                  );
                })
                .map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    cartQuantity={cartItemQuantityMap[item.id] || 0}
                    isOrderingDisabled={isOrderingBlocked}
                    onOpenCustomizer={handleOpenCustomizer}
                    onDirectAdd={handleDirectAdd}
                    onIncrement={handleCardIncrement}
                    onDecrement={handleCardDecrement}
                    onOpenDetails={setSelectedDetailItem}
                    onOpenImageModal={(url, name) => setSelectedImageModal({ url, name })}
                  />
                ))}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: CART (Split 2-Column on Desktop)                                */}
        {/* ==================================================================== */}
        {/* ==================================================================== */}
        {/* VIEW: CART (Split 2-Column on Tablet & Desktop, Compact on Mobile)   */}
        {/* ==================================================================== */}
        {activeTab === 'cart' && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in pb-20 sm:pb-32">
            {/* Header with Title, Context Subtitle, Session Context & Items Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-2.5 sm:pb-3 border-b border-border/60 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                  <h2 className="font-black text-xl sm:text-3xl text-text-primary dark:text-white tracking-tight">
                    Your Table Cart
                  </h2>
                  {cart.length > 0 && (
                    <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[11px] sm:text-xs font-bold bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]">
                      {cartCount} {cartCount === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 mt-0.5">
                  Review your selected unplaced items before dispatching to the kitchen &amp; bar.
                </p>
              </div>

              {/* Table / Dining Session Context */}
              <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] text-xs font-bold text-text-muted dark:text-zinc-300 w-fit shrink-0">
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
                className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in"
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
              <div className="max-w-xl mx-auto p-6 sm:p-12 text-center border border-dashed border-border/80 dark:border-white/10 rounded-3xl bg-white dark:bg-[#18181B] shadow-xs">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/15 flex items-center justify-center mx-auto mb-2.5 sm:mb-3">
                  <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7 text-primary dark:text-[#D4AF37]" />
                </div>
                <h3 className="font-bold text-sm sm:text-base text-text-primary dark:text-white">Your cart is empty</h3>
                <p className="text-xs text-text-muted dark:text-zinc-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  Browse our Food or Bar Menu to add items to your table session.
                </p>
                <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
                  <button
                    onClick={() => setActiveTab('eat')}
                    className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-black text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    Browse Food Menu
                  </button>
                  <button
                    onClick={() => setActiveTab('drink')}
                    className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-border/80 dark:border-white/10 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 bg-white dark:bg-white/5 hover:bg-primary/5 dark:hover:bg-[#D4AF37]/10 text-xs font-bold text-text-primary dark:text-white transition-colors cursor-pointer"
                  >
                    Browse Bar Menu
                  </button>
                </div>
                <div className="mt-4 pt-3 border-t border-border/60 dark:border-white/10 text-[11px] text-text-muted dark:text-zinc-500">
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
              <div className="md:grid md:grid-cols-12 md:gap-6 lg:gap-8 items-start space-y-4 md:space-y-0">
                {/* Left Column: Compact Cart Items List */}
                <div className="md:col-span-7 lg:col-span-7 xl:col-span-8 space-y-2.5 sm:space-y-3">
                  {cart.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-3 sm:p-5 shadow-xs transition-colors"
                    >
                      {/* Item Top Row: Name + Badge on Left, Total Price on Right */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <VegBadge type={c.foodType} size="sm" />
                            <div className="font-extrabold text-sm sm:text-base text-text-primary dark:text-white leading-tight break-words">
                              {c.name}
                            </div>
                          </div>
                          {(c.variantName || (c.modifiers && c.modifiers.length > 0)) && (
                            <div className="mt-0.5 text-[11px] sm:text-xs text-text-muted dark:text-zinc-400 break-words">
                              {[c.variantName, ...(c.modifiers || []).map((m: any) => m.optionName)].filter(Boolean).join(' · ')}
                            </div>
                          )}
                          {c.specialInstructions && (
                            <div className="mt-0.5 text-[11px] italic text-amber-500 break-words">"{c.specialInstructions}"</div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm sm:text-base font-black text-primary dark:text-[#D4AF37]">
                            ₹{(Number(c.unitPrice || 0) * (c.quantity || 1)).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-text-muted dark:text-zinc-400">
                            ₹{Number(c.unitPrice || 0).toFixed(2)}/ea
                          </div>
                        </div>
                      </div>

                      {/* Item Bottom Row: Compact Stepper on Left, Delete Action on Right */}
                      <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/60 dark:border-white/10 gap-2">
                        {/* Stepper with compact responsive touch targets */}
                        <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-0.5 rounded-lg border border-border/60 dark:border-white/10">
                          <button
                            disabled={isOrdering}
                            onClick={() => updateCartQuantity(c.id, -1)}
                            aria-label={c.quantity === 1 ? `Remove ${c.name} from cart` : `Decrease quantity of ${c.name}`}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer text-text-primary dark:text-white"
                          >
                            {c.quantity === 1 ? (
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            ) : (
                              <Minus className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span className="w-7 text-center font-black text-xs sm:text-sm text-primary dark:text-[#D4AF37]">
                            {c.quantity}
                          </span>
                          <button
                            disabled={isOrdering}
                            onClick={() => updateCartQuantity(c.id, 1)}
                            aria-label={`Increase quantity of ${c.name}`}
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer text-text-primary dark:text-white"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Remove Action */}
                        <button
                          disabled={isOrdering}
                          onClick={() => removeFromCart(c.id)}
                          aria-label={`Remove ${c.name} from cart`}
                          className="px-2 py-1 rounded-lg text-[11px] font-bold text-text-muted hover:text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Column: Order Summary Card */}
                <div className="md:col-span-5 lg:col-span-5 xl:col-span-4 md:sticky md:top-24 space-y-3.5">
                  <div className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-4 sm:p-5 space-y-3 text-xs shadow-xs">
                    <h3 className="font-black text-sm sm:text-base text-text-primary dark:text-white pb-2 border-b border-border/60 dark:border-white/10">
                      Order Summary
                    </h3>

                    <div className="flex justify-between text-text-muted dark:text-zinc-400 font-medium">
                      <span>Total Items</span>
                      <span className="font-bold text-text-primary dark:text-white">
                        {cartCount} {cartCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    <div className="flex justify-between text-text-primary dark:text-white font-extrabold text-sm pt-0.5">
                      <span>Cart Subtotal</span>
                      <span className="text-sm sm:text-base text-primary dark:text-[#D4AF37]">
                        ₹{Number(cartTotal || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="border-t border-border/60 dark:border-white/10 pt-2.5 text-[10.5px] sm:text-[11px] text-text-muted dark:text-zinc-400 leading-relaxed">
                      Taxes, service charge, and applicable discounts are calculated as part of your final table bill.
                    </div>

                    {isOrderingBlocked ? (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-amber-700 dark:text-amber-400 animate-fade-in">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed">
                          <p className="font-bold">
                            {isBillPaidOrSettled ? 'Session Settled / Closed' : 'Ordering Closed (15-Minute Cutoff)'}
                          </p>
                          <p className="mt-0.5 opacity-90">
                            {isBillPaidOrSettled
                              ? 'Your table session has been settled. Ordering new items is disabled.'
                              : 'Orders can only be placed when more than 15 minutes remain in the session. You may still view your bill or call the waiter.'}
                          </p>
                        </div>
                      </div>
                    ) : tableStatus === 'SETTLING' ? (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2 text-amber-700 dark:text-amber-400 animate-fade-in">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed">
                          <p className="font-bold">Bill Settlement in Progress</p>
                          <p className="mt-0.5 opacity-90">
                            Your server is finalizing the bill at your table. Ordering is temporarily paused.
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <button
                      disabled={isOrdering || cart.length === 0 || isOrderingBlocked || tableStatus === 'SETTLING'}
                      onClick={handlePlaceOrder}
                      className="w-full h-11 sm:h-13 mt-1.5 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-black disabled:opacity-50 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-between px-4 sm:px-5 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <span className="flex items-center gap-2">
                        {isOrdering && <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />}
                        <span>
                          {isBillPaidOrSettled
                            ? 'Ordering Locked (Settled)'
                            : isOrderingCutoffReached
                            ? 'Ordering Closed (15m Cutoff)'
                            : tableStatus === 'SETTLING'
                            ? 'Ordering Locked (Settling)'
                            : isOrdering
                            ? 'Placing Order...'
                            : 'Place Order'}
                        </span>
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

              <div className="flex items-center gap-2 flex-wrap">
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
                  const orderTotalAmount = o.subtotal != null
                    ? Number(o.subtotal)
                    : (o.items || []).reduce(
                        (acc: number, item: any) =>
                          item.status === 'CANCELLED' || item.status === 'STOCK_OUT'
                            ? acc
                            : acc + Number(item.lineTotal || item.unitPrice * item.quantity || 0),
                        0
                      );

                  return (
                    <div
                      key={o.id || idx}
                      className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-3.5 sm:p-5 space-y-2.5 sm:space-y-3 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between pb-2 sm:pb-3 border-b border-border/60 dark:border-white/10">
                          <div>
                            <div className="font-black text-sm sm:text-base text-text-primary dark:text-white">
                              Order #{String(o.orderNumber || idx + 1).padStart(2, '0')}
                            </div>
                            <div className="text-[10px] sm:text-[11px] text-text-muted dark:text-zinc-400 mt-0.5">
                              Placed {new Date(o.placedAt || o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <span
                            className={`text-[9.5px] sm:text-[10px] font-extrabold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full ${getOrderStatusBadgeClass(
                              o.status
                            )}`}
                          >
                            {o.status || 'PREPARING'}
                          </span>
                        </div>

                        <div className="divide-y divide-border/40 dark:divide-white/5 mt-1.5 sm:mt-2">
                          {(o.items || []).map((item: any) => (
                            <div key={item.id} className="flex flex-col py-2 sm:py-2.5 text-xs">
                              <div className="flex items-start justify-between gap-2.5">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {item.foodType && (
                                      <VegBadge type={item.foodType} size="sm" />
                                    )}
                                    <span className="font-bold text-text-primary dark:text-white break-words text-[11.5px] sm:text-xs">
                                      {item.itemName || item.name}
                                    </span>
                                    {item.variantName && (
                                      <span className="text-text-muted dark:text-zinc-400 text-[10.5px] sm:text-[11px]">
                                        · {item.variantName}
                                      </span>
                                    )}
                                    {item.selectedModifiers && Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                                      <span className="text-text-muted dark:text-zinc-400 text-[10.5px] sm:text-[11px]">
                                        · {item.selectedModifiers.map((m: any) => m.optionName || m.name || m).join(', ')}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[9.5px] sm:text-[10px] text-text-muted dark:text-zinc-400 mt-0.5">
                                    Qty {item.quantity} · {item.station?.toLowerCase()}
                                  </div>
                                  {item.specialInstructions && (
                                    <div className="text-[9.5px] sm:text-[10px] text-amber-600 dark:text-amber-400 italic mt-0.5">
                                      Note: {item.specialInstructions}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                  <div className="flex items-center gap-1.5">
                                    {/* Delete / Cancel Item Button: ONLY visible when item is NOT yet accepted by KDS (i.e. status is strictly 'PLACED') */}
                                    {item.status === 'PLACED' && (
                                      <button
                                        type="button"
                                        disabled={cancellingItemId === item.id}
                                        onClick={() => handleDeleteOrderItem(item.id, item.itemName || item.name)}
                                        aria-label={`Remove ${item.itemName || item.name} from order`}
                                        title="Remove item before kitchen/bar acceptance"
                                        className="p-1 rounded-md text-text-muted hover:text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 text-[10px] font-bold"
                                      >
                                        {cancellingItemId === item.id ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
                                        ) : (
                                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                        )}
                                        <span className="hidden xs:inline">Delete</span>
                                      </button>
                                    )}
                                    <span
                                      className={`text-[8.5px] sm:text-[9px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md ${
                                        item.status === 'SERVED'
                                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                          : item.status === 'READY'
                                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                          : item.status === 'STOCK_OUT'
                                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                          : item.status === 'CANCELLED'
                                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                          : item.status === 'ACCEPTED' || item.status === 'PREPARING'
                                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                          : 'bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
                                      }`}
                                    >
                                      {item.status === 'STOCK_OUT' ? 'STOCK OUT' : (item.status || 'PLACED')}
                                    </span>
                                  </div>
                                  {item.status === 'STOCK_OUT' ? (
                                    <div className="mt-0.5 flex flex-col items-end">
                                      <span className="line-through text-text-muted text-[10px]">
                                        ₹{Number(item.unitPrice * item.quantity).toFixed(2)}
                                      </span>
                                      <span className="font-bold text-xs text-rose-600 dark:text-rose-400">
                                        Not charged · ₹0.00
                                      </span>
                                    </div>
                                  ) : item.status === 'CANCELLED' ? (
                                    <div className="mt-0.5 flex flex-col items-end">
                                      <span className="line-through text-text-muted text-[10px]">
                                        ₹{Number(item.unitPrice * item.quantity).toFixed(2)}
                                      </span>
                                      <span className="font-bold text-xs text-rose-600 dark:text-rose-400">
                                        Cancelled · ₹0.00
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="mt-0.5 font-bold text-xs sm:text-sm text-text-primary dark:text-white">
                                      ₹{Number(item.lineTotal || item.unitPrice * item.quantity).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {item.status === 'STOCK_OUT' && (
                                <div className="mt-2 text-[10px] sm:text-[10.5px] text-rose-600 dark:text-rose-400 font-medium bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 space-y-0.5">
                                  <div className="font-bold flex items-center gap-1 text-[11px]">
                                    <span>Stock Unavailable</span>
                                  </div>
                                  <p className="text-[10px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                                    This item is currently out of stock and could not be prepared. The amount for this item will not be added to your bill. You can choose another available item.
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Card Footer */}
                      <div className="pt-2 sm:pt-3 border-t border-border/60 dark:border-white/10 mt-1.5 sm:mt-2 space-y-1 sm:space-y-1.5">
                        {o.notes && (
                          <div className="text-[10px] sm:text-[11px] text-text-muted dark:text-zinc-400 italic">
                            Order Note: {o.notes}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-muted dark:text-zinc-400 font-medium text-[11px] sm:text-xs">
                            {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[10px] sm:text-[11px] text-text-muted dark:text-zinc-400 font-medium">
                              Order Total:
                            </span>
                            <span className="font-black text-xs sm:text-sm text-primary dark:text-[#D4AF37]">
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
          const grossSubtotal = Number(activeBill?.grossSubtotal ?? activeBill?.subtotal ?? (foodSub + drinkSub + merchSub));
          const checkInAmountPaid = Number(
            activeBill?.amountPaid ??
            activeBill?.confirmedCheckInAmount ??
            activeBill?.entryFeePaid ??
            sessionData?.amountPaid ??
            sessionData?.session?.amountPaid ??
            0
          );
          const checkInPayment = Number(
            activeBill?.prepaidCreditApplied ??
            activeBill?.redemptionDeduction ??
            (checkInAmountPaid > 0 ? Math.min(checkInAmountPaid, grossSubtotal) : 0)
          );
          const discountTotal = Number(activeBill?.discountTotal || 0);
          const balanceBeforeCharges = Math.max(0, grossSubtotal - discountTotal - checkInPayment);
          const serviceCharge = Number(activeBill?.serviceChargeTotal ?? activeBill?.serviceCharge ?? 0);
          const taxTotal = Number(activeBill?.taxTotal ?? activeBill?.gst ?? 0);
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
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-text-primary dark:text-white break-words">
                                  {item.quantity} × {item.itemName || item.name}
                                </span>
                                {item.status === 'STOCK_OUT' && (
                                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    Stock Out
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-text-muted dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>Order #{String(item.orderNumber || 1).padStart(2, '0')}</span>
                                {item.variantName && <span>· {item.variantName}</span>}
                                {item.status === 'STOCK_OUT' ? (
                                  <span className="text-rose-600 dark:text-rose-400 font-semibold">· Not Charged (Out of stock)</span>
                                ) : (
                                  <span>· @ ₹{Number(item.unitPrice).toFixed(2)}</span>
                                )}
                              </div>
                            </div>
                            <div className="font-bold shrink-0 text-right">
                              {item.status === 'STOCK_OUT' ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold">₹0.00</span>
                              ) : (
                                <span className="text-text-primary dark:text-white font-bold">
                                  ₹{Number(item.lineTotal || item.unitPrice * item.quantity).toFixed(2)}
                                </span>
                              )}
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
                      {/* 1. Subtotal */}
                      <div className="flex justify-between text-text-muted dark:text-zinc-400">
                        <span>Subtotal</span>
                        <span className="font-semibold text-text-primary dark:text-white">
                          ₹{grossSubtotal.toFixed(2)}
                        </span>
                      </div>

                      {/* Optional Category Breakdown */}
                      {(foodSub > 0 || drinkSub > 0 || merchSub > 0) && ((foodSub > 0 && drinkSub > 0) || (foodSub > 0 && merchSub > 0) || (drinkSub > 0 && merchSub > 0)) && (
                        <div className="pl-3 space-y-1 text-[11px] text-text-muted/80 dark:text-zinc-500 border-l-2 border-border/50 dark:border-white/5">
                          {foodSub > 0 && (
                            <div className="flex justify-between">
                              <span>Food</span>
                              <span>₹{foodSub.toFixed(2)}</span>
                            </div>
                          )}
                          {drinkSub > 0 && (
                            <div className="flex justify-between">
                              <span>Drink</span>
                              <span>₹{drinkSub.toFixed(2)}</span>
                            </div>
                          )}
                          {merchSub > 0 && (
                            <div className="flex justify-between">
                              <span>Merchandise</span>
                              <span>₹{merchSub.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {discountTotal > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                          <span>Discount Applied</span>
                          <span>-₹{discountTotal.toFixed(2)}</span>
                        </div>
                      )}

                      {/* 2. Check-in Amount Paid & Deduction */}
                      {checkInAmountPaid > 0 && (
                        <>
                          <div className="flex justify-between text-text-muted dark:text-zinc-400">
                            <span>Check-in Amount Paid:</span>
                            <span className="font-mono text-text-primary dark:text-white">₹{checkInAmountPaid.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                            <span>Less Check-in Payment:</span>
                            <span className="font-mono">-₹{checkInPayment.toFixed(2)}</span>
                          </div>
                          {/* 3. Balance Before Charges */}
                          <div className="flex justify-between text-text-primary dark:text-white font-semibold pt-0.5">
                            <span>Balance Before Charges:</span>
                            <span className="font-mono">₹{balanceBeforeCharges.toFixed(2)}</span>
                          </div>
                        </>
                      )}

                      {/* 4. Service Charge */}
                      {serviceCharge > 0 && (
                        <div className="flex justify-between text-text-muted dark:text-zinc-400">
                          <span>Service Charge (5%)</span>
                          <span className="font-semibold text-text-primary dark:text-white">
                            ₹{serviceCharge.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* 5. GST */}
                      {taxTotal > 0 && (
                        <div className="flex justify-between text-text-muted dark:text-zinc-400">
                          <span>GST / Taxes (5%)</span>
                          <span className="font-semibold text-text-primary dark:text-white">
                            ₹{taxTotal.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {rounding !== 0 && (
                        <div className="flex justify-between text-text-muted dark:text-zinc-400 text-[11px]">
                          <span>Rounding Adjustment</span>
                          <span>{rounding > 0 ? `+₹${rounding.toFixed(2)}` : `-₹${Math.abs(rounding).toFixed(2)}`}</span>
                        </div>
                      )}

                      {/* 6. Final Amount Payable */}
                      <div className="pt-2 border-t border-border/60 dark:border-white/10 flex justify-between items-baseline">
                        <span className="font-bold text-sm text-text-primary dark:text-white">Final Amount Payable</span>
                        <span className="font-black text-base text-primary dark:text-[#D4AF37]">
                          ₹{grandTotal.toFixed(2)}
                        </span>
                      </div>

                      <button
                        onClick={handleRequestBill}
                        disabled={isRequestingBill || billRequested || billableItems.length === 0}
                        className="w-full mt-3 py-3.5 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-black text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRequestingBill ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Receipt className="w-4 h-4" />
                        )}
                        <span>{billRequested ? 'Staff Notified (Requested)' : isRequestingBill ? 'Requesting...' : 'Request Bill from Waiter'}</span>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {flatHistoryItems.map((item: RepeatItemConfig) => (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-xs hover:border-primary/40 dark:hover:border-[#D4AF37]/40 transition-all"
                  >
                    {/* Left: Compact Thumbnail */}
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/5 border border-border/40 dark:border-white/10 shrink-0 flex items-center justify-center">
                      {item.image ? (
                        <img
                          src={formatImageUrl(item.image)}
                          alt={item.itemName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-text-muted dark:text-zinc-500">
                          {item.station?.toUpperCase() === 'BAR' || item.foodType === 'BEVERAGE' ? (
                            <Wine className="w-6 h-6" />
                          ) : (
                            <UtensilsCrossed className="w-6 h-6" />
                          )}
                        </div>
                      )}
                      {item.foodType && (
                        <div className="absolute top-1 left-1">
                          <VegBadge type={item.foodType} size="sm" />
                        </div>
                      )}
                    </div>

                    {/* Middle: Title, Configuration Summary, Live Price */}
                    <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-xs sm:text-sm text-text-primary dark:text-white truncate">
                          {item.itemName}
                        </h4>
                        {item.variantName && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] shrink-0">
                            {item.variantName}
                          </span>
                        )}
                      </div>

                      {/* Short configuration info */}
                      <div className="text-[11px] text-text-muted dark:text-zinc-400 flex items-center gap-1.5 flex-wrap truncate">
                        {item.selectedModifiers.length > 0 && (
                          <span className="truncate">
                            +{item.selectedModifiers.map((m) => m.optionName).join(', ')}
                          </span>
                        )}
                        {item.specialInstructions && (
                          <span className="italic truncate text-[10.5px]">
                            &quot;{item.specialInstructions}&quot;
                          </span>
                        )}
                      </div>

                      {/* Price & Ordered times */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-black text-xs sm:text-sm text-primary dark:text-[#D4AF37]">
                          ₹{item.unitPrice.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-text-muted dark:text-zinc-400">
                          · Ordered {item.totalQuantityOrdered}x
                        </span>
                      </div>
                    </div>

                    {/* Right: Re-order CTA */}
                    <div className="shrink-0">
                      <button
                        type="button"
                        disabled={isOrderingBlocked || !item.isAvailable}
                        onClick={() => handleRepeatItem(item)}
                        className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer ${
                          isOrderingBlocked
                            ? 'bg-zinc-100 dark:bg-white/5 text-zinc-400 opacity-60 cursor-not-allowed'
                            : !item.isAvailable
                            ? 'bg-zinc-100 dark:bg-white/5 text-zinc-400 opacity-60 cursor-not-allowed'
                            : 'bg-primary hover:bg-primary-hover text-white dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] dark:text-black hover:scale-105 active:scale-95'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden xs:inline">
                          {isOrderingBlocked
                            ? 'Closed'
                            : !item.isAvailable
                            ? 'Out of Stock'
                            : 'Re-order'}
                        </span>
                        <span className="xs:hidden">
                          {!item.isAvailable ? 'Out' : 'Re-order'}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: ACCOUNT & PROFILE (Includes Persistent Order History)         */}
        {/* ==================================================================== */}
        {activeTab === 'account' && (
          <div className="space-y-6 animate-fade-in pb-28 sm:pb-32 max-w-4xl mx-auto">
            {/* Header with Title & Active Status */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60 dark:border-white/10">
              <div>
                <h2 className="font-black text-2xl sm:text-3xl text-text-primary dark:text-white tracking-tight flex items-center gap-2.5">
                  <User className="w-7 h-7 text-primary dark:text-[#D4AF37]" />
                  Guest Profile &amp; Account
                </h2>
                <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 mt-1">
                  View your active table session details, guest profile, and persistent order history.
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

            {/* Profile Sub-Tabs: Profile Details vs Order History */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-border/60 dark:border-white/10 w-fit">
              <button
                type="button"
                onClick={() => setAccountSubTab('profile')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  accountSubTab === 'profile'
                    ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs'
                    : 'text-text-muted dark:text-zinc-400 hover:text-text-primary dark:hover:text-white'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Profile Details</span>
              </button>

              <button
                type="button"
                onClick={() => setAccountSubTab('history')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  accountSubTab === 'history'
                    ? 'bg-primary text-white dark:bg-[#D4AF37] dark:text-black shadow-xs'
                    : 'text-text-muted dark:text-zinc-400 hover:text-text-primary dark:hover:text-white'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Order History</span>
                {sessionHistory.length > 0 && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                      accountSubTab === 'history'
                        ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
                        : 'bg-primary/15 text-primary dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]'
                    }`}
                  >
                    {sessionHistory.length}
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: PROFILE DETAILS */}
            {accountSubTab === 'profile' && (
              <div className="space-y-6">
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

                          <div className="flex items-center justify-between py-1.5 border-b border-border/40 dark:border-white/5">
                            <span className="text-text-muted dark:text-zinc-400">Active Orders</span>
                            <button
                              type="button"
                              onClick={() => setActiveTab('orders')}
                              className="font-bold text-primary dark:text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{pendingOrders.length} {pendingOrders.length === 1 ? 'ticket' : 'tickets'}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between py-1.5">
                            <span className="text-text-muted dark:text-zinc-400 flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 text-zinc-400" />
                              Order History
                            </span>
                            <button
                              type="button"
                              onClick={() => setAccountSubTab('history')}
                              className="font-bold text-primary dark:text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>{sessionHistory.length} {sessionHistory.length === 1 ? 'past session' : 'past sessions'}</span>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <button
                            type="button"
                            onClick={() => setAccountSubTab('history')}
                            className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 dark:border-white/10 hover:border-primary/40 dark:hover:border-[#D4AF37]/40 bg-white dark:bg-[#18181B] hover:bg-zinc-50 dark:hover:bg-white/5 transition-all group text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-[#D4AF37]/10 flex items-center justify-center text-primary dark:text-[#D4AF37]">
                                <History className="w-4 h-4" />
                              </div>
                              <div>
                                <span className="block text-xs font-bold text-text-primary dark:text-white">
                                  Order History
                                </span>
                                <span className="block text-[11px] text-text-muted dark:text-zinc-400">
                                  {sessionHistory.length} {sessionHistory.length === 1 ? 'session' : 'sessions'} completed
                                </span>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-text-primary dark:group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                          </button>

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
                                  {pendingOrders.length} active
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
                          onClick={() => setIsLogoutModalOpen(true)}
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

            {/* TAB 2: ORDER HISTORY (INSIDE PROFILE) */}
            {accountSubTab === 'history' && (
              <div className="space-y-6 animate-fade-in">
                {/* Header with Navigation & Refresh */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setAccountSubTab('profile')}
                      className="p-2 rounded-xl border border-border/80 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-text-primary dark:text-white transition-colors cursor-pointer"
                      title="Back to Profile Details"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h3 className="font-black text-xl sm:text-2xl text-text-primary dark:text-white tracking-tight flex items-center gap-2.5">
                        <History className="w-6 h-6 text-primary dark:text-[#D4AF37]" />
                        Order History
                      </h3>
                      <p className="text-xs text-text-muted dark:text-zinc-400 mt-0.5">
                        Persistent record of your completed orders across all dining sessions.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => refreshOrderHistory()}
                      disabled={isHistoryLoading}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] hover:bg-zinc-100 dark:hover:bg-white/10 text-text-primary dark:text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isHistoryLoading ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountSubTab('profile')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] hover:bg-zinc-100 dark:hover:bg-white/10 text-text-primary dark:text-white shadow-xs transition-colors cursor-pointer"
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Profile Details</span>
                    </button>
                  </div>
                </div>

                {/* Content: Loading, Empty, or Session-Wise History List */}
                {isHistoryLoading && sessionHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Loader2 className="w-8 h-8 text-primary dark:text-[#D4AF37] animate-spin mb-3" />
                    <p className="text-sm font-semibold text-text-primary dark:text-white">
                      Loading dining session history...
                    </p>
                    <p className="text-xs text-text-muted dark:text-zinc-400 mt-1">
                      Fetching your past dining records from PostgreSQL.
                    </p>
                  </div>
                ) : sessionHistory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/80 dark:border-white/15 bg-white/50 dark:bg-[#18181B]/50 p-12 text-center max-w-md mx-auto space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/10 flex items-center justify-center mx-auto text-primary dark:text-[#D4AF37]">
                      <History className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-text-primary dark:text-white">
                        No Past Sessions Found
                      </h3>
                      <p className="text-xs text-text-muted dark:text-zinc-400 mt-1">
                        Completed orders from your dining sessions are saved permanently and will appear here.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('home')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black text-xs font-bold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <UtensilsCrossed className="w-4 h-4" />
                      <span>Explore Menu</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-text-muted dark:text-zinc-400 px-1">
                      <span>
                        Showing {sessionHistory.length} {sessionHistory.length === 1 ? 'dining session' : 'dining sessions'}
                        {orderHistory.length > sessionHistory.length && ` (${orderHistory.length} orders total)`}
                      </span>
                      <span className="text-[11px]">Saved in database · Sorted newest first</span>
                    </div>

                    <div className="space-y-3.5">
                      {sessionHistory.map((session: any) => {
                        const isCompleted = session.hasServedItems || session.sessionStatus === 'CLOSED';
                        const isAllCancelled = session.isAllCancelled;

                        return (
                          <div
                            key={session.sessionId}
                            onClick={() => setSelectedHistorySession(session)}
                            className="group rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#18181B] p-4 sm:p-5 space-y-3.5 shadow-xs hover:border-primary/40 dark:hover:border-[#D4AF37]/40 hover:shadow-md transition-all cursor-pointer"
                          >
                            {/* Top Header: Session & Status Badge */}
                            <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/40 dark:border-white/5">
                              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-[#D4AF37]/10 flex items-center justify-center text-primary dark:text-[#D4AF37] shrink-0 font-black text-xs">
                                  <Receipt className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-black text-sm sm:text-base text-text-primary dark:text-white">
                                      Dining Session · {session.sessionTokenNumber}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                                        isAllCancelled
                                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                          : isCompleted
                                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                          : 'bg-zinc-100 dark:bg-white/10 text-text-muted dark:text-zinc-400 border border-border/60 dark:border-white/10'
                                      }`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          isAllCancelled ? 'bg-rose-500' : isCompleted ? 'bg-emerald-500' : 'bg-zinc-400'
                                        }`}
                                      />
                                      <span>{isAllCancelled ? 'CANCELLED' : session.sessionStatus === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED'}</span>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-text-muted dark:text-zinc-400 flex-wrap mt-0.5">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3.5 h-3.5" />
                                      <span>{session.formattedDate} {session.formattedTime && `at ${session.formattedTime}`}</span>
                                    </span>
                                    {session.tableNumber && session.tableNumber !== 'N/A' && (
                                      <span className="flex items-center gap-1">
                                        <span className="opacity-50">·</span>
                                        <span>Table {session.tableNumber}</span>
                                        {session.areaName && <span className="opacity-70">({session.areaName})</span>}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <span className="text-[10.5px] text-text-muted dark:text-zinc-400 block font-medium">
                                  Session Total
                                </span>
                                <span className="font-black text-base sm:text-lg text-primary dark:text-[#D4AF37]">
                                  ₹{session.totalAmount.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Summary Metrics & Order Previews */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-0.5 text-xs">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/5 font-bold text-text-primary dark:text-zinc-200 text-[11px]">
                                  {session.totalOrdersCount} {session.totalOrdersCount === 1 ? 'Order' : 'Orders'}
                                </span>
                                <span className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-white/5 text-text-muted dark:text-zinc-400 text-[11px] font-medium">
                                  {session.totalItemsCount} {session.totalItemsCount === 1 ? 'item' : 'items total'}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 text-primary dark:text-[#D4AF37] font-bold text-xs group-hover:translate-x-0.5 transition-transform">
                                <span>View Session Orders</span>
                                <ChevronRight className="w-4 h-4" />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Session Detail Modal */}
            {selectedHistorySession && (
              <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-fade-in"
                onClick={() => setSelectedHistorySession(null)}
              >
                <div
                  className="relative w-full max-w-2xl bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/60 dark:border-white/10 bg-zinc-50/70 dark:bg-white/5">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base sm:text-lg text-text-primary dark:text-white">
                          Dining Session Details
                        </h3>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]">
                          {selectedHistorySession.sessionTokenNumber}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted dark:text-zinc-400">
                        {selectedHistorySession.formattedDate} {selectedHistorySession.formattedTime && `at ${selectedHistorySession.formattedTime}`}
                        {selectedHistorySession.tableNumber && selectedHistorySession.tableNumber !== 'N/A' && ` · Table ${selectedHistorySession.tableNumber} (${selectedHistorySession.areaName})`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedHistorySession(null)}
                      className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label="Close details"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Modal Scrollable Body */}
                  <div className="p-4 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                    {/* Session Summary Card */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-white/5 border border-border/60 dark:border-white/5">
                      <div>
                        <span className="text-[10px] sm:text-[11px] text-text-muted dark:text-zinc-400 block font-medium uppercase tracking-wider">
                          Total Spend
                        </span>
                        <span className="font-black text-base sm:text-lg text-primary dark:text-[#D4AF37]">
                          ₹{selectedHistorySession.totalAmount.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] sm:text-[11px] text-text-muted dark:text-zinc-400 block font-medium uppercase tracking-wider">
                          Orders Placed
                        </span>
                        <span className="font-black text-base sm:text-lg text-text-primary dark:text-white">
                          {selectedHistorySession.totalOrdersCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] sm:text-[11px] text-text-muted dark:text-zinc-400 block font-medium uppercase tracking-wider">
                          Total Items
                        </span>
                        <span className="font-black text-base sm:text-lg text-text-primary dark:text-white">
                          {selectedHistorySession.totalItemsCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] sm:text-[11px] text-text-muted dark:text-zinc-400 block font-medium uppercase tracking-wider">
                          Session Status
                        </span>
                        <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 mt-1 block">
                          {selectedHistorySession.sessionStatus === 'ACTIVE' ? 'Active' : 'Settled & Completed'}
                        </span>
                      </div>
                    </div>

                    {/* Orders Breakdown */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-text-muted dark:text-zinc-400 uppercase tracking-wider">
                        Orders in this Session ({selectedHistorySession.orders.length})
                      </h4>

                      <div className="space-y-4">
                        {selectedHistorySession.orders.map((order: any, idx: number) => {
                          const orderDate = order.placedAt ? new Date(order.placedAt) : null;
                          const formattedTime = orderDate
                            ? orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '';
                          const isServed = order.status === 'SERVED';
                          const isCancelled = order.status === 'CANCELLED';
                          const orderSubtotal = Number(order.subtotal || order.totalAmount || 0);

                          return (
                            <div
                              key={order.id || idx}
                              className="rounded-2xl border border-border/80 dark:border-white/10 bg-white dark:bg-[#141416] p-4 sm:p-5 space-y-3.5 shadow-2xs"
                            >
                              {/* Order Header */}
                              <div className="flex items-center justify-between pb-3 border-b border-border/40 dark:border-white/5">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-black text-sm sm:text-base text-text-primary dark:text-white">
                                      Order #{String(order.orderNumber || idx + 1).padStart(2, '0')}
                                    </span>
                                    <span
                                      className={`text-[9.5px] font-extrabold px-2 py-0.5 rounded-full ${
                                        isServed
                                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                          : isCancelled
                                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                          : 'bg-zinc-100 dark:bg-white/10 text-text-muted dark:text-zinc-400 border border-border/60 dark:border-white/10'
                                      }`}
                                    >
                                      {order.status || 'COMPLETED'}
                                    </span>
                                  </div>
                                  {formattedTime && (
                                    <div className="text-[11px] text-text-muted dark:text-zinc-400 mt-0.5">
                                      Placed at {formattedTime}
                                    </div>
                                  )}
                                </div>

                                <div className="text-right">
                                  <span className="text-[10.5px] text-text-muted dark:text-zinc-400 block">
                                    Order Subtotal
                                  </span>
                                  <span className="font-black text-sm sm:text-base text-primary dark:text-[#D4AF37]">
                                    ₹{orderSubtotal.toFixed(2)}
                                  </span>
                                </div>
                              </div>

                              {/* Order Itemized List */}
                              <div className="divide-y divide-border/40 dark:divide-white/5 text-xs">
                                {(order.items || []).map((item: any, itIdx: number) => {
                                  const itemPrice = Number(item.price || item.unitPrice || 0);
                                  const itemQty = Number(item.quantity || 1);
                                  const isStockOut = item.status === 'STOCK_OUT';
                                  const isCancelledItem = item.status === 'CANCELLED';

                                  return (
                                    <div
                                      key={item.id || itIdx}
                                      className="py-2.5 flex items-start justify-between gap-3 text-text-primary dark:text-zinc-200"
                                    >
                                      <div className="min-w-0 flex-1 space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          {item.foodType && <VegBadge type={item.foodType} size="sm" />}
                                          <span className="font-semibold text-text-primary dark:text-white">
                                            {item.quantity} × {item.name || item.itemName || item.menuItem?.name || 'Item'}
                                          </span>
                                          {item.variantName && (
                                            <span className="text-text-muted dark:text-zinc-400 text-[11px]">
                                              · {item.variantName}
                                            </span>
                                          )}
                                          {isStockOut && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                              Stock Out
                                            </span>
                                          )}
                                          {isCancelledItem && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                              Cancelled
                                            </span>
                                          )}
                                          {item.station && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/5 text-text-muted dark:text-zinc-400 uppercase">
                                              {item.station}
                                            </span>
                                          )}
                                        </div>

                                        {item.selectedModifiers && Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0 && (
                                          <div className="text-text-muted dark:text-zinc-400 text-[10.5px]">
                                            + {item.selectedModifiers.map((m: any) => m.optionName || m.name || m).join(', ')}
                                          </div>
                                        )}

                                        {(item.notes || item.specialInstructions) && (
                                          <div className="text-[10.5px] text-amber-600 dark:text-amber-400 italic">
                                            Note: {item.notes || item.specialInstructions}
                                          </div>
                                        )}
                                      </div>

                                      <div className="text-right shrink-0">
                                        {isStockOut || isCancelledItem ? (
                                          <span className="font-bold text-rose-600 dark:text-rose-400">
                                            ₹0.00
                                          </span>
                                        ) : (
                                          <span className="font-bold text-text-primary dark:text-white">
                                            ₹{Number(item.lineTotal || itemPrice * itemQty).toFixed(2)}
                                          </span>
                                        )}
                                        <div className="text-[10px] text-text-muted dark:text-zinc-400">
                                          @ ₹{itemPrice.toFixed(2)}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Order Footer Actions */}
                              <div className="pt-2 border-t border-border/40 dark:border-white/5 flex items-center justify-between">
                                {order.notes ? (
                                  <span className="text-[10.5px] text-text-muted dark:text-zinc-400 italic">
                                    Order Note: {order.notes}
                                  </span>
                                ) : (
                                  <span className="text-[10.5px] text-text-muted dark:text-zinc-400">
                                    {order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'item' : 'items'}
                                  </span>
                                )}

                                <button
                                  type="button"
                                  disabled={isOrderingBlocked}
                                  onClick={() => handleReorderHistoricalOrder(order)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                                    isOrderingBlocked
                                      ? 'bg-zinc-100 dark:bg-white/5 text-zinc-400 opacity-50 cursor-not-allowed'
                                      : 'bg-primary/10 hover:bg-primary text-primary hover:text-white dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] dark:hover:bg-[#D4AF37] dark:hover:text-black cursor-pointer'
                                  }`}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>{isOrderingBlocked ? 'Ordering Closed' : 'Re-order Items'}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 sm:p-5 border-t border-border/60 dark:border-white/10 bg-zinc-50/70 dark:bg-white/5 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-text-muted dark:text-zinc-400 block font-medium">
                        Session Grand Total
                      </span>
                      <span className="font-black text-base sm:text-xl text-primary dark:text-[#D4AF37]">
                        ₹{selectedHistorySession.totalAmount.toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedHistorySession(null)}
                      className="px-5 py-2.5 rounded-xl bg-primary text-white dark:bg-[#D4AF37] dark:text-black font-extrabold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </main>

        {/* Minimal Footer */}
        <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2 text-center select-none">
          <p className="text-[11px] font-medium text-text-muted/70 dark:text-zinc-500 tracking-wide">
            © 2026 Pegs N Bottles · Premium Dining Experience
          </p>
        </footer>

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

      {/* Compact Floating Mobile Cart Control (Positioned at bottom-right above mobile nav) */}
      {cartCount > 0 && activeTab !== 'cart' && (
        <div className="lg:hidden fixed bottom-[72px] sm:bottom-[76px] right-3.5 sm:right-5 z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <button
            type="button"
            onClick={() => setActiveTab('cart')}
            aria-label={`View Cart: ${cartCount} items, total ₹${Number(cartTotal || 0).toFixed(0)}`}
            className="group relative flex items-center gap-2.5 pl-3 pr-3.5 py-2.5 rounded-full bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black shadow-xl shadow-primary/30 dark:shadow-black/60 border-2 border-white dark:border-[#18181B] transition-all transform active:scale-95 cursor-pointer select-none"
          >
            {/* Cart Icon with badge count */}
            <div className="relative shrink-0">
              <ShoppingCart className="w-4.5 h-4.5 stroke-[2.2]" />
              <span className="absolute -top-2 -right-2 min-w-[17px] h-[17px] px-0.5 rounded-full bg-white dark:bg-black text-primary dark:text-[#D4AF37] text-[9.5px] font-black flex items-center justify-center shadow-xs border border-primary/20 dark:border-white/20">
                {cartCount}
              </span>
            </div>

            {/* Cart Amount */}
            <div className="flex flex-col text-left leading-none">
              <span className="text-[8.5px] uppercase tracking-wider font-extrabold opacity-80">Cart</span>
              <span className="text-[12px] font-black mt-0.5">₹{Number(cartTotal || 0).toFixed(0)}</span>
            </div>
          </button>
        </div>
      )}

      {/* 2. Premium Mobile Bottom Navigation Bar (Shown on mobile & tablet, hidden on desktop lg+) */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/80 dark:border-white/10 bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-xl shadow-[0_-8px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-8px_24px_rgba(0,0,0,0.4)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md md:max-w-xl mx-auto grid grid-cols-5 gap-1 px-1.5 sm:px-2 pt-1.5 pb-1 sm:pb-1.5 items-end text-center">
          {/* 1. Home */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center gap-0.5 sm:gap-1 py-1 px-0.5 rounded-xl transition-all cursor-pointer min-w-0 ${
              activeTab === 'home' || activeTab === 'eat' || activeTab === 'drink' || activeTab === 'merch'
                ? 'text-primary dark:text-[#D4AF37] font-black scale-105'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-text-primary'
            }`}
          >
            <HomeIcon className="w-4.5 h-4.5 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-bold leading-tight truncate max-w-full">Home</span>
          </button>

          {/* 2. Repeat */}
          <button
            type="button"
            onClick={() => setActiveTab('repeat')}
            className={`flex flex-col items-center justify-center gap-0.5 sm:gap-1 py-1 px-0.5 rounded-xl transition-all cursor-pointer min-w-0 ${
              activeTab === 'repeat'
                ? 'text-primary dark:text-[#D4AF37] font-black scale-105'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-text-primary'
            }`}
          >
            <RotateCcw className="w-4.5 h-4.5 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-bold leading-tight truncate max-w-full">Repeat</span>
          </button>

          {/* 3. Call Waiter (Center Primary Floating Action ~1.5-2x size) */}
          <div className="flex flex-col items-center justify-center -mt-6 sm:-mt-8 relative z-10 min-w-0">
            <button
              type="button"
              onClick={() => setIsCallWaiterOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={isCallWaiterOpen}
              aria-label="Call waiter"
              className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-primary via-purple-600 to-indigo-600 dark:from-[#D4AF37] dark:via-amber-500 dark:to-yellow-400 text-white dark:text-black shadow-lg shadow-primary/30 dark:shadow-black/50 flex items-center justify-center border-4 border-white dark:border-[#18181B] ring-2 ring-primary/20 dark:ring-[#D4AF37]/30 transition-transform hover:scale-105 active:scale-95 cursor-pointer relative group shrink-0"
            >
              <PhoneCall className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2] group-hover:rotate-12 transition-transform duration-200" />
              {activeRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#D4AF37] text-zinc-950 dark:bg-purple-600 dark:text-white text-[10px] font-black border-2 border-white dark:border-[#18181B] flex items-center justify-center shadow-md select-none">
                  {activeRequests.length}
                </span>
              )}
            </button>
            <span className="text-[10px] sm:text-[11px] font-extrabold text-primary dark:text-[#D4AF37] mt-1 leading-none tracking-tight select-none whitespace-nowrap">
              Call Waiter
            </span>
          </div>

          {/* 4. My Orders */}
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center justify-center gap-0.5 sm:gap-1 py-1 px-0.5 rounded-xl transition-all relative cursor-pointer min-w-0 ${
              activeTab === 'orders'
                ? 'text-primary dark:text-[#D4AF37] font-black scale-105'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-text-primary'
            }`}
          >
            <div className="relative">
              <ClipboardList className="w-4.5 h-4.5 shrink-0" />
              {pendingOrders.length > 0 && (
                <span className="absolute -top-1.5 -right-2.5 w-4 h-4 rounded-full bg-primary dark:bg-[#D4AF37] text-white dark:text-black text-[8px] font-black flex items-center justify-center shadow-xs">
                  {pendingOrders.length}
                </span>
              )}
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold leading-tight truncate max-w-full">My Orders</span>
          </button>

          {/* 5. Pay Bill */}
          <button
            type="button"
            onClick={() => setActiveTab('bill')}
            className={`flex flex-col items-center justify-center gap-0.5 sm:gap-1 py-1 px-0.5 rounded-xl transition-all cursor-pointer min-w-0 ${
              activeTab === 'bill'
                ? 'text-primary dark:text-[#D4AF37] font-black scale-105'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-text-primary'
            }`}
          >
            <Receipt className="w-4.5 h-4.5 shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-bold leading-tight truncate max-w-full">Pay Bill</span>
          </button>
        </div>
      </nav>

      {/* Global Real-Time Customer Stock & Status Notifications */}
      {notifications.length > 0 && (
        <aside aria-label="Customer real-time notifications" className="fixed top-3 inset-x-0 z-[60] flex flex-col items-center pointer-events-none px-3 space-y-2">
          {notifications.map((notif) => {
            const isStockIn = notif.type === 'stock_in';

            return (
              <div
                key={notif.id}
                onClick={() => isStockIn && handleNotificationClick(notif)}
                className={`pointer-events-auto max-w-md w-full animate-fade-in flex items-center justify-between gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl shadow-xl backdrop-blur-md transition-all ${
                  isStockIn
                    ? 'cursor-pointer bg-white/95 dark:bg-[#18181B]/95 text-zinc-900 dark:text-white border-2 border-emerald-500/35 dark:border-emerald-500/40 hover:border-emerald-500/60 dark:hover:border-emerald-400/60 active:scale-[0.99] shadow-emerald-500/10'
                    : 'bg-zinc-900/95 dark:bg-black/95 text-white border border-rose-500/30 shadow-2xl'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                      isStockIn
                        ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-400 border border-emerald-500/20 shadow-2xs'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {isStockIn ? <Sparkles className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold leading-snug ${
                      isStockIn ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-100'
                    }`}>
                      {notif.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isStockIn && (
                    <span className="text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25 dark:bg-[#D4AF37]/15 dark:text-[#D4AF37] dark:border-[#D4AF37]/30 flex items-center gap-0.5 shadow-2xs">
                      View →
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissNotification(notif.id);
                    }}
                    className={`p-1 rounded-lg transition-colors cursor-pointer ${
                      isStockIn
                        ? 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10'
                        : 'text-zinc-400 hover:text-white hover:bg-white/10'
                    }`}
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </aside>
      )}

      {/* Product Customizer Sheet */}
      <ProductCustomizer
        item={customizingItem}
        open={!!customizingItem}
        initialConfig={customizingInitialConfig}
        onClose={() => {
          setCustomizingItem(null);
          setCustomizingInitialConfig(null);
        }}
        onAddToCart={addToCart}
        isOrderingDisabled={isOrderingBlocked}
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

      {/* 1. Customer Portal Read-Only Product Details View */}
      {selectedDetailItem && (() => {
        const detailBackdropOpacity = isDetailClosing
          ? 0
          : isDetailDragging
          ? Math.max(0.15, 1 - detailDragY / 400)
          : 1;

        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-detail-title"
            onClick={() => setSelectedDetailItem(null)}
            style={{
              opacity: detailBackdropOpacity,
              transition: isDetailDragging ? 'none' : 'opacity 0.22s ease-out',
            }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 dark:bg-black/80 backdrop-blur-xs animate-fade-in cursor-pointer"
          >
          <div
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleDetailTouchStart}
            onTouchMove={handleDetailTouchMove}
            onTouchEnd={handleDetailTouchEnd}
            style={{
              transform: isDetailDragging ? `translateY(${detailDragY}px)` : isDetailClosing ? 'translateY(100%)' : 'translateY(0)',
              transition: isDetailDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="relative w-full max-w-xl max-h-[90vh] bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col cursor-default text-text-primary dark:text-zinc-100 will-change-transform"
          >
            {/* Mobile Drag Handle */}
            <div className="w-full pt-2.5 pb-0.5 flex justify-center sm:hidden cursor-grab active:cursor-grabbing bg-[#F5F3FA] dark:bg-white/5">
              <div className="w-12 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>

            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-border/80 dark:border-white/10 flex items-center justify-between shrink-0 bg-[#F5F3FA] dark:bg-white/5">
              <div className="flex items-center gap-2.5 min-w-0">
                {selectedDetailItem.foodType && (
                  <VegBadge type={selectedDetailItem.foodType} size="sm" />
                )}
                <h3 id="product-detail-title" className="text-base sm:text-lg font-black text-text-primary dark:text-white truncate">
                  {selectedDetailItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                aria-label="Close product details"
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary dark:text-zinc-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div ref={detailScrollRef} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Product Image Preview: Aspect-square contained container with blurred background fill */}
              {selectedDetailItem.image || selectedDetailItem.imageUrl ? (
                <div
                  onClick={() => {
                    const imgUrl = selectedDetailItem.image || selectedDetailItem.imageUrl;
                    setSelectedImageModal({ url: imgUrl, name: selectedDetailItem.name });
                  }}
                  title="Click to view full image"
                  className="relative w-full aspect-square max-h-72 sm:max-h-80 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-white/5 border border-border/80 dark:border-white/10 flex items-center justify-center cursor-pointer group shadow-inner"
                >
                  {/* Subtle blurred background fill */}
                  <img
                    src={formatImageUrl(selectedDetailItem.image || selectedDetailItem.imageUrl)}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-xl scale-125 opacity-25 dark:opacity-40 pointer-events-none"
                  />
                  {/* Sharp contained foreground image */}
                  <img
                    src={formatImageUrl(selectedDetailItem.image || selectedDetailItem.imageUrl)}
                    alt={selectedDetailItem.name}
                    className="relative z-10 max-h-full max-w-full object-contain p-3 drop-shadow-md group-hover:scale-105 transition-transform duration-200"
                  />
                  <span className="absolute bottom-2.5 right-2.5 z-20 px-2.5 py-1 rounded-lg bg-white/90 dark:bg-black/70 text-[10px] text-text-primary dark:text-zinc-100 font-semibold backdrop-blur-md border border-border/80 dark:border-white/10 shadow-sm">
                    Click to Enlarge
                  </span>
                </div>
              ) : (
                <div className="w-full h-44 rounded-2xl bg-[#F5F3FA] dark:bg-white/5 border border-dashed border-border/80 dark:border-white/10 flex flex-col items-center justify-center text-text-muted dark:text-zinc-500 gap-1.5">
                  <span className="text-3xl select-none" role="img" aria-label="No image">🍽️</span>
                  <span className="text-xs font-semibold text-text-primary dark:text-zinc-300">Image: N/A</span>
                  <span className="text-[10px] text-text-muted dark:text-zinc-500">No product image assigned</span>
                </div>
              )}

              {/* Price & Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#F5F3FA] dark:bg-white/5 border border-border/80 dark:border-white/10">
                <div>
                  <span className="text-[10px] text-text-muted dark:text-zinc-400 uppercase tracking-wider font-bold block">
                    Price
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-lg sm:text-xl font-black text-primary dark:text-[#D4AF37]">
                      ₹{Number(selectedDetailItem.finalPrice ?? selectedDetailItem.basePrice ?? 0).toFixed(2)}
                    </span>
                    {Number(selectedDetailItem.finalPrice ?? selectedDetailItem.basePrice) < Number(selectedDetailItem.basePrice ?? 0) && (
                      <span className="text-xs text-text-muted dark:text-zinc-500 line-through">
                        ₹{Number(selectedDetailItem.basePrice).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedDetailItem.isAvailable === false ? (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-500/20 dark:border-rose-800/60">
                      Out of Stock
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-800/60">
                      In Stock
                    </span>
                  )}
                  {Number(selectedDetailItem.finalPrice ?? selectedDetailItem.basePrice) < Number(selectedDetailItem.basePrice ?? 0) && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-800/60">
                      {selectedDetailItem.discountMode === 'PERCENTAGE'
                        ? `${selectedDetailItem.discountValue}% OFF`
                        : `₹${selectedDetailItem.discountValue} OFF`}
                    </span>
                  )}
                  {selectedDetailItem.featured && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 dark:bg-[#D4AF37]/15 dark:text-[#E5C158] dark:border-[#D4AF37]/30">
                      Signature
                    </span>
                  )}
                  {selectedDetailItem.popular && (
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 dark:bg-[#D4AF37]/15 dark:text-[#E5C158] dark:border-[#D4AF37]/30">
                      Popular
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <span className="text-[11px] font-bold text-text-muted dark:text-zinc-400 uppercase tracking-wider block mb-1">
                  Description
                </span>
                <p className="text-xs text-text-primary dark:text-zinc-300 leading-relaxed p-3 rounded-xl bg-[#F5F3FA] dark:bg-white/5 border border-border/80 dark:border-white/10">
                  {selectedDetailItem.description?.trim() || 'N/A'}
                </p>
              </div>

              {/* Customer Specification Grid (Strict N/A & Not applicable Fallbacks) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* Section */}
                <div className="p-3 rounded-xl bg-[#F5F3FA] dark:bg-white/5 border border-border/80 dark:border-white/10">
                  <span className="text-[10px] font-bold text-text-muted dark:text-zinc-500 uppercase tracking-wider block">
                    Section
                  </span>
                  <span className="text-xs font-semibold text-text-primary dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.sectionSlug === 'eat'
                      ? 'Food'
                      : selectedDetailItem.sectionName || (selectedDetailItem.sectionSlug ? selectedDetailItem.sectionSlug.toUpperCase() : 'N/A')}
                  </span>
                </div>

                {/* Category */}
                <div className="p-3 rounded-xl bg-[#F5F3FA] dark:bg-white/5 border border-border/80 dark:border-white/10">
                  <span className="text-[10px] font-bold text-text-muted dark:text-zinc-500 uppercase tracking-wider block">
                    Category
                  </span>
                  <span className="text-xs font-semibold text-text-primary dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.categoryName || selectedDetailItem.category?.name || 'N/A'}
                  </span>
                </div>

                {/* Subcategory */}
                <div className="p-3 rounded-xl bg-[#F5F3FA] dark:bg-white/5 border border-border/80 dark:border-white/10">
                  <span className="text-[10px] font-bold text-text-muted dark:text-zinc-500 uppercase tracking-wider block">
                    Subcategory
                  </span>
                  <span className="text-xs font-semibold text-text-primary dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.subcategory?.name || selectedDetailItem.subcategoryName
                      ? (selectedDetailItem.subcategory?.name || selectedDetailItem.subcategoryName)
                      : selectedDetailItem.subcategoryId
                      ? 'N/A'
                      : 'Not applicable'}
                  </span>
                </div>

                {/* Dietary Classification */}
                <div className="p-3 rounded-xl bg-[#F5F3FA] dark:bg-white/5 border border-border/80 dark:border-white/10">
                  <span className="text-[10px] font-bold text-text-muted dark:text-zinc-500 uppercase tracking-wider block">
                    Dietary Classification
                  </span>
                  <span className="text-xs font-semibold text-text-primary dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.foodType
                      ? selectedDetailItem.foodType === 'VEG'
                        ? 'Vegetarian (Veg)'
                        : selectedDetailItem.foodType === 'NON_VEG'
                        ? 'Non-Vegetarian (Non-Veg)'
                        : selectedDetailItem.foodType === 'EGG'
                        ? 'Contains Egg'
                        : selectedDetailItem.foodType === 'VEGAN'
                        ? 'Vegan'
                        : selectedDetailItem.foodType
                      : selectedDetailItem.sectionSlug === 'merch'
                      ? 'Not applicable'
                      : 'N/A'}
                  </span>
                </div>

                {/* Prep Time */}
                <div className="p-3 rounded-xl bg-[#F5F3FA] dark:bg-white/5 border border-border/80 dark:border-white/10">
                  <span className="text-[10px] font-bold text-text-muted dark:text-zinc-500 uppercase tracking-wider block">
                    Prep Time
                  </span>
                  <span className="text-xs font-semibold text-text-primary dark:text-zinc-200 mt-0.5 block">
                    {selectedDetailItem.sectionSlug === 'merch'
                      ? 'Not applicable'
                      : selectedDetailItem.preparationTime !== undefined && selectedDetailItem.preparationTime !== null
                      ? `${selectedDetailItem.preparationTime} mins`
                      : 'N/A'}
                  </span>
                </div>

                {/* Pricing / Offers */}
                <div className="p-3 rounded-xl bg-[#F5F3FA] dark:bg-white/5 border border-border/80 dark:border-white/10">
                  <span className="text-[10px] font-bold text-text-muted dark:text-zinc-500 uppercase tracking-wider block">
                    Offers / Discounts
                  </span>
                  <span className="text-xs font-semibold text-text-primary dark:text-zinc-200 mt-0.5 block">
                    {Number(selectedDetailItem.finalPrice ?? selectedDetailItem.basePrice) < Number(selectedDetailItem.basePrice ?? 0)
                      ? selectedDetailItem.discountMode === 'PERCENTAGE'
                        ? `${selectedDetailItem.discountValue}% OFF`
                        : `₹${selectedDetailItem.discountValue} OFF`
                      : 'Not applicable'}
                  </span>
                </div>

              </div>

              {/* Variants (if present) */}
              <div className="p-3 rounded-xl bg-[#F5F3FA] dark:bg-white/5 border border-border/80 dark:border-white/10 space-y-1.5">
                <span className="text-[10px] font-bold text-text-muted dark:text-zinc-500 uppercase tracking-wider block">
                  Available Variants
                </span>
                {selectedDetailItem.variants && selectedDetailItem.variants.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedDetailItem.variants.map((v: any) => (
                      <span
                        key={v.id || v.name}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 text-text-primary dark:text-zinc-200 text-xs font-semibold border border-border/60 dark:border-white/10 shadow-2xs"
                      >
                        {v.name} ({Number(v.priceDelta) >= 0 ? `+₹${v.priceDelta}` : `-₹${Math.abs(Number(v.priceDelta))}`})
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-text-muted dark:text-zinc-400">Not applicable</span>
                )}
              </div>
            </div>

            {/* Modal Footer (Close + Add to Cart Actions) */}
            <div className="p-3.5 sm:p-4 px-4 sm:px-6 border-t border-border/80 dark:border-white/10 bg-[#F5F3FA] dark:bg-white/5 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-text-muted hover:text-text-primary dark:text-zinc-400 dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                Close
              </button>

              {selectedDetailItem.isAvailable === false ? (
                <span className="px-4 py-2.5 rounded-xl text-xs font-bold border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  Out of Stock
                </span>
              ) : isOrderingBlocked ? (
                <button
                  type="button"
                  disabled
                  className="flex-1 max-w-[240px] py-2.5 px-4 rounded-xl bg-zinc-200 dark:bg-white/10 text-zinc-500 dark:text-zinc-400 font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed"
                >
                  <span>{isBillPaidOrSettled ? 'Session Settled' : 'Ordering Closed (15m Cutoff)'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const item = selectedDetailItem;
                    const hasModifiers =
                      (item.variants && item.variants.length > 0) ||
                      (item.modifierGroups && item.modifierGroups.length > 0);
                    setSelectedDetailItem(null);
                    if (hasModifiers) {
                      handleOpenCustomizer(item);
                    } else {
                      handleDirectAdd(item);
                    }
                  }}
                  className="flex-1 max-w-[240px] py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#E5C158] text-white dark:text-black font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {(selectedDetailItem.variants && selectedDetailItem.variants.length > 0) ||
                    (selectedDetailItem.modifierGroups && selectedDetailItem.modifierGroups.length > 0)
                      ? 'Customize & Add'
                      : `Add to Cart • ₹${Number(selectedDetailItem.finalPrice ?? selectedDetailItem.basePrice ?? 0).toFixed(0)}`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      ); })()}

      {/* 2. Customer Portal Maximized Image Preview (z-[100] Layering to Appear Above All Modals & Sheets) */}
      {selectedImageModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Image preview for ${selectedImageModal.name}`}
          onClick={() => setSelectedImageModal(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/25 dark:bg-black/90 backdrop-blur-md animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm sm:max-w-md md:max-w-lg aspect-square max-h-[85vh] bg-white dark:bg-zinc-950 border border-border/80 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center cursor-default"
          >
            {/* Blurred background filling the square container */}
            <img
              src={formatImageUrl(selectedImageModal.url)}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-20 dark:opacity-40 pointer-events-none"
            />
            <div className="absolute inset-0 bg-white/40 dark:bg-black/25 pointer-events-none" />

            {/* Sharp foreground image contained */}
            <img
              src={formatImageUrl(selectedImageModal.url)}
              alt={selectedImageModal.name}
              className="relative z-10 max-h-full max-w-full w-auto h-auto object-contain p-4 drop-shadow-md dark:drop-shadow-2xl"
            />

            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setSelectedImageModal(null)}
              aria-label="Close image preview"
              className="absolute top-3.5 right-3.5 z-20 p-2.5 rounded-full bg-white/90 hover:bg-white text-text-primary border border-border/80 dark:bg-black/75 dark:hover:bg-black dark:text-white dark:border-white/20 transition-all cursor-pointer shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Bottom Caption Pill */}
            <div className="absolute bottom-3.5 inset-x-3.5 z-20 flex justify-center pointer-events-none">
              <span className="px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-black/75 backdrop-blur-md text-text-primary dark:text-white text-xs font-bold border border-border/80 dark:border-white/20 max-w-[90%] truncate shadow-md">
                {selectedImageModal.name}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Premium Logout Confirmation Dialog */}
      {isLogoutModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
          onClick={() => setIsLogoutModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 dark:bg-black/80 backdrop-blur-sm animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm sm:max-w-md rounded-3xl bg-white dark:bg-[#18181B] border border-primary/30 dark:border-[#D4AF37]/50 shadow-2xl p-6 sm:p-7 space-y-5 text-center cursor-default animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Modal Icon Pill */}
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto shadow-xs">
              <LogOut className="w-6 h-6" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h3 id="logout-dialog-title" className="text-lg sm:text-xl font-black text-text-primary dark:text-white tracking-tight">
                Leave Dining Session?
              </h3>
              <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
                Your active dining session and table will remain open. You can re-scan your table pass at any time to resume ordering.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-text-primary dark:text-zinc-200 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-border/80 dark:border-white/10 transition-all cursor-pointer"
              >
                Stay / Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsLogoutModalOpen(false);
                  logout();
                }}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/25 transition-all active:scale-95 cursor-pointer"
              >
                Leave / Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Remove Order Item Confirmation Dialog */}
      {itemToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-item-dialog-title"
          onClick={() => !cancellingItemId && setItemToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 dark:bg-black/80 backdrop-blur-sm animate-fade-in cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm sm:max-w-md rounded-3xl bg-white dark:bg-[#18181B] border border-primary/30 dark:border-[#D4AF37]/50 shadow-2xl p-6 sm:p-7 space-y-5 text-center cursor-default animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Modal Icon Pill */}
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h3 id="delete-item-dialog-title" className="text-lg sm:text-xl font-black text-text-primary dark:text-white tracking-tight">
                Remove Item?
              </h3>
              <p className="text-xs sm:text-sm text-text-muted dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
                Are you sure you want to remove <span className="font-bold text-text-primary dark:text-white">"{itemToDelete.name}"</span> from this order?
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={Boolean(cancellingItemId)}
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-text-primary dark:text-zinc-200 bg-zinc-100 dark:bg-white/5 hover:bg-zinc-200 dark:hover:bg-white/10 border border-border/80 dark:border-white/10 transition-all cursor-pointer disabled:opacity-50"
              >
                Keep Item
              </button>
              <button
                type="button"
                disabled={Boolean(cancellingItemId)}
                onClick={handleConfirmDeleteItem}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/25 transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {cancellingItemId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Remove Item</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
