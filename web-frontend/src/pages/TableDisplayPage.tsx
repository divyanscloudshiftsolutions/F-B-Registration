import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { joinRoom, onSocketEvent } from '../services/socket';
import { CustomerApp } from './CustomerApp';
import {
  Sparkles,
  Phone,
  ArrowRight,
  Loader2,
  Utensils,
  CheckCircle2,
  AlertCircle,
  X,
  Delete,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface TableDisplayPageProps {
  tableNumberProp?: string;
}

export const TableDisplayPage: React.FC<TableDisplayPageProps> = ({ tableNumberProp }) => {
  // Extract tableNumber from prop or URL path (/table/:tableNumber or /display/:tableNumber)
  const [tableNumber] = useState<string>(() => {
    if (tableNumberProp) return tableNumberProp;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/^\/(?:table|display)\/([A-Za-z0-9_-]+)/);
      if (match) return decodeURIComponent(match[1]);
      const urlParams = new URLSearchParams(window.location.search);
      const qTable = urlParams.get('table');
      if (qTable) return qTable;
    }
    return 'S-01'; // Default fallback table
  });

  const [displayState, setDisplayState] = useState<'IDLE' | 'ACTIVATING' | 'ACTIVE' | 'RESETTING'>('ACTIVATING');
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [tableDetails, setTableDetails] = useState<any | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState<boolean>(false);
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isVerifyingPhone, setIsVerifyingPhone] = useState<boolean>(false);

  // Clear guest state and return display to IDLE
  const resetToIdle = useCallback(() => {
    setDisplayState('RESETTING');
    try {
      localStorage.removeItem('bar_active_token');
      localStorage.removeItem('bar_customer_cart');
      localStorage.removeItem('bar_active_table_id');
      // Preserve tableNumber so device remains locked to physical table
      localStorage.setItem('bar_active_table_num', tableNumber);
    } catch {}

    setActiveSession(null);
    setPhoneInput('');
    setPhoneError(null);
    setShowPhoneModal(false);

    setTimeout(() => {
      setDisplayState('IDLE');
    }, 400);
  }, [tableNumber]);

  // Authoritative check against backend for active session
  const checkActiveSession = useCallback(async () => {
    try {
      const res = await api.getTableActiveSession(tableNumber);
      if (res.success) {
        setTableDetails(res.table);
        if (res.active && res.session) {
          setActiveSession(res.session);
          localStorage.setItem('bar_active_token', res.session.tokenNumber);
          localStorage.setItem('bar_active_table_num', tableNumber);
          if (res.table?.id) {
            localStorage.setItem('bar_active_table_id', res.table.id);
          }
          setDisplayState('ACTIVE');
        } else {
          resetToIdle();
        }
      } else {
        resetToIdle();
      }
    } catch (err) {
      console.warn('[TableDisplay] Failed to fetch active session:', err);
      resetToIdle();
    }
  }, [tableNumber, resetToIdle]);

  // Initial mount & Socket room registration
  useEffect(() => {
    checkActiveSession();

    // Join table rooms
    joinRoom(`table:${tableNumber}`);

    // Listen for real-time activation
    const unsubActivate = onSocketEvent('table.session.activated', (data: any) => {
      if (
        data.tableNumber?.toLowerCase() === tableNumber.toLowerCase() ||
        (tableDetails?.id && data.tableId === tableDetails.id)
      ) {
        console.log('[TableDisplay] Real-time session activation event received:', data);
        if (data.tokenNumber) {
          localStorage.setItem('bar_active_token', data.tokenNumber);
          localStorage.setItem('bar_active_table_num', tableNumber);
          setActiveSession({
            tokenNumber: data.tokenNumber,
            customerName: data.customerName,
            startTime: data.startTime,
            endTime: data.endTime,
          });
          setDisplayState('ACTIVE');
        } else {
          checkActiveSession();
        }
      }
    });

    // Listen for real-time closure (Checkout / Bill Settle)
    const unsubClose = onSocketEvent('table.session.closed', (data: any) => {
      if (
        data.tableNumber?.toLowerCase() === tableNumber.toLowerCase() ||
        (tableDetails?.id && data.tableId === tableDetails.id) ||
        (activeSession?.tokenNumber && data.tokenNumber === activeSession.tokenNumber)
      ) {
        console.log('[TableDisplay] Real-time session closed event received. Resetting display.');
        resetToIdle();
      }
    });

    // Listen for general table update
    const unsubTableUpdate = onSocketEvent('table.updated', (data: any) => {
      if (
        data.tableNumber?.toLowerCase() === tableNumber.toLowerCase() ||
        (tableDetails?.id && data.tableId === tableDetails.id)
      ) {
        if (data.status === 'available' && !data.currentTokenId) {
          resetToIdle();
        }
      }
    });

    return () => {
      unsubActivate();
      unsubClose();
      unsubTableUpdate();
    };
  }, [tableNumber, tableDetails?.id, activeSession?.tokenNumber, checkActiveSession, resetToIdle]);

  // Handle Phone Fallback Submission
  const handleVerifyPhone = async () => {
    const cleaned = phoneInput.replace(/[^\d]/g, '');
    if (cleaned.length < 10) {
      setPhoneError('Please enter a complete 10-digit phone number.');
      return;
    }

    setIsVerifyingPhone(true);
    setPhoneError(null);

    try {
      const res = await api.claimTableSession(tableNumber, cleaned);
      if (res.success && res.tokenNumber) {
        localStorage.setItem('bar_active_token', res.tokenNumber);
        localStorage.setItem('bar_active_table_num', tableNumber);
        if (res.tableId) localStorage.setItem('bar_active_table_id', res.tableId);
        setActiveSession(res.session || { tokenNumber: res.tokenNumber });
        setShowPhoneModal(false);
        setDisplayState('ACTIVE');
      } else {
        setPhoneError(res.error?.message || 'No active session found for this table. Please contact staff.');
      }
    } catch (err: any) {
      setPhoneError(err.message || 'No active session found for this table. Please contact staff.');
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  // Keypad button click
  const handleKeypadPress = (digit: string) => {
    if (phoneInput.length < 10) {
      setPhoneInput((prev) => prev + digit);
      setPhoneError(null);
    }
  };

  const handleKeypadBackspace = () => {
    setPhoneInput((prev) => prev.slice(0, -1));
    setPhoneError(null);
  };

  // 1. ACTIVE STATE: Render the Full Customer Ordering App
  if (displayState === 'ACTIVE' && activeSession) {
    return <CustomerApp />;
  }

  // 2. LOADING / RESETTING STATE
  if (displayState === 'ACTIVATING' || displayState === 'RESETTING') {
    return (
      <div className="h-[100dvh] w-full bg-[#12111F] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 rounded-3xl bg-[#8D6CE5]/20 border border-[#8D6CE5]/30 flex items-center justify-center mb-6 animate-pulse shadow-lg shadow-[#8D6CE5]/20">
          <Loader2 className="w-8 h-8 text-[#8D6CE5] animate-spin" />
        </div>
        <h2 className="text-xl font-extrabold tracking-tight mb-2">
          {displayState === 'RESETTING' ? 'Session Completed' : 'Connecting Table Display...'}
        </h2>
        <p className="text-xs text-text-muted max-w-xs">
          {displayState === 'RESETTING'
            ? 'Clearing customer data & restoring welcome screen'
            : `Synchronizing live dining session for Table ${tableNumber}`}
        </p>
      </div>
    );
  }

  // 3. IDLE / WELCOME STATE
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#12111F] text-white flex flex-col justify-between p-6 sm:p-10 relative font-sans select-none">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#8D6CE5]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#8D6CE5] to-indigo-500 text-white font-black flex items-center justify-center text-base shadow-md">
            P
          </div>
          <div>
            <div className="font-extrabold text-base leading-tight">Pegs N Bottles</div>
            <div className="text-xs text-[#8D6CE5] font-semibold">Table Display Terminal</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-1.5 rounded-full bg-[#8D6CE5]/10 border border-[#8D6CE5]/30 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-black tracking-wider text-emerald-300">ONLINE</span>
          </div>
          <button
            onClick={checkActiveSession}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Refresh Table Session"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Central Hero Banner */}
      <main className="flex flex-col items-center justify-center text-center my-auto z-10 max-w-lg mx-auto">
        {/* Table Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#8D6CE5]/15 border border-[#8D6CE5]/30 text-[#8D6CE5] text-xs font-black tracking-wider mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>TABLE {tableNumber}</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-4">
          Welcome to <br />
          <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
            Pegs N Bottles
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-text-muted max-w-md leading-relaxed mb-8">
          Your table will activate automatically once checked in at the reception desk.
          Or tap below to claim your active table session.
        </p>

        {/* Action Button: Manual Phone Fallback */}
        <button
          onClick={() => {
            setPhoneInput('');
            setPhoneError(null);
            setShowPhoneModal(true);
          }}
          className="w-full sm:w-80 py-4 px-6 rounded-2xl bg-gradient-to-r from-[#8D6CE5] to-indigo-600 hover:from-[#7c5cd6] hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-[#8D6CE5]/25 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <Phone className="w-4 h-4" />
          <span>Enter Phone Number</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </main>

      {/* Footer Info */}
      <footer className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-text-muted border-t border-white/5 pt-4 z-10 gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#8D6CE5]" />
          <span>Table Display locked to Table {tableNumber} · Automatic Session Turnover</span>
        </div>
        <div>Authoritative Production Terminal</div>
      </footer>

      {/* Manual Phone Number Verification Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#1A1829] border border-[#8D6CE5]/30 p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            {/* Close button */}
            <button
              onClick={() => setShowPhoneModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#8D6CE5]/15 border border-[#8D6CE5]/30 text-[#8D6CE5] flex items-center justify-center mx-auto mb-3">
                <Phone className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-white">Claim Table {tableNumber}</h3>
              <p className="text-xs text-text-muted mt-1">
                Enter the 10-digit phone number provided during check-in.
              </p>
            </div>

            {/* Display Input Box */}
            <div className="mb-4">
              <div className="h-14 w-full rounded-2xl bg-[#12111F] border border-[#8D6CE5]/30 flex items-center justify-center px-4">
                <span className="text-xl font-black tracking-widest text-white">
                  {phoneInput ? phoneInput.replace(/(\d{5})(\d{0,5})/, '$1 $2').trim() : (
                    <span className="text-text-muted text-base font-normal">Enter 10-digit number</span>
                  )}
                </span>
              </div>
              {phoneError && (
                <div className="mt-2 text-xs font-semibold text-rose-400 flex items-center gap-1.5 justify-center">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{phoneError}</span>
                </div>
              )}
            </div>

            {/* Numeric Keypad Grid */}
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeypadPress(digit)}
                  className="h-12 rounded-xl bg-white/5 hover:bg-[#8D6CE5]/20 active:bg-[#8D6CE5]/40 border border-white/10 hover:border-[#8D6CE5]/40 text-lg font-extrabold text-white transition-all flex items-center justify-center cursor-pointer"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => setPhoneInput('')}
                className="h-12 rounded-xl bg-white/5 hover:bg-rose-500/20 active:bg-rose-500/40 border border-white/10 hover:border-rose-500/40 text-xs font-bold text-rose-300 transition-all flex items-center justify-center cursor-pointer"
              >
                Clear
              </button>
              <button
                onClick={() => handleKeypadPress('0')}
                className="h-12 rounded-xl bg-white/5 hover:bg-[#8D6CE5]/20 active:bg-[#8D6CE5]/40 border border-white/10 hover:border-[#8D6CE5]/40 text-lg font-extrabold text-white transition-all flex items-center justify-center cursor-pointer"
              >
                0
              </button>
              <button
                onClick={handleKeypadBackspace}
                className="h-12 rounded-xl bg-white/5 hover:bg-white/15 active:bg-white/20 border border-white/10 text-white transition-all flex items-center justify-center cursor-pointer"
              >
                <Delete className="w-5 h-5 text-white/70" />
              </button>
            </div>

            {/* Submit Verification Button */}
            <button
              onClick={handleVerifyPhone}
              disabled={isVerifyingPhone || phoneInput.length < 10}
              className="w-full py-3.5 rounded-xl bg-[#8D6CE5] hover:bg-[#7c5cd6] disabled:opacity-40 text-white font-extrabold text-sm shadow-lg shadow-[#8D6CE5]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isVerifyingPhone ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Session...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verify & Unlock Table</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableDisplayPage;
