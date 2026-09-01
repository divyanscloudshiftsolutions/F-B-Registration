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
} from 'lucide-react';

type CustomerNavTab = 'home' | 'eat' | 'drink' | 'merch' | 'search' | 'cart' | 'orders' | 'bill' | 'repeat' | 'account';

const CustomerAppInner: React.FC = () => {
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
    activeBill,
    isLoading,
    isOrdering,
    placeOrder,
    refreshBill,
    isCallWaiterOpen,
    setIsCallWaiterOpen,
  } = useCustomer();

  const [activeTab, setActiveTab] = useState<CustomerNavTab>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | 'VEG' | 'NON_VEG' | 'EGG'>('ALL');
  const [customizingItem, setCustomizingItem] = useState<CustomizerItem | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [billRequested, setBillRequested] = useState<boolean>(false);
  const [orderSuccessToast, setOrderSuccessToast] = useState<string | null>(null);
  const [activeOrdersSubTab, setActiveOrdersSubTab] = useState<'pending' | 'done'>('pending');

  // Flatten all menu items
  const allItems: any[] = useMemo(() => {
    const list: any[] = [];
    menu.forEach((section: any) => {
      (section.categories || []).forEach((cat: any) => {
        (cat.items || []).forEach((item: any) => {
          list.push({
            ...item,
            sectionSlug: section.slug,
            categoryName: cat.name,
            categoryId: cat.id || item.categoryId,
          });
        });
      });
    });
    return list;
  }, [menu]);

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

  // Section item filters
  const getSectionItems = (sectionSlug: 'eat' | 'drink' | 'merchandise') => {
    return allItems.filter((i) => {
      if (i.sectionSlug !== sectionSlug) return false;
      if (dietaryFilter === 'VEG' && i.foodType !== 'VEG') return false;
      if (dietaryFilter === 'NON_VEG' && i.foodType !== 'NON_VEG') return false;
      if (dietaryFilter === 'EGG' && i.foodType !== 'EGG') return false;
      return true;
    });
  };

  const popularItems = useMemo(() => allItems.filter((i) => i.popular).slice(0, 6), [allItems]);
  const featuredItems = useMemo(() => allItems.filter((i) => i.featured).slice(0, 6), [allItems]);
  const drinkHighlights = useMemo(() => allItems.filter((i) => i.sectionSlug === 'drink' && i.popular).slice(0, 4), [allItems]);
  const dessertItems = useMemo(() => allItems.filter((i) => (i.categoryName || '').toLowerCase().includes('dessert')), [allItems]);

  // Order Placement
  const handlePlaceOrder = async () => {
    try {
      const order = await placeOrder();
      setOrderSuccessToast(`Order #${order?.orderNumber || '01'} placed successfully!`);
      setActiveTab('orders');
      setTimeout(() => setOrderSuccessToast(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to place order.');
    }
  };

  // Direct Add handler
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

  const pendingOrders = activeOrders.filter((o) => o.status !== 'SERVED' && o.status !== 'CANCELLED');
  const completedOrders = activeOrders.filter((o) => o.status === 'SERVED' || o.status === 'CANCELLED');

  return (
    <div className="flex min-h-[100dvh] flex-col dark:bg-[#12111F] bg-[#F7F6FC] text-text-primary dark:text-white font-sans max-w-2xl mx-auto border-x border-[#8D6CE5]/15 shadow-2xl pb-24 relative overflow-x-hidden">
      {/* 1. Header (Pegs N Bottles Brand + Cart + Top Navigation Tabs) */}
      <header className="sticky top-0 z-30 border-b border-[#8D6CE5]/15 dark:bg-[#1A1829]/95 bg-white/95 backdrop-blur-md">
        {/* Brand Bar */}
        <div className="mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <button
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8D6CE5] to-indigo-500 text-white font-black flex items-center justify-center text-sm shadow-md group-hover:scale-105 transition-transform">
              P
            </div>
            <div>
              <div className="font-extrabold text-sm text-text-primary dark:text-white leading-tight">Pegs N Bottles</div>
              <div className="text-[11px] text-text-muted">Table {tableNumber || 'C5'} · PIN 2019</div>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('cart')}
              className="relative p-2.5 rounded-full border border-[#8D6CE5]/20 hover:bg-[#8D6CE5]/10 text-text-primary dark:text-white transition-colors"
              aria-label="Cart"
            >
              <ShoppingCart className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#8D6CE5] text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('account')}
              className="p-2.5 rounded-full border border-[#8D6CE5]/20 hover:bg-[#8D6CE5]/10 text-text-primary dark:text-white transition-colors"
              aria-label="Account"
            >
              <User className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Sub-nav Tabs: For You | Eat | Drink | Merchandise + Timers */}
        <div className="mx-auto flex items-center gap-1.5 overflow-x-auto px-4 pb-2 text-xs scrollbar-none">
          <button
            onClick={() => setActiveTab('home')}
            className={`shrink-0 rounded-full px-3.5 py-1.5 font-bold transition-all ${
              activeTab === 'home'
                ? 'bg-[#8D6CE5] text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary dark:hover:text-white'
            }`}
          >
            For You
          </button>
          <button
            onClick={() => setActiveTab('eat')}
            className={`shrink-0 rounded-full px-3.5 py-1.5 font-bold transition-all ${
              activeTab === 'eat'
                ? 'bg-[#8D6CE5] text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary dark:hover:text-white'
            }`}
          >
            Eat
          </button>
          <button
            onClick={() => setActiveTab('drink')}
            className={`shrink-0 rounded-full px-3.5 py-1.5 font-bold transition-all ${
              activeTab === 'drink'
                ? 'bg-[#8D6CE5] text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary dark:hover:text-white'
            }`}
          >
            Drink
          </button>
          <button
            onClick={() => setActiveTab('merch')}
            className={`shrink-0 rounded-full px-3.5 py-1.5 font-bold transition-all ${
              activeTab === 'merch'
                ? 'bg-[#8D6CE5] text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary dark:hover:text-white'
            }`}
          >
            Merchandise
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-text-muted">
            <span className="px-2 py-0.5 rounded-full border border-[#8D6CE5]/20 bg-black/5 dark:bg-white/5">
              Food ends 23:00
            </span>
            <span className="px-2 py-0.5 rounded-full border border-[#8D6CE5]/20 bg-black/5 dark:bg-white/5">
              Drinks end 23:30
            </span>
          </div>
        </div>
      </header>

      {/* Bill Status Notices */}
      {billRequested && (
        <div className="mx-auto mt-3 w-full px-4 animate-fade-in">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Your bill has been requested. Waiter is on the way to Table {tableNumber || 'C5'}.</span>
          </div>
        </div>
      )}

      {orderSuccessToast && (
        <div className="mx-auto mt-3 w-full px-4 animate-fade-in">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{orderSuccessToast}</span>
          </div>
        </div>
      )}

      {/* Main Screen Content */}
      <main className="mx-auto w-full flex-1 px-4 pt-4 space-y-6">
        {/* ==================================================================== */}
        {/* VIEW: HOME ("For You")                                              */}
        {/* ==================================================================== */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-fade-in">
            {/* Search link */}
            <button
              onClick={() => setActiveTab('search')}
              className="w-full flex items-center gap-2.5 rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white px-4 py-3 text-xs text-text-muted hover:border-[#8D6CE5] transition-all shadow-xs"
            >
              <Search className="w-4 h-4 text-[#8D6CE5]" />
              <span>Search for a dish, drink or category…</span>
            </button>

            {/* Welcome banner */}
            <div>
              <h2 className="font-black text-2xl text-text-primary dark:text-white tracking-tight">Welcome to Pegs N Bottles</h2>
              <p className="text-xs text-text-muted mt-1">
                Table {tableNumber || 'C5'} · You have {activeOrders.length} order{activeOrders.length === 1 ? '' : 's'} in this session.
              </p>
            </div>

            {/* Promo Carousel Cards (3 columns on sm) */}
            <div className="grid gap-3 sm:grid-cols-3">
              {(promotions.length > 0 ? promotions : [
                { id: 'p1', title: 'Happy Hour Pitchers', subtitle: 'Complimentary bar snacks on craft pitchers before 8 PM.', ctaLabel: 'Explore Pitchers', ctaTarget: 'drink' },
                { id: 'p2', title: "Chef's Tasting Flight", subtitle: 'Three artisanal sliders paired with craft brew samplers.', ctaLabel: 'View Tasting', ctaTarget: 'eat' },
                { id: 'p3', title: 'Late Night Spirits', subtitle: 'Single malt pours paired with smoked dark chocolate.', ctaLabel: 'Browse Spirits', ctaTarget: 'drink' },
              ]).map((p: any) => (
                <div
                  key={p.id}
                  onClick={() => setActiveTab(p.ctaTarget === 'drink' ? 'drink' : 'eat')}
                  className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 bg-gradient-to-br from-[#8D6CE5]/15 via-[#8D6CE5]/5 to-indigo-500/10 p-4 hover:border-[#8D6CE5] transition-all group flex flex-col justify-between"
                >
                  <div>
                    <h4 className="font-extrabold text-sm text-text-primary dark:text-white">{p.title}</h4>
                    <p className="text-xs text-text-muted mt-1">{p.subtitle || p.description}</p>
                  </div>
                  <div className="mt-3 text-xs font-bold text-[#8D6CE5] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>{p.ctaLabel || 'Explore'} →</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cart Recovery Card */}
            {cart.length > 0 && (
              <div
                onClick={() => setActiveTab('cart')}
                className="flex items-center justify-between rounded-2xl border border-[#8D6CE5] bg-[#8D6CE5]/10 px-4 py-3 cursor-pointer shadow-sm hover:bg-[#8D6CE5]/15 transition-all"
              >
                <div>
                  <div className="font-bold text-xs text-text-primary dark:text-white">Continue your order</div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    {cart.length} item{cart.length === 1 ? '' : 's'} in your table cart
                  </div>
                </div>
                <span className="text-xs font-extrabold text-[#8D6CE5]">Go to cart →</span>
              </div>
            )}

            {/* Curated Sections */}
            {featuredItems.length > 0 && (
              <section className="space-y-3">
                <h3 className="font-black text-lg text-text-primary dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Tonight's Specials
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
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
              <section className="space-y-3">
                <h3 className="font-black text-lg text-text-primary dark:text-white flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-[#8D6CE5]" /> Popular at Pegs N Bottles
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
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
              <section className="space-y-3">
                <h3 className="font-black text-lg text-text-primary dark:text-white">Recommended Drinks</h3>
                <div className="grid gap-3 sm:grid-cols-2">
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
              <section className="space-y-3">
                <h3 className="font-black text-lg text-text-primary dark:text-white">Chef's Desserts</h3>
                <div className="grid gap-3 sm:grid-cols-2">
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
        {/* VIEW: EAT (Category Accordions with 2-Column Responsive Grid)        */}
        {/* ==================================================================== */}
        {activeTab === 'eat' && (
          <div className="space-y-4 animate-fade-in">
            {/* Dietary Toggle Filter */}
            <div className="flex items-center justify-between pb-1">
              <h2 className="font-black text-xl text-text-primary dark:text-white">Food Menu</h2>
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
                {(['ALL', 'VEG', 'NON_VEG'] as const).map((df) => (
                  <button
                    key={df}
                    onClick={() => setDietaryFilter(df)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      dietaryFilter === df
                        ? 'bg-[#8D6CE5] text-white shadow-xs'
                        : 'text-text-muted hover:text-text-primary dark:hover:text-white'
                    }`}
                  >
                    {df === 'ALL' ? 'All' : df === 'VEG' ? 'Veg' : 'Non-Veg'}
                  </button>
                ))}
              </div>
            </div>

            {/* Accordion Categories */}
            <div className="space-y-3">
              {categories
                .filter((c) => (c.sectionSlug || 'eat') === 'eat')
                .map((cat) => {
                  const catItems = getSectionItems('eat').filter((i) => i.categoryId === cat.id);
                  if (catItems.length === 0) return null;
                  const isExpanded = expandedCategories[cat.id] !== false;

                  return (
                    <div
                      key={cat.id}
                      className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white overflow-hidden shadow-xs"
                    >
                      <button
                        onClick={() => toggleCategory(cat.id)}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#8D6CE5]/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-text-primary dark:text-white">{cat.name}</span>
                          <span className="text-xs text-text-muted font-bold">({catItems.length})</span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                      </button>

                      {isExpanded && (
                        <div className="p-4 pt-0 grid gap-3 sm:grid-cols-2">
                          {catItems.map((item) => (
                            <MenuItemCard
                              key={item.id}
                              item={item}
                              onOpenCustomizer={setCustomizingItem}
                              onDirectAdd={handleDirectAdd}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: DRINK (Beverages, Cocktails & Spirits)                         */}
        {/* ==================================================================== */}
        {activeTab === 'drink' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="font-black text-xl text-text-primary dark:text-white">Beverages & Spirits</h2>
            <div className="space-y-3">
              {categories
                .filter((c) => (c.sectionSlug || '').includes('drink'))
                .map((cat) => {
                  const catItems = getSectionItems('drink').filter((i) => i.categoryId === cat.id);
                  if (catItems.length === 0) return null;
                  const isExpanded = expandedCategories[cat.id] !== false;

                  return (
                    <div
                      key={cat.id}
                      className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white overflow-hidden shadow-xs"
                    >
                      <button
                        onClick={() => toggleCategory(cat.id)}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#8D6CE5]/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base text-text-primary dark:text-white">{cat.name}</span>
                          <span className="text-xs text-text-muted font-bold">({catItems.length})</span>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                      </button>

                      {isExpanded && (
                        <div className="p-4 pt-0 grid gap-3 sm:grid-cols-2">
                          {catItems.map((item) => (
                            <MenuItemCard
                              key={item.id}
                              item={item}
                              onOpenCustomizer={setCustomizingItem}
                              onDirectAdd={handleDirectAdd}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: MERCHANDISE                                                    */}
        {/* ==================================================================== */}
        {activeTab === 'merch' && (
          <div className="space-y-4 animate-fade-in">
            <h2 className="font-black text-xl text-text-primary dark:text-white">Venue Merchandise</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {getSectionItems('merchandise').map((item) => (
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
        {/* VIEW: SEARCH                                                         */}
        {/* ==================================================================== */}
        {activeTab === 'search' && (
          <div className="space-y-4 animate-fade-in">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search food, cocktails, spirits, merch..."
                className="w-full text-xs pl-10 pr-4 py-3 rounded-2xl border border-[#8D6CE5]/20 bg-white dark:bg-[#1A1829] dark:text-white placeholder:text-text-muted focus:outline-none focus:border-[#8D6CE5]"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {allItems
                .filter((i) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q) || (i.categoryName || '').toLowerCase().includes(q);
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
        {/* VIEW: CART                                                           */}
        {/* ==================================================================== */}
        {activeTab === 'cart' && (
          <div className="space-y-4 animate-fade-in pb-8">
            <h2 className="font-black text-2xl text-text-primary dark:text-white tracking-tight">Your Order</h2>

            {cart.length === 0 ? (
              <div className="p-16 text-center border border-dashed border-[#8D6CE5]/20 rounded-2xl">
                <ShoppingCart className="w-12 h-12 mx-auto text-[#8D6CE5]/40 mb-3" />
                <h3 className="font-bold text-sm text-text-primary dark:text-white">Your cart is empty</h3>
                <p className="text-xs text-text-muted mt-1">Browse Eat, Drink or Merchandise and add something delicious.</p>
                <button
                  onClick={() => setActiveTab('eat')}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#8D6CE5] text-white font-bold text-xs shadow-md"
                >
                  Browse Menu
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2.5">
                  {cart.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white p-4 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <VegBadge type={c.foodType} size="sm" />
                            <div className="font-extrabold text-sm text-text-primary dark:text-white">{c.name}</div>
                          </div>
                          {(c.variantName || (c.modifiers && c.modifiers.length > 0)) && (
                            <div className="mt-1 text-xs text-text-muted">
                              {[c.variantName, ...(c.modifiers || []).map((m: any) => m.optionName)].filter(Boolean).join(' · ')}
                            </div>
                          )}
                          {c.specialInstructions && (
                            <div className="mt-1 text-xs italic text-amber-500">"{c.specialInstructions}"</div>
                          )}
                        </div>

                        <button
                          onClick={() => removeFromCart(c.id)}
                          className="text-text-muted hover:text-rose-500 p-1 transition-colors"
                          aria-label="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#8D6CE5]/10">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartQuantity(c.id, -1)}
                            className="w-7 h-7 rounded-lg border border-[#8D6CE5]/30 flex items-center justify-center hover:bg-[#8D6CE5]/10 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-black text-xs text-[#8D6CE5]">{c.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(c.id, 1)}
                            className="w-7 h-7 rounded-lg border border-[#8D6CE5]/30 flex items-center justify-center hover:bg-[#8D6CE5]/10 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-sm font-black text-[#8D6CE5]">₹{(c.unitPrice * c.quantity).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Subtotal Card */}
                <div className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-text-primary dark:text-white font-semibold">
                    <span>Subtotal</span>
                    <span>₹{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>Service charge (5%)</span>
                    <span>~₹{Math.round((cartTotal * 5) / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-text-muted">
                    <span>GST (5%)</span>
                    <span>~₹{Math.round(((cartTotal + Math.round((cartTotal * 5) / 100)) * 5) / 100).toFixed(2)}</span>
                  </div>
                  <div className="mt-2 border-t border-[#8D6CE5]/15 pt-2 text-[10px] text-text-muted">
                    Final charges are calculated when requesting the bill.
                  </div>
                </div>

                {/* Sticky Bottom Place Order Button */}
                <div className="sticky bottom-24 z-20 pt-2">
                  <button
                    disabled={isOrdering}
                    onClick={handlePlaceOrder}
                    className="w-full h-14 rounded-2xl bg-[#8D6CE5] hover:bg-[#7B59D8] disabled:opacity-50 text-white font-extrabold text-sm shadow-xl transition-all flex items-center justify-between px-5"
                  >
                    <span>{isOrdering ? 'Dispatching to Kitchen...' : 'Place Order'}</span>
                    <span>₹{cartTotal.toFixed(2)}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: MY ORDERS (Live Status Tabs)                                  */}
        {/* ==================================================================== */}
        {activeTab === 'orders' && (
          <div className="space-y-4 animate-fade-in pb-6">
            <h2 className="font-black text-2xl text-text-primary dark:text-white tracking-tight">My Orders</h2>

            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl dark:bg-[#1A1829] bg-white border border-[#8D6CE5]/15">
              <button
                onClick={() => setActiveOrdersSubTab('pending')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  activeOrdersSubTab === 'pending' ? 'bg-[#8D6CE5] text-white shadow-xs' : 'text-text-muted'
                }`}
              >
                Pending ({pendingOrders.length})
              </button>
              <button
                onClick={() => setActiveOrdersSubTab('done')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  activeOrdersSubTab === 'done' ? 'bg-[#8D6CE5] text-white shadow-xs' : 'text-text-muted'
                }`}
              >
                Completed ({completedOrders.length})
              </button>
            </div>

            <div className="space-y-3">
              {(activeOrdersSubTab === 'pending' ? pendingOrders : completedOrders).map((o, idx) => (
                <div
                  key={o.id || idx}
                  className="rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#8D6CE5]/10">
                    <div>
                      <div className="font-black text-base text-text-primary dark:text-white">
                        Order #{String(o.orderNumber || idx + 1).padStart(2, '0')}
                      </div>
                      <div className="text-[11px] text-text-muted">
                        Placed {new Date(o.placedAt || o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-[#8D6CE5]/10 text-[#8D6CE5]">
                      {o.status || 'PREPARING'}
                    </span>
                  </div>

                  <div className="divide-y divide-[#8D6CE5]/10">
                    {(o.items || []).map((item: any) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 py-2 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <VegBadge type={item.foodType} size="sm" />
                            <span className="font-bold text-text-primary dark:text-white">{item.itemName || item.name}</span>
                            {item.variantName && <span className="text-text-muted">· {item.variantName}</span>}
                          </div>
                          <div className="text-[10px] text-text-muted mt-0.5">
                            Qty {item.quantity} · {item.station?.toLowerCase()}
                          </div>
                          {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                            <div className="text-[10px] text-text-muted">
                              {item.selectedModifiers.map((m: any) => m.optionName).join(', ')}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                              item.status === 'SERVED'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : item.status === 'READY'
                                ? 'bg-purple-500/20 text-[#8D6CE5]'
                                : 'bg-amber-500/10 text-amber-500'
                            }`}
                          >
                            {item.status}
                          </span>
                          <div className="mt-1 font-bold text-text-primary dark:text-white">
                            ₹{Number(item.lineTotal || item.unitPrice * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: PAY BILL                                                       */}
        {/* ==================================================================== */}
        {activeTab === 'bill' && (
          <div className="space-y-4 animate-fade-in pb-6">
            {/* Highlighted Header Card */}
            <div className="rounded-2xl border border-[#8D6CE5]/30 bg-gradient-to-br from-[#8D6CE5]/20 via-[#8D6CE5]/10 to-indigo-500/10 p-6 text-center shadow-md">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-[#8D6CE5]/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-[#8D6CE5]" />
              </div>
              <h2 className="font-black text-2xl text-text-primary dark:text-white">
                {billRequested ? 'Bill Requested' : 'Itemized Table Bill'}
              </h2>
              <p className="mt-1 text-xs text-text-muted max-w-sm mx-auto">
                {billRequested
                  ? `A waiter is coming to Table ${tableNumber || 'C5'} to collect payment. No online payment is required.`
                  : 'Review all placed order tickets and charges below before settlement.'}
              </p>
              <div className="mt-4 font-black text-4xl text-[#8D6CE5]">
                ₹{Number(activeBill?.grandTotal || cartTotal).toFixed(2)}
              </div>
              <div className="text-[10px] text-text-muted mt-1 font-mono">{tokenNumber}</div>
            </div>

            {/* Breakdown card */}
            <div className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white p-4 text-xs space-y-3 shadow-xs">
              <h3 className="font-black text-base text-text-primary dark:text-white">Bill Breakdown</h3>
              <div className="divide-y divide-[#8D6CE5]/10">
                {flatHistoryItems.map((item: any, idx: number) => (
                  <div key={item.id || idx} className="flex items-start justify-between py-2">
                    <div>
                      <div className="font-bold text-text-primary dark:text-white">
                        {item.quantity} × {item.itemName || item.name}
                      </div>
                      <div className="text-[10px] text-text-muted">Order #{String(item.orderNumber || 1).padStart(2, '0')}</div>
                    </div>
                    <div className="font-bold text-text-primary dark:text-white">
                      ₹{Number(item.lineTotal || item.unitPrice * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 border-t border-[#8D6CE5]/15 pt-3">
                <div className="flex justify-between text-text-muted">
                  <span>Food Subtotal</span>
                  <span className="font-semibold text-text-primary dark:text-white">₹{Number(activeBill?.foodSubtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>Drink Subtotal</span>
                  <span className="font-semibold text-text-primary dark:text-white">₹{Number(activeBill?.drinkSubtotal || 0).toFixed(2)}</span>
                </div>
                {Number(activeBill?.merchandiseSubtotal || 0) > 0 && (
                  <div className="flex justify-between text-text-muted">
                    <span>Merchandise</span>
                    <span className="font-semibold text-text-primary dark:text-white">₹{Number(activeBill?.merchandiseSubtotal || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-text-muted">
                  <span>Service Charge (5%)</span>
                  <span>₹{Number(activeBill?.serviceCharge || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-text-muted">
                  <span>GST (5%)</span>
                  <span>₹{Number(activeBill?.gst || 0).toFixed(2)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[#8D6CE5]/15 pt-2 text-base font-black text-text-primary dark:text-white">
                  <span>Total</span>
                  <span className="text-xl text-[#8D6CE5]">₹{Number(activeBill?.grandTotal || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleRequestBill}
              className="w-full py-4 rounded-2xl bg-[#8D6CE5] hover:bg-[#7B59D8] text-white font-black text-sm shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              <span>Request Bill from Waiter</span>
            </button>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW: REPEAT (Reorder Past Session Items in 1-Tap)                   */}
        {/* ==================================================================== */}
        {activeTab === 'repeat' && (
          <div className="space-y-4 animate-fade-in pb-6">
            <h2 className="font-black text-2xl text-text-primary dark:text-white tracking-tight">Repeat Order</h2>
            {flatHistoryItems.length === 0 ? (
              <div className="p-16 text-center border border-dashed border-[#8D6CE5]/20 rounded-2xl">
                <RotateCcw className="w-12 h-12 mx-auto text-[#8D6CE5]/40 mb-3" />
                <h3 className="font-bold text-sm text-text-primary dark:text-white">Nothing to repeat yet</h3>
                <p className="text-xs text-text-muted mt-1">Once you place an order, you can quickly re-order it here.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {flatHistoryItems.map((item: any, idx: number) => (
                  <div
                    key={item.id || idx}
                    className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white p-4 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div>
                      <div className="font-bold text-sm text-text-primary dark:text-white">{item.itemName || item.name}</div>
                      <div className="text-xs text-[#8D6CE5] font-bold mt-0.5">₹{Number(item.unitPrice).toFixed(2)}</div>
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
                      className="px-3.5 py-2 rounded-xl bg-[#8D6CE5]/10 hover:bg-[#8D6CE5] text-[#8D6CE5] hover:text-white font-bold text-xs transition-colors"
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
        {/* VIEW: ACCOUNT                                                        */}
        {/* ==================================================================== */}
        {activeTab === 'account' && (
          <div className="space-y-4 animate-fade-in pb-6">
            <h2 className="font-black text-2xl text-text-primary dark:text-white tracking-tight">Your Session</h2>
            <div className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white p-5 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Table Number</span>
                <span className="font-bold text-text-primary dark:text-white">Table {tableNumber || 'C5'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Session Token</span>
                <span className="font-mono text-[#8D6CE5]">{tokenNumber || 'DEMO'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Active Placed Orders</span>
                <span className="font-bold text-text-primary dark:text-white">{activeOrders.length} tickets</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 2. Bottom Navigation Bar (5 tabs matching reference) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#8D6CE5]/15 dark:bg-[#1A1829]/95 bg-white/95 backdrop-blur-md max-w-2xl mx-auto">
        <div className="grid grid-cols-5 gap-1 px-2 pt-1.5 pb-2 text-[11px]">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors ${
              activeTab === 'home' || activeTab === 'eat' || activeTab === 'drink' || activeTab === 'merch'
                ? 'text-[#8D6CE5] font-black'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <HomeIcon className="w-5 h-5" />
            <span>Home</span>
          </button>

          <button
            onClick={() => setIsCallWaiterOpen(true)}
            className="flex flex-col items-center gap-1 py-1.5 rounded-xl text-text-muted hover:text-text-primary transition-colors relative"
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
            className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors ${
              activeTab === 'repeat' ? 'text-[#8D6CE5] font-black' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <RotateCcw className="w-5 h-5" />
            <span>Repeat</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors relative ${
              activeTab === 'orders' ? 'text-[#8D6CE5] font-black' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <ClipboardList className="w-5 h-5" />
            {activeOrders.length > 0 && (
              <span className="absolute top-1 right-3 w-3.5 h-3.5 rounded-full bg-[#8D6CE5] text-white text-[8px] font-black flex items-center justify-center">
                {activeOrders.length}
              </span>
            )}
            <span>My Orders</span>
          </button>

          <button
            onClick={() => setActiveTab('bill')}
            className={`flex flex-col items-center gap-1 py-1.5 rounded-xl transition-colors ${
              activeTab === 'bill' ? 'text-[#8D6CE5] font-black' : 'text-text-muted hover:text-text-primary'
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
        tokenNumber={tokenNumber || 'DEMO'}
        tableId={undefined}
        activeRequests={activeRequests}
      />
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
