import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CustomerApp } from './CustomerApp';
import {
  Loader2,
  CheckCircle2,
  CreditCard,
  RefreshCw,
  Home,
  ShieldAlert,
  Sun,
  Moon,
  Receipt,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

interface CustomerAccessPageProps {
  tokenProp?: string;
}

export const CustomerAccessPage: React.FC<CustomerAccessPageProps> = ({ tokenProp }) => {
  const { isDark, toggleTheme } = useAuth();
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

  // Smooth circular wave theme transition
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
          duration: 500,
          easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  };

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

  // Common Header across all states and viewports
  const renderHeader = (badgeText?: string, badgeColor?: 'amber' | 'emerald' | 'rose') => (
    <header className="w-full max-w-sm sm:max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex items-center justify-between z-10 shrink-0 mb-4 sm:mb-6 md:mb-8">
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-primary to-primary-hover dark:from-[#D4AF37] dark:to-amber-500 text-white dark:text-black font-black flex items-center justify-center text-sm sm:text-base shadow-sm shrink-0">
          P
        </div>
        <div>
          <div className="font-extrabold text-sm sm:text-base leading-tight text-text-main dark:text-white tracking-tight">
            Pegs N Bottles
          </div>
          <div className="text-[10px] sm:text-[11px] text-primary dark:text-[#D4AF37] font-semibold">
            Customer Dining Access
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {badgeText && (
          <span
            className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-black tracking-wide border ${
              badgeColor === 'emerald'
                ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : badgeColor === 'amber'
                ? 'border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
                : 'border-rose-300 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
            }`}
          >
            {badgeText}
          </span>
        )}

        {/* Light / Dark Theme Toggle */}
        <button
          onClick={toggleThemeWithWave}
          className="w-9 h-9 rounded-xl border border-border-main dark:border-white/10 bg-white dark:bg-white/5 hover:bg-zinc-100 dark:hover:bg-white/10 text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer select-none active:scale-95 shadow-xs shrink-0"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Color Theme"
        >
          {isDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-zinc-600" />}
        </button>
      </div>
    </header>
  );

  // Common Footer
  const renderFooter = (note: string) => (
    <footer className="w-full max-w-sm sm:max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto text-center text-[11px] sm:text-xs text-text-muted z-10 py-3 border-t border-border-main/50 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-4 shrink-0 mt-4 sm:mt-6">
      <div>Pegs N Bottles · Table Experience Gateway</div>
      <div>{note}</div>
    </footer>
  );

  // =========================================================================
  // 2. LOADING STATE (VERIFYING)
  // =========================================================================
  if (accessState === 'VERIFYING') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-[100dvh] w-full bg-[#F5F3FA] dark:bg-[#18181A] text-[#18181B] dark:text-white flex flex-col justify-between p-3.5 sm:p-6 md:p-8 lg:p-10 font-sans select-text overflow-x-hidden relative transition-colors duration-200"
      >
        <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 md:w-[500px] lg:w-[650px] h-80 sm:h-96 md:h-[500px] lg:h-[650px] bg-primary/10 dark:bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

        {renderHeader('VERIFYING', 'amber')}

        {/* 1. Mobile View (320px - 767px): Compact Centered Mobile Flow */}
        <div className="md:hidden w-full max-w-sm mx-auto my-auto z-10 text-center py-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/10 border border-primary/20 dark:border-[#D4AF37]/20 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Loader2 className="w-7 h-7 text-primary dark:text-[#D4AF37] animate-spin" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-text-main dark:text-white mb-2 leading-tight">
            Verifying Table Experience...
          </h1>
          <p className="text-xs text-text-muted leading-relaxed max-w-xs mx-auto font-medium">
            Checking your entry payment verification and active dining session with Pegs N Bottles.
          </p>
        </div>

        {/* 2. Tablet View (768px - 1023px): Balanced Elevated Tablet Area */}
        <div className="hidden md:flex lg:hidden w-full max-w-xl mx-auto my-auto z-10 flex-col items-center text-center py-8">
          <div className="p-8 rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 shadow-lg w-full">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 dark:bg-[#D4AF37]/10 border border-primary/20 dark:border-[#D4AF37]/20 flex items-center justify-center mx-auto mb-5 shadow-sm">
              <Loader2 className="w-8 h-8 text-primary dark:text-[#D4AF37] animate-spin" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-text-main dark:text-white mb-2 leading-snug">
              Verifying Your Table Experience
            </h1>
            <p className="text-sm text-text-muted leading-relaxed max-w-md mx-auto font-medium">
              Communicating with reception terminal to confirm verified entry payment and load your active table menu.
            </p>
          </div>
        </div>

        {/* 3. Desktop View (1024px+): Executive Full Web Application Loading Presentation */}
        <div className="hidden lg:flex w-full max-w-3xl xl:max-w-4xl mx-auto my-auto z-10 flex-col items-center text-center py-12">
          <div className="p-10 xl:p-12 rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 shadow-xl w-full">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-primary/10 dark:bg-[#D4AF37]/10 border border-primary/20 dark:border-[#D4AF37]/20 text-primary dark:text-[#D4AF37] text-xs font-bold tracking-wider mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              <span>DIGITAL ACCESS GATEWAY</span>
            </div>

            <div className="w-18 h-18 rounded-3xl bg-primary/10 dark:bg-[#D4AF37]/10 border border-primary/20 dark:border-[#D4AF37]/20 flex items-center justify-center mx-auto mb-6 shadow-md shadow-primary/10 dark:shadow-[#D4AF37]/10">
              <Loader2 className="w-9 h-9 text-primary dark:text-[#D4AF37] animate-spin" aria-hidden="true" />
            </div>

            <h1 className="text-3xl xl:text-4xl font-black tracking-tight text-text-main dark:text-white mb-3">
              Verifying Your Dining Experience
            </h1>
            <p className="text-sm xl:text-base text-text-muted leading-relaxed max-w-lg mx-auto font-medium">
              Authorizing your guest pass credentials, table reservation status, and payment verification records with Pegs N Bottles live service.
            </p>
          </div>
        </div>

        {renderFooter('Please keep this window open while verification finishes.')}
      </div>
    );
  }

  // =========================================================================
  // 3. UNVERIFIED PAYMENT STATE (Entry Payment Pending)
  // =========================================================================
  if (accessState === 'UNVERIFIED') {
    return (
      <div className="min-h-[100dvh] w-full bg-[#F5F3FA] dark:bg-[#18181A] text-[#18181B] dark:text-white flex flex-col justify-between p-3.5 sm:p-6 md:p-8 lg:p-10 xl:p-12 font-sans select-text overflow-x-hidden relative transition-colors duration-200">
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-80 sm:w-96 md:w-[500px] lg:w-[650px] h-80 sm:h-96 md:h-[500px] lg:h-[650px] bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {renderHeader('PAYMENT PENDING', 'amber')}

        {/* 1. Mobile View (320px - 767px): Vertical Flow with Full-Width Action Buttons */}
        <div className="md:hidden w-full max-w-sm sm:max-w-md mx-auto my-auto z-10 py-3">
          <div className="rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 p-5 shadow-lg text-center">
            <div className="w-13 h-13 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3.5 shadow-xs">
              <CreditCard className="w-6 h-6" />
            </div>

            <h1 className="text-xl font-black tracking-tight text-text-main dark:text-white mb-2">
              Payment Not Received
            </h1>

            <div className="rounded-2xl border border-amber-500/25 bg-amber-50/80 dark:bg-amber-500/10 p-3.5 text-left mb-4">
              <p className="text-xs text-amber-800 dark:text-amber-200 font-semibold leading-relaxed">
                Payment is not received. Please contact the receptionist to complete your registration.
              </p>
            </div>

            {/* Session Info Details */}
            <div className="rounded-2xl border border-border-main dark:border-white/10 bg-bg-primary dark:bg-white/5 p-3.5 text-left mb-5 space-y-2 text-xs">
              <div className="flex justify-between items-center text-text-muted">
                <span className="font-medium">Pass Token:</span>
                <span className="font-mono font-bold text-text-main dark:text-white">{tokenNumber}</span>
              </div>
              {sessionData?.customerName && (
                <div className="flex justify-between items-center text-text-muted">
                  <span className="font-medium">Guest Name:</span>
                  <span className="font-bold text-text-main dark:text-white">{sessionData.customerName}</span>
                </div>
              )}
              {sessionData?.tableNumber && (
                <div className="flex justify-between items-center text-text-muted">
                  <span className="font-medium">Assigned Table:</span>
                  <span className="font-bold text-primary dark:text-[#D4AF37]">Table {sessionData.tableNumber}</span>
                </div>
              )}
              {sessionData?.amountPaid !== undefined && (
                <div className="flex justify-between items-center text-text-muted pt-1.5 border-t border-border-main dark:border-white/10">
                  <span className="font-medium">Entry Due:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">₹{sessionData.amountPaid}</span>
                </div>
              )}
            </div>

            {/* Mobile Actions */}
            <div className="flex flex-col gap-2.5">
              <button
                onClick={verifyAccess}
                disabled={isRechecking}
                aria-busy={isRechecking}
                className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-xs shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRechecking ? 'animate-spin' : ''}`} />
                <span>{isRechecking ? 'Checking Status...' : 'Check Payment Status Again'}</span>
              </button>

              <button
                onClick={() => window.location.assign('/customer/landing')}
                className="w-full min-h-[44px] py-3 px-4 rounded-xl border border-border-main dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Return to Customer Home</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2. Tablet View (768px - 1023px): Two-Column Diagnostic Split */}
        <div className="hidden md:block lg:hidden w-full max-w-3xl mx-auto my-auto z-10 py-6">
          <div className="rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 p-7 shadow-xl">
            <div className="grid grid-cols-12 gap-6 items-center">
              <div className="col-span-6 text-left">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 shadow-sm">
                  <CreditCard className="w-7 h-7" />
                </div>
                <h1 className="text-2xl font-black tracking-tight text-text-main dark:text-white mb-2">
                  Payment Not Received
                </h1>
                <p className="text-xs text-text-muted leading-relaxed font-medium mb-4">
                  Your table dining session is created, but entry payment verification is pending counter confirmation.
                </p>
                <div className="rounded-2xl border border-amber-500/25 bg-amber-50/80 dark:bg-amber-500/10 p-4">
                  <p className="text-xs text-amber-800 dark:text-amber-200 font-semibold leading-relaxed">
                    Payment is not received. Please contact the receptionist to complete your registration.
                  </p>
                </div>
              </div>

              <div className="col-span-6 flex flex-col justify-between h-full pl-2">
                <div className="rounded-2xl border border-border-main dark:border-white/10 bg-bg-primary dark:bg-white/5 p-4 text-left mb-5 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-text-muted">
                    <span className="font-medium">Token Number:</span>
                    <span className="font-mono font-bold text-text-main dark:text-white">{tokenNumber}</span>
                  </div>
                  {sessionData?.customerName && (
                    <div className="flex justify-between items-center text-text-muted">
                      <span className="font-medium">Guest Name:</span>
                      <span className="font-bold text-text-main dark:text-white">{sessionData.customerName}</span>
                    </div>
                  )}
                  {sessionData?.tableNumber && (
                    <div className="flex justify-between items-center text-text-muted">
                      <span className="font-medium">Assigned Table:</span>
                      <span className="font-bold text-primary dark:text-[#D4AF37]">Table {sessionData.tableNumber}</span>
                    </div>
                  )}
                  {sessionData?.amountPaid !== undefined && (
                    <div className="flex justify-between items-center text-text-muted pt-2 border-t border-border-main dark:border-white/10">
                      <span className="font-medium">Entry Fee Due:</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">₹{sessionData.amountPaid}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={verifyAccess}
                    disabled={isRechecking}
                    aria-busy={isRechecking}
                    className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-xs shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRechecking ? 'animate-spin' : ''}`} />
                    <span>{isRechecking ? 'Checking Status...' : 'Check Payment Status Again'}</span>
                  </button>

                  <button
                    onClick={() => window.location.assign('/customer/landing')}
                    className="w-full min-h-[44px] py-3 px-4 rounded-xl border border-border-main dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Home className="w-3.5 h-3.5" />
                    <span>Return to Customer Home</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Desktop View (1024px+): Executive Web Split Layout with Hero Narrative */}
        <div className="hidden lg:block w-full max-w-5xl xl:max-w-6xl mx-auto my-auto z-10 py-8">
          <div className="grid grid-cols-12 gap-8 xl:gap-10 items-center">
            {/* Left Hero Column */}
            <div className="col-span-6 text-left">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-5 shadow-sm">
                <CreditCard className="w-8 h-8" />
              </div>
              <h1 className="text-3xl xl:text-4xl font-black tracking-tight text-text-main dark:text-white mb-3">
                Payment Verification Required
              </h1>
              <p className="text-sm xl:text-base text-text-muted leading-relaxed font-medium mb-6">
                Your dining pass is registered on our floor plan, but counter payment verification has not been marked complete by reception.
              </p>
              <div className="rounded-2xl border border-amber-500/25 bg-amber-50/80 dark:bg-amber-500/10 p-4 text-xs xl:text-sm text-amber-800 dark:text-amber-200 font-semibold leading-relaxed flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <span>Payment is not received. Please contact the receptionist to verify entry payment and activate your live digital menu.</span>
              </div>
            </div>

            {/* Right Card Column */}
            <div className="col-span-6">
              <div className="rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 p-7 xl:p-8 shadow-xl">
                <div className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4 border-b border-border-main dark:border-white/10 pb-3">
                  Registered Session Details
                </div>

                <div className="space-y-3 text-sm mb-6">
                  <div className="flex justify-between items-center text-text-muted">
                    <span className="font-medium">Pass Token Number:</span>
                    <span className="font-mono font-bold text-text-main dark:text-white bg-bg-primary dark:bg-white/5 px-2 py-0.5 rounded">{tokenNumber}</span>
                  </div>
                  {sessionData?.customerName && (
                    <div className="flex justify-between items-center text-text-muted">
                      <span className="font-medium">Primary Guest:</span>
                      <span className="font-bold text-text-main dark:text-white">{sessionData.customerName}</span>
                    </div>
                  )}
                  {sessionData?.tableNumber && (
                    <div className="flex justify-between items-center text-text-muted">
                      <span className="font-medium">Assigned Dining Table:</span>
                      <span className="font-bold text-primary dark:text-[#D4AF37]">Table {sessionData.tableNumber}</span>
                    </div>
                  )}
                  {sessionData?.amountPaid !== undefined && (
                    <div className="flex justify-between items-center text-text-muted pt-3 border-t border-border-main dark:border-white/10">
                      <span className="font-semibold text-text-main dark:text-white">Entry Fee Amount:</span>
                      <span className="font-mono text-base font-bold text-amber-600 dark:text-amber-400">₹{sessionData.amountPaid}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={verifyAccess}
                    disabled={isRechecking}
                    aria-busy={isRechecking}
                    className="w-full min-h-[50px] py-3.5 px-5 rounded-2xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-sm shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRechecking ? 'animate-spin' : ''}`} />
                    <span>{isRechecking ? 'Checking Status with Reception...' : 'Check Payment Status Again'}</span>
                  </button>

                  <button
                    onClick={() => window.location.assign('/customer/landing')}
                    className="w-full min-h-[46px] py-3 px-5 rounded-2xl border border-border-main dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    <span>Return to Customer Home</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {renderFooter('Need assistance? Please contact reception staff to complete registration.')}
      </div>
    );
  }

  // =========================================================================
  // 4. SESSION CLOSED STATE (Post-Checkout / Concluded Session Receipt)
  // =========================================================================
  if (accessState === 'CLOSED') {
    const bill = sessionData?.bill;

    return (
      <div className="min-h-[100dvh] w-full bg-[#F5F3FA] dark:bg-[#18181A] text-[#18181B] dark:text-white flex flex-col justify-between p-3.5 sm:p-6 md:p-8 lg:p-10 xl:p-12 font-sans select-text overflow-x-hidden relative transition-colors duration-200">
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-80 sm:w-96 md:w-[500px] lg:w-[650px] h-80 sm:h-96 md:h-[500px] lg:h-[650px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {renderHeader('PAYMENT COMPLETED', 'emerald')}

        {/* 1. Mobile View (320px - 767px): Vertical Flow, Natural Page Scroll (No Nested Scroll Trap) */}
        <div className="md:hidden w-full max-w-sm sm:max-w-md mx-auto my-auto z-10 py-3">
          <div className="rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 p-5 shadow-lg">
            <div className="text-center mb-4">
              <div className="w-13 h-13 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h1 className="text-xl font-black tracking-tight text-text-main dark:text-white mb-1">
                Dining Session Closed
              </h1>
              <p className="text-xs text-text-muted leading-relaxed font-medium">
                Payment was successfully completed and this session is now closed. Thank you for dining with us!
              </p>
            </div>

            {/* Mobile Receipt Slip */}
            <div className="rounded-2xl border border-border-main dark:border-white/10 bg-bg-primary dark:bg-white/5 p-4 mb-4">
              <div className="border-b border-border-main dark:border-white/10 pb-2.5 mb-2.5 flex justify-between items-center text-xs">
                <div>
                  <span className="text-text-muted font-medium">Bill No: </span>
                  <span className="font-mono font-bold text-text-main dark:text-white">{bill?.billNumber || 'PNB-FINAL'}</span>
                </div>
                <div>
                  <span className="text-text-muted font-medium">Table: </span>
                  <span className="font-bold text-primary dark:text-[#D4AF37]">{sessionData?.tableNumber ? `Table ${sessionData.tableNumber}` : 'N/A'}</span>
                </div>
              </div>

              {sessionData?.customerName && (
                <div className="flex justify-between text-xs text-text-muted mb-2.5">
                  <span className="font-medium">Guest:</span>
                  <span className="font-semibold text-text-main dark:text-white">{sessionData.customerName}</span>
                </div>
              )}

              {/* Order Items List in Natural Flow */}
              {bill?.orders && bill.orders.length > 0 && (
                <div className="border-t border-b border-border-main dark:border-white/10 py-2.5 my-2.5 space-y-1.5">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Ordered Items</div>
                  {bill.orders.map((ord: any, idx: number) => (
                    <div key={idx} className="space-y-1">
                      {ord.items.map((it: any, iIdx: number) => (
                        <div key={iIdx} className="flex justify-between text-xs">
                          <span className="text-text-main dark:text-white/90 font-medium">
                            {it.quantity}x {it.itemName}
                          </span>
                          <span className="font-mono font-semibold text-text-main dark:text-white">
                            ₹{it.lineTotal.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Financial Totals */}
              <div className="space-y-1.5 text-xs text-text-muted pt-1">
                {bill?.subtotal !== undefined && (
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono text-text-main dark:text-white">₹{bill.subtotal.toFixed(2)}</span>
                  </div>
                )}
                {bill?.serviceChargeTotal !== undefined && (
                  <div className="flex justify-between">
                    <span>Service Charge (5%):</span>
                    <span className="font-mono text-text-main dark:text-white">₹{bill.serviceChargeTotal.toFixed(2)}</span>
                  </div>
                )}
                {bill?.taxTotal !== undefined && (
                  <div className="flex justify-between">
                    <span>GST (5%):</span>
                    <span className="font-mono text-text-main dark:text-white">₹{bill.taxTotal.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-border-main dark:border-white/10 pt-2 flex justify-between text-sm font-black text-text-main dark:text-white">
                  <span>Final Grand Total:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    ₹{bill?.grandTotal !== undefined ? bill.grandTotal.toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold pt-1">
                  <span>Status:</span>
                  <span>PAID {bill?.paymentMethod ? `via ${bill.paymentMethod}` : ''}</span>
                </div>
              </div>
            </div>

            <div className="text-center text-[11px] text-text-muted mb-4 font-medium">
              Ordering is disabled for this concluded session. A new check-in is required for future orders.
            </div>

            <button
              onClick={() => window.location.assign('/customer/landing')}
              className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-xs shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Start New Visit / Welcome Screen</span>
            </button>
          </div>
        </div>

        {/* 2. Tablet View (768px - 1023px): Two-Column Receipt & Financial Balance */}
        <div className="hidden md:block lg:hidden w-full max-w-3xl mx-auto my-auto z-10 py-6">
          <div className="rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 p-7 shadow-xl">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-sm">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-text-main dark:text-white mb-1.5">
                Dining Session Closed
              </h1>
              <p className="text-xs text-text-muted leading-relaxed font-medium">
                Payment was successfully completed and this session is now closed. Thank you for dining with us!
              </p>
            </div>

            <div className="rounded-2xl border border-border-main dark:border-white/10 bg-bg-primary dark:bg-white/5 p-6 mb-5">
              <div className="border-b border-border-main dark:border-white/10 pb-3 mb-4 flex justify-between items-center text-xs">
                <div>
                  <span className="text-text-muted font-medium">Bill No: </span>
                  <span className="font-mono font-bold text-text-main dark:text-white">{bill?.billNumber || 'PNB-FINAL'}</span>
                </div>
                <div>
                  <span className="text-text-muted font-medium">Table: </span>
                  <span className="font-bold text-primary dark:text-[#D4AF37]">{sessionData?.tableNumber ? `Table ${sessionData.tableNumber}` : 'N/A'}</span>
                </div>
                {sessionData?.customerName && (
                  <div>
                    <span className="text-text-muted font-medium">Guest: </span>
                    <span className="font-semibold text-text-main dark:text-white">{sessionData.customerName}</span>
                  </div>
                )}
              </div>

              {/* Tablet 2-Column Split */}
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-7 border-r border-border-main dark:border-white/10 pr-6">
                  <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2.5">
                    Ordered Items
                  </div>
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {bill?.orders?.map((ord: any, idx: number) => (
                      <div key={idx} className="space-y-1.5">
                        {ord.items.map((it: any, iIdx: number) => (
                          <div key={iIdx} className="flex justify-between text-xs">
                            <span className="text-text-main dark:text-white/90 font-medium">
                              {it.quantity}x {it.itemName}
                            </span>
                            <span className="font-mono font-semibold text-text-main dark:text-white">
                              ₹{it.lineTotal.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-span-5 space-y-2 text-xs text-text-muted flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2.5">
                      Payment Breakdown
                    </div>
                    {bill?.subtotal !== undefined && (
                      <div className="flex justify-between py-0.5">
                        <span>Subtotal:</span>
                        <span className="font-mono text-text-main dark:text-white">₹{bill.subtotal.toFixed(2)}</span>
                      </div>
                    )}
                    {bill?.serviceChargeTotal !== undefined && (
                      <div className="flex justify-between py-0.5">
                        <span>Service Charge (5%):</span>
                        <span className="font-mono text-text-main dark:text-white">₹{bill.serviceChargeTotal.toFixed(2)}</span>
                      </div>
                    )}
                    {bill?.taxTotal !== undefined && (
                      <div className="flex justify-between py-0.5">
                        <span>GST (5%):</span>
                        <span className="font-mono text-text-main dark:text-white">₹{bill.taxTotal.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border-main dark:border-white/10 pt-3">
                    <div className="flex justify-between text-sm font-black text-text-main dark:text-white">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400">
                        ₹{bill?.grandTotal !== undefined ? bill.grandTotal.toFixed(2) : '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold pt-1">
                      <span>Status:</span>
                      <span>PAID {bill?.paymentMethod ? `via ${bill.paymentMethod}` : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-text-muted mb-5 font-medium">
              Ordering is disabled for this concluded session. A new check-in is required for future orders.
            </div>

            <button
              onClick={() => window.location.assign('/customer/landing')}
              className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-xs shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Start New Visit / Welcome Screen</span>
            </button>
          </div>
        </div>

        {/* 3. Desktop View (1024px+): Executive Web Receipt with Side-by-Side Presentation */}
        <div className="hidden lg:block w-full max-w-5xl xl:max-w-6xl mx-auto my-auto z-10 py-8">
          <div className="grid grid-cols-12 gap-8 xl:gap-10 items-center">
            {/* Left Narrative Column */}
            <div className="col-span-5 text-left">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5 shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-3xl xl:text-4xl font-black tracking-tight text-text-main dark:text-white mb-3">
                Dining Session Concluded
              </h1>
              <p className="text-sm xl:text-base text-text-muted leading-relaxed font-medium mb-6">
                Your settlement has been recorded and the table pass is officially closed. We hope you had a wonderful culinary experience with us.
              </p>

              <div className="p-4 rounded-2xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 text-xs text-text-muted flex items-center gap-3 mb-6">
                <Receipt className="w-5 h-5 text-emerald-500 shrink-0" />
                <span>An electronic record of this final invoice has been generated for your visit history.</span>
              </div>

              <button
                onClick={() => window.location.assign('/customer/landing')}
                className="w-full min-h-[50px] py-3.5 px-5 rounded-2xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-sm shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Start New Visit / Welcome Screen</span>
              </button>
            </div>

            {/* Right Web Invoice Card Column */}
            <div className="col-span-7">
              <div className="rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 p-7 xl:p-8 shadow-xl">
                <div className="border-b border-border-main dark:border-white/10 pb-4 mb-5 flex justify-between items-center text-sm">
                  <div>
                    <span className="text-text-muted font-medium">Invoice No: </span>
                    <span className="font-mono font-bold text-text-main dark:text-white">{bill?.billNumber || 'PNB-FINAL'}</span>
                  </div>
                  <div>
                    <span className="text-text-muted font-medium">Table: </span>
                    <span className="font-bold text-primary dark:text-[#D4AF37]">
                      {sessionData?.tableNumber ? `Table ${sessionData.tableNumber}` : 'N/A'}
                    </span>
                  </div>
                  {sessionData?.customerName && (
                    <div>
                      <span className="text-text-muted font-medium">Guest: </span>
                      <span className="font-semibold text-text-main dark:text-white">{sessionData.customerName}</span>
                    </div>
                  )}
                </div>

                {/* Split Order Items & Financials */}
                <div className="grid grid-cols-12 gap-6 pt-1">
                  <div className="col-span-7 border-r border-border-main dark:border-white/10 pr-6">
                    <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                      Ordered Line Items
                    </div>
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-2">
                      {bill?.orders?.map((ord: any, idx: number) => (
                        <div key={idx} className="space-y-1.5">
                          {ord.items.map((it: any, iIdx: number) => (
                            <div key={iIdx} className="flex justify-between text-xs xl:text-sm">
                              <span className="text-text-main dark:text-white/90 font-medium">
                                {it.quantity}x {it.itemName}
                              </span>
                              <span className="font-mono font-semibold text-text-main dark:text-white">
                                ₹{it.lineTotal.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-5 space-y-2 text-xs xl:text-sm text-text-muted flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">
                        Financial Summary
                      </div>
                      {bill?.subtotal !== undefined && (
                        <div className="flex justify-between py-1">
                          <span>Subtotal:</span>
                          <span className="font-mono text-text-main dark:text-white">₹{bill.subtotal.toFixed(2)}</span>
                        </div>
                      )}
                      {bill?.serviceChargeTotal !== undefined && (
                        <div className="flex justify-between py-1">
                          <span>Service Charge (5%):</span>
                          <span className="font-mono text-text-main dark:text-white">₹{bill.serviceChargeTotal.toFixed(2)}</span>
                        </div>
                      )}
                      {bill?.taxTotal !== undefined && (
                        <div className="flex justify-between py-1">
                          <span>GST (5%):</span>
                          <span className="font-mono text-text-main dark:text-white">₹{bill.taxTotal.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-border-main dark:border-white/10 pt-3">
                      <div className="flex justify-between text-base xl:text-lg font-black text-text-main dark:text-white">
                        <span>Grand Total:</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">
                          ₹{bill?.grandTotal !== undefined ? bill.grandTotal.toFixed(2) : '0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold pt-1.5">
                        <span>Payment Status:</span>
                        <span>PAID {bill?.paymentMethod ? `via ${bill.paymentMethod}` : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {renderFooter('Pegs N Bottles — Thank you for choosing us!')}
      </div>
    );
  }

  // =========================================================================
  // 5. GENERIC ERROR / INVALID TOKEN STATE
  // =========================================================================
  return (
    <div className="min-h-[100dvh] w-full bg-[#F5F3FA] dark:bg-[#18181A] text-[#18181B] dark:text-white flex flex-col justify-between p-3.5 sm:p-6 md:p-8 lg:p-10 xl:p-12 font-sans select-text overflow-x-hidden relative transition-colors duration-200">
      <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-80 sm:w-96 md:w-[500px] lg:w-[650px] h-80 sm:h-96 md:h-[500px] lg:h-[650px] bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />

      {renderHeader('UNAUTHORIZED', 'rose')}

      {/* 1. Mobile View (320px - 767px): Vertical Flow */}
      <div className="md:hidden w-full max-w-sm sm:max-w-md mx-auto my-auto z-10 py-3 text-center">
        <div className="rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 p-5 shadow-lg">
          <div className="w-13 h-13 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3.5 shadow-xs">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <h1 className="text-xl font-black tracking-tight text-text-main dark:text-white mb-2">
            Unable to Open Session
          </h1>

          <p className="text-xs text-text-muted leading-relaxed mb-5 font-medium">
            {errorMessage || 'The requested customer session token is invalid or has expired.'}
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={verifyAccess}
              disabled={isRechecking}
              aria-busy={isRechecking}
              className="w-full min-h-[48px] py-3.5 px-4 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-xs shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRechecking ? 'animate-spin' : ''}`} />
              <span>{isRechecking ? 'Verifying...' : 'Try Again'}</span>
            </button>

            <button
              onClick={() => window.location.assign('/customer/landing')}
              className="w-full min-h-[44px] py-3 px-4 rounded-xl border border-border-main dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Go to Customer Landing</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tablet View (768px - 1023px): Controlled Tablet Card */}
      <div className="hidden md:block lg:hidden w-full max-w-xl mx-auto my-auto z-10 py-6 text-center">
        <div className="rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 p-8 shadow-xl">
          <div className="w-15 h-15 rounded-3xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <h1 className="text-2xl font-black tracking-tight text-text-main dark:text-white mb-2.5">
            Unable to Open Session
          </h1>

          <p className="text-sm text-text-muted leading-relaxed mb-6 max-w-md mx-auto font-medium">
            {errorMessage || 'The requested customer session token is invalid or has expired.'}
          </p>

          <div className="flex flex-col gap-3 max-w-md mx-auto">
            <button
              onClick={verifyAccess}
              disabled={isRechecking}
              aria-busy={isRechecking}
              className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-xs shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRechecking ? 'animate-spin' : ''}`} />
              <span>{isRechecking ? 'Verifying Session with Server...' : 'Try Again'}</span>
            </button>

            <button
              onClick={() => window.location.assign('/customer/landing')}
              className="w-full min-h-[44px] py-3 px-5 rounded-2xl border border-border-main dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Go to Customer Landing</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Desktop View (1024px+): Executive Web Dialog Card */}
      <div className="hidden lg:block w-full max-w-2xl xl:max-w-3xl mx-auto my-auto z-10 py-10 text-center">
        <div className="rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 p-10 xl:p-12 shadow-2xl">
          <div className="w-18 h-18 rounded-3xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <h1 className="text-3xl xl:text-4xl font-black tracking-tight text-text-main dark:text-white mb-3">
            Unable to Open Session
          </h1>

          <p className="text-sm xl:text-base text-text-muted leading-relaxed mb-8 max-w-lg mx-auto font-medium">
            {errorMessage || 'The requested customer session token is invalid or has expired. Please verify your access credentials.'}
          </p>

          <div className="flex items-center justify-center gap-4 max-w-md mx-auto">
            <button
              onClick={() => window.location.assign('/customer/landing')}
              className="flex-1 min-h-[48px] py-3.5 px-5 rounded-2xl border border-border-main dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Customer Landing</span>
            </button>

            <button
              onClick={verifyAccess}
              disabled={isRechecking}
              aria-busy={isRechecking}
              className="flex-1 min-h-[48px] py-3.5 px-5 rounded-2xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-sm shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRechecking ? 'animate-spin' : ''}`} />
              <span>{isRechecking ? 'Verifying...' : 'Try Again'}</span>
            </button>
          </div>
        </div>
      </div>

      {renderFooter('Please contact our staff or check your email for the correct access link.')}
    </div>
  );
};

export default CustomerAccessPage;

