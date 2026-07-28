import React, { useState } from 'react';
import { Lock, User, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [pin, setPin] = useState('admin123');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !pin) return;
    setIsSubmitting(true);
    try {
      await login(username.trim(), pin.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  const setPreset = (presetUsername: string, presetPin: string) => {
    setUsername(presetUsername);
    setPin(presetPin);
  };

  return (
    <div className="min-h-screen bg-[#07090E] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Blur Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#121620]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#D4AF37] to-[#F5E08B] flex items-center justify-center text-black text-3xl font-black mx-auto mb-4 shadow-xl shadow-[#D4AF37]/20">
            🍸
          </div>
          <h1 className="text-2xl font-black text-white tracking-wider uppercase">NFC BAR SYSTEM</h1>
          <p className="text-xs text-[#D4AF37] font-semibold mt-1">Enterprise Management Portal</p>
        </div>

        {/* Staff Presets Shortcuts */}
        <div className="mb-6">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Staff Shortcuts</p>
          <div className="grid grid-cols-4 gap-2">
            <button 
              type="button"
              onClick={() => setPreset('admin', 'admin123')}
              className="py-2 px-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition-all text-center"
            >
              Admin
            </button>
            <button 
              type="button"
              onClick={() => setPreset('receptionist', 'recep123')}
              className="py-2 px-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-bold hover:bg-blue-500/20 transition-all text-center"
            >
              Reception
            </button>
            <button 
              type="button"
              onClick={() => setPreset('bartender', 'bar123')}
              className="py-2 px-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/20 transition-all text-center"
            >
              Bartender
            </button>
            <button 
              type="button"
              onClick={() => setPreset('manager', 'manager123')}
              className="py-2 px-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold hover:bg-purple-500/20 transition-all text-center"
            >
              Manager
            </button>
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Staff User ID</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 text-gray-400" size={18} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. admin"
                className="w-full bg-[#1A202C] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-all font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Security Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3 text-gray-400" size={18} />
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="Password"
                className="w-full bg-[#1A202C] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-all font-mono tracking-wider"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-6 py-3 rounded-xl gold-gradient-btn flex items-center justify-center gap-2 text-sm uppercase tracking-wider disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <Lock size={16} />
                <span>Sign In to System</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-[11px] text-gray-500">
          Connected to Company API Server
        </div>
      </div>
    </div>
  );
};
