import React, { useState } from 'react';
import { Clock, Search, RefreshCw, LogOut, X } from 'lucide-react';
import { api } from '../../services/api';
import type { Token } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

export const CustomerSessionsManager: React.FC = () => {
  const { showToast } = useAuth();
  const { tokens, isLoading, refreshTokens, refreshTables } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Deactivate Session Modal State
  const [deactivatingToken, setDeactivatingToken] = useState<Token | null>(null);
  const [closeReason, setCloseReason] = useState('CHECKOUT');
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);

  // Extend Session Modal State
  const [extendingToken, setExtendingToken] = useState<Token | null>(null);
  const [extraMinutes, setExtraMinutes] = useState(60);
  const [additionalAmount, setAdditionalAmount] = useState(500);
  const [isSubmittingExtend, setIsSubmittingExtend] = useState(false);

  const handleDeactivateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deactivatingToken) return;

    setIsSubmittingClose(true);
    try {
      await api.closeToken(deactivatingToken.tokenNumber, closeReason);
      showToast(`Session ${deactivatingToken.tokenNumber} deactivated successfully.`, 'success');
      setDeactivatingToken(null);
      refreshTokens();
      refreshTables();
    } catch (err: any) {
      showToast(err.message || 'Failed to deactivate session.', 'danger');
    } finally {
      setIsSubmittingClose(false);
    }
  };

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingToken) return;

    setIsSubmittingExtend(true);
    try {
      await api.extendToken(extendingToken.tokenNumber, extraMinutes, additionalAmount);
      showToast(`Session ${extendingToken.tokenNumber} extended by ${extraMinutes} mins.`, 'success');
      setExtendingToken(null);
      refreshTokens();
    } catch (err: any) {
      showToast(err.message || 'Failed to extend session.', 'danger');
    } finally {
      setIsSubmittingExtend(false);
    }
  };

  const filteredTokens = tokens.filter(t => {
    const query = search.toLowerCase();
    const matchesSearch = 
      t.tokenNumber.toLowerCase().includes(query) ||
      (t.customer?.name || '').toLowerCase().includes(query) ||
      (t.customer?.phoneNumber || '').includes(query);

    const matchesFilter = statusFilter === 'all' || (t.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-white/10">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Token Number, Customer Name, or Phone..."
            className="w-full bg-[#1A202C] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center gap-2">
          {['all', 'active', 'extended', 'expired', 'closed'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                statusFilter === f
                  ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                  : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}

          <button
            onClick={refreshTokens}
            className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 border border-white/10 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Customer Sessions Directory Table */}
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading customer sessions...</div>
        ) : filteredTokens.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">No customer sessions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 uppercase font-semibold text-[10px] tracking-wider">
                  <th className="pb-3 px-3">Token #</th>
                  <th className="pb-3 px-3">Customer Name</th>
                  <th className="pb-3 px-3">Phone</th>
                  <th className="pb-3 px-3">Guests</th>
                  <th className="pb-3 px-3">Redemptions</th>
                  <th className="pb-3 px-3">Delivery Mode</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTokens.map(tk => (
                  <tr key={tk.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#D4AF37]">{tk.tokenNumber}</td>
                    <td className="py-3 px-3 font-semibold text-white">{tk.customer?.name || 'Walk-in Guest'}</td>
                    <td className="py-3 px-3 font-mono text-gray-300">{tk.customer?.phoneNumber || 'N/A'}</td>
                    <td className="py-3 px-3 font-semibold text-gray-200">{tk.personsCount} Guests</td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-amber-300 font-bold">{tk.redemptionsUsed}</span> / {tk.totalRedemptionsAllowed} Drinks
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-gray-300 border border-white/10">
                        {tk.deliveryMode}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold badge-active">
                        {tk.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 flex items-center gap-2">
                      <button
                        onClick={() => setExtendingToken(tk)}
                        className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 transition-all flex items-center gap-1"
                      >
                        <Clock size={12} /> Extend
                      </button>

                      <button
                        onClick={() => setDeactivatingToken(tk)}
                        className="px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/30 transition-all flex items-center gap-1"
                      >
                        <LogOut size={12} /> Deactivate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EXTEND SESSION MODAL */}
      {extendingToken && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setExtendingToken(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <Clock size={18} /> Admin Extend Session Time
            </div>

            <p className="text-xs text-gray-400">
              Token Number: <span className="font-mono font-bold text-[#D4AF37]">{extendingToken.tokenNumber}</span> ({extendingToken.customer?.name})
            </p>

            <form onSubmit={handleExtendSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Additional Minutes</label>
                <select
                  value={extraMinutes}
                  onChange={e => setExtraMinutes(Number(e.target.value))}
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                  <option value={180}>180 Minutes (3 Hours)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Additional Fee (₹)</label>
                <input
                  type="number"
                  value={additionalAmount}
                  onChange={e => setAdditionalAmount(Number(e.target.value))}
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtendingToken(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExtend}
                  className="flex-1 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider"
                >
                  {isSubmittingExtend ? 'Extending...' : 'Confirm Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEACTIVATE SESSION MODAL */}
      {deactivatingToken && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setDeactivatingToken(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <LogOut size={18} /> Admin Deactivate Session
            </div>

            <p className="text-xs text-gray-400">
              Token Number: <span className="font-mono font-bold text-[#D4AF37]">{deactivatingToken.tokenNumber}</span> ({deactivatingToken.customer?.name})
            </p>

            <form onSubmit={handleDeactivateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Select Deactivation Reason</label>
                <select
                  value={closeReason}
                  onChange={e => setCloseReason(e.target.value)}
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                >
                  <option value="CHECKOUT">Standard Guest Checkout</option>
                  <option value="EXPIRED">Session Time Expired</option>
                  <option value="CANCELLED">Deactivated by Admin</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeactivatingToken(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClose}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider"
                >
                  {isSubmittingClose ? 'Deactivating...' : 'Confirm Deactivation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
