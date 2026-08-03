import React, { useState } from 'react';
import { User, KeyRound, ShieldCheck, Grid3X3, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [selectedRole, setSelectedRole] = useState<'REC' | 'BAR' | 'ADM' | 'MGR'>('ADM');
  const [username, setUsername] = useState('ADM-03');
  const [pin, setPin] = useState('1234');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPosNumpad, setShowPosNumpad] = useState(false);
  const [activeField, setActiveField] = useState<'username' | 'pin'>('username');

  const handleRoleSelect = (role: 'REC' | 'BAR' | 'ADM' | 'MGR') => {
    setSelectedRole(role);
    setErrorMsg('');
    const defaults = {
      REC: { user: 'REC-01', pin: '1234' },
      BAR: { user: 'BAR-02', pin: '1234' },
      ADM: { user: 'ADM-03', pin: '1234' },
      MGR: { user: 'MGR-04', pin: '1234' },
    };
    setUsername(defaults[role].user);
    setPin(defaults[role].pin);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !pin) {
      setErrorMsg('Please enter a valid Employee Code and Security PIN.');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await login(username.trim(), pin.trim());
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNumpadKey = (val: string) => {
    setErrorMsg('');
    if (activeField === 'username') {
      setUsername(prev => prev + val);
    } else {
      if (pin.length < 4) {
        setPin(prev => prev + val);
      }
    }
  };

  const handleNumpadBackspace = () => {
    setErrorMsg('');
    if (activeField === 'pin') {
      if (pin.length > 0) setPin(prev => prev.slice(0, -1));
      else setActiveField('username');
    } else {
      setUsername(prev => prev.slice(0, -1));
    }
  };

  const handleNumpadClear = () => {
    setErrorMsg('');
    setPin('');
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4 lg:p-12 relative overflow-hidden text-text-main">
      {/* Ambient Backdrop Orbs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-[#D4AF37]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-[#10B981]/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Split Screen Container */}
      <div className="w-full max-w-5xl bg-bg-surface border border-border-main rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 relative z-10">
        
        {/* Left Panel: Venue Branding Showcase (Hidden on Mobile) */}
        <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-bg-surface to-bg-primary border-r border-border-main relative">
          <div>
            <div className="w-14 h-14 rounded-2xl gold-gradient-btn flex items-center justify-center text-black text-2xl font-black mb-6 shadow-xl shadow-[#D4AF37]/20">
              🍸
            </div>
            <h1 className="text-3xl font-black text-text-main tracking-wider uppercase">NFC BAR SYSTEM</h1>
            <p className="text-xs text-[#D4AF37] font-semibold mt-1 uppercase tracking-widest">Enterprise Terminal Gateway</p>
            
            <p className="text-xs text-text-muted mt-6 leading-relaxed">
              Unified venue check-in, real-time seating map, beverage redemption station, and executive management portal.
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-bg-primary border border-border-main flex items-center gap-3">
              <ShieldCheck className="dark:text-emerald-400 text-emerald-700" size={20} />
              <div>
                <p className="text-xs font-bold text-text-main">Secure Terminal Access</p>
                <p className="text-[10px] text-text-muted">Authorized Shift Staff Terminal Only</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: Authentication Form */}
        <div className="p-6 md:p-10 flex flex-col justify-center space-y-6">
          
          {/* Header */}
          <div>
            <h2 className="text-xl font-bold text-text-main tracking-wide">Staff Terminal Login</h2>
            <p className="text-xs text-text-muted mt-1">Select your shift role and enter credentials</p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Role Selection Tabs */}
          <div>
            <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">1. Select Shift Role</label>
            <div className="grid grid-cols-4 gap-2 p-1.5 rounded-xl bg-bg-primary border border-border-main">
              {(['REC', 'BAR', 'ADM', 'MGR'] as const).map(r => {
                const isSel = selectedRole === r;
                const labels = { REC: 'Recep', BAR: 'Bar', ADM: 'Admin', MGR: 'Mngr' };
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleSelect(r)}
                    className={`py-2 text-xs font-extrabold uppercase rounded-lg transition-all cursor-pointer ${
                      isSel
                        ? 'gold-gradient-btn text-black shadow-md shadow-[#D4AF37]/20 font-black'
                        : 'text-text-muted hover:text-text-main dark:hover:bg-white/5 hover:bg-black/5'
                    }`}
                  >
                    {labels[r]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Credentials Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Employee ID Code</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 text-text-muted" size={16} />
                <input
                  type="text"
                  value={username}
                  onFocus={() => setActiveField('username')}
                  onChange={e => {
                    setUsername(e.target.value.toUpperCase());
                    setErrorMsg('');
                  }}
                  placeholder="e.g. ADM-03"
                  className="w-full bg-bg-primary border border-border-main rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-main font-mono placeholder-text-muted focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Security PIN / Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-3.5 text-text-muted" size={16} />
                <input
                  type="password"
                  value={pin}
                  onFocus={() => setActiveField('pin')}
                  onChange={e => {
                    setPin(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="••••"
                  className="w-full bg-bg-primary border border-border-main rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-main font-mono placeholder-text-muted focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 transition-all"
                  required
                />
              </div>
            </div>

            {/* Mode 2: Touch POS Onscreen Numpad Toggle */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowPosNumpad(!showPosNumpad)}
                className="text-xs text-[#D4AF37] font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Grid3X3 size={14} />
                <span>{showPosNumpad ? 'Hide Touch POS Numpad' : 'Show Touch POS Numpad'}</span>
              </button>
            </div>

            {/* Touch POS Onscreen Keypad Overlay */}
            {showPosNumpad && (
              <div className="p-3 rounded-2xl bg-bg-primary border border-border-main space-y-2 animate-fadeIn">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider text-center mb-1">
                  Editing {activeField === 'username' ? 'Employee Code' : 'PIN'}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(key => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (key === 'C') handleNumpadClear();
                        else if (key === '⌫') handleNumpadBackspace();
                        else handleNumpadKey(key);
                      }}
                      className="py-3 rounded-xl bg-bg-surface hover:bg-bg-card text-text-main font-bold text-sm border border-border-main active:scale-95 transition-all text-center cursor-pointer"
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl gold-gradient-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-[#D4AF37]/20 disabled:opacity-50 transition-all mt-4 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Authenticating Terminal...</span>
              ) : (
                <>
                  <span>Sign In To Shift Station</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
