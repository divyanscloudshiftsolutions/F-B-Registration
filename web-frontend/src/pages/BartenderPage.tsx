import React, { useState, useRef, useEffect } from 'react';
import { Wine, Search, RotateCcw, Camera, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Token } from '../types';

export const BartenderPage: React.FC = () => {
  const { showToast } = useAuth();
  const [tokenInput, setTokenInput] = useState('');
  const [scannedToken, setScannedToken] = useState<Token | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Camera State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
    } catch (err: any) {
      setCameraError('Camera access unavailable. Please grant browser camera permissions or use manual token verification.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleVerify = async (e?: React.FormEvent, customCode?: string) => {
    if (e) e.preventDefault();
    const query = customCode || tokenInput.trim();
    if (!query) return;

    setIsVerifying(true);
    setScannedToken(null);

    try {
      const res = await api.verifyQR(query);
      if (res.success && res.token) {
        setScannedToken(res.token);
        showToast(`Token #${res.token.tokenNumber} verified successfully!`, 'success');
      } else {
        showToast('Token QR verification failed.', 'danger');
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
      showToast(err.message || 'Undo redemption failed.', 'danger');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Search & Camera Action Bar */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
              <Wine size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Bartender Service & QR Scanner Station</h3>
              <p className="text-xs text-gray-400">Scan QR pass or enter NFC token number to dispense drinks</p>
            </div>
          </div>

          <button
            onClick={() => (cameraActive ? stopCamera() : startCamera())}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all border ${
              cameraActive
                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            <Camera size={16} />
            <span>{cameraActive ? 'Close Camera' : 'Open QR Scanner Camera'}</span>
          </button>
        </div>

        {/* Live Video Camera Box */}
        {cameraActive && (
          <div className="relative rounded-2xl bg-black overflow-hidden aspect-video border border-white/10 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-dashed border-amber-400/80 rounded-3xl animate-pulse flex items-center justify-center">
                <p className="text-[10px] text-amber-300 font-bold uppercase bg-black/60 px-3 py-1 rounded-full">Position QR Pass Inside Frame</p>
              </div>
            </div>
          </div>
        )}

        {/* Camera Permission Failure Message */}
        {cameraError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Manual Verification Form */}
        <form onSubmit={handleVerify} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 text-gray-400" size={16} />
            <input
              type="text"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="Scan QR Code payload or type Token Number (e.g. TKN-1001)..."
              className="w-full bg-[#1A202C] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
          <button
            type="submit"
            disabled={isVerifying || !tokenInput}
            className="px-6 py-3 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50"
          >
            {isVerifying ? 'Verifying...' : 'Verify Token'}
          </button>
        </form>
      </div>

      {/* Verified Customer Pass Card */}
      {scannedToken && (
        <div className="glass-panel p-8 rounded-3xl border border-[#D4AF37]/40 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest badge-active">
                {scannedToken.status}
              </span>
              <h2 className="text-2xl font-black text-white mt-1">{scannedToken.customer?.name || 'Verified Guest Pass'}</h2>
              <p className="text-xs text-gray-400 font-mono">Token Pass: {scannedToken.tokenNumber}</p>
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-400 font-semibold">Drinks Used / Total Allowed</p>
              <p className="text-3xl font-black text-[#D4AF37]">
                {scannedToken.redemptionsUsed} <span className="text-lg text-gray-400">/ {scannedToken.totalRedemptionsAllowed}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-gray-400 font-medium">Phone</p>
              <p className="font-bold text-white font-mono mt-0.5">{scannedToken.customer?.phoneNumber || 'N/A'}</p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-gray-400 font-medium">Headcount</p>
              <p className="font-bold text-white mt-0.5">{scannedToken.personsCount} Guests</p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-gray-400 font-medium">Delivery Mode</p>
              <p className="font-bold text-white mt-0.5">{scannedToken.deliveryMode}</p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="text-gray-400 font-medium">Status</p>
              <p className="font-bold text-emerald-400 mt-0.5">{scannedToken.status}</p>
            </div>
          </div>

          {/* Dispense Actions */}
          <div className="flex gap-4 pt-4 border-t border-white/10">
            <button
              onClick={handleRedeem}
              disabled={isRedeeming || scannedToken.redemptionsUsed >= scannedToken.totalRedemptionsAllowed}
              className="flex-1 py-4 rounded-xl gold-gradient-btn text-xs font-black uppercase tracking-wider shadow-xl disabled:opacity-40"
            >
              {isRedeeming ? 'Dispensing...' : 'Dispense 1 Drink'}
            </button>

            <button
              onClick={handleUndo}
              disabled={scannedToken.redemptionsUsed <= 0}
              className="px-6 py-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <RotateCcw size={16} /> Revert Last Redemption
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
