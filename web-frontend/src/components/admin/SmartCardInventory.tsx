import React, { useState } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

export const SmartCardInventory: React.FC = () => {
  const { showToast } = useAuth();
  const { cards, isLoading, refreshCards } = useData();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const handleUpdateStatus = async (cardUid: string, status: string) => {
    try {
      await api.updateCardStatus(cardUid, status);
      showToast(`Card ${cardUid} status updated to ${status}.`, 'success');
      refreshCards();
    } catch (err: any) {
      showToast(err.message || 'Failed to update card status.', 'danger');
    }
  };

  const filteredCards = cards.filter(c => {
    const matchesSearch = (c.cardUid || c.uid || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || (c.status || '').toLowerCase() === filter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-border-main">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-3 text-text-muted" size={16} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Smart Card UID..."
              className="w-full bg-bg-primary border border-border-main rounded-xl pl-10 pr-4 py-2 text-xs text-text-main placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {['all', 'available', 'assigned', 'lost', 'damaged'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                filter === f
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-bg-primary text-text-muted border-border-main hover:bg-bg-card'
              }`}
            >
              {f}
            </button>
          ))}

          <button
            onClick={refreshCards}
            className="px-3.5 py-1.5 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-semibold text-text-muted border border-border-main flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Cards Table */}
      <div className="glass-panel rounded-2xl p-6 border border-border-main">
        {isLoading ? (
          <div className="py-12 text-center text-text-muted text-sm">Loading NFC Smart Card inventory...</div>
        ) : filteredCards.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-sm">No NFC Smart Cards found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-main text-text-muted uppercase font-semibold text-[10px] tracking-wider">
                  <th className="pb-3 px-3">Smart Card UID</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Assigned Token</th>
                  <th className="pb-3 px-3">Last Updated</th>
                  <th className="pb-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {filteredCards.map(c => (
                  <tr key={c.id || c.cardUid} className="hover:bg-bg-primary transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#D4AF37]">{c.cardUid || c.uid}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        c.status === 'AVAILABLE' ? 'badge-active' :
                        c.status === 'ASSIGNED' ? 'dark:bg-blue-500/20 bg-blue-500/10 dark:text-blue-300 text-blue-700 border border-blue-500/40' :
                        'dark:bg-red-500/20 bg-red-500/10 dark:text-red-400 text-red-700 border border-red-500/30'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-text-muted">{c.assignedTokenNumber || 'Unassigned'}</td>
                    <td className="py-3 px-3 font-mono text-text-muted">{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : 'N/A'}</td>
                    <td className="py-3 px-3 flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateStatus(c.cardUid, 'AVAILABLE')}
                        className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 dark:text-emerald-300 text-emerald-700 text-[10px] font-bold border border-emerald-500/30 transition-all"
                      >
                        Available
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(c.cardUid, 'LOST')}
                        className="px-2 py-1 rounded bg-red-500/10 hover:dark:bg-red-500/20 bg-red-500/10 dark:text-red-400 text-red-700 text-[10px] font-bold border border-red-500/30 transition-all"
                      >
                        Mark Lost
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
