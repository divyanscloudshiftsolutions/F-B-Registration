import React, { useState, useRef, useEffect } from 'react';
import { Wine, Search, RotateCcw, Camera, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // Fallback to default system video input device (laptop webcam)
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStream(mediaStream);
      setCameraActive(true);
    } catch {
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

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (cameraActive) {
      startCamera(nextMode);
    }
  };

  // Bind video stream whenever stream state or videoRef mounts
  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive, stream]);

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
      showToast(err.message || 'Token verification failed. Invalid or expired token.', 'danger');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRedeem = async () => {
    if (!scannedToken) return;

    setIsRedeeming(true);
    try {
      const res = await api.redeemDrink(scannedToken.id);
      if (res.success) {
        showToast('Drink redemption recorded successfully!', 'success');
        setScannedToken(prev => prev ? { 
          ...prev, 
          redemptionsUsed: (prev.redemptionsUsed || 0) + 1 
        } : null);
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
        showToast('Drink redemption reverted successfully.', 'info');
        setScannedToken(prev => prev ? { 
          ...prev, 
          redemptionsUsed: Math.max(0, (prev.redemptionsUsed || 0) - 1) 
        } : null);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to revert drink redemption.', 'danger');
    }
  };

  const redemptionsUsed = scannedToken ? (scannedToken.redemptionsUsed || 0) : 0;
  const totalAllowed = scannedToken ? (scannedToken.totalRedemptionsAllowed || 2) : 2;
  const isQuotaDepleted = redemptionsUsed >= totalAllowed;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-border-main flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl dark:bg-amber-500/15 bg-amber-500/10 dark:text-amber-400 text-amber-700 flex items-center justify-center font-bold text-xl">
            <Wine size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-main tracking-wide">Bartender Service Station</h2>
            <p className="text-xs text-text-muted">Scan guest QR pass or enter token number to verify and dispense drinks</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cameraActive && (
            <button
              onClick={toggleFacingMode}
              className="px-3.5 py-2 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-bold text-text-muted border border-border-main flex items-center gap-1.5 transition-all"
              title="Switch Camera Source"
            >
              <RefreshCw size={14} />
              <span>{facingMode === 'user' ? 'Laptop Webcam' : 'External Scanner'}</span>
            </button>
          )}

          {!cameraActive ? (
            <button
              onClick={() => startCamera(facingMode)}
              className="px-4 py-2 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-bold text-text-muted border border-border-main flex items-center gap-2 transition-all"
            >
              <Camera size={16} /> Enable Camera Scanner
            </button>
          ) : (
            <button
              onClick={stopCamera}
              className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-xs font-bold text-red-300 border border-red-500/30 transition-all"
            >
              Stop Camera Scanner
            </button>
          )}
        </div>
      </div>

      {/* Main Dual Workstation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Left Workstation Panel: Scanner & Search */}
        <div className="glass-panel p-6 rounded-3xl border border-border-main space-y-6">
          <h3 className="text-sm font-bold uppercase text-[#D4AF37] tracking-wider">1. Pass Verification Terminal</h3>

          {/* Camera View / Reticle Box */}
          <div className={`relative rounded-2xl overflow-hidden border border-border-main aspect-video flex flex-col items-center justify-center ${
            cameraActive ? 'bg-black' : 'bg-bg-primary'
          }`}>
            {cameraActive ? (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover" 
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-[#D4AF37] rounded-3xl animate-pulse flex items-center justify-center">
                    <span className="text-[10px] text-[#D4AF37] font-extrabold uppercase tracking-widest bg-black/60 px-2 py-1 rounded-md">Align QR Code</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center p-6 space-y-3">
                <Camera className="mx-auto text-text-muted" size={40} />
                <p className="text-xs text-text-muted">Click &quot;Enable Camera Scanner&quot; above to activate live QR scanner</p>
                {cameraError && (
                  <p className="text-xs dark:text-amber-400 text-amber-700 font-semibold">{cameraError}</p>
                )}
              </div>
            )}
          </div>

          {/* Manual Token Lookup Form */}
          <form onSubmit={handleVerify} className="space-y-3 pt-2">
            <label className="block text-xs font-semibold text-text-muted">Or Enter Token Code Manually</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-3 text-text-muted" size={18} />
                <input
                  type="text"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="e.g. TK-108"
                  className="w-full bg-bg-primary border border-border-main rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-main font-mono placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying || !tokenInput.trim()}
                className="px-6 py-2.5 rounded-xl gold-gradient-btn text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center gap-1.5 shadow-lg"
              >
                {isVerifying ? 'Verifying...' : 'Verify Pass'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Workstation Panel: Verified Pass Details Card */}
        <div className="glass-panel p-6 rounded-3xl border border-border-main space-y-6">
          <h3 className="text-sm font-bold uppercase text-[#D4AF37] tracking-wider">2. Verified Guest Pass Summary</h3>

          {!scannedToken ? (
            <div className="py-20 text-center text-text-muted text-xs space-y-2">
              <Wine className="mx-auto text-gray-600" size={36} />
              <p className="font-bold text-text-muted">No Guest Pass Verified Yet</p>
              <p>Scan a guest QR pass or enter token code to verify drink quota</p>
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Token Number & Status Header */}
              <div className="p-4 rounded-2xl bg-bg-primary border border-border-main flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Token Pass</span>
                  <span className="font-mono text-2xl font-black text-[#D4AF37]">{scannedToken.tokenNumber}</span>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                    isQuotaDepleted
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isQuotaDepleted ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                  <span>{isQuotaDepleted ? 'QUOTA DEPLETED' : 'ACTIVE PASS'}</span>
                </span>
              </div>

              {/* Guest Details */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-3 rounded-xl bg-bg-primary border border-border-main">
                  <span className="text-text-muted">Guest Name:</span>
                  <span className="font-bold text-text-main text-sm">{scannedToken.customer?.name || 'Guest'}</span>
                </div>

                <div className="flex justify-between p-3 rounded-xl bg-bg-primary border border-border-main">
                  <span className="text-text-muted">Phone Contact:</span>
                  <span className="font-mono text-text-muted">{scannedToken.customer?.phoneNumber || '—'}</span>
                </div>

                <div className="flex justify-between p-3 rounded-xl bg-bg-primary border border-border-main">
                  <span className="text-text-muted">Guest Headcount:</span>
                  <span className="font-bold text-text-main">{scannedToken.personsCount} Guests</span>
                </div>
              </div>

              {/* Drink Quota Usage Progress Bar */}
              <div className="p-4 rounded-2xl bg-bg-primary border border-border-main space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-text-muted">Drink Quota Allowance:</span>
                  <span className={isQuotaDepleted ? 'dark:text-red-400 text-red-700' : 'dark:text-emerald-400 text-emerald-700'}>
                    {redemptionsUsed} / {totalAllowed} Drinks Used
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-bg-card overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      isQuotaDepleted ? 'bg-red-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (redemptionsUsed / totalAllowed) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Dispense & Revert Actions */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleRedeem}
                  disabled={isRedeeming || isQuotaDepleted}
                  className="w-full py-3.5 rounded-xl gold-gradient-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
                >
                  <Wine size={18} />
                  <span>{isRedeeming ? 'Dispensing Drink...' : 'Dispense 1 Drink'}</span>
                </button>

                {redemptionsUsed > 0 && (
                  <button
                    onClick={handleUndo}
                    className="w-full py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-bold text-amber-300 border border-amber-500/30 flex items-center justify-center gap-2 transition-all"
                  >
                    <RotateCcw size={14} /> Revert Last Drink Redemption
                  </button>
                )}
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
