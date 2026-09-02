import React, { useState } from 'react';
import { api } from '../services/api';
import {
  QrCode,
  Sparkles,
  Phone,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  Utensils,
  HelpCircle,
} from 'lucide-react';

export const CustomerLandingPage: React.FC = () => {
  const [activeModal, setActiveModal] = useState<'NONE' | 'TOKEN' | 'PHONE' | 'SCAN'>('NONE');
  const [tokenInput, setTokenInput] = useState<string>('');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Handle direct Token submission
  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tokenInput.trim();
    if (!cleaned) {
      setErrorMsg('Please enter your access token number.');
      return;
    }
    window.location.assign(`/customer/access/${encodeURIComponent(cleaned)}`);
  };

  // Handle Phone Recovery submission
  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phoneInput.trim().replace(/[^\d]/g, '');
    if (cleaned.length < 10) {
      setErrorMsg('Please enter a valid 10-digit phone number.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await api.recoverCustomerSession(cleaned);
      if (res.authorized && res.tokenNumber) {
        window.location.assign(`/customer/access/${encodeURIComponent(res.tokenNumber)}`);
      } else {
        setErrorMsg(res.error || 'No active dining session found with this phone number.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to find session. Please contact reception.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#12111F] text-white flex flex-col justify-between p-6 sm:p-10 font-sans select-none overflow-x-hidden relative">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#8D6CE5]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#8D6CE5] to-indigo-500 text-white font-black flex items-center justify-center text-base shadow-md">
            P
          </div>
          <div>
            <div className="font-extrabold text-base leading-tight">Pegs N Bottles</div>
            <div className="text-[11px] text-[#8D6CE5] font-semibold">Self-Ordering Experience</div>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full border border-[#8D6CE5]/30 bg-[#8D6CE5]/10 text-[#8D6CE5] text-xs font-bold">
          Mobile Dining
        </span>
      </header>

      {/* Hero Section */}
      <main className="max-w-md mx-auto my-auto z-10 w-full text-center py-8">
        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#8D6CE5]/15 border border-[#8D6CE5]/30 text-[#8D6CE5] text-xs font-black tracking-wider mb-5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>TABLEFLOW GUEST ACCESS</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight mb-4">
          Your Table Experience <br />
          <span className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">
            Starts on Your Phone
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-sm mx-auto mb-8">
          Order signature cocktails, food, and call your waiter directly from your smartphone.
          Access via your email pass or choose an option below.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3.5">
          {/* Action 1: QR Access */}
          <button
            onClick={() => {
              setErrorMsg(null);
              setTokenInput('');
              setActiveModal('SCAN');
            }}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#8D6CE5] to-indigo-600 hover:from-[#7c5cd6] hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-[#8D6CE5]/25 flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <QrCode className="w-4 h-4" />
              </div>
              <span className="text-left">Scan Customer QR</span>
            </div>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Action 2: Enter Token Number */}
          <button
            onClick={() => {
              setErrorMsg(null);
              setTokenInput('');
              setActiveModal('TOKEN');
            }}
            className="w-full py-4 px-6 rounded-2xl border border-white/15 hover:border-[#8D6CE5] bg-white/5 hover:bg-[#8D6CE5]/10 text-white font-extrabold text-sm flex items-center justify-between transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-text-muted">
                <KeyRound className="w-4 h-4" />
              </div>
              <span className="text-left">Enter Pass Token</span>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted" />
          </button>

          {/* Action 3: Phone Lookup */}
          <button
            onClick={() => {
              setErrorMsg(null);
              setPhoneInput('');
              setActiveModal('PHONE');
            }}
            className="w-full py-4 px-6 rounded-2xl border border-white/15 hover:border-[#8D6CE5] bg-white/5 hover:bg-[#8D6CE5]/10 text-white font-extrabold text-sm flex items-center justify-between transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-text-muted">
                <Phone className="w-4 h-4" />
              </div>
              <span className="text-left">Find Session via Phone</span>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted" />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-[11px] text-text-muted z-10 space-y-1">
        <div>Pegs N Bottles · Self-Order Guest Experience</div>
        <div>Please complete check-in at reception to verify entry payment.</div>
      </footer>

      {/* MODAL 1: Enter Token */}
      {activeModal === 'TOKEN' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#1A1829] border border-[#8D6CE5]/30 p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setActiveModal('NONE')}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-[#8D6CE5]/15 text-[#8D6CE5] flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-white">Enter Pass Token</h3>
              <p className="text-xs text-text-muted mt-1">
                Enter your alphanumeric token (e.g. BAR-20260902-00014)
              </p>
            </div>

            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value.toUpperCase());
                    setErrorMsg(null);
                  }}
                  placeholder="e.g. BAR-20260902-00014"
                  className="w-full h-12 rounded-xl bg-[#12111F] border border-[#8D6CE5]/30 px-4 text-sm font-mono text-white placeholder:text-text-muted focus:outline-none focus:border-[#8D6CE5]"
                  autoFocus
                />
                {errorMsg && (
                  <p className="mt-2 text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[#8D6CE5] hover:bg-[#7c5cd6] text-white font-extrabold text-sm shadow-lg shadow-[#8D6CE5]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Continue to Table</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Find Session via Phone */}
      {activeModal === 'PHONE' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#1A1829] border border-[#8D6CE5]/30 p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setActiveModal('NONE')}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Phone className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-lg text-white">Find Your Dining Session</h3>
              <p className="text-xs text-text-muted mt-1">
                Enter the 10-digit phone number registered during check-in.
              </p>
            </div>

            <form onSubmit={handlePhoneSubmit} className="space-y-4">
              <div>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  className="w-full h-12 rounded-xl bg-[#12111F] border border-[#8D6CE5]/30 px-4 text-base tracking-widest text-center font-bold text-white placeholder:text-text-muted focus:outline-none focus:border-[#8D6CE5]"
                  autoFocus
                />
                {errorMsg && (
                  <p className="mt-2 text-xs font-semibold text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || phoneInput.length < 10}
                className="w-full py-3.5 rounded-xl bg-[#8D6CE5] hover:bg-[#7c5cd6] text-white font-extrabold text-sm shadow-lg shadow-[#8D6CE5]/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
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

      {/* MODAL 3: Scan QR Helper */}
      {activeModal === 'SCAN' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#1A1829] border border-[#8D6CE5]/30 p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-center">
            <button
              onClick={() => setActiveModal('NONE')}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-[#8D6CE5]/15 text-[#8D6CE5] flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-7 h-7" />
            </div>

            <h3 className="font-extrabold text-lg text-white mb-2">Scan Customer Pass QR</h3>
            <p className="text-xs text-text-muted leading-relaxed mb-5">
              Open your smartphone camera and scan the QR code received in your email, or enter the access link below:
            </p>

            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <input
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste Token or Full QR URL"
                className="w-full h-12 rounded-xl bg-[#12111F] border border-[#8D6CE5]/30 px-4 text-xs font-mono text-white placeholder:text-text-muted focus:outline-none focus:border-[#8D6CE5]"
              />

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[#8D6CE5] hover:bg-[#7c5cd6] text-white font-extrabold text-sm shadow-lg shadow-[#8D6CE5]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Open Experience</span>
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
