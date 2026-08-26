import React, { useState, useRef, useEffect } from 'react';
import { Wine, Search, RotateCcw, Camera, CheckCircle2, AlertCircle, RefreshCw, VideoOff, Clock, Users, Mail, Phone, QrCode, Plus, Minus, AlertTriangle, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../services/api';
import { ExtendSessionModal } from '../components/modals/ExtendSessionModal';
import { CheckoutConfirmationModal } from '../components/modals/CheckoutConfirmationModal';
import { QuickAttendanceWebPage } from './QuickAttendanceWebPage';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import jsQR from 'jsqr';
import type { Token } from '../types';

interface BartenderPageProps {
 activeTab: string;
 setActiveTab: (tab: string) => void;
}

interface LiveSessionTimerProps {
  endTime: string | Date;
  status: string;
}

const LiveSessionTimer: React.FC<LiveSessionTimerProps> = ({ endTime, status }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const diffMs = new Date(endTime).getTime() - Date.now();
      return Math.max(0, Math.floor(diffMs / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  const upperStatus = String(status).toUpperCase();
  if (upperStatus === 'CLOSED' || upperStatus === 'COMPLETED') {
    return <span className="text-zinc-500 font-bold text-xs">Closed</span>;
  }
  if (upperStatus === 'EXPIRED' || timeLeft <= 0) {
    return <span className="text-red-400 font-bold text-xs font-mono">00:00</span>;
  }

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const paddedMins = String(minutes).padStart(2, '0');
  const paddedSecs = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const paddedHours = String(hours).padStart(2, '0');
    return <span className="font-mono font-bold text-amber-400 text-xs">{paddedHours}:{paddedMins}:{paddedSecs}</span>;
  }

  return <span className="font-mono font-bold text-amber-400 text-xs">{paddedMins}:{paddedSecs}</span>;
};

interface AnimatedNumberProps {
  value: number;
  className?: string;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, className = '' }) => {
  const [prevValue, setPrevValue] = useState(value);
  const [isHighlight, setIsHighlight] = useState(false);

  useEffect(() => {
    if (value !== prevValue) {
      setPrevValue(value);
      setIsHighlight(true);
      const timer = setTimeout(() => setIsHighlight(false), 250);
      return () => clearTimeout(timer);
    }
  }, [value, prevValue]);

  return (
    <span 
      className={`inline-block transition-all duration-200 ease-out will-change-transform ${
        isHighlight ? 'scale-110 text-primary dark:text-[#D4AF37] font-black' : 'scale-100'
      } ${className}`}
    >
      {value}
    </span>
  );
};

// Reconciles server tokens with local tokens without altering array references or ordering when unchanged
const silentMergeTokens = (current: Token[], incoming: Token[]): Token[] => {
  if (!current || current.length === 0) return incoming;
  if (!incoming || incoming.length === 0) return current;

  const incomingMap = new Map(incoming.map(t => [t.tokenNumber || t.id, t]));
  let hasChanges = false;

  const merged: Token[] = [];
  for (const oldTk of current) {
    const key = oldTk.tokenNumber || oldTk.id;
    const fresh = incomingMap.get(key);
    if (!fresh) {
      hasChanges = true;
      continue;
    }

    const isDifferent =
      oldTk.redemptionsUsed !== fresh.redemptionsUsed ||
      oldTk.totalRedemptionsAllowed !== fresh.totalRedemptionsAllowed ||
      oldTk.status !== fresh.status ||
      oldTk.endTime !== fresh.endTime ||
      oldTk.amountPaid !== fresh.amountPaid ||
      oldTk.tableNumber !== fresh.tableNumber ||
      oldTk.personsCount !== fresh.personsCount ||
      oldTk.currentCheckInEntitlement !== fresh.currentCheckInEntitlement ||
      oldTk.carriedForwardBalance !== fresh.carriedForwardBalance;

    if (isDifferent) {
      hasChanges = true;
      merged.push({ ...oldTk, ...fresh });
    } else {
      merged.push(oldTk);
    }
    incomingMap.delete(key);
  }

  if (incomingMap.size > 0) {
    hasChanges = true;
    for (const newTk of incomingMap.values()) {
      merged.unshift(newTk);
    }
  }

  return hasChanges ? merged : current;
};

export const BartenderPage: React.FC<BartenderPageProps> = ({ activeTab, setActiveTab }) => {
 const { showToast } = useAuth();
 const { refreshTokens, refreshTables, rates, tokens: contextTokens } = useData();
 const [tokenInput, setTokenInput] = useState('');
 const [scannedToken, setScannedToken] = useState<Token | null>(null);
 const [isVerifying, setIsVerifying] = useState(false);
 const [isRedeeming, setIsRedeeming] = useState(false);
 const [redeemingTokenIds, setRedeemingTokenIds] = useState<Set<string>>(new Set());
 const [redeemQty, setRedeemQty] = useState(1);

 // Per-card quantity state for Check-in cards
 const [cardQuantities, setCardQuantities] = useState<Record<string, string>>({});
 
 // Progressive disclosure expansion state for mobile / tablet cards
 const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

 const toggleCardExpansion = (tokenNumber: string) => {
   setExpandedCardIds(prev => {
     const next = new Set(prev);
     if (next.has(tokenNumber)) {
       next.delete(tokenNumber);
     } else {
       next.add(tokenNumber);
     }
     return next;
   });
 };

 const handleQuantityChange = (tokenNumber: string, rawVal: string) => {
   // Allow empty string or digits only (sanitized positive integers)
   const cleaned = rawVal.replace(/[^0-9]/g, '');
   setCardQuantities(prev => ({ ...prev, [tokenNumber]: cleaned }));
 };

 const handleQuantityBlur = (tokenNumber: string, maxRemaining: number) => {
   setCardQuantities(prev => {
     const current = prev[tokenNumber];
     if (!current || parseInt(current, 10) < 1) {
       return { ...prev, [tokenNumber]: '1' };
     }
     const num = parseInt(current, 10);
     const capped = Math.min(Math.max(1, maxRemaining), num);
     return { ...prev, [tokenNumber]: String(capped) };
   });
 };

 const handleQuantityIncrement = (tokenNumber: string, maxRemaining: number) => {
   setCardQuantities(prev => {
     const current = parseInt(prev[tokenNumber] || '1', 10) || 1;
     const next = Math.min(Math.max(1, maxRemaining), current + 1);
     return { ...prev, [tokenNumber]: String(next) };
   });
 };

 const handleQuantityDecrement = (tokenNumber: string) => {
   setCardQuantities(prev => {
     const current = parseInt(prev[tokenNumber] || '1', 10) || 1;
     const next = Math.max(1, current - 1);
     return { ...prev, [tokenNumber]: String(next) };
   });
 };

 // Search Active Customer Sessions State
 const [activeTokens, setActiveTokens] = useState<Token[]>([]);
 const [searchQuery, setSearchQuery] = useState('');
 const [isLoadingTokens, setIsLoadingTokens] = useState(false);

 // Modal States
 const [extendingToken, setExtendingToken] = useState<Token | null>(null);
 const [cancellingToken, setCancellingToken] = useState<Token | null>(null);
 

 // Camera State
 const videoRef = useRef<HTMLVideoElement | null>(null);
 const activeStreamRef = useRef<MediaStream | null>(null);
 const cameraRequestIdRef = useRef(0);
 const lastScannedCodeRef = useRef<string | null>(null);
 const [cameraActive, setCameraActive] = useState(false);
 const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
 const [cameraError, setCameraError] = useState<string | null>(null);
 const [stream, setStream] = useState<MediaStream | null>(null);

 const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
 setCameraError(null);
 stopCamera();

 const requestId = ++cameraRequestIdRef.current;

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

 if (requestId !== cameraRequestIdRef.current) {
 mediaStream.getTracks().forEach(track => {
 try {
 track.enabled = false;
 track.stop();
 } catch {}
 });
 return;
 }

 activeStreamRef.current = mediaStream;
 setStream(mediaStream);
 setCameraActive(true);
 } catch {
 setCameraError('Camera access unavailable. Please grant browser camera permissions or use manual token verification.');
 setCameraActive(false);
 }
 };

 const stopCamera = () => {
 cameraRequestIdRef.current++;
 if (activeStreamRef.current) {
 activeStreamRef.current.getTracks().forEach(track => {
 try {
 track.enabled = false;
 track.stop();
 } catch {}
 });
 activeStreamRef.current = null;
 }
 if (stream) {
 stream.getTracks().forEach(track => {
 try {
 track.enabled = false;
 track.stop();
 } catch {}
 });
 setStream(null);
 }
 if (videoRef.current && videoRef.current.srcObject) {
 try {
 const srcObj = videoRef.current.srcObject as MediaStream;
 if (srcObj && srcObj.getTracks) {
 srcObj.getTracks().forEach(track => {
 try {
 track.enabled = false;
 track.stop();
 } catch {}
 });
 }
 videoRef.current.pause();
 videoRef.current.srcObject = null;
 } catch {}
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

  const handleEnableCamera = () => {
    if (scannedToken) {
      setScannedToken(null);
      setTokenInput('');
    }
    startCamera(facingMode);
  };

 // Bind video stream whenever stream state or videoRef mounts
 useEffect(() => {
 if (cameraActive && stream && videoRef.current) {
 videoRef.current.srcObject = stream;
 videoRef.current.play().catch(() => {});
 }
 }, [cameraActive, stream]);

 // Automatically handle camera state based on activeTab
 useEffect(() => {
 if (activeTab === 'bartender/scan' && !scannedToken) {
 startCamera();
 } else {
 stopCamera();
 }
 return () => {
 stopCamera();
 };
 }, [activeTab, scannedToken]);

 // Frame-by-frame loop for QR code detection using jsQR
 useEffect(() => {
   let animationFrameId: number;
   let scanning = true;

   const scanFrame = () => {
     if (!scanning) return;

     if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
       const video = videoRef.current;
       const canvas = document.createElement('canvas');
       canvas.width = video.videoWidth;
       canvas.height = video.videoHeight;
       const ctx = canvas.getContext('2d');
       if (ctx) {
         ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
         const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
         const code = jsQR(imageData.data, imageData.width, imageData.height, {
           inversionAttempts: 'dontInvert',
         });

         if (code && code.data) {
           const decoded = code.data.trim();
           if (decoded && decoded !== lastScannedCodeRef.current) {
             lastScannedCodeRef.current = decoded;
             console.log("[Bartender QR Scanner] Decoded QR code:", decoded);
             handleVerify(undefined, decoded);

             // Allow scanning the same code again after 3 seconds if it was rejected/failed
             setTimeout(() => {
               if (lastScannedCodeRef.current === decoded) {
                 lastScannedCodeRef.current = null;
               }
             }, 3000);
           }
         }
       }
     }

     animationFrameId = requestAnimationFrame(scanFrame);
   };

   if (cameraActive && activeTab === 'bartender/scan' && !scannedToken) {
     scanning = true;
     animationFrameId = requestAnimationFrame(scanFrame);
   }

   return () => {
     scanning = false;
     cancelAnimationFrame(animationFrameId);
   };
 }, [cameraActive, activeTab, scannedToken]);

 // Page visibility & window focus camera lifecycle management
 const cameraActiveRef = useRef(cameraActive);
 const shouldResumeRef = useRef(false);

 useEffect(() => {
 cameraActiveRef.current = cameraActive;
 }, [cameraActive]);

 useEffect(() => {
 const handleVisibilityChange = () => {
 if (document.hidden) {
 if (cameraActiveRef.current) {
 shouldResumeRef.current = true;
 stopCamera();
 }
 } else {
 if (shouldResumeRef.current) {
 shouldResumeRef.current = false;
 if (activeTab === 'bartender/scan' && !scannedToken) {
 startCamera();
 }
 }
 }
 };

 const handleWindowBlur = () => {
 if (cameraActiveRef.current) {
 shouldResumeRef.current = true;
 stopCamera();
 }
 };

 const handleWindowFocus = () => {
 if (shouldResumeRef.current) {
 shouldResumeRef.current = false;
 if (activeTab === 'bartender/scan' && !scannedToken) {
 startCamera();
 }
 }
 };

 document.addEventListener('visibilitychange', handleVisibilityChange);
 window.addEventListener('blur', handleWindowBlur);
 window.addEventListener('focus', handleWindowFocus);

 return () => {
 document.removeEventListener('visibilitychange', handleVisibilityChange);
 window.removeEventListener('blur', handleWindowBlur);
 window.removeEventListener('focus', handleWindowFocus);
 };
 }, [activeTab, scannedToken]);

 // Component unmount stream cleanup
 useEffect(() => {
 return () => {
 cameraRequestIdRef.current++;
 if (activeStreamRef.current) {
 activeStreamRef.current.getTracks().forEach(track => {
 try {
 track.enabled = false;
 track.stop();
 } catch {}
 });
 activeStreamRef.current = null;
 }
 if (stream) {
 stream.getTracks().forEach(track => {
 try {
 track.enabled = false;
 track.stop();
 } catch {}
 });
 }
 };
 }, []);

  // Fetch active tokens on mount and keep updated live in real time
  const fetchActiveTokens = async (silent: boolean = false) => {
    if (!silent) setIsLoadingTokens(true);
    try {
      const tokensList = await api.getActiveTokens();
      if (Array.isArray(tokensList)) {
        setActiveTokens(prev => silentMergeTokens(prev, tokensList));
      }
    } catch (err) {
      console.error('Failed to fetch active tokens:', err);
    } finally {
      if (!silent) setIsLoadingTokens(false);
    }
  };

  useEffect(() => {
    fetchActiveTokens(false);
    const interval = setInterval(() => {
      api.getActiveTokens().then(list => {
        if (Array.isArray(list)) {
          setActiveTokens(prev => silentMergeTokens(prev, list));
        }
      }).catch(() => {});
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Sync with global data context tokens
  useEffect(() => {
    if (contextTokens && Array.isArray(contextTokens)) {
      setActiveTokens(prev => silentMergeTokens(prev, contextTokens));
    }
  }, [contextTokens]);

  // Keyboard listener for Verified Pass Panel
  useEffect(() => {
    if (!scannedToken) return;

    const handlePassKeyDown = (e: KeyboardEvent) => {
      if (extendingToken || cancellingToken) return;

      if (e.key === 'Enter') {
        const isQuotaDepleted = scannedToken.redemptionsUsed >= scannedToken.totalRedemptionsAllowed;
        const isActivePass = scannedToken.status?.toUpperCase() === 'ACTIVE' || scannedToken.status?.toUpperCase() === 'EXTENDED';
        if (!isRedeeming && !isQuotaDepleted && isActivePass) {
          e.preventDefault();
          handleRedeem();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setScannedToken(null);
        setTokenInput('');
        startCamera();
      }
    };

    window.addEventListener('keydown', handlePassKeyDown);
    return () => window.removeEventListener('keydown', handlePassKeyDown);
  }, [scannedToken, extendingToken, cancellingToken, isRedeeming, redeemQty]);

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
        stopCamera(); // Stop camera once successfully verified
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
    if (!scannedToken || isRedeeming || scannedToken.redemptionsUsed >= scannedToken.totalRedemptionsAllowed) return;

    setIsRedeeming(true);
    try {
      const res: any = await api.redeemDrink(scannedToken.tokenNumber, redeemQty);
      if (res.success) {
        showToast(`Drink redemption (${redeemQty}) recorded successfully!`, 'success');
        const newUsed = res.redemptionsUsed ?? (res.token?.redemptionsUsed ?? (res.data?.redemption?.token?.redemptionsUsed ?? (scannedToken.redemptionsUsed + redeemQty)));
        
        // Immediate local state synchronization
        setScannedToken(prev => prev ? { ...prev, redemptionsUsed: newUsed } : null);
        setActiveTokens(prev => prev.map(tk => 
          tk.tokenNumber === scannedToken.tokenNumber 
            ? { ...tk, redemptionsUsed: newUsed }
            : tk
        ));
        setRedeemQty(1);

        // Silent background reconciliation
        fetchActiveTokens(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Redemption failed. All drink quotas used or session closed.', 'danger');
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleRedeemForToken = async (token: Token, quantity: number = 1) => {
    const validQty = Math.max(1, Math.floor(quantity));
    if (redeemingTokenIds.has(token.tokenNumber) || token.redemptionsUsed >= token.totalRedemptionsAllowed) {
      return;
    }

    const maxAllowed = token.totalRedemptionsAllowed - token.redemptionsUsed;
    if (validQty > maxAllowed) {
      showToast(`Cannot redeem ${validQty} drinks. Only ${maxAllowed} remaining.`, 'warning');
      return;
    }

    setRedeemingTokenIds(prev => new Set(prev).add(token.tokenNumber));
    try {
      const res: any = await api.redeemDrink(token.tokenNumber, validQty);
      if (res.success) {
        showToast(`${validQty} drink ${validQty === 1 ? 'redemption' : 'redemptions'} recorded for ${token.customer?.name || 'Guest'}.`, 'success');
        const newUsed = res.redemptionsUsed ?? (res.token?.redemptionsUsed ?? (res.data?.redemption?.token?.redemptionsUsed ?? (token.redemptionsUsed + validQty)));
        
        // Immediate targeted local state synchronization
        setActiveTokens(prev => prev.map(tk => 
          tk.tokenNumber === token.tokenNumber 
            ? { ...tk, redemptionsUsed: newUsed }
            : tk
        ));

        if (scannedToken?.tokenNumber === token.tokenNumber) {
          setScannedToken(prev => prev ? { ...prev, redemptionsUsed: newUsed } : null);
        }

        // Reset this card's quantity input to 1 after successful redemption
        setCardQuantities(prev => ({ ...prev, [token.tokenNumber]: '1' }));

        // Silent background reconciliation without page reload or card jump
        fetchActiveTokens(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Redemption failed. All drink quotas used or session closed.', 'danger');
    } finally {
      setRedeemingTokenIds(prev => {
        const next = new Set(prev);
        next.delete(token.tokenNumber);
        return next;
      });
    }
  };

  const handleUndoForToken = async (token: Token) => {
    if (redeemingTokenIds.has(token.tokenNumber) || token.redemptionsUsed <= 0) {
      return;
    }

    setRedeemingTokenIds(prev => new Set(prev).add(token.tokenNumber));
    try {
      const res: any = await api.undoRedeem(token.tokenNumber);
      if (res.success) {
        showToast(`Reverted 1 drink redemption for ${token.customer?.name || 'Guest'}.`, 'info');
        const newUsed = res.redemptionsUsed ?? (res.redemptionCount ?? (res.token?.redemptionsUsed ?? (res.data?.redemption?.token?.redemptionsUsed ?? Math.max(0, token.redemptionsUsed - 1))));
        
        // Immediate targeted local state synchronization
        setActiveTokens(prev => prev.map(tk => 
          tk.tokenNumber === token.tokenNumber 
            ? { ...tk, redemptionsUsed: newUsed }
            : tk
        ));

        if (scannedToken?.tokenNumber === token.tokenNumber) {
          setScannedToken(prev => prev ? { ...prev, redemptionsUsed: newUsed } : null);
        }

        // Reset this card's quantity input to 1
        setCardQuantities(prev => ({ ...prev, [token.tokenNumber]: '1' }));

        // Silent background reconciliation without page reload or card jump
        fetchActiveTokens(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to revert drink redemption.', 'danger');
    } finally {
      setRedeemingTokenIds(prev => {
        const next = new Set(prev);
        next.delete(token.tokenNumber);
        return next;
      });
    }
  };

  const handleUndo = async () => {
    if (!scannedToken) return;
    try {
      const res: any = await api.undoRedeem(scannedToken.tokenNumber);
      if (res.success) {
        showToast('Drink redemption reverted successfully.', 'info');
        const newUsed = res.redemptionsUsed ?? (res.redemptionCount ?? (res.token?.redemptionsUsed ?? (res.data?.redemption?.token?.redemptionsUsed ?? Math.max(0, scannedToken.redemptionsUsed - 1))));
        
        // Immediate local state synchronization
        setScannedToken(prev => prev ? { ...prev, redemptionsUsed: newUsed } : null);
        setActiveTokens(prev => prev.map(tk => 
          tk.tokenNumber === scannedToken.tokenNumber 
            ? { ...tk, redemptionsUsed: newUsed }
            : tk
        ));

        // Silent background reconciliation
        fetchActiveTokens(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to revert drink redemption.', 'danger');
    }
  };

 

 // Filter Tokens list based on search query
 const filteredTokens = searchQuery.trim() === '' 
 ? activeTokens 
 : activeTokens.filter(tk => {
 const name = (tk.customer?.name || '').toLowerCase();
 const phone = (tk.customer?.phoneNumber || '').toLowerCase();
 const email = (tk.customer?.email || '').toLowerCase();
 const tokenNum = (tk.tokenNumber || '').toLowerCase();
 const q = searchQuery.toLowerCase();
 return name.includes(q) || phone.includes(q) || email.includes(q) || tokenNum.includes(q);
 });

 const getSessionDuration = (createdAtStr: string) => {
 const created = new Date(createdAtStr).getTime();
 const now = new Date().getTime();
 const diffMs = now - created;
 if (diffMs < 0) return '0m';
 const diffMins = Math.floor(diffMs / 60000);
 if (diffMins < 60) return `${diffMins}m`;
 const diffHours = Math.floor(diffMins / 60);
 const mins = diffMins % 60;
 return `${diffHours}h ${mins}m`;
 };

 if (activeTab === 'bartender/attendance') {
   return <QuickAttendanceWebPage />;
 }

  const isScanTab = activeTab === 'bartender/scan';

  // Scanned Token redemptions helper
  const redemptionsUsed = scannedToken ? (scannedToken.redemptionsUsed || 0) : 0;
  const totalAllowed = scannedToken ? (scannedToken.totalRedemptionsAllowed || 2) : 2;
  const remainingDrinks = Math.max(0, totalAllowed - redemptionsUsed);
  const isQuotaDepleted = redemptionsUsed >= totalAllowed;

  const scannedBasePerPerson = (scannedToken?.placeType && typeof scannedToken.placeType === 'object' && (scannedToken.placeType as any).redemptionsPerPerson) ? (scannedToken.placeType as any).redemptionsPerPerson : 2;
  const scannedCurrentCheckIn = scannedToken ? Math.min(totalAllowed, (scannedToken.personsCount || 1) * scannedBasePerPerson) : 2;
  const scannedCarriedForward = Math.max(0, totalAllowed - scannedCurrentCheckIn);

  const tokenStatus = scannedToken?.status?.toUpperCase();
  const isActivePass = tokenStatus === 'ACTIVE' || tokenStatus === 'EXTENDED';

  let badgeLabel = 'ACTIVE PASS';
  let badgeClasses = 'dark:bg-emerald-500/20 bg-emerald-500/10 dark:text-emerald-300 text-emerald-700 border dark:border-emerald-500/40 border-emerald-500/30';
  let badgeIcon = <CheckCircle2 size={12} />;

  if (scannedToken) {
    if (tokenStatus === 'EXPIRED') {
      badgeLabel = 'EXPIRED PASS';
      badgeClasses = 'dark:bg-red-500/20 bg-red-500/10 dark:text-red-300 text-red-700 border dark:border-red-500/40 border-red-500/30';
      badgeIcon = <AlertCircle size={12} />;
    } else if (tokenStatus === 'COMPLETED' || tokenStatus === 'CLOSED') {
      badgeLabel = 'COMPLETED PASS';
      badgeClasses = 'dark:bg-gray-500/20 bg-gray-500/10 dark:text-gray-300 text-gray-700 border dark:border-gray-500/40 border-gray-500/30';
      badgeIcon = <AlertCircle size={12} />;
    } else if (tokenStatus === 'CANCELLED') {
      badgeLabel = 'CANCELLED PASS';
      badgeClasses = 'dark:bg-red-500/20 bg-red-500/10 dark:text-red-300 text-red-700 border dark:border-red-500/40 border-red-500/30';
      badgeIcon = <AlertCircle size={12} />;
    } else if (isQuotaDepleted) {
      badgeLabel = 'QUOTA DEPLETED';
      badgeClasses = 'dark:bg-red-500/20 bg-red-500/10 dark:text-red-300 text-red-700 border dark:border-red-500/40 border-red-500/30';
      badgeIcon = <AlertCircle size={12} />;
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ======================================================== */}
      {/* 1. QR SCAN TAB */}
      {/* ======================================================== */}
      {isScanTab && (
        <div className="max-w-xl mx-auto space-y-4">
          {/* Scan Tab Camera Bar */}
          <div className="glass-panel p-4 rounded-2xl border border-border-main flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl dark:bg-amber-500/15 bg-amber-500/10 dark:text-amber-400 text-amber-700 flex items-center justify-center font-bold">
                <Camera size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">QR Scanner Terminal</h3>
                <p className="text-[11px] text-text-muted">Scan guest QR pass or enter token manually</p>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
              {cameraActive && (
                <button
                  onClick={toggleFacingMode}
                  className="flex-1 sm:flex-none justify-center px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all premium-btn-secondary cursor-pointer"
                  title="Switch Camera Source"
                >
                  <div className="nav-icon-badge">
                    <RefreshCw size={12} />
                  </div>
                  <span className="hidden sm:inline">{facingMode === 'user' ? 'Laptop Webcam' : 'External Scanner'}</span>
                  <span className="sm:hidden">Switch Cam</span>
                </button>
              )}

              {!cameraActive ? (
                <button
                  onClick={handleEnableCamera}
                  className="flex-1 sm:flex-none justify-center px-4 py-2 rounded-xl primary-btn bg-emerald-500 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <div className="nav-icon-badge">
                    <Camera size={14} />
                  </div>
                  <span>Enable Camera Scanner</span>
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="flex-1 sm:flex-none justify-center px-4 py-2 rounded-xl premium-btn-secondary cancellation-btn dark:text-red-400 text-red-700 dark:border-red-500/30 border-red-500/30 dark:bg-red-500/5 bg-red-500/5 hover:bg-red-500/15 hover:border-red-500/50 hover:text-red-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <div className="nav-icon-badge">
                    <VideoOff size={14} />
                  </div>
                  <span className="hidden sm:inline">Stop Camera</span>
                  <span className="sm:hidden">Stop Cam</span>
                </button>
              )}
            </div>
          </div>
 {!scannedToken ? (
 /* Pass Verification Terminal Panel */
 <div className="glass-panel p-3 sm:p-6 rounded-3xl border border-border-main space-y-4 sm:space-y-6 animate-fadeIn">
 <div className="flex items-center justify-between pb-3 border-b border-border-main">
 <h3 className="text-sm font-bold uppercase text-text-main tracking-wider">Pass Verification Terminal</h3>
 <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">QR Code Reader</span>
 </div>

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
  <div className="absolute inset-0 pointer-events-none z-10">
    {/* Ambient Scanning Line across the full view */}
    <div className="absolute left-0 right-0 h-[2px] bg-emerald-500/60 top-1/2 -translate-y-1/2 shadow-[0_0_12px_#10B981] animate-pulse" />
    
    {/* Smart Full-Frame Corner Brackets */}
    <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
    <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
    <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
    <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />

    {/* Ambient Text Identifier */}
    <div className="absolute top-4 left-12 bg-black/60 px-2 py-0.5 rounded-md border border-white/10">
      <span className="text-[9px] text-emerald-400 font-black uppercase tracking-wider">Full-Frame Auto Scanner</span>
    </div>

    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 w-[90%] sm:w-max px-4 py-1.5 rounded-full border border-border-main flex items-center justify-center">
      <p className="text-[10px] text-text-main font-extrabold uppercase tracking-widest text-center leading-tight">
        Place QR Code anywhere in the camera view
      </p>
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
 <form onSubmit={handleVerify} className="space-y-2 sm:space-y-3 pt-1 sm:pt-2">
 <label className="block text-[11px] sm:text-xs font-semibold text-text-muted">Or Enter Token Code Manually</label>
 <div className="flex flex-row gap-2 sm:gap-3">
 <div className="relative flex-1 w-full">
 <Search className="absolute left-3.5 top-3 text-text-muted" size={18} />
 <input
 type="text"
 value={tokenInput}
 onChange={e => setTokenInput(e.target.value.toUpperCase())}
 placeholder="e.g. TKB-0104"
 className="w-full bg-bg-primary border border-border-main rounded-xl pl-10 pr-4 py-2.5 text-base md:text-sm text-text-main font-mono placeholder-gray-500 focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary"
 />
 </div>

 <button
 type="submit"
 disabled={isVerifying || !tokenInput.trim()}
 title={isVerifying ? "Verifying..." : !tokenInput.trim() ? "Enter pass code" : undefined}
 className="px-4 sm:px-6 py-2.5 rounded-xl primary-btn text-[11px] sm:text-xs font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
 >
 {isVerifying ? 'Verifying...' : 'Verify Pass'}
 </button>
 </div>
 </form>
 </div>
 ) : (
 /* Verified Guest Pass Summary Panel */
 <div className="glass-panel p-3 sm:p-6 rounded-3xl border border-border-main space-y-4 sm:space-y-6 animate-fadeIn">
 <div className="flex items-center justify-between pb-3 border-b border-border-main">
 <h3 className="text-sm font-bold uppercase text-text-main tracking-wider">Verified Guest Pass Summary</h3>
 <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Redemption Console</span>
 </div>

 {/* Token Number & Status Header */}
 <div className="p-3 sm:p-4 rounded-2xl bg-bg-primary border border-border-main flex flex-row items-center justify-between gap-3 sm:gap-0">
 <div>
 <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Token Pass</span>
 <span className="font-mono text-2xl font-black text-text-main break-all">{scannedToken.tokenNumber}</span>
 </div>

 <span className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${badgeClasses}`}>
    {badgeIcon}
    <span>{badgeLabel}</span>
  </span>
 </div>

 {/* Guest Details */}
 <div className="space-y-1.5 sm:space-y-2 text-xs">
 <div className="flex justify-between items-center p-2.5 sm:p-3 rounded-xl bg-bg-primary border border-border-main gap-2">
 <span className="text-text-muted shrink-0">Guest Name:</span>
 <span className="font-bold text-text-main text-sm truncate flex-1 text-right">{scannedToken.customer?.name || 'Walk-in Guest'}</span>
 </div>

 <div className="flex justify-between items-center p-2.5 sm:p-3 rounded-xl bg-bg-primary border border-border-main gap-2">
 <span className="text-text-muted shrink-0">Phone Contact:</span>
 <span className="font-mono text-text-muted truncate flex-1 text-right">{scannedToken.customer?.phoneNumber || '—'}</span>
 </div>

 <div className="flex justify-between items-center p-2.5 sm:p-3 rounded-xl bg-bg-primary border border-border-main gap-2">
 <span className="text-text-muted shrink-0">Email Contact:</span>
 <span className="font-mono text-text-muted truncate flex-1 text-right" title={scannedToken.customer?.email}>{scannedToken.customer?.email || '—'}</span>
 </div>

 <div className="flex justify-between items-center p-2.5 sm:p-3 rounded-xl bg-bg-primary border border-border-main gap-2">
 <span className="text-text-muted shrink-0">Guest Headcount:</span>
 <span className="font-bold text-text-main truncate flex-1 text-right">{scannedToken.personsCount} Guests</span>
 </div>
 </div>

  {/* Drink Quota Usage Progress Bar & Cumulative Breakdown */}
  <div className="p-4 rounded-2xl bg-bg-primary border border-border-main space-y-3">
    <div className="flex items-center justify-between text-xs font-bold">
      <span className="text-text-muted uppercase tracking-wider text-[11px]">Redemption Progress</span>
      <div className="flex items-center gap-2">
        <span className={`font-black font-mono text-sm inline-flex items-center gap-1 ${isQuotaDepleted ? 'dark:text-red-400 text-red-700' : 'dark:text-emerald-400 text-emerald-700'}`}>
          <AnimatedNumber value={redemptionsUsed} />
          <span>/</span>
          <span>{totalAllowed}</span>
          <span>USED</span>
        </span>
        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${remainingDrinks > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
          <AnimatedNumber value={remainingDrinks} />
          <span>{remainingDrinks === 1 ? 'Drink' : 'Drinks'} Remaining</span>
        </span>
      </div>
    </div>

    <div className="w-full h-2.5 rounded-full bg-bg-card overflow-hidden">
      <div 
        className={`h-full transition-[width] duration-300 ease-out rounded-full ${
          isQuotaDepleted ? 'bg-red-500' : 'bg-emerald-500'
        }`}
        style={{ width: `${Math.min(100, (redemptionsUsed / totalAllowed) * 100)}%` }}
      />
    </div>

    {/* Cumulative Breakdown in Scan Mode */}
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border-main/40 text-xs">
      <div className="p-2 rounded-xl bg-bg-surface border border-border-main flex flex-col">
        <span className="text-[10px] text-text-muted font-semibold uppercase">Current Check-In</span>
        <span className="font-mono font-bold text-text-main text-xs">{scannedCurrentCheckIn} Drinks</span>
      </div>
      <div className="p-2 rounded-xl bg-bg-surface border border-border-main flex flex-col">
        <span className="text-[10px] text-text-muted font-semibold uppercase">Carried Forward</span>
        <span className={`font-mono font-bold text-xs ${scannedCarriedForward > 0 ? 'text-primary font-black' : 'text-text-muted'}`}>
          {scannedCarriedForward > 0 ? `+${scannedCarriedForward} Drinks` : '0 Drinks'}
        </span>
      </div>
      <div className="p-2 rounded-xl bg-bg-surface border border-border-main flex flex-col col-span-2 sm:col-span-1">
        <span className="text-[10px] text-text-muted font-semibold uppercase">Total Entitlement</span>
        <span className="font-mono font-black text-text-main text-xs">{totalAllowed} Drinks</span>
      </div>
    </div>
  </div>

  {/* Dispense & Revert Actions */}
  <div className="space-y-2 sm:space-y-3 pt-1 sm:pt-2">
    {!isActivePass && (
      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-400">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <div>
          <p className="font-extrabold uppercase tracking-wider">Redemption Blocked</p>
          <p className="mt-0.5 text-text-muted">This token pass is no longer active (Current status: <span className="font-black text-text-main">{tokenStatus || 'UNKNOWN'}</span>). Dispensing and reverting drinks is locked.</p>
        </div>
      </div>
    )}

    <div className="flex flex-row items-center gap-2 sm:gap-3">
      <div className="flex items-center justify-between bg-bg-surface border border-border-main rounded-xl p-1 h-12 sm:h-[52px] w-32 shrink-0">
        <button 
          onClick={() => setRedeemQty(Math.max(1, redeemQty - 1))}
          disabled={isRedeeming || isQuotaDepleted || !isActivePass || redeemQty <= 1}
          className="p-2 hover:bg-bg-card rounded-lg transition-all text-text-muted disabled:opacity-50 cursor-pointer"
        >
          <Minus size={16} />
        </button>
        <span className="font-bold text-text-main text-sm">{redeemQty}</span>
        <button 
          onClick={() => setRedeemQty(Math.min(Math.max(1, totalAllowed - redemptionsUsed), redeemQty + 1))}
          disabled={isRedeeming || isQuotaDepleted || !isActivePass || redeemQty >= (totalAllowed - redemptionsUsed)}
          className="p-2 hover:bg-bg-card rounded-lg transition-all text-text-muted disabled:opacity-50 cursor-pointer"
        >
          <Plus size={16} />
        </button>
      </div>
      
      <button
        onClick={handleRedeem}
        disabled={isRedeeming || isQuotaDepleted || !isActivePass}
        title={isRedeeming ? "Dispensing..." : !isActivePass ? `Redemption blocked. Token status is ${tokenStatus || 'INACTIVE'}.` : isQuotaDepleted ? "Drink quota limit reached for this session." : undefined}
        className="flex-1 h-12 sm:h-[52px] rounded-xl primary-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        <div className="nav-icon-badge">
          <Wine size={14} />
        </div>
        <span>{isRedeeming ? 'Dispensing...' : `Dispense ${redeemQty}`}</span>
      </button>
    </div>

    <div className="flex flex-row gap-2 sm:gap-3">
      {redemptionsUsed > 0 && isActivePass && (
        <button
          onClick={handleUndo}
          className="flex-1 py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card text-[11px] sm:text-xs font-bold text-amber-300 border border-amber-500/30 flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer"
        >
          <RotateCcw size={14} /> <span className="hidden sm:inline">Revert Last Drink</span><span className="sm:hidden">Revert</span>
        </button>
      )}
 <button
 onClick={() => {
 setScannedToken(null);
 setTokenInput('');
 startCamera();
 }}
 className="flex-1 py-2.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all premium-btn-secondary flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
 >
 <Camera size={14} /> Scan Next
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 )}

 {/* ======================================================== */}
 {/* 2. CHECK-INS TAB */}
 {/* ======================================================== */}
 {!isScanTab && (
    <div className="space-y-5">
      
      {/* Hero Station Banner */}
      <div className="rounded-2xl dark:bg-[#18181A] bg-white border border-border-main p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-sm">
        <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0 w-full sm:w-auto">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Wine size={18} className="stroke-[2.2] sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-lg font-bold text-text-main tracking-wide truncate">Bartender Service Station</h3>
                <span className="px-2 py-0.5 text-[10px] sm:text-[11px] font-mono font-bold rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                  {activeTokens.length}
                </span>
              </div>
              <p className="text-xs text-text-muted font-medium mt-0.5 truncate hidden sm:block">
                Manage and search active guest check-in sessions with quick action tools
              </p>
            </div>
          </div>

          {/* Mobile Refresh Button */}
          <button
            onClick={() => {
              fetchActiveTokens();
              refreshTokens();
              refreshTables();
            }}
            disabled={isLoadingTokens}
            className="w-9 h-9 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 active:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 shrink-0 sm:hidden"
            title={`Sync Sessions (${activeTokens.length})`}
            aria-label={`Sync Sessions (${activeTokens.length})`}
          >
            <RefreshCw size={14} className={isLoadingTokens ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Desktop / Tablet Refresh Button */}
        <button
          onClick={() => {
            fetchActiveTokens();
            refreshTokens();
            refreshTables();
          }}
          disabled={isLoadingTokens}
          className="w-9 h-9 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 active:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 hidden sm:flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 shrink-0"
          title={`Sync Sessions (${activeTokens.length})`}
          aria-label={`Sync Sessions (${activeTokens.length})`}
        >
          <RefreshCw size={14} className={isLoadingTokens ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Global Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Global Session Search (Search by Guest Name, Phone Number, Email, or Token code...)"
          className="w-full bg-[#121214] dark:bg-[#121214] bg-white border border-border-main rounded-xl pl-11 pr-4 py-3 text-sm text-text-main placeholder-zinc-500 dark:placeholder-zinc-500 focus:outline-none dark:focus:border-primary focus:border-primary transition-all font-medium"
        />
      </div>

      {/* Active Checked-in Customers List */}
      {isLoadingTokens ? (
        <div className="glass-panel p-12 text-center text-text-muted text-sm rounded-3xl border border-border-main">
          Loading active check-ins...
        </div>
      ) : filteredTokens.length === 0 ? (
        <div className="glass-panel p-16 text-center text-text-muted text-sm rounded-3xl border border-border-main space-y-2">
          <Users className="mx-auto text-gray-600" size={40} />
          <p className="font-bold text-text-main">No Active Checked-In Guests</p>
          <p className="text-xs">No guest matches the search queries, or no sessions are currently checked in.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-3 sm:gap-4">
          {filteredTokens.map(tk => {
            const isTokenQuotaDepleted = tk.redemptionsUsed >= tk.totalRedemptionsAllowed;
            const tkRemainingDrinks = Math.max(0, tk.totalRedemptionsAllowed - tk.redemptionsUsed);
            const tkBasePerPerson = (tk.placeType && typeof tk.placeType === 'object' && (tk.placeType as any).redemptionsPerPerson) ? (tk.placeType as any).redemptionsPerPerson : 2;
            const tkCurrentCheckIn = typeof tk.currentCheckInEntitlement === 'number' 
              ? tk.currentCheckInEntitlement 
              : Math.min(tk.totalRedemptionsAllowed, (tk.personsCount || 1) * tkBasePerPerson);
            const tkCarriedForward = typeof tk.carriedForwardBalance === 'number' 
              ? tk.carriedForwardBalance 
              : Math.max(0, tk.totalRedemptionsAllowed - tkCurrentCheckIn);
            const isRedeemingToken = redeemingTokenIds.has(tk.tokenNumber);

            const isActiveToken = tk.status?.toUpperCase() === 'ACTIVE' || tk.status?.toUpperCase() === 'EXTENDED';
            const qtyInput = cardQuantities[tk.tokenNumber] !== undefined ? cardQuantities[tk.tokenNumber] : '1';
            const currentQty = parseInt(qtyInput, 10) || 1;
            const isCardExpanded = expandedCardIds.has(tk.tokenNumber);

            return (
              <div 
                key={tk.tokenNumber || tk.id} 
                className="dark:bg-[#141416] bg-white p-3.5 sm:p-4 xl:p-5 rounded-2xl border border-border-main/70 transition-all duration-200 hover:border-border-main relative shadow-sm flex flex-col justify-between"
              >
                {/* ======================================================== */}
                {/* 1. MOBILE & TABLET COMPACT OPERATIONAL CARD (< 1280px)  */}
                {/* ======================================================== */}
                <div className="flex flex-col gap-2.5 xl:hidden w-full">
                  {/* ROW 1: Identity & Live Session Status */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    {/* Left: Table Badge + Name + Token */}
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/25 text-primary text-[11px] font-black font-mono shrink-0">
                        {tk.tableNumber || tk.table?.tableNumber ? `Table ${tk.tableNumber || tk.table?.tableNumber}` : 'Walking / Bar'}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-text-main truncate max-w-[100px] sm:max-w-[160px]" title={tk.customer?.name || 'Walk-in Guest'}>
                        {tk.customer?.name || 'Walk-in Guest'}
                      </h4>
                      <span className="hidden xs:inline-block px-1.5 py-0.5 rounded bg-zinc-800/60 dark:bg-zinc-800/60 bg-zinc-100 text-[10px] font-mono font-semibold text-text-muted shrink-0">
                        {tk.tokenNumber}
                      </span>
                    </div>

                    {/* Right: Live Countdown Timer + Status Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="bg-bg-card/70 border border-border-main/40 px-2 py-0.5 rounded-md">
                        <LiveSessionTimer endTime={tk.endTime} status={tk.status} />
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-950/60 dark:bg-emerald-950/60 bg-emerald-50 text-emerald-400 dark:text-emerald-400 text-emerald-700 border border-emerald-800/50 dark:border-emerald-800/50 border-emerald-300 shrink-0">
                        {tk.status}
                      </span>
                    </div>
                  </div>

                  {/* ROW 2: Drink Progress Gauge & Fast Dispense Pod */}
                  <div className="bg-bg-primary/50 dark:bg-black/20 p-2.5 rounded-xl border border-border-main/40 space-y-2">
                    {/* Drink Progress Stats & Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Wine size={12} className="text-amber-500 shrink-0" />
                          <span className="font-mono font-bold text-xs text-text-main inline-flex items-center gap-1">
                            <AnimatedNumber value={tk.redemptionsUsed} />
                            <span>/</span>
                            <span>{tk.totalRedemptionsAllowed}</span>
                            <span className="text-[10px] text-text-muted font-normal">USED</span>
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase inline-flex items-center gap-1 ${
                          tkRemainingDrinks > 0 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                        }`}>
                          <AnimatedNumber value={tkRemainingDrinks} />
                          <span>{tkRemainingDrinks === 1 ? 'DRINK' : 'DRINKS'} REMAINING</span>
                        </span>
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-zinc-800 dark:bg-zinc-800 bg-zinc-200 overflow-hidden">
                        <div 
                          className={`h-full transition-[width] duration-300 ease-out rounded-full ${isTokenQuotaDepleted ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(100, (tk.redemptionsUsed / tk.totalRedemptionsAllowed) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Primary Controls Row: [ Stepper ] [ REDEEM ] [ REVERT ] */}
                    <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                      {/* Quantity Stepper */}
                      <div className="h-9 sm:h-10 rounded-lg dark:bg-[#1C1C20] bg-zinc-100 border border-border-main flex items-center justify-between px-1">
                        <button
                          type="button"
                          onClick={() => handleQuantityDecrement(tk.tokenNumber)}
                          disabled={isRedeemingToken || isTokenQuotaDepleted || !isActiveToken || currentQty <= 1}
                          className="w-7 h-8 flex items-center justify-center rounded text-text-muted hover:text-text-main hover:bg-bg-card disabled:opacity-30 transition-all cursor-pointer"
                          title="Decrease quantity"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>

                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={qtyInput}
                          onChange={(e) => handleQuantityChange(tk.tokenNumber, e.target.value)}
                          onBlur={() => handleQuantityBlur(tk.tokenNumber, tkRemainingDrinks)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          disabled={isRedeemingToken || isTokenQuotaDepleted || !isActiveToken}
                          className="w-8 h-8 text-center font-mono font-bold text-xs text-text-main bg-transparent focus:outline-none focus:ring-1 focus:ring-primary rounded"
                          aria-label="Redemption Quantity"
                        />

                        <button
                          type="button"
                          onClick={() => handleQuantityIncrement(tk.tokenNumber, tkRemainingDrinks)}
                          disabled={isRedeemingToken || isTokenQuotaDepleted || !isActiveToken || currentQty >= tkRemainingDrinks}
                          className="w-7 h-8 flex items-center justify-center rounded text-text-muted hover:text-text-main hover:bg-bg-card disabled:opacity-30 transition-all cursor-pointer"
                          title="Increase quantity"
                          aria-label="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      {/* REDEEM Button — Emerald Green */}
                      <button
                        type="button"
                        onClick={() => handleRedeemForToken(tk, currentQty)}
                        disabled={isRedeemingToken || isTokenQuotaDepleted || !isActiveToken || currentQty < 1 || currentQty > tkRemainingDrinks}
                        title={isTokenQuotaDepleted ? "Drink quota limit reached" : `Dispense ${currentQty} ${currentQty === 1 ? 'Drink' : 'Drinks'}`}
                        className="h-9 sm:h-10 px-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-400/40 dark:border-emerald-600/50 hover:bg-emerald-500/20 dark:hover:bg-emerald-900/60 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                      >
                        <Wine size={12} className="shrink-0" />
                        <span className="truncate">{isRedeemingToken ? 'REDEEMING' : 'REDEEM'}</span>
                      </button>

                      {/* REVERT Button — Amber Gold */}
                      <button
                        type="button"
                        onClick={() => handleUndoForToken(tk)}
                        disabled={isRedeemingToken || tk.redemptionsUsed <= 0 || !isActiveToken}
                        title={tk.redemptionsUsed <= 0 ? "No redemptions to revert" : "Revert last drink redemption"}
                        className="h-9 sm:h-10 px-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-400/40 dark:border-amber-600/50 hover:bg-amber-500/20 dark:hover:bg-amber-900/60 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                      >
                        <RotateCcw size={12} className="shrink-0" />
                        <span className="truncate">REVERT</span>
                      </button>
                    </div>
                  </div>

                  {/* ROW 3: Secondary Actions & Progressive Disclosure Details Toggle */}
                  <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                    {/* EXTEND Button */}
                    <button
                      type="button"
                      onClick={() => setExtendingToken(tk)}
                      className="h-8 px-1 rounded-lg bg-purple-500/10 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-400/40 dark:border-purple-600/50 hover:bg-purple-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Extend Session Duration"
                    >
                      <Clock size={11} className="shrink-0" />
                      <span className="truncate">EXTEND</span>
                    </button>

                    {/* QR SCAN Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setScannedToken(tk);
                        setActiveTab('bartender/scan');
                      }}
                      className="h-8 px-1 rounded-lg bg-sky-500/10 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-400/40 dark:border-sky-600/50 hover:bg-sky-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Open QR Scan Terminal"
                    >
                      <QrCode size={11} className="shrink-0" />
                      <span className="truncate">SCAN</span>
                    </button>

                    {/* CHECKOUT Button */}
                    <button
                      type="button"
                      onClick={() => setCancellingToken(tk)}
                      className="h-8 px-1 rounded-lg bg-rose-500/10 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-400/40 dark:border-rose-600/50 hover:bg-rose-500/20 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Checkout and Close Session"
                    >
                      <LogOut size={11} className="shrink-0" />
                      <span className="truncate">CHECKOUT</span>
                    </button>

                    {/* DETAILS Expander Toggle */}
                    <button
                      type="button"
                      onClick={() => toggleCardExpansion(tk.tokenNumber)}
                      aria-expanded={isCardExpanded}
                      className={`h-8 px-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-0.5 transition-all cursor-pointer ${
                        isCardExpanded 
                          ? 'bg-primary/10 border-primary/30 text-primary font-black' 
                          : 'bg-bg-surface border-border-main text-text-muted hover:text-text-main'
                      }`}
                      title={isCardExpanded ? "Hide Reference Details" : "View Reference Details"}
                    >
                      {isCardExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      <span className="truncate">{isCardExpanded ? 'HIDE' : 'INFO'}</span>
                    </button>
                  </div>

                  {/* ROW 4: Progressively Disclosed Reference Details Panel */}
                  {isCardExpanded && (
                    <div className="pt-2 mt-0.5 border-t border-border-main/30 space-y-2 text-xs animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-text-muted text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Phone size={12} className="shrink-0 text-text-muted" />
                          <span className="font-mono truncate">{tk.customer?.phoneNumber || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Mail size={12} className="shrink-0 text-text-muted" />
                          <span className="font-mono truncate" title={tk.customer?.email}>{tk.customer?.email || '—'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border-main/20 text-[11px]">
                        <div>
                          <span className="text-text-muted text-[9px] uppercase font-semibold block">Party Size</span>
                          <span className="font-bold text-text-main">{tk.personsCount || 1} Guests</span>
                        </div>
                        <div>
                          <span className="text-text-muted text-[9px] uppercase font-semibold block">Check-in</span>
                          <span className="font-bold text-text-main font-mono">{new Date(tk.createdAt || tk.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div>
                          <span className="text-text-muted text-[9px] uppercase font-semibold block">Gate Cover</span>
                          <span className="font-bold text-text-main font-mono">₹{tk.amountPaid}</span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-bg-surface/70 border border-border-main/30 text-[10px] flex items-center justify-between text-text-muted">
                        <span>Current: <strong className="text-text-main font-mono">{tkCurrentCheckIn}</strong></span>
                        <span>Carried: <strong className="text-amber-400 font-mono">+{tkCarriedForward}</strong></span>
                        <span>Total: <strong className="text-text-main font-mono">{tk.totalRedemptionsAllowed}</strong></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ======================================================== */}
                {/* 2. DESKTOP BASELINE LAYOUT (Visible strictly at >= 1280px) */}
                {/* ======================================================== */}
                <div className="hidden xl:flex xl:flex-row xl:items-center justify-between gap-5 w-full">
                  {/* Section 1: Customer Info and Session Meta */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    {/* Guest Name & Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-bold text-text-main truncate">
                        {tk.customer?.name || 'Walk-in Guest'}
                      </h4>
                      
                      {/* Token Code Badge */}
                      <span className="px-2.5 py-0.5 rounded-md bg-[#222226] dark:bg-[#222226] bg-zinc-100 border border-[#333338] dark:border-[#333338] border-zinc-200 text-[11px] font-mono font-bold text-zinc-200 dark:text-zinc-200 text-zinc-700">
                        {tk.tokenNumber}
                      </span>

                      {/* Status Badge */}
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-950/60 dark:bg-emerald-950/60 bg-emerald-50 text-emerald-400 dark:text-emerald-400 text-emerald-700 border border-emerald-800/50 dark:border-emerald-800/50 border-emerald-300">
                        {tk.status}
                      </span>
                    </div>

                    {/* Phone & Email Row */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-text-muted">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Phone size={13} className="shrink-0 text-text-muted" />
                        <span className="font-mono">{tk.customer?.phoneNumber || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Mail size={13} className="shrink-0 text-text-muted" />
                        <span className="font-mono truncate" title={tk.customer?.email}>{tk.customer?.email || '—'}</span>
                      </div>
                    </div>

                    {/* 4-Item Metadata Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border-main/20 text-xs">
                      <div>
                        <div className="flex items-center gap-1 text-[10px] text-text-muted font-medium">
                          <Wine size={11} className="text-text-muted shrink-0" />
                          <span>Table/Zone</span>
                        </div>
                        <p className="font-bold text-text-main text-xs mt-0.5 font-mono">{tk.tableNumber || tk.table?.tableNumber || 'Walking / Bar'}</p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 text-[10px] text-text-muted font-medium">
                          <Users size={11} className="text-text-muted shrink-0" />
                          <span>Party Size</span>
                        </div>
                        <p className="font-bold text-text-main text-xs mt-0.5">{tk.personsCount || 1}</p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 text-[10px] text-text-muted font-medium">
                          <Clock size={11} className="text-text-muted shrink-0" />
                          <span>Check-in</span>
                        </div>
                        <p className="font-bold text-text-main text-xs mt-0.5">{new Date(tk.createdAt || tk.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 text-[10px] text-text-muted font-medium">
                          <Clock size={11} className="text-text-muted shrink-0" />
                          <span>Remaining</span>
                        </div>
                        <div className="mt-0.5">
                          <LiveSessionTimer endTime={tk.endTime} status={tk.status} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Redemption Progress */}
                  <div className="w-full xl:w-[260px] shrink-0 border-t xl:border-t-0 xl:border-l border-border-main/20 pt-4 xl:pt-0 xl:pl-5 space-y-1.5">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">REDEMPTION PROGRESS</span>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black font-mono text-text-main inline-flex items-center gap-1">
                        <AnimatedNumber value={tk.redemptionsUsed} />
                        <span>/</span>
                        <span>{tk.totalRedemptionsAllowed}</span>
                        <span>USED</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-950/80 dark:bg-emerald-950/80 bg-emerald-50 text-emerald-400 dark:text-emerald-400 text-emerald-700 border border-emerald-800/60 dark:border-emerald-800/60 border-emerald-300 whitespace-nowrap inline-flex items-center gap-1">
                        <AnimatedNumber value={tkRemainingDrinks} />
                        <span>{tkRemainingDrinks === 1 ? 'DRINK' : 'DRINKS'} REMAINING</span>
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-zinc-800 dark:bg-zinc-800 bg-zinc-200 overflow-hidden my-2">
                      <div 
                        className={`h-full transition-[width] duration-300 ease-out rounded-full ${isTokenQuotaDepleted ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, (tk.redemptionsUsed / tk.totalRedemptionsAllowed) * 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-text-muted pt-0.5">
                      <span>Current Check-In: <strong className="text-text-main font-mono">{tkCurrentCheckIn}</strong></span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-amber-400 font-bold">
                        Carried Forward: <strong className="font-mono text-amber-400">+{tkCarriedForward}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Section 3: Gate Payment */}
                  <div className="w-full xl:w-[130px] shrink-0 border-t xl:border-t-0 xl:border-l border-border-main/20 pt-4 xl:pt-0 xl:pl-5 space-y-1">
                    <span className="text-[10px] text-text-muted font-bold uppercase tracking-wider block">GATE PAYMENT</span>
                    <span className="text-2xl font-black text-text-main font-mono block">₹{tk.amountPaid}</span>
                  </div>

                  {/* Section 4: Compact 2-Row × 3-Column Action Grid */}
                  <div className="w-full xl:w-[320px] shrink-0 pt-4 xl:pt-0 border-t xl:border-t-0 border-border-main/20 flex flex-col gap-2">
                    {/* ROW 1: [ Quantity Control ] [ REDEEM ] [ REVERT ] */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {/* Quantity Selector: [ − ] [ 1 ] [ + ] */}
                      <div className="h-9 rounded-lg dark:bg-[#1C1C20] bg-zinc-100 border border-border-main flex items-center justify-between px-1">
                        <button
                          type="button"
                          onClick={() => handleQuantityDecrement(tk.tokenNumber)}
                          disabled={isRedeemingToken || isTokenQuotaDepleted || !isActiveToken || currentQty <= 1}
                          className="w-6 h-7 flex items-center justify-center rounded text-text-muted hover:text-text-main hover:bg-bg-card disabled:opacity-30 transition-all cursor-pointer"
                          title="Decrease quantity"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={12} />
                        </button>

                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={qtyInput}
                          onChange={(e) => handleQuantityChange(tk.tokenNumber, e.target.value)}
                          onBlur={() => handleQuantityBlur(tk.tokenNumber, tkRemainingDrinks)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.currentTarget.blur();
                            }
                          }}
                          disabled={isRedeemingToken || isTokenQuotaDepleted || !isActiveToken}
                          className="w-8 h-7 text-center font-mono font-bold text-xs text-text-main bg-transparent focus:outline-none focus:ring-1 focus:ring-primary rounded"
                          aria-label="Redemption Quantity"
                        />

                        <button
                          type="button"
                          onClick={() => handleQuantityIncrement(tk.tokenNumber, tkRemainingDrinks)}
                          disabled={isRedeemingToken || isTokenQuotaDepleted || !isActiveToken || currentQty >= tkRemainingDrinks}
                          className="w-6 h-7 flex items-center justify-center rounded text-text-muted hover:text-text-main hover:bg-bg-card disabled:opacity-30 transition-all cursor-pointer"
                          title="Increase quantity"
                          aria-label="Increase quantity"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* REDEEM Button — Emerald Green */}
                      <button
                        type="button"
                        onClick={() => handleRedeemForToken(tk, currentQty)}
                        disabled={isRedeemingToken || isTokenQuotaDepleted || !isActiveToken || currentQty < 1 || currentQty > tkRemainingDrinks}
                        title={isTokenQuotaDepleted ? "Drink quota limit reached" : `Dispense ${currentQty} ${currentQty === 1 ? 'Drink' : 'Drinks'}`}
                        className="h-9 px-2 rounded-lg bg-emerald-500/10 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-400/40 dark:border-emerald-600/50 hover:bg-emerald-500/20 dark:hover:bg-emerald-900/60 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                      >
                        <Wine size={12} className="shrink-0" />
                        <span>{isRedeemingToken ? 'REDEEMING' : 'REDEEM'}</span>
                      </button>

                      {/* REVERT Button — Amber Gold */}
                      <button
                        type="button"
                        onClick={() => handleUndoForToken(tk)}
                        disabled={isRedeemingToken || tk.redemptionsUsed <= 0 || !isActiveToken}
                        title={tk.redemptionsUsed <= 0 ? "No redemptions to revert" : "Revert last drink redemption"}
                        className="h-9 px-2 rounded-lg bg-amber-500/10 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-400/40 dark:border-amber-600/50 hover:bg-amber-500/20 dark:hover:bg-amber-900/60 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                      >
                        <RotateCcw size={12} className="shrink-0" />
                        <span>REVERT</span>
                      </button>
                    </div>

                    {/* ROW 2: [ EXTEND ] [ QR SCAN ] [ CHECKOUT ] */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {/* EXTEND Button — Brand Purple */}
                      <button
                        type="button"
                        onClick={() => setExtendingToken(tk)}
                        className="h-9 px-2 rounded-lg bg-purple-500/10 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-400/40 dark:border-purple-600/50 hover:bg-purple-500/20 dark:hover:bg-purple-900/60 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Clock size={12} className="shrink-0" />
                        <span>EXTEND</span>
                      </button>

                      {/* QR SCAN Button — Sky Cyan */}
                      <button
                        type="button"
                        onClick={() => {
                          setScannedToken(tk);
                          setActiveTab('bartender/scan');
                        }}
                        className="h-9 px-2 rounded-lg bg-sky-500/10 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-400/40 dark:border-sky-600/50 hover:bg-sky-500/20 dark:hover:bg-sky-900/60 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <QrCode size={12} className="shrink-0" />
                        <span>QR SCAN</span>
                      </button>

                      {/* CHECKOUT Button — Crimson Red */}
                      <button
                        type="button"
                        onClick={() => setCancellingToken(tk)}
                        className="h-9 px-2 rounded-lg bg-rose-500/10 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-400/40 dark:border-rose-600/50 hover:bg-rose-500/20 dark:hover:bg-rose-900/60 font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <LogOut size={12} className="shrink-0" />
                        <span>CHECKOUT</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
 )}

 {/* ======================================================== */}
 {/* MODALS */}
 {/* ======================================================== */}

 {extendingToken && (
    <ExtendSessionModal
      isOpen={!!extendingToken}
      token={extendingToken}
      rates={rates || []}
      onClose={() => setExtendingToken(null)}
      onSuccess={() => {
        setExtendingToken(null);
        fetchActiveTokens();
        refreshTokens();
        refreshTables();
        if (scannedToken?.tokenNumber === extendingToken.tokenNumber) {
          api.verifyQR(scannedToken.tokenNumber).then(verifyRes => {
            if (verifyRes.success && verifyRes.token) {
              setScannedToken(verifyRes.token);
            }
          }).catch(() => {});
        }
      }}
    />
  )}

    {cancellingToken && (
      <CheckoutConfirmationModal
        isOpen={!!cancellingToken}
        session={{
          tokenNumber: cancellingToken.tokenNumber,
          customerName: cancellingToken.customer?.name || 'Walk-in Guest',
          customerPhone: cancellingToken.customer?.phoneNumber || 'N/A',
          tableNumber: cancellingToken.table?.tableNumber || 'N/A',
        }}
        onClose={() => setCancellingToken(null)}
        onSuccess={() => {
          setCancellingToken(null);
          fetchActiveTokens();
          refreshTokens();
          refreshTables();
          if (scannedToken?.tokenNumber === cancellingToken.tokenNumber) {
            setScannedToken(null);
          }
        }}
      />
    )}

 </div>
 );
};
