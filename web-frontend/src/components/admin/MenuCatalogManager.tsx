import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { VegBadge } from '../customer/VegBadge';
import { Search, Filter, CheckCircle2, AlertCircle, Sparkles, UtensilsCrossed } from 'lucide-react';

export const MenuCatalogManager: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const [menu, setMenu] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchMenu = async () => {
    setIsLoading(true);
    try {
      const data = await api.getMenu(true);
      setMenu(data);
    } catch (err: any) {
      console.warn('Failed to load menu in admin:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
    const handleGlobalRefresh = () => fetchMenu();
    window.addEventListener('app:global-refresh', handleGlobalRefresh);
    return () => {
      window.removeEventListener('app:global-refresh', handleGlobalRefresh);
    };
  }, []);

  const handleToggleAvailability = async (itemId: string, currentAvailability: boolean) => {
    setTogglingId(itemId);
    try {
      const newStatus = !currentAvailability;
      await api.setItemAvailability(itemId, newStatus);
      setMenu((prevSections) =>
        prevSections.map((sec) => ({
          ...sec,
          categories: (sec.categories || []).map((cat: any) => ({
            ...cat,
            items: (cat.items || []).map((i: any) => (i.id === itemId ? { ...i, isAvailable: newStatus } : i)),
          })),
        }))
      );
      setFeedback(`Item marked ${newStatus ? 'IN STOCK' : '86 / SOLD OUT'}!`);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback(`Failed to update item: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const allItems: any[] = [];
  menu.forEach((sec: any) => {
    (sec.categories || []).forEach((cat: any) => {
      (cat.items || []).forEach((item: any) => {
        allItems.push({
          ...item,
          sectionName: sec.name,
          categoryName: cat.name,
        });
      });
    });
  });

  const filteredItems = allItems.filter((i) => {
    if (stationFilter !== 'ALL' && i.station !== stationFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = i.name.toLowerCase().includes(q);
      const matchesCat = (i.categoryName || '').toLowerCase().includes(q);
      if (!matchesName && !matchesCat) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-zinc-900 dark:text-white">Menu Catalog & Live 86 Manager</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Instant in-stock and sold-out availability toggling across guest devices</p>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
            feedback.toLowerCase().startsWith('failed')
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
          }`}
        >
          {feedback.toLowerCase().startsWith('failed') ? (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-primary dark:focus:border-[#D4AF37] transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-white/5 p-1 rounded-xl">
          {['ALL', 'KITCHEN', 'BAR', 'DESSERT'].map((st) => (
            <button
              key={st}
              onClick={() => setStationFilter(st)}
              className={`text-xs font-bold px-3 sm:px-3.5 py-2 rounded-lg min-h-[38px] transition-all cursor-pointer ${
                stationFilter === st
                  ? 'bg-primary text-white shadow-xs dark:bg-[#D4AF37] dark:text-black font-extrabold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#18181A] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th scope="col" className="p-3.5">Item Name</th>
                <th scope="col" className="p-3.5">Category</th>
                <th scope="col" className="p-3.5">Station</th>
                <th scope="col" className="p-3.5">Base Price</th>
                <th scope="col" className="p-3.5 text-right">Availability (86 Switch)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-white/5">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="animate-pulse">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-zinc-200 dark:bg-white/10 shrink-0" />
                        <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-white/10" />
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-white/10" />
                    </td>
                    <td className="p-3.5">
                      <div className="h-4 w-14 rounded bg-zinc-200 dark:bg-white/10" />
                    </td>
                    <td className="p-3.5">
                      <div className="h-4 w-12 rounded bg-zinc-200 dark:bg-white/10" />
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="h-7 w-20 rounded-xl bg-zinc-200 dark:bg-white/10 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <UtensilsCrossed className="w-8 h-8 mx-auto text-zinc-400 dark:text-zinc-500 mb-2" />
                    <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200">No menu items found</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Try adjusting your search query or station filter.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isAvail = item.isAvailable !== false;
                  const isToggling = togglingId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/80 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          {item.foodType && <VegBadge type={item.foodType} size="sm" />}
                          <span className="font-bold text-zinc-900 dark:text-white">{item.name}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-zinc-500 dark:text-zinc-400">{item.categoryName}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-white/10 font-semibold text-[10px]">
                          {item.station}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-zinc-900 dark:text-white">₹{item.basePrice}</td>
                      <td className="p-3.5 text-right">
                        {isAdmin ? (
                          <button
                            disabled={isToggling}
                            onClick={() => handleToggleAvailability(item.id, isAvail)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                              isAvail
                                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-400'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isToggling ? 'Updating...' : isAvail ? 'In Stock' : '86 Sold Out'}
                          </button>
                        ) : (
                          <span
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs inline-block ${
                              isAvail
                                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {isAvail ? 'In Stock' : '86 Sold Out'} (View Only)
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
