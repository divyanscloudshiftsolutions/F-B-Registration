import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Search, 
  LogOut, 
  X, 
  Eye, 
  Layers, 
  Activity, 
  AlertCircle, 
  CheckCheck, 
  History 
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ExtendSessionModal } from '../modals/ExtendSessionModal';
import { CheckoutConfirmationModal } from '../modals/CheckoutConfirmationModal';

const STATUS_TABS_CONFIG = [
  { id: 'all', label: 'ALL', icon: Layers },
  { id: 'active', label: 'ACTIVE', icon: Activity },
  { id: 'extended', label: 'EXTENDED', icon: History },
  { id: 'expired', label: 'EXPIRED', icon: AlertCircle },
  { id: 'closed', label: 'CLOSED', icon: CheckCheck },
];

export const CustomerSessionsManager: React.FC = () => {
  const { showToast } = useAuth();
  const { allSessions, isLoading, refreshAllSessions, refreshTables, rates, refreshTokens } = useData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // Fetch tokens and tables on component mount
  useEffect(() => {
    refreshAllSessions();
    refreshTables();
  }, []);

  // Close Session Modal State
  const [deactivatingToken, setDeactivatingToken] = useState<any | null>(null);

  // Extend Session Modal State
  const [extendingToken, setExtendingToken] = useState<any | null>(null);

  // History Details Modal State
  const [viewingHistoryToken, setViewingHistoryToken] = useState<any | null>(null);

  // Keyboard accessibility: Escape key dismisses the audit details modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewingHistoryToken) {
        setViewingHistoryToken(null);
      }
    };
    if (viewingHistoryToken) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewingHistoryToken]);

  const historyExtensionsTotal = viewingHistoryToken?.extensions?.reduce(
    (sum: number, ext: any) => sum + Number(ext.additionalAmount || 0),
    0
  ) || 0;
  const historyInitialAmount = viewingHistoryToken
    ? Number(viewingHistoryToken.amountPaid || 0) - historyExtensionsTotal
    : 0;

  // Counts for each status tab
  const getStatusCount = (statusId: string) => {
    if (statusId === 'all') return allSessions.length;
    return allSessions.filter(s => (s.status || '').toLowerCase() === statusId.toLowerCase()).length;
  };

  // Semantic Status Badge Component
  const renderStatusBadge = (status?: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'active':
        return (
          <span className="badge-active px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
            Active
          </span>
        );
      case 'extended':
        return (
          <span className="badge-warning px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
            Extended
          </span>
        );
      case 'expired':
        return (
          <span className="badge-danger px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
            Expired
          </span>
        );
      case 'closed':
        return (
          <span className="badge-closed px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400" />
            Closed
          </span>
        );
      default:
        return (
          <span className="badge-closed px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  const filteredTokens = allSessions.filter(t => {
    const query = search.toLowerCase().trim();
    if (!query) {
      return statusFilter === 'all' || (t.status || '').toLowerCase() === statusFilter.toLowerCase();
    }

    const tokenNum = (t.tokenNumber || '').toLowerCase();
    const custName = (t.customer?.name || '').toLowerCase();
    const custPhone = (t.customer?.phoneNumber || '').toLowerCase();
    const custEmail = (t.customer?.email || '').toLowerCase();
    const tableNum = (t.table?.tableNumber || t.tableNumber || '').toLowerCase();
    const personsCountStr = String(t.personsCount || '');

    // Check if query is targeting guest count (e.g. "2", "2 guests", "2 guest", "guests 2", "guests: 2")
    const guestMatch = query.match(/^(\d+)\s*guests?$/) || query.match(/^guests?[:\s]*(\d+)$/);
    const matchesGuestNumber = guestMatch ? personsCountStr === guestMatch[1] : false;
    const matchesGuestPhrase = `${personsCountStr} guests`.includes(query) || `${personsCountStr} guest`.includes(query);
    const matchesDirectCount = personsCountStr === query;

    const matchesSearch = 
      tokenNum.includes(query) ||
      custName.includes(query) ||
      custPhone.includes(query) ||
      custEmail.includes(query) ||
      tableNum.includes(query) ||
      `table ${tableNum}`.includes(query) ||
      matchesGuestNumber ||
      matchesGuestPhrase ||
      matchesDirectCount;

    const matchesFilter = statusFilter === 'all' || (t.status || '').toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredTokens.length / itemsPerPage);
  const paginatedTokens = filteredTokens.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-main pb-4">
        <div>
          <h2 className="text-sm font-bold text-text-main uppercase tracking-wider">
            Customer Sessions & Audit Directory
          </h2>
          <p className="text-xs text-text-muted">
            Monitor real-time guest sessions, table allocations, drink redemptions, and audit history
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-bg-surface border border-border-main text-text-muted">
            Total Sessions: <span className="text-text-main font-bold">{allSessions.length}</span>
          </span>
        </div>
      </div>

      {/* Search & Status Filter Bar (Tabs beside Search Bar) */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-border-main pb-4 mb-6">
        {/* Search Bar */}
        <div className="relative w-full sm:max-w-xs md:max-w-sm shrink-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" size={15} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search token, name, email, guests..."
            aria-label="Search customer sessions by token, name, phone, email, table, or guest count"
            className="w-full bg-bg-primary border border-border-main rounded-xl pl-10 pr-4 py-2 text-xs text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-[#D4AF37]/20 focus:border-primary dark:focus:border-[#D4AF37] transition-all h-[36px]"
          />
        </div>

        {/* Status Filter Navigation Tabs */}
        <div 
          className="glass-panel p-1 rounded-xl flex flex-nowrap overflow-x-auto no-scrollbar gap-1 sm:gap-1.5 shrink-0 max-w-full"
          role="tablist"
          aria-label="Filter sessions by status"
        >
          {STATUS_TABS_CONFIG.map(t => {
            const Icon = t.icon;
            const count = getStatusCount(t.id);
            const isSelected = statusFilter === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setStatusFilter(t.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] transition-all premium-tab-secondary shrink-0 whitespace-nowrap active:scale-95 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-[#D4AF37] ${
                  isSelected ? 'active' : ''
                }`}
              >
                <div className="nav-icon-badge">
                  <Icon size={12} />
                </div>
                <span className="font-bold tracking-wider">{t.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ml-0.5 transition-colors ${
                  isSelected 
                    ? 'bg-primary/20 text-primary dark:bg-[#D4AF37]/30 dark:text-[#D4AF37]' 
                    : 'bg-zinc-200/70 dark:bg-white/10 text-zinc-600 dark:text-zinc-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Customer Sessions Directory Table */}
      <div className="glass-panel rounded-2xl p-3 sm:p-6 border border-border-main">
        {isLoading ? (
          <div className="overflow-x-auto custom-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead>
                <tr className="border-b border-border-main bg-zinc-50/80 dark:bg-white/5 text-text-muted uppercase font-semibold text-[10px] tracking-wider">
                  <th scope="col" className="py-3 px-3.5">Token #</th>
                  <th scope="col" className="py-3 px-3">Customer & Table</th>
                  <th scope="col" className="py-3 px-3">Contact Details</th>
                  <th scope="col" className="py-3 px-3">Guests</th>
                  <th scope="col" className="py-3 px-3">Redemptions</th>
                  <th scope="col" className="py-3 px-3">Status</th>
                  <th scope="col" className="py-3 px-3">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {[1, 2, 3, 4, 5].map(idx => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3.5 px-3.5"><div className="h-4 w-28 bg-zinc-200 dark:bg-white/10 rounded" /></td>
                    <td className="py-3.5 px-3"><div className="h-4 w-32 bg-zinc-200 dark:bg-white/10 rounded mb-1" /><div className="h-3 w-16 bg-zinc-200 dark:bg-white/10 rounded" /></td>
                    <td className="py-3.5 px-3"><div className="h-4 w-24 bg-zinc-200 dark:bg-white/10 rounded mb-1" /><div className="h-3 w-36 bg-zinc-200 dark:bg-white/10 rounded" /></td>
                    <td className="py-3.5 px-3"><div className="h-4 w-16 bg-zinc-200 dark:bg-white/10 rounded" /></td>
                    <td className="py-3.5 px-3"><div className="h-4 w-20 bg-zinc-200 dark:bg-white/10 rounded" /></td>
                    <td className="py-3.5 px-3"><div className="h-4 w-14 bg-zinc-200 dark:bg-white/10 rounded-full" /></td>
                    <td className="py-3.5 px-3"><div className="h-8 w-44 bg-zinc-200 dark:bg-white/10 rounded-lg" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredTokens.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/5 border border-border-main flex items-center justify-center mx-auto text-text-muted">
              <Clock size={24} className="opacity-60" />
            </div>
            <div className="text-sm font-bold text-text-main">
              {allSessions.length === 0 ? 'No Customer Sessions Recorded' : 'No Matching Customer Sessions'}
            </div>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              {allSessions.length === 0
                ? 'Active and completed guest sessions created at check-in will appear here.'
                : 'No customer sessions match your active search or status filter. Try adjusting your criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-xs min-w-[850px] border-collapse" aria-label="Customer Sessions Directory">
              <thead>
                <tr className="border-b border-border-main bg-zinc-50/80 dark:bg-white/5 text-text-muted uppercase font-semibold text-[10px] tracking-wider">
                  <th scope="col" className="py-3 px-3.5 sticky left-0 z-20 bg-zinc-100/95 dark:bg-[#18181A]/95 backdrop-blur-xs border-r border-border-main">
                    Token #
                  </th>
                  <th scope="col" className="py-3 px-3">Customer & Table</th>
                  <th scope="col" className="py-3 px-3">Contact Details</th>
                  <th scope="col" className="py-3 px-3">Guests</th>
                  <th scope="col" className="py-3 px-3">Redemptions</th>
                  <th scope="col" className="py-3 px-3">Status</th>
                  <th scope="col" className="py-3 px-3">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {paginatedTokens.map(tk => (
                  <tr key={tk.id} className="hover:bg-bg-primary transition-colors">
                    <td className="py-3 px-3.5 font-mono font-bold text-text-main sticky left-0 z-10 bg-white/95 dark:bg-[#18181A]/95 backdrop-blur-xs border-r border-border-main">
                      {tk.tokenNumber}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-text-main">{tk.customer?.name || 'Walk-in Guest'}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/10">
                          {tk.table?.tableNumber ? `Table ${tk.table.tableNumber}` : (tk.tableNumber ? `Table ${tk.tableNumber}` : 'No Table')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <span className="font-mono text-text-main">{tk.customer?.phoneNumber || '—'}</span>
                        {tk.customer?.email && (
                          <span className="font-mono text-[10px] text-text-muted truncate max-w-[180px] inline-block" title={tk.customer.email}>
                            {tk.customer.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-text-main">
                      {tk.personsCount} {tk.personsCount === 1 ? 'Guest' : 'Guests'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono dark:text-amber-300 text-amber-700 font-bold">{tk.redemptionsUsed}</span>
                      <span className="text-text-muted font-normal"> / {tk.totalRedemptionsAllowed} Drinks</span>
                    </td>
                    <td className="py-3 px-3">
                      {renderStatusBadge(tk.status)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingHistoryToken(tk)}
                          className="px-3 py-1.5 rounded-lg cursor-pointer bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-text-main text-xs font-semibold border border-border-main transition-all flex items-center gap-1.5 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-[#D4AF37]"
                          title="View Complete Session History"
                          aria-label={`View complete audit history for session ${tk.tokenNumber}`}
                        >
                          <Eye size={13} /> <span>Details</span>
                        </button>

                        {(tk.status.toLowerCase() === 'active' || tk.status.toLowerCase() === 'extended') && (
                          <>
                            <button
                              onClick={() => setExtendingToken(tk)}
                              className="px-3 py-1.5 rounded-lg cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-500/30 transition-all flex items-center gap-1.5 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                              title={`Extend duration for session ${tk.tokenNumber}`}
                              aria-label={`Extend duration for session ${tk.tokenNumber}`}
                            >
                              <Clock size={13} /> <span>Extend</span>
                            </button>

                            <button
                              onClick={() => setDeactivatingToken(tk)}
                              className="px-3 py-1.5 rounded-lg cursor-pointer bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/20 dark:hover:bg-red-500/30 text-red-700 dark:text-red-400 text-xs font-semibold border border-red-500/30 transition-all flex items-center gap-1.5 min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                              title={`Checkout and release table for session ${tk.tokenNumber}`}
                              aria-label={`Checkout and release table for session ${tk.tokenNumber}`}
                            >
                              <LogOut size={13} /> <span>Close</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border-main text-xs">
            <span className="text-text-muted text-center sm:text-left">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTokens.length)} of {filteredTokens.length} sessions
            </span>
            <div className="flex gap-1.5 sm:gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="px-3 py-1.5 rounded-lg border border-border-main bg-bg-primary disabled:opacity-50 transition-all hover:bg-bg-surface text-text-main cursor-pointer min-h-[36px]"
              >
                Prev
              </button>
              <div className="flex items-center gap-2 px-1 sm:px-2 text-text-main font-semibold">
                Page {currentPage} of {totalPages}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="px-3 py-1.5 rounded-lg border border-border-main bg-bg-primary disabled:opacity-50 transition-all hover:bg-bg-surface text-text-main cursor-pointer min-h-[36px]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <ExtendSessionModal
        isOpen={extendingToken !== null}
        token={extendingToken!}
        rates={rates}
        onClose={() => setExtendingToken(null)}
        onSuccess={() => {
          setExtendingToken(null);
          refreshAllSessions();
          refreshTokens();
        }}
      />

      {/* CLOSE SESSION MODAL */}
      {deactivatingToken && (
        <CheckoutConfirmationModal
          isOpen={!!deactivatingToken}
          session={{
            tokenNumber: deactivatingToken.tokenNumber,
            customerName: deactivatingToken.customer?.name || 'Walk-in Guest',
            customerPhone: deactivatingToken.customer?.phoneNumber || 'N/A',
            tableNumber: deactivatingToken.table?.tableNumber || 'N/A',
          }}
          onClose={() => setDeactivatingToken(null)}
          onSuccess={() => {
            setDeactivatingToken(null);
            refreshAllSessions();
            refreshTables();
            refreshTokens();
          }}
        />
      )}

      {/* VIEW HISTORY / DETAILS MODAL */}
      {viewingHistoryToken && (
        <div 
          onClick={() => setViewingHistoryToken(null)}
          className="fixed inset-0 z-[100] bg-black/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
          role="presentation"
        >
          <div 
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-audit-title"
            className="bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 rounded-2xl p-6 w-full max-w-2xl relative text-text-main max-h-[85vh] flex flex-col shadow-2xl animate-fadeIn font-sans cursor-default"
          >
            <button 
              onClick={() => setViewingHistoryToken(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-text-muted hover:text-text-main transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-[#D4AF37]"
              aria-label="Close session audit history"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-text-main font-bold text-base border-b border-border-main pb-3 mb-4">
              <Clock size={20} className="shrink-0 text-primary dark:text-[#D4AF37]" /> 
              <span id="session-audit-title">Session Audit History</span>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 space-y-5 pr-2">
              {/* Session Overview Card */}
              <div className="p-4 bg-bg-primary rounded-xl border border-border-main space-y-2 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-text-muted block">Token Number</span>
                    <span className="font-mono font-bold text-text-main text-sm">{viewingHistoryToken.tokenNumber}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Customer Name</span>
                    <span className="font-semibold text-text-main">{viewingHistoryToken.customer?.name || 'Walk-in Guest'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Phone Number</span>
                    <span className="font-mono font-semibold text-text-main">{viewingHistoryToken.customer?.phoneNumber || '—'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Email Address</span>
                    <span className="font-mono font-semibold text-text-main truncate block" title={viewingHistoryToken.customer?.email}>{viewingHistoryToken.customer?.email || '—'}</span>
                  </div>

                  <div>
                    <span className="text-text-muted block">Issued By</span>
                    <span className="font-semibold text-text-main">{viewingHistoryToken.createdBy || '—'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Table Assigned</span>
                    <span className="font-bold text-text-main">{viewingHistoryToken.table?.tableNumber ? `Table ${viewingHistoryToken.table.tableNumber}` : (viewingHistoryToken.tableNumber ? `Table ${viewingHistoryToken.tableNumber}` : 'N/A')}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Status</span>
                    <div className="mt-0.5">
                      {renderStatusBadge(viewingHistoryToken.status)}
                    </div>
                  </div>
                  <div>
                    <span className="text-text-muted block">Guests/Headcount</span>
                    <span className="font-semibold text-text-main">{viewingHistoryToken.personsCount} Guests</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Initial Cover Charge</span>
                    <span className="font-bold text-text-main">₹{Number(historyInitialAmount).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Extension Charges</span>
                    <span className="font-bold text-text-main">₹{Number(historyExtensionsTotal).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-text-muted block">Total Amount Paid</span>
                    <span className="font-bold text-text-main">₹{Number(viewingHistoryToken.amountPaid || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="border-t border-border-main/50 pt-2 grid grid-cols-2 gap-3 text-[11px] text-text-muted font-semibold">
                  <div>Started At: <span className="text-text-main">{new Date(viewingHistoryToken.startTime || viewingHistoryToken.createdAt).toLocaleString()}</span></div>
                  <div>Expires At: <span className="text-text-main">{new Date(viewingHistoryToken.endTime).toLocaleString()}</span></div>
                </div>
              </div>

              {/* Extension History */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Session Extension Logs</h4>
                {!viewingHistoryToken.extensions || viewingHistoryToken.extensions.length === 0 ? (
                  <div className="text-xs text-text-muted italic bg-bg-primary/30 p-3 rounded-xl border border-border-main/50 text-center">No extensions recorded for this session.</div>
                ) : (
                  <div className="space-y-2">
                    {viewingHistoryToken.extensions.map((ext: any, idx: number) => (
                      <div key={idx} className="p-3 bg-bg-primary rounded-xl border border-border-main text-xs flex flex-col sm:flex-row justify-between gap-2">
                        <div>
                          <div className="font-semibold text-text-main">Extension: <span className="text-primary">+{ext.extraMinutes} mins</span> | Amount Paid: <span className="font-bold text-text-main">₹{Number(ext.additionalAmount).toLocaleString('en-IN')}</span></div>
                          <div className="text-[11px] text-text-muted mt-0.5 font-semibold">Payment Method: <span className="text-text-main uppercase">{ext.paymentMethod || 'CASH'}</span></div>
                        </div>
                        <div className="text-right text-[11px] text-text-muted shrink-0 self-end sm:self-center">
                          <div>Time: <span className="text-text-main font-semibold">{new Date(ext.extendedAt).toLocaleString()}</span></div>
                          <div>Approved By: <span className="text-text-main font-semibold">{ext.approvedBy}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Drink Redemption Logs */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Drink Redemption Logs</h4>
                {!viewingHistoryToken.redemptions || viewingHistoryToken.redemptions.length === 0 ? (
                  <div className="text-xs text-text-muted italic bg-bg-primary/30 p-3 rounded-xl border border-border-main/50 text-center">No drink redemptions recorded for this session.</div>
                ) : (
                  <div className="space-y-2">
                    {viewingHistoryToken.redemptions.map((red: any, idx: number) => (
                      <div key={idx} className="p-3 bg-bg-primary rounded-xl border border-border-main text-xs flex flex-col sm:flex-row justify-between gap-2">
                        <div>
                          <div className="font-semibold text-text-main">
                            Redemption Sequence: <span className="text-primary">#{red.redemptionSequence || (idx + 1)}</span>
                          </div>
                          {red.notes && (
                            <div className="text-[11px] text-text-muted mt-0.5 font-semibold">
                              Notes: <span className="text-text-main">{red.notes}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-right text-[11px] text-text-muted shrink-0 self-end sm:self-center">
                          <div>Time: <span className="text-text-main font-semibold">{new Date(red.redeemedAt).toLocaleString()}</span></div>
                          <div>Dispensed By: <span className="text-text-main font-semibold">{red.bartenderName || 'N/A'}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Closure Details */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">Closure Details</h4>
                {viewingHistoryToken.status.toLowerCase() !== 'closed' ? (
                  <div className="text-xs text-text-muted italic bg-bg-primary/30 p-3 rounded-xl border border-border-main/50 text-center">Session is currently active.</div>
                ) : (
                  <div className="p-3 bg-bg-primary rounded-xl border border-border-main text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Closure Time:</span>
                      <span className="font-semibold text-text-main">{viewingHistoryToken.closedAt ? new Date(viewingHistoryToken.closedAt).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Closure Reason:</span>
                      <span className="font-bold text-red-500 uppercase">{viewingHistoryToken.closure?.closeReason || viewingHistoryToken.closeReason || 'MANUAL'}</span>
                    </div>
                    {viewingHistoryToken.closure?.reasonDetail && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Detail Description:</span>
                        <span className="font-semibold text-text-main max-w-xs text-right break-words">{viewingHistoryToken.closure.reasonDetail}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-text-muted">Closed By Operator:</span>
                      <span className="font-semibold text-text-main">{viewingHistoryToken.closedBy || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border-main pt-4 mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingHistoryToken(null)}
                className="px-5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-semibold text-text-main border border-border-main cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
