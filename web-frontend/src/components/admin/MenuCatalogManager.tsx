import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { VegBadge } from '../customer/VegBadge';
import { Search, Filter, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

export const MenuCatalogManager: React.FC = () => {
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
          <h2 className="text-lg font-black text-text-primary dark:text-white">Menu Catalog & Live 86 Manager</h2>
          <p className="text-xs text-text-muted">Instant in-stock and sold-out availability toggling across guest devices</p>
        </div>

        <button
          onClick={fetchMenu}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#8D6CE5]/20 text-xs font-bold text-text-primary dark:text-white hover:bg-[#8D6CE5]/10 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {feedback && (
        <div className="p-3 rounded-2xl bg-[#8D6CE5]/15 border border-[#8D6CE5]/30 text-[#8D6CE5] text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items..."
            className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-[#8D6CE5]/20 bg-white dark:bg-[#1A1829] dark:text-white placeholder:text-text-muted focus:outline-none focus:border-[#8D6CE5]"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-xl">
          {['ALL', 'KITCHEN', 'BAR', 'DESSERT'].map((st) => (
            <button
              key={st}
              onClick={() => setStationFilter(st)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                stationFilter === st
                  ? 'bg-[#8D6CE5] text-white shadow-xs'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#8D6CE5]/15 bg-[#8D6CE5]/5 text-text-muted font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Item Name</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Station</th>
                <th className="p-3.5">Base Price</th>
                <th className="p-3.5 text-right">Availability (86 Switch)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#8D6CE5]/10">
              {filteredItems.map((item) => {
                const isAvail = item.isAvailable !== false;
                const isToggling = togglingId === item.id;

                return (
                  <tr key={item.id} className="hover:bg-[#8D6CE5]/5 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <VegBadge type={item.foodType} size="sm" />
                        <span className="font-bold text-text-primary dark:text-white">{item.name}</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-text-muted">{item.categoryName}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#8D6CE5]/10 text-[#8D6CE5] font-semibold text-[10px]">
                        {item.station}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-text-primary dark:text-white">₹{item.basePrice}</td>
                    <td className="p-3.5 text-right">
                      <button
                        disabled={isToggling}
                        onClick={() => handleToggleAvailability(item.id, isAvail)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                          isAvail
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 hover:bg-rose-500/15 hover:border-rose-500/30 hover:text-rose-500'
                            : 'bg-rose-500/15 border border-rose-500/30 text-rose-500 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-500'
                        }`}
                      >
                        {isToggling ? 'Updating...' : isAvail ? 'In Stock' : '86 Sold Out'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
