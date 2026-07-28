import React, { useState } from 'react';
import { Wine, QrCode, Search, RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Token } from '../types';

export const BartenderPage: React.FC = () => {
  const { showToast } = useAuth();
  const [tokenInput, setTokenInput] = useState('');
  const [scannedToken, setScannedToken] = useState<Token | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput) return;

    setIsVerifying(true);
    setScannedToken(null);

    try {
      const res = await api.verifyQR(tokenInput.trim());
      if (res.success && res.token) {
        setScannedToken(res.token);
        showToast(`Token #${res.token.tokenNumber} verified!`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Token QR verification failed. Invalid or expired token.', 'danger');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRedeem = async () => {
    if (!scannedToken) return;

    setIsRedeeming(true);
    try {
      const res = await api.redeemDrink({ tokenId: scannedToken.id });
      if (res.success) {
        showToast('Drink redemption recorded!', 'success');
        // Refresh token state
        setScannedToken(prev => prev ? { ...prev, redemptionsUsed: prev.redemptionsUsed + 1 } : null);
      }
    } catch (err: any) {
      showToast(err.message || 'Redemption failed. All drink quotas used or session closed.', 'danger');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleUndo = async () => {
    if (!scannedToken) return;
    try {
      const res = await api.undoRedeem(scannedToken.id);
      if (res.success) {
        showToast('Drink redemption reverted.', 'info');
        setScannedToken(prev => prev ? { ...prev, redemptionsUsed: Math.max(0, prev.redemptionsUsed - 1) } : null);
      }
    } catch (err: any) {
      showToast(err.message || 'Unable to undo redemption.', 'danger');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass-panel p-8 rounded-3xl border border-white/10">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
            <Wine size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Bartender Drink Service Station</h3>
            <p className="text-xs text-gray-400">Scan QR codes or tap NFC cards to verify drink quota redemptions</p>
          </div>
        </div>

        {/* Verification Form */}
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Scan QR / Enter Token Pass #</label>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder="e.g. TKN-8492"
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="px-6 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2"
              >
                <QrCode size={16} />
                <span>{isVerifying ? 'Verifying...' : 'Verify Token'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Token Redemption Card */}
        {scannedToken && (
          <div className="mt-8 p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Token Number</span>
                <h4 className="text-xl font-mono font-black text-[#D4AF37]">{scannedToken.tokenNumber}</h4>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase font-semibold">Customer</span>
                <p className="text-sm font-bold text-white">{scannedToken.customer?.name || 'Walk-in Guest'}</p>
              </div>
            </div>

            {/* Quota Progress Meter */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-gray-300">Drink Quota Used</span>
                <span className="text-amber-400 font-mono">
                  {scannedToken.redemptionsUsed} of {scannedToken.totalRedemptionsAllowed} Drinks
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-[#D4AF37] transition-all"
                  style={{ width: `${Math.min(100, (scannedToken.redemptionsUsed / scannedToken.totalRedemptionsAllowed) * 100)}%` }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-2">
              <button
                onClick={handleRedeem}
                disabled={isRedeeming || scannedToken.redemptionsUsed >= scannedToken.totalRedemptionsAllowed}
                className="flex-1 py-3.5 rounded-xl gold-gradient-btn flex items-center justify-center gap-2 text-sm uppercase tracking-wider disabled:opacity-40"
              >
                <Wine size={18} />
                <span>{isRedeeming ? 'Processing...' : 'Serve Drink (-1 Quota)'}</span>
              </button>

              {scannedToken.redemptionsUsed > 0 && (
                <button
                  onClick={handleUndo}
                  className="px-4 py-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-bold text-xs flex items-center gap-1.5 transition-all"
                  title="Undo last drink redemption"
                >
                  <RotateCcw size={16} />
                  <span>Undo</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
