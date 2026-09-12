import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Ticket,
  Sparkles,
  Phone,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  Sun,
  Moon,
} from 'lucide-react';

export const CustomerLandingPage: React.FC = () => {
  const { isDark, toggleTheme } = useAuth();
  const [activeModal, setActiveModal] = useState<'NONE' | 'CODE' | 'PHONE' | 'TOKEN'>('NONE');
  const [codeInput, setCodeInput] = useState<string>('');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  // Keyboard accessibility: Dismiss modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveModal('NONE');
      }
    };
    if (activeModal !== 'NONE') {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [activeModal]);

  // Handle 6-Digit Access Code Submission
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = codeInput.trim();
    if (!cleaned) {
      setErrorMsg('Please enter your 6-digit access code.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.recoverCustomerSession({ accessCode: cleaned });
      if (res.tokenNumber) {
        window.location.assign(`/customer/access/${encodeURIComponent(res.tokenNumber)}`);
      } else {
        window.location.assign(`/customer/access/${encodeURIComponent(cleaned)}`);
      }
    } catch (err: any) {
      window.location.assign(`/customer/access/${encodeURIComponent(cleaned)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Phone Recovery submission
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phoneInput.trim().replace(/[^\d]/g, '');
    if (cleaned.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.recoverCustomerSession({ phoneNumber: cleaned });
      if (res.tokenNumber) {
        window.location.assign(`/customer/access/${encodeURIComponent(res.tokenNumber)}`);
      } else {
        setErrorMsg(res.error || 'No dining session found with this phone number.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to find session. Please contact reception.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Token ID Submission
  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let cleaned = tokenInput.trim();
    if (!cleaned) {
      setErrorMsg('Please enter your Token ID.');
      return;
    }
    const urlMatch = cleaned.match(/(?:access\/|t\/)([A-Za-z0-9_-]+)/);
    if (urlMatch && urlMatch[1]) {
      cleaned = urlMatch[1];
    }
    window.location.assign(`/customer/access/${encodeURIComponent(cleaned)}`);
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#F5F3FA] dark:bg-[#18181A] text-[#18181B] dark:text-white flex flex-col justify-between p-3.5 sm:p-6 md:p-8 lg:p-10 xl:p-12 font-sans select-text overflow-x-hidden relative transition-colors duration-200">
      {/* Responsive ambient background glow */}
      <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-96 md:w-[500px] lg:w-[650px] xl:w-[750px] h-96 md:h-[500px] lg:h-[650px] xl:h-[750px] bg-primary/10 dark:bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="hidden md:block absolute bottom-10 right-10 w-72 lg:w-96 h-72 lg:h-96 bg-primary/5 dark:bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-sm sm:max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-primary to-primary-hover dark:from-[#D4AF37] dark:to-amber-500 text-white dark:text-black font-black flex items-center justify-center text-sm sm:text-base shadow-sm shrink-0">
            P
          </div>
          <div>
            <div className="font-extrabold text-sm sm:text-base leading-tight text-text-main dark:text-white tracking-tight">
              Pegs N Bottles
            </div>
            <div className="text-[10px] sm:text-[11px] text-primary dark:text-[#D4AF37] font-semibold">
              Guest Dining Portal
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
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

      {/* ========================================================================= */}
      {/* 1. MOBILE VIEW (320px – 767px): Vertical-First Mobile Application Layout  */}
      {/* ========================================================================= */}
      <div className="md:hidden w-full max-w-sm sm:max-w-md mx-auto my-auto z-10 text-center py-4 sm:py-6 shrink-0">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 dark:bg-[#D4AF37]/10 border border-primary/20 dark:border-[#D4AF37]/20 text-primary dark:text-[#D4AF37] text-[11px] font-bold tracking-wider mb-3">
          <Sparkles className="w-3 h-3 shrink-0" />
          <span>GUEST ACCESS PORTAL</span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-snug mb-2 text-text-main dark:text-white">
          Your Table Experience <br />
          <span className="text-primary dark:text-[#D4AF37]">
            Starts on Your Phone
          </span>
        </h1>

        <p className="text-xs text-text-muted leading-relaxed max-w-xs mx-auto mb-4 sm:mb-5">
          Order food and drinks, view specials, and request assistance directly from your table.
        </p>

        {/* Mobile Vertical Action Rows */}
        <div className="flex flex-col gap-2.5 sm:gap-3 w-full">
          {/* Action 1: 6-Digit Access Code (Primary) */}
          <button
            onClick={() => {
              setErrorMsg(null);
              setCodeInput('');
              setActiveModal('CODE');
            }}
            className="w-full min-h-[50px] sm:min-h-[54px] py-3 px-4 rounded-2xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-xs sm:text-sm shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 dark:bg-black/10 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <span className="text-left font-bold">Enter 6-Digit Access Code</span>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>

          {/* Action 2: Token ID (Secondary) */}
          <button
            onClick={() => {
              setErrorMsg(null);
              setTokenInput('');
              setActiveModal('TOKEN');
            }}
            className="w-full min-h-[50px] sm:min-h-[54px] py-3 px-4 rounded-2xl border border-border-main dark:border-white/10 bg-white hover:bg-zinc-50 dark:bg-white/5 dark:hover:bg-white/10 text-text-main dark:text-white font-extrabold text-xs sm:text-sm shadow-xs flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-white/10 flex items-center justify-center text-primary dark:text-zinc-400 shrink-0">
                <Ticket className="w-4 h-4" />
              </div>
              <span className="text-left font-bold">Enter Table Token ID</span>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted dark:text-zinc-400 shrink-0" />
          </button>

          {/* Action 3: Phone Lookup (Secondary) */}
          <button
            onClick={() => {
              setErrorMsg(null);
              setPhoneInput('');
              setActiveModal('PHONE');
            }}
            className="w-full min-h-[50px] sm:min-h-[54px] py-3 px-4 rounded-2xl border border-border-main dark:border-white/10 bg-white hover:bg-zinc-50 dark:bg-white/5 dark:hover:bg-white/10 text-text-main dark:text-white font-extrabold text-xs sm:text-sm shadow-xs flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 dark:bg-white/10 flex items-center justify-center text-primary dark:text-zinc-400 shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <span className="text-left font-bold">Find via Mobile Number</span>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted dark:text-zinc-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TABLET VIEW (768px – 1023px): Centered Tablet 3-Card Grid Layout       */}
      {/* ========================================================================= */}
      <div className="hidden md:block lg:hidden w-full max-w-3xl mx-auto my-auto z-10 text-center py-6 sm:py-8 shrink-0">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary/10 dark:bg-[#D4AF37]/10 border border-primary/20 dark:border-[#D4AF37]/20 text-primary dark:text-[#D4AF37] text-xs font-bold tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>GUEST ACCESS PORTAL</span>
        </div>

        <h1 className="text-3xl font-black tracking-tight leading-tight mb-3 text-text-main dark:text-white">
          Your Table Experience <br />
          <span className="text-primary dark:text-[#D4AF37]">
            Starts on Your Phone
          </span>
        </h1>

        <p className="text-sm text-text-muted leading-relaxed max-w-lg mx-auto mb-6">
          Order food & drinks, browse menus, and request service directly from your smartphone.
        </p>

        {/* Tablet 3-Card Symmetrical Grid */}
        <div className="grid grid-cols-3 gap-4 text-left">
          {/* Card 1: 6-Digit Code (Primary) */}
          <div
            onClick={() => {
              setErrorMsg(null);
              setCodeInput('');
              setActiveModal('CODE');
            }}
            className="p-5 rounded-3xl bg-gradient-to-b from-primary to-primary-hover dark:from-[#D4AF37] dark:to-amber-500 text-white dark:text-black shadow-lg shadow-primary/20 dark:shadow-[#D4AF37]/20 flex flex-col justify-between group cursor-pointer transition-all hover:-translate-y-1 hover:shadow-xl min-h-[220px]"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-white/20 dark:bg-black/10 flex items-center justify-center mb-4">
                <KeyRound className="w-5 h-5 text-white dark:text-black" />
              </div>
              <h2 className="font-black text-base leading-tight mb-1.5">
                6-Digit Access Code
              </h2>
              <p className="text-xs text-white/80 dark:text-black/80 leading-relaxed font-medium">
                Enter the 6-digit access code sent to your email to open the menu.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-extrabold mt-4 pt-3 border-t border-white/20 dark:border-black/10">
              <span>Enter Code</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: Table Token ID */}
          <div
            onClick={() => {
              setErrorMsg(null);
              setTokenInput('');
              setActiveModal('TOKEN');
            }}
            className="p-5 rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 text-text-main dark:text-white shadow-sm hover:border-primary/50 dark:hover:border-[#D4AF37]/50 flex flex-col justify-between group cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md min-h-[220px]"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/10 text-primary dark:text-[#D4AF37] flex items-center justify-center mb-4">
                <Ticket className="w-5 h-5" />
              </div>
              <h2 className="font-black text-base leading-tight mb-1.5">
                Table Token ID
              </h2>
              <p className="text-xs text-text-muted leading-relaxed font-medium">
                Enter your Token ID (e.g. BAR-XXXXXXXX) from your receipt or email.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-primary dark:text-[#D4AF37] mt-4 pt-3 border-t border-border-main dark:border-white/10">
              <span>Enter Token ID</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 3: Mobile Lookup */}
          <div
            onClick={() => {
              setErrorMsg(null);
              setPhoneInput('');
              setActiveModal('PHONE');
            }}
            className="p-5 rounded-3xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 text-text-main dark:text-white shadow-sm hover:border-primary/50 dark:hover:border-[#D4AF37]/50 flex flex-col justify-between group cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md min-h-[220px]"
          >
            <div>
              <div className="w-11 h-11 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/10 text-primary dark:text-[#D4AF37] flex items-center justify-center mb-4">
                <Phone className="w-5 h-5" />
              </div>
              <h2 className="font-black text-base leading-tight mb-1.5">
                Mobile Number
              </h2>
              <p className="text-xs text-text-muted leading-relaxed font-medium">
                Find your active table session with your 10-digit registered number.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-extrabold text-primary dark:text-[#D4AF37] mt-4 pt-3 border-t border-border-main dark:border-white/10">
              <span>Find Table</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. LAPTOP / DESKTOP VIEW (1024px+): Full Web Application View             */}
      {/* ========================================================================= */}
      <div className="hidden lg:block w-full max-w-5xl xl:max-w-6xl mx-auto my-auto z-10 py-8 xl:py-12 shrink-0">
        <div className="grid grid-cols-12 gap-8 xl:gap-12 items-center">
          {/* Left Column: Brand Narrative */}
          <div className="col-span-5 text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 dark:bg-[#D4AF37]/10 border border-primary/20 dark:border-[#D4AF37]/20 text-primary dark:text-[#D4AF37] text-xs font-bold tracking-wider mb-5">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>GUEST ACCESS PORTAL</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-black tracking-tight leading-[1.12] mb-4 text-text-main dark:text-white">
              Your Table Experience <br />
              <span className="text-primary dark:text-[#D4AF37]">
                Starts on Your Phone
              </span>
            </h1>

            <p className="text-sm xl:text-base text-text-muted leading-relaxed mb-6 font-medium">
              Browse food and drinks, order from your table, and request waiter service directly from your smartphone.
            </p>

            <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/5 border border-border-main dark:border-white/10 text-xs text-text-muted flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>Check in at reception to receive your 6-digit access code or Table Token ID.</span>
            </div>
          </div>

          {/* Right Column: Spacious Web Action Cards */}
          <div className="col-span-7 flex flex-col gap-4 text-left">
            {/* Action 1: 6-Digit Code (Primary Web Card) */}
            <div
              onClick={() => {
                setErrorMsg(null);
                setCodeInput('');
                setActiveModal('CODE');
              }}
              className="p-6 rounded-2xl bg-gradient-to-r from-primary to-primary-hover dark:from-[#D4AF37] dark:to-amber-500 text-white dark:text-black shadow-xl shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-between group cursor-pointer transition-all hover:scale-[1.01] hover:shadow-2xl"
            >
              <div className="flex items-center gap-4">
                <div className="w-13 h-13 rounded-2xl bg-white/20 dark:bg-black/10 flex items-center justify-center shrink-0">
                  <KeyRound className="w-7 h-7 text-white dark:text-black" />
                </div>
                <div>
                  <h2 className="font-black text-lg leading-tight mb-1">
                    Enter 6-Digit Access Code
                  </h2>
                  <p className="text-xs text-white/80 dark:text-black/80 leading-relaxed font-medium">
                    Use the 6-digit access code from your check-in email to view the menu.
                  </p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/20 dark:bg-black/10 flex items-center justify-center shrink-0 ml-4 group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-5 h-5 text-white dark:text-black" />
              </div>
            </div>

            {/* Action 2: Table Token ID (Secondary Web Card) */}
            <div
              onClick={() => {
                setErrorMsg(null);
                setTokenInput('');
                setActiveModal('TOKEN');
              }}
              className="p-5 xl:p-6 rounded-2xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 text-text-main dark:text-white shadow-sm hover:border-primary/50 dark:hover:border-[#D4AF37]/50 flex items-center justify-between group cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/10 text-primary dark:text-[#D4AF37] flex items-center justify-center shrink-0">
                  <Ticket className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-black text-base xl:text-lg leading-tight mb-0.5">
                    Enter Table Token ID
                  </h2>
                  <p className="text-xs text-text-muted leading-relaxed font-medium">
                    Enter the Token ID from your check-in receipt or email to view the menu.
                  </p>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center shrink-0 ml-4 group-hover:translate-x-1 transition-transform text-text-muted dark:text-zinc-400">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Action 3: Phone Lookup (Secondary Web Card) */}
            <div
              onClick={() => {
                setErrorMsg(null);
                setPhoneInput('');
                setActiveModal('PHONE');
              }}
              className="p-5 xl:p-6 rounded-2xl bg-white dark:bg-[#111114] border border-border-main dark:border-white/10 text-text-main dark:text-white shadow-sm hover:border-primary/50 dark:hover:border-[#D4AF37]/50 flex items-center justify-between group cursor-pointer transition-all hover:scale-[1.01] hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/10 text-primary dark:text-[#D4AF37] flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-black text-base xl:text-lg leading-tight mb-0.5">
                    Find via Mobile Number
                  </h2>
                  <p className="text-xs text-text-muted leading-relaxed font-medium">
                    Find your active dining session using your 10-digit registered phone number.
                  </p>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center shrink-0 ml-4 group-hover:translate-x-1 transition-transform text-text-muted dark:text-zinc-400">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-sm sm:max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-6xl mx-auto text-center text-[11px] sm:text-xs text-text-muted z-10 py-3 border-t border-border-main/50 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-1 sm:gap-4 shrink-0">
        <div>Pegs N Bottles · Guest Dining Portal</div>
        <div>Please complete check-in at reception to verify entry payment.</div>
      </footer>

      {/* ========================================================================= */}
      {/* RESPONSIVE MODALS                                                         */}
      {/* ========================================================================= */}

      {/* MODAL 1: Enter 6-Digit Access Code */}
      {activeModal === 'CODE' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="code-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal('NONE');
          }}
          className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-6"
        >
          <div className="w-full max-w-full md:max-w-lg rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#111114] border-t md:border border-border-main dark:border-white/10 p-5 sm:p-7 md:p-8 shadow-2xl relative animate-in fade-in slide-in-from-bottom-6 md:zoom-in-95 duration-200 max-h-[85dvh] md:max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setActiveModal('NONE')}
              aria-label="Close dialog"
              className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5 sm:mb-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/10 text-primary dark:text-[#D4AF37] flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h3 id="code-modal-title" className="font-extrabold text-lg sm:text-xl text-text-main dark:text-white">
                Enter 6-Digit Access Code
              </h3>
              <p className="text-xs sm:text-sm text-text-muted mt-1">
                Enter the 6-digit access code sent to your email to open your table menu.
              </p>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label htmlFor="code-input" className="block text-xs sm:text-sm font-semibold text-text-muted mb-1.5 text-left">
                  6-Digit Access Code
                </label>
                <input
                  id="code-input"
                  type="text"
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value.replace(/\s+/g, ''));
                    setErrorMsg(null);
                  }}
                  placeholder="e.g. 481923"
                  maxLength={12}
                  aria-describedby={errorMsg ? 'code-error-msg' : undefined}
                  className="w-full h-12 sm:h-13 rounded-xl bg-bg-primary dark:bg-white/5 border border-border-main dark:border-white/10 px-4 text-center text-lg sm:text-xl font-mono font-bold tracking-widest text-text-main dark:text-white placeholder:text-text-muted placeholder:font-normal placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-[#D4AF37]/20 focus:border-primary dark:focus:border-[#D4AF37]"
                  autoFocus
                />
                {errorMsg && (
                  <p id="code-error-msg" className="mt-2 text-xs font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || !codeInput.trim()}
                className="w-full min-h-[46px] sm:min-h-[50px] py-3 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-sm md:text-base shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Opening Table Menu...</span>
                  </>
                ) : (
                  <>
                    <span>Open Table Menu</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Find Session via Phone */}
      {activeModal === 'PHONE' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="phone-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal('NONE');
          }}
          className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-6"
        >
          <div className="w-full max-w-full md:max-w-lg rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#111114] border-t md:border border-border-main dark:border-white/10 p-5 sm:p-7 md:p-8 shadow-2xl relative animate-in fade-in slide-in-from-bottom-6 md:zoom-in-95 duration-200 max-h-[85dvh] md:max-h-[90dvh] overflow-y-auto">
            <button
              onClick={() => setActiveModal('NONE')}
              aria-label="Close dialog"
              className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5 sm:mb-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Phone className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h3 id="phone-modal-title" className="font-extrabold text-lg sm:text-xl text-text-main dark:text-white">
                Find Your Dining Session
              </h3>
              <p className="text-xs sm:text-sm text-text-muted mt-1">
                Enter the 10-digit mobile number registered during check-in.
              </p>
            </div>

            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <label htmlFor="phone-input" className="block text-xs sm:text-sm font-semibold text-text-muted mb-1.5 text-left">
                  10-Digit Mobile Number
                </label>
                <input
                  id="phone-input"
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  aria-describedby={errorMsg ? 'phone-error-msg' : undefined}
                  className="w-full h-12 sm:h-13 rounded-xl bg-bg-primary dark:bg-white/5 border border-border-main dark:border-white/10 px-4 text-base sm:text-lg tracking-widest text-center font-bold text-text-main dark:text-white placeholder:text-text-muted placeholder:font-normal placeholder:text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-[#D4AF37]/20 focus:border-primary dark:focus:border-[#D4AF37]"
                  autoFocus
                />
                {errorMsg && (
                  <p id="phone-error-msg" className="mt-2 text-xs font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || phoneInput.length < 10}
                className="w-full min-h-[46px] sm:min-h-[50px] py-3 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-sm md:text-base shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Session...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Lookup Table Pass</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Enter Table Token ID */}
      {activeModal === 'TOKEN' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="token-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal('NONE');
          }}
          className="fixed inset-0 z-50 bg-black/60 dark:bg-black/75 backdrop-blur-xs flex items-end md:items-center justify-center p-0 md:p-6"
        >
          <div className="w-full max-w-full md:max-w-lg rounded-t-3xl md:rounded-3xl bg-white dark:bg-[#111114] border-t md:border border-border-main dark:border-white/10 p-5 sm:p-7 md:p-8 shadow-2xl relative animate-in fade-in slide-in-from-bottom-6 md:zoom-in-95 duration-200 max-h-[85dvh] md:max-h-[90dvh] overflow-y-auto text-center">
            <button
              onClick={() => setActiveModal('NONE')}
              aria-label="Close dialog"
              className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 w-10 h-10 rounded-xl flex items-center justify-center text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/10 dark:bg-[#D4AF37]/10 text-primary dark:text-[#D4AF37] flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Ticket className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>

            <h3 id="token-modal-title" className="font-extrabold text-lg sm:text-xl text-text-main dark:text-white mb-2">
              Enter Table Token ID
            </h3>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed mb-5">
              Enter the Token ID (e.g. BAR-20260912-00025) from your check-in confirmation or email to access your table menu:
            </p>

            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <div>
                <label htmlFor="token-input" className="block text-xs sm:text-sm font-semibold text-text-muted mb-1.5 text-left">
                  Token ID
                </label>
                <input
                  id="token-input"
                  type="text"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="e.g. BAR-20260912-00025"
                  className="w-full h-11 sm:h-12 md:h-13 rounded-xl bg-bg-primary dark:bg-white/5 border border-border-main dark:border-white/10 px-4 text-xs sm:text-sm font-mono text-text-main dark:text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 dark:focus:ring-[#D4AF37]/20 focus:border-primary dark:focus:border-[#D4AF37]"
                />
                {errorMsg && (
                  <p className="mt-2 text-xs font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!tokenInput.trim()}
                className="w-full min-h-[46px] sm:min-h-[50px] py-3 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] text-white dark:text-black font-extrabold text-sm md:text-base shadow-md shadow-primary/20 dark:shadow-[#D4AF37]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>Open Table Menu</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerLandingPage;
