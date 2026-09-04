import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { CustomerApp } from './CustomerApp';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Clock,
  ArrowRight,
  RefreshCw,
  Home,
  ShieldAlert,
} from 'lucide-react';

interface CustomerAccessPageProps {
  tokenProp?: string;
}

export const CustomerAccessPage: React.FC<CustomerAccessPageProps> = ({ tokenProp }) => {
  const [tokenNumber] = useState<string>(() => {
    if (tokenProp) return tokenProp;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/^\/(?:customer\/access|t)\/([A-Za-z0-9_-]+)/);
      if (match) return decodeURIComponent(match[1]);
      const params = new URLSearchParams(window.location.search);
      const qToken = params.get('token');
      if (qToken) return qToken;
      return localStorage.getItem('bar_active_token') || '';
    }
    return '';
  });

  const [accessState, setAccessState] = useState<'VERIFYING' | 'AUTHORIZED' | 'UNVERIFIED' | 'CLOSED' | 'ERROR'>('VERIFYING');
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRechecking, setIsRechecking] = useState<boolean>(false);

  const verifyAccess = useCallback(async () => {
    if (!tokenNumber) {
      setErrorMessage('No customer access token provided. Please scan your QR code or use the link sent to your email.');
      setAccessState('ERROR');
      return;
    }

    setIsRechecking(true);
    try {
      const res = await api.validateCustomerAccess(tokenNumber);
      if (res.authorized && res.session) {
        setSessionData(res.session);
        localStorage.setItem('bar_active_token', res.session.tokenNumber);
        if (res.session.tableNumber) {
          localStorage.setItem('bar_active_table_num', res.session.tableNumber);
        }
        if (res.session.tableId) {
          localStorage.setItem('bar_active_table_id', res.session.tableId);
        }
        setAccessState('AUTHORIZED');
      } else if (res.paymentStatus === 'UNVERIFIED') {
        setSessionData(res);
        setErrorMessage(res.error || 'Your entry payment has not been verified yet. Please complete payment at the counter.');
        setAccessState('UNVERIFIED');
      } else if (res.sessionStatus === 'CLOSED' || res.sessionStatus === 'CANCELLED') {
        setSessionData(res);
        setErrorMessage(res.error || 'This dining session has concluded.');
        setAccessState('CLOSED');
      } else {
        setErrorMessage(res.error || 'Unable to authorize customer access.');
        setAccessState('ERROR');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Connection error while verifying your session. Please check your network or contact staff.');
      setAccessState('ERROR');
    } finally {
      setIsRechecking(false);
    }
  }, [tokenNumber]);

  useEffect(() => {
    verifyAccess();
  }, [verifyAccess]);

  // 1. SUCCESS: Mount Authorized CustomerApp
  if (accessState === 'AUTHORIZED' && sessionData) {
    return <CustomerApp />;
  }

  // 2. LOADING: Verifying state
  if (accessState === 'VERIFYING') {
    return (
      <div className="h-[100dvh] w-full bg-[#12111F] text-white flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="w-16 h-16 rounded-3xl bg-[#8D6CE5]/20 border border-[#8D6CE5]/40 flex items-center justify-center mb-6 animate-pulse shadow-xl shadow-[#8D6CE5]/20">
          <Loader2 className="w-8 h-8 text-[#8D6CE5] animate-spin" />
        </div>
        <h2 className="text-xl font-black tracking-tight mb-2">
          Verifying Your Table Experience...
        </h2>
        <p className="text-xs text-text-muted max-w-xs leading-relaxed">
          Checking your entry payment verification and active dining session with Pegs N Bottles.
        </p>
      </div>
    );
  }

  // 3. UNVERIFIED PAYMENT STATE (Entry payment gatekeeper)
  if (accessState === 'UNVERIFIED') {
    return (
      <div className="min-h-[100dvh] w-full bg-[#12111F] text-white flex flex-col justify-between p-6 sm:p-10 font-sans select-none overflow-y-auto">
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <header className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#8D6CE5] to-indigo-500 text-white font-black flex items-center justify-center text-sm shadow-md">
              P
            </div>
            <div>
              <div className="font-extrabold text-sm leading-tight">Pegs N Bottles</div>
              <div className="text-[11px] text-text-muted">Customer Access Portal</div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-black">
            PAYMENT PENDING
          </span>
        </header>

        {/* Main Card */}
        <main className="max-w-md mx-auto my-auto z-10 w-full text-center py-6">
          <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-lg">
            <CreditCard className="w-8 h-8" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">
            Payment Not Received
          </h1>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 mb-6">
            <p className="text-xs sm:text-sm text-amber-200 font-semibold leading-relaxed">
              Payment is not received. Please contact the receptionist to complete your registration.
            </p>
          </div>

          {/* Session Summary Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left mb-6 space-y-2.5 text-xs">
            <div className="flex justify-between text-text-muted">
              <span>Token Number:</span>
              <span className="font-mono font-bold text-white">{tokenNumber}</span>
            </div>
            {sessionData?.customerName && (
              <div className="flex justify-between text-text-muted">
                <span>Guest Name:</span>
                <span className="font-bold text-white">{sessionData.customerName}</span>
              </div>
            )}
            {sessionData?.tableNumber && (
              <div className="flex justify-between text-text-muted">
                <span>Assigned Table:</span>
                <span className="font-bold text-[#8D6CE5]">Table {sessionData.tableNumber}</span>
              </div>
            )}
            {sessionData?.amountPaid !== undefined && (
              <div className="flex justify-between text-text-muted">
                <span>Entry Fee Due:</span>
                <span className="font-mono font-bold text-amber-400">₹{sessionData.amountPaid}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={verifyAccess}
              disabled={isRechecking}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#8D6CE5] to-indigo-600 hover:from-[#7c5cd6] hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-[#8D6CE5]/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRechecking ? 'animate-spin' : ''}`} />
              <span>{isRechecking ? 'Checking Status...' : 'Check Payment Status Again'}</span>
            </button>

            <button
              onClick={() => window.location.assign('/customer/landing')}
              className="w-full py-3.5 rounded-2xl border border-white/10 hover:bg-white/5 text-text-muted hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Return to Customer Home</span>
            </button>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center text-[11px] text-text-muted z-10">
          Need assistance? Please contact reception staff to complete registration.
        </footer>
      </div>
    );
  }

  // 4. SESSION CLOSED STATE (Post-Checkout / Ended Session - Read-Only Bill View)
  if (accessState === 'CLOSED') {
    const bill = sessionData?.bill;

    return (
      <div className="min-h-[100dvh] w-full bg-[#12111F] text-white flex flex-col justify-between p-6 sm:p-10 font-sans select-none overflow-y-auto">
        <header className="flex items-center justify-between z-10 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#8D6CE5] to-indigo-500 text-white font-black flex items-center justify-center text-sm shadow-md">
              P
            </div>
            <div>
              <div className="font-extrabold text-sm leading-tight">Pegs N Bottles</div>
              <div className="text-[11px] text-text-muted">Completed Dining Session</div>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-black flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PAYMENT COMPLETED
          </span>
        </header>

        <main className="max-w-md mx-auto my-auto z-10 w-full py-4">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-lg">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-1">
              Dining Session Closed
            </h1>
            <p className="text-xs text-text-muted leading-relaxed">
              Payment was successfully completed and this session is now closed. Thank you for dining with us!
            </p>
          </div>

          {/* Read-Only Printed Bill Card */}
          <div className="rounded-3xl border border-white/10 bg-[#181628] p-5 shadow-2xl mb-6 relative overflow-hidden">
            <div className="border-b border-white/10 pb-3 mb-3 flex justify-between items-center text-xs">
              <div>
                <span className="text-text-muted">Bill No: </span>
                <span className="font-mono font-bold text-white">{bill?.billNumber || 'PNB-FINAL'}</span>
              </div>
              <div>
                <span className="text-text-muted">Table: </span>
                <span className="font-bold text-[#8D6CE5]">{sessionData?.tableNumber ? `Table ${sessionData.tableNumber}` : 'N/A'}</span>
              </div>
            </div>

            {sessionData?.customerName && (
              <div className="flex justify-between text-xs text-text-muted mb-3">
                <span>Guest:</span>
                <span className="font-semibold text-white">{sessionData.customerName}</span>
              </div>
            )}

            {/* Bill Line Items Breakdown if available */}
            {bill?.orders && bill.orders.length > 0 ? (
              <div className="border-t border-b border-white/5 py-3 my-3 space-y-2 max-h-48 overflow-y-auto">
                {bill.orders.map((ord: any, idx: number) => (
                  <div key={idx} className="space-y-1">
                    {ord.items.map((it: any, iIdx: number) => (
                      <div key={iIdx} className="flex justify-between text-xs">
                        <span className="text-white/80">
                          {it.quantity}x {it.itemName}
                        </span>
                        <span className="font-mono text-white">₹{it.lineTotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Financial Summary */}
            <div className="space-y-1.5 text-xs text-text-muted pt-2">
              {bill?.subtotal !== undefined && (
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono text-white">₹{bill.subtotal.toFixed(2)}</span>
                </div>
              )}
              {bill?.serviceChargeTotal !== undefined && (
                <div className="flex justify-between">
                  <span>Service Charge (5%):</span>
                  <span className="font-mono text-white">₹{bill.serviceChargeTotal.toFixed(2)}</span>
                </div>
              )}
              {bill?.taxTotal !== undefined && (
                <div className="flex justify-between">
                  <span>GST (5%):</span>
                  <span className="font-mono text-white">₹{bill.taxTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-black text-white">
                <span>Final Grand Total:</span>
                <span className="font-mono text-emerald-400">
                  ₹{bill?.grandTotal !== undefined ? bill.grandTotal.toFixed(2) : '0.00'}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-emerald-400/90 font-bold pt-1">
                <span>Payment Status:</span>
                <span>PAID {bill?.paymentMethod ? `via ${bill.paymentMethod}` : ''}</span>
              </div>
            </div>
          </div>

          <div className="text-center text-[11px] text-text-muted mb-6">
            Ordering is disabled for this concluded session. A new check-in is required for future orders.
          </div>

          <button
            onClick={() => window.location.assign('/customer/landing')}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#8D6CE5] to-indigo-600 hover:from-[#7c5cd6] hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-[#8D6CE5]/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Start New Visit / Welcome Screen</span>
          </button>
        </main>

        <footer className="text-center text-[11px] text-text-muted z-10">
          Pegs N Bottles — Thank you for choosing us!
        </footer>
      </div>
    );
  }

  // 5. GENERIC ERROR / INVALID TOKEN STATE
  return (
    <div className="h-[100dvh] w-full bg-[#12111F] text-white flex flex-col justify-between p-6 sm:p-10 font-sans select-none overflow-y-auto">
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#8D6CE5] to-indigo-500 text-white font-black flex items-center justify-center text-sm shadow-md">
            P
          </div>
          <div>
            <div className="font-extrabold text-sm leading-tight">Pegs N Bottles</div>
            <div className="text-[11px] text-text-muted">Customer Access Portal</div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto my-auto z-10 w-full text-center py-6">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-5 shadow-lg">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-3">
          Unable to Open Session
        </h1>

        <p className="text-xs sm:text-sm text-text-muted leading-relaxed mb-6">
          {errorMessage || 'The requested customer session token is invalid or has expired.'}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={verifyAccess}
            disabled={isRechecking}
            className="w-full py-4 rounded-2xl bg-[#8D6CE5] hover:bg-[#7c5cd6] text-white font-extrabold text-sm shadow-lg shadow-[#8D6CE5]/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRechecking ? 'animate-spin' : ''}`} />
            <span>Try Again</span>
          </button>

          <button
            onClick={() => window.location.assign('/customer/landing')}
            className="w-full py-3.5 rounded-2xl border border-white/10 hover:bg-white/5 text-text-muted hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Go to Customer Landing</span>
          </button>
        </div>
      </main>

      <footer className="text-center text-[11px] text-text-muted z-10">
        Please contact our staff or check your email for the correct access link.
      </footer>
    </div>
  );
};

export default CustomerAccessPage;
