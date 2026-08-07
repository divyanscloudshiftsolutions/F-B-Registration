import React, { useState } from 'react';
import { 
  Users, 
  Grid3X3, 
  Wine, 
  DollarSign, 
  TrendingUp,
  Clock,
  LogOut,
  X,
  UserCheck,
  CalendarRange,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import type { Token } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

interface DashboardPageProps {
  onNavigate?: (tabId: string, adminSubtab?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { showToast } = useAuth();
  const { tokens, tables, isLoading, refreshTokens, refreshTables } = useData();

  // Extend Modal State
  const [extendingToken, setExtendingToken] = useState<Token | null>(null);
  const [extraMinutes, setExtraMinutes] = useState(60);
  const [additionalAmount, setAdditionalAmount] = useState(500);
  const [isSubmittingExtend, setIsSubmittingExtend] = useState(false);

  // Close Modal State
  const [closingToken, setClosingToken] = useState<Token | null>(null);
  const [closeReason, setCloseReason] = useState('CHECKOUT');
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingToken) return;

    setIsSubmittingExtend(true);
    try {
      await api.extendToken(extendingToken.tokenNumber, extraMinutes, additionalAmount);
      showToast(`Session for ${extendingToken.tokenNumber} extended by ${extraMinutes} mins.`, 'success');
      setExtendingToken(null);
      refreshTokens();
    } catch (err: any) {
      showToast(err.message || 'Failed to extend session.', 'danger');
    } finally {
      setIsSubmittingExtend(false);
    }
  };

  const handleCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingToken) return;

    setIsSubmittingClose(true);
    try {
      await api.closeToken(closingToken.tokenNumber, closeReason);
      showToast(`Session ${closingToken.tokenNumber} closed (${closeReason}).`, 'success');
      setClosingToken(null);
      refreshTokens();
      refreshTables();
    } catch (err: any) {
      showToast(err.message || 'Failed to close session.', 'danger');
    } finally {
      setIsSubmittingClose(false);
    }
  };

  const activeTokensCount = tokens.length;
  const occupiedTablesCount = tables.filter(t => t.status === 'occupied').length;
  const totalCapacity = tables.reduce((acc, t) => acc + t.capacity, 0);
  const totalGuestsInHouse = tokens.reduce((acc, tk) => acc + tk.personsCount, 0);
  const totalRedemptionsUsed = tokens.reduce((acc, tk) => acc + tk.redemptionsUsed, 0);
  const totalRevenue = tokens.reduce((acc, tk) => acc + (tk.amountPaid || 0), 0);

  return (
    <div className="space-y-6 text-text-main">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-[#8D6CE5]">
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Active Guest Sessions</p>
            <h3 className="text-2xl font-black text-text-main mt-1">{activeTokensCount}</h3>
            <p className="text-[11px] dark:text-emerald-400 text-emerald-700 mt-1 flex items-center gap-1 font-medium">
              <TrendingUp size={12} /> {totalGuestsInHouse} Total Guests In-House
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#8D6CE5]/15 text-[#8D6CE5] flex items-center justify-center font-bold">
            <Users size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Seating Occupancy</p>
            <h3 className="text-2xl font-black text-text-main mt-1">{occupiedTablesCount} / {tables.length}</h3>
            <p className="text-[11px] text-text-muted mt-1">
              Floor Capacity: {totalCapacity} Seats
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl dark:bg-emerald-500/15 bg-emerald-500/10 dark:text-emerald-400 text-emerald-700 flex items-center justify-center font-bold">
            <Grid3X3 size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Drink Redemptions</p>
            <h3 className="text-2xl font-black text-text-main mt-1">{totalRedemptionsUsed}</h3>
            <p className="text-[11px] dark:text-amber-400 text-amber-700 mt-1">Active Drinks Served Today</p>
          </div>
          <div className="w-12 h-12 rounded-xl dark:bg-amber-500/15 bg-amber-500/10 dark:text-amber-400 text-amber-700 flex items-center justify-center font-bold">
            <Wine size={24} />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Session Revenue</p>
            <h3 className="text-2xl font-black text-text-main mt-1">₹{totalRevenue.toLocaleString()}</h3>
            <p className="text-[11px] dark:text-blue-400 text-blue-700 mt-1">Verified Gate Payments</p>
          </div>
          <div className="w-12 h-12 rounded-xl dark:bg-blue-500/15 bg-blue-500/10 dark:text-blue-400 text-blue-700 flex items-center justify-center font-bold">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Quick Actions</h4>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onNavigate?.('checkin')}
            className="px-4 py-2.5 rounded-xl primary-btn text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer"
          >
            <div className="nav-icon-badge">
              <UserCheck size={14} />
            </div>
            <span>New Check-In</span>
          </button>

          <button
            onClick={() => onNavigate?.('tables')}
            className="px-4 py-2.5 text-xs font-semibold flex items-center gap-2 transition-all premium-btn-secondary"
          >
            <div className="nav-icon-badge">
              <Grid3X3 size={14} />
            </div>
            <span>Table Layout</span>
          </button>

          <button
            onClick={() => onNavigate?.('tables')}
            className="px-4 py-2.5 text-xs font-semibold flex items-center gap-2 transition-all premium-btn-secondary"
          >
            <div className="nav-icon-badge">
              <CalendarRange size={14} />
            </div>
            <span>Reservations</span>
          </button>

          <button
            onClick={() => onNavigate?.('admin', 'customers')}
            className="px-4 py-2.5 text-xs font-semibold flex items-center gap-2 transition-all premium-btn-secondary"
          >
            <div className="nav-icon-badge">
              <Users size={14} />
            </div>
            <span>Customer Sessions</span>
          </button>
        </div>
      </div>

      {/* Active Guest Sessions Table */}
      <div className="glass-panel rounded-2xl p-6 border border-border-main">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-text-main">Live Customer Sessions</h3>
            <p className="text-xs text-text-muted">Real-time QR active seating tickets</p>
          </div>
          <button 
            onClick={() => { refreshTokens(); refreshTables(); }}
            className="px-3 py-1.5 text-xs font-semibold transition-all premium-btn-secondary active flex items-center gap-1.5"
          >
            <div className="nav-icon-badge">
              <RefreshCw size={12} />
            </div>
            <span>Refresh List</span>
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-text-muted text-sm">Loading live session data...</div>
        ) : tokens.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-sm">No active customer sessions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border-main text-text-muted uppercase font-semibold text-[10px] tracking-wider">
                  <th className="pb-3 px-3">Token #</th>
                  <th className="pb-3 px-3">Customer</th>
                  <th className="pb-3 px-3">Phone</th>
                  <th className="pb-3 px-3">Persons</th>
                  <th className="pb-3 px-3">Redemptions</th>
                  <th className="pb-3 px-3">Mode</th>
                  <th className="pb-3 px-3">Status</th>
                  <th className="pb-3 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {tokens.map(tk => (
                  <tr key={tk.id} className="hover:bg-bg-card transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#8D6CE5]">{tk.tokenNumber}</td>
                    <td className="py-3 px-3 font-semibold text-text-main">{tk.customer?.name || 'Walk-in Guest'}</td>
                    <td className="py-3 px-3 font-mono text-text-muted">{tk.customer?.phoneNumber || 'N/A'}</td>
                    <td className="py-3 px-3 font-semibold text-text-muted">{tk.personsCount} Guests</td>
                    <td className="py-3 px-3">
                      <span className="font-mono dark:text-amber-300 text-amber-700 dark:text-amber-300 font-bold">{tk.redemptionsUsed}</span> / {tk.totalRedemptionsAllowed} Drinks
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-primary text-text-muted border border-border-main">
                        {tk.deliveryMode}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold badge-active animate-pulse">
                        {tk.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 flex items-center gap-2">
                      <button
                        onClick={() => setExtendingToken(tk)}
                        className="px-2 py-1 rounded dark:bg-amber-500/10 bg-amber-500/5 hover:dark:bg-amber-500/20 hover:bg-amber-500/10 dark:text-amber-300 text-amber-700 text-[10px] font-bold border border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                        title="Extend Session"
                      >
                        <Clock size={12} /> Extend
                      </button>

                      <button
                        onClick={() => setClosingToken(tk)}
                        className="px-2 py-1 rounded dark:bg-red-500/10 bg-red-500/5 hover:dark:bg-red-500/20 hover:bg-red-500/10 dark:text-red-400 text-red-700 text-[10px] font-bold border border-red-500/30 transition-all flex items-center gap-1 cursor-pointer"
                        title="Close Session"
                      >
                        <LogOut size={12} /> Checkout
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
          <div className="bg-bg-surface border border-border-main rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative text-text-main animate-fadeIn">
            <button 
              onClick={() => setExtendingToken(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 dark:text-amber-400 text-amber-700 font-bold text-sm">
              <Clock size={18} /> Extend Customer Session
            </div>

            <p className="text-xs text-text-muted">
              Token Number: <span className="font-mono font-bold text-[#8D6CE5]">{extendingToken.tokenNumber}</span> ({extendingToken.customer?.name})
            </p>

            <form onSubmit={handleExtendSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Additional Minutes</label>
                <select
                  value={extraMinutes}
                  onChange={e => setExtraMinutes(Number(e.target.value))}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-[#8D6CE5]"
                >
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (1 Hour)</option>
                  <option value={120}>120 Minutes (2 Hours)</option>
                  <option value={180}>180 Minutes (3 Hours)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Additional Extension Amount (₹)</label>
                <input
                  type="number"
                  value={additionalAmount}
                  onChange={e => setAdditionalAmount(Number(e.target.value))}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none focus:border-[#8D6CE5]"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtendingToken(null)}
                  className="flex-1 py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-semibold text-text-muted hover:text-text-main cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExtend}
                  title={isSubmittingExtend ? "Request in progress" : undefined}
                  className="flex-1 py-2.5 rounded-xl primary-btn text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {isSubmittingExtend ? 'Extending...' : 'Confirm Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOSE / CHECKOUT SESSION MODAL */}
      {closingToken && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-main rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative text-text-main animate-fadeIn">
            <button 
              onClick={() => setClosingToken(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 dark:text-red-400 text-red-700 font-bold text-sm">
              <LogOut size={18} /> Checkout / Close Session
            </div>

            <p className="text-xs text-text-muted">
              Token Number: <span className="font-mono font-bold text-[#8D6CE5]">{closingToken.tokenNumber}</span> ({closingToken.customer?.name})
            </p>

            <form onSubmit={handleCloseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Select Close Reason</label>
                <select
                  value={closeReason}
                  onChange={e => setCloseReason(e.target.value)}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-red-500"
                >
                  <option value="CHECKOUT">Standard Guest Checkout</option>
                  <option value="EXPIRED">Session Time Expired</option>
                  <option value="CANCELLED">Session Cancelled by Reception</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClosingToken(null)}
                  className="flex-1 py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-semibold text-text-muted hover:text-text-main cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingClose}
                  title={isSubmittingClose ? "Request in progress" : undefined}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  {isSubmittingClose ? 'Closing...' : 'Close & Release Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

