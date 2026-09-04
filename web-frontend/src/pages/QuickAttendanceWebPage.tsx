import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, AlertTriangle, UserCheck, Shield, Video, VideoOff } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const QuickAttendanceWebPage: React.FC = () => {
  const { showToast } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestIdRef = useRef(0);
  const [employeeCode, setEmployeeCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const stopCameraInternal = () => {
    cameraRequestIdRef.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.enabled = false;
          track.stop();
        } catch {}
      });
      streamRef.current = null;
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

  const startCamera = async () => {
    stopCameraInternal();
    setErrorMessage(null);
    const requestId = ++cameraRequestIdRef.current;
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      if (requestId !== cameraRequestIdRef.current) {
        mediaStream.getTracks().forEach(track => {
          try {
            track.enabled = false;
            track.stop();
          } catch {}
        });
        return;
      }
      streamRef.current = mediaStream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(() => {});
      }
      showToast('Camera enabled successfully.', 'success');
    } catch (err: any) {
      setErrorMessage('Camera access required for facial attendance. Please check browser permissions.');
      stopCameraInternal();
      showToast('Failed to access camera.', 'danger');
    }
  };

  const stopCamera = () => {
    stopCameraInternal();
    showToast('Camera disabled.', 'info');
  };

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
          stopCameraInternal();
        }
      } else {
        if (shouldResumeRef.current) {
          shouldResumeRef.current = false;
          startCamera();
        }
      }
    };

    const handleWindowBlur = () => {
      if (cameraActiveRef.current) {
        shouldResumeRef.current = true;
        stopCameraInternal();
      }
    };

    const handleWindowFocus = () => {
      if (shouldResumeRef.current) {
        shouldResumeRef.current = false;
        startCamera();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
      stopCameraInternal(); // stops on unmount
    };
  }, []);

  useEffect(() => {
    if (!attendanceResult && !errorMessage) return;

    const handleResultKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        handleReset();
      }
    };

    window.addEventListener('keydown', handleResultKeyDown);
    return () => window.removeEventListener('keydown', handleResultKeyDown);
  }, [attendanceResult, errorMessage]);

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const handleCaptureAndSubmit = async () => {
    if (isSubmitting || !cameraActive || !videoRef.current) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setAttendanceResult(null);

    try {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to initialize image capture context.');
      }

      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64Clean = dataUrl.replace(/^data:image\/\w+;base64,/, '');

      const res = await api.markQuickAttendance(base64Clean, employeeCode.trim() || undefined);

      if (res.success) {
        setAttendanceResult(res);
        showToast(res.message || `Attendance marked successfully (${res.action}).`, 'success');
      } else {
        const errorText = res.message || 'Attendance verification failed.';
        setErrorMessage(errorText);
        showToast(errorText, 'danger');
      }
    } catch (err: any) {
      const msg = err?.message || 'Unable to connect to attendance verification service.';
      setErrorMessage(msg);
      showToast(msg, 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setAttendanceResult(null);
    setErrorMessage(null);
    if (!cameraActive) {
      startCamera();
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0 space-y-3 sm:space-y-4" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="rounded-3xl bg-white dark:bg-[#18181A] border border-border-main dark:border-white/10 p-4 sm:p-6 relative overflow-hidden shadow-sm">
        
        {/* Header Title & FaceMark Security Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 mb-3 pb-2.5 sm:mb-4 sm:pb-3 border-b border-border-main dark:border-white/10">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary dark:bg-amber-500/15 dark:border-amber-500/20 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
              <UserCheck size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-text-main leading-tight truncate">FaceMark Quick Facial Attendance Kiosk</h3>
              <p className="text-[10px] text-text-muted truncate">Biometric facial recognition check-in & check-out</p>
            </div>
          </div>

          <div className="flex items-center justify-start sm:justify-end mt-1 sm:mt-0 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-[#141416] border border-border-main dark:border-white/10 text-[10px] font-semibold text-text-muted">
              <Shield size={12} className="text-primary dark:text-[#D4AF37]" />
              <span>FaceMark AI</span>
            </div>
          </div>
        </div>

        {/* Video Camera View Box */}
        <div className={`relative rounded-2xl overflow-hidden aspect-video border border-border-main dark:border-white/15 flex items-center justify-center max-h-[40vh] sm:max-h-[50vh] lg:max-h-none ${
          cameraActive ? 'bg-black' : 'bg-zinc-50 dark:bg-[#121214]'
        }`}>
          {cameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-200/60 dark:bg-[#1E1E22] border border-border-main dark:border-white/10 flex items-center justify-center text-text-muted">
                <VideoOff size={24} />
              </div>
              <p className="text-xs font-bold text-text-main">Camera is currently disabled</p>
              <p className="text-[10px] text-text-muted max-w-xs">Click the "Enable Camera" button below to turn on webcam for biometric attendance.</p>
            </div>
          )}

          {/* Hidden Canvas for Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanning Reticle Frame Overlay */}
          {!attendanceResult && !errorMessage && cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
              <div className="w-40 h-40 sm:w-48 sm:h-48 max-w-[70vw] max-h-[70vw] border-2 border-dashed border-primary/60 dark:border-[#D4AF37]/60 rounded-full animate-pulse flex items-center justify-center">
                <div className="w-32 h-32 sm:w-40 sm:h-40 border border-white/20 rounded-full" />
              </div>
            </div>
          )}

          {/* Result Card Overlay */}
          {attendanceResult && (
            <div className="absolute inset-0 bg-white/95 dark:bg-black/85 backdrop-blur-md p-5 flex flex-col items-center justify-center text-center space-y-3 overflow-y-auto animate-fadeIn border border-border-main dark:border-white/10">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                attendanceResult.action === 'check-in' 
                  ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500' 
                  : 'bg-blue-500/10 text-blue-700 border border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40'
              }`}>
                <CheckCircle2 size={28} />
              </div>

              <div className="w-full max-w-[90%] mx-auto">
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest inline-block ${
                  attendanceResult.action === 'check-in' 
                    ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40' 
                    : 'bg-blue-500/10 text-blue-700 border border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40'
                }`}>
                  {attendanceResult.action}
                </span>
                <h3 className="text-lg font-black text-text-main mt-1.5 truncate px-2">{attendanceResult.userName || 'Employee Identified'}</h3>
                <p className="text-[10px] text-text-muted font-mono mt-0.5 truncate px-2">{attendanceResult.userEmail}</p>
              </div>

              {attendanceResult.confidence && (
                <div className="text-[10px] font-semibold text-primary dark:text-[#D4AF37] bg-zinc-100 dark:bg-[#1C1C20] px-3 py-1 rounded-full border border-border-main dark:border-white/10">
                  Confidence Score: {(attendanceResult.confidence * 100).toFixed(1)}%
                </div>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="mt-2 h-10 px-6 rounded-xl primary-btn text-xs uppercase font-black tracking-wider cursor-pointer shadow-sm"
              >
                Scan Next Employee
              </button>
            </div>
          )}

          {/* Error State Overlay */}
          {errorMessage && (
            <div className="absolute inset-0 bg-white/95 dark:bg-black/85 backdrop-blur-md p-5 flex flex-col items-center justify-center text-center space-y-3 overflow-y-auto animate-fadeIn border border-border-main dark:border-white/10">
              <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-700 border border-red-500/30 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/40 flex items-center justify-center text-xl">
                <AlertTriangle size={24} />
              </div>

              <h4 className="text-sm font-bold text-red-700 dark:text-red-400">Attendance Verification Failed</h4>
              <p className="text-xs text-text-muted max-w-sm">{errorMessage}</p>

              <button
                type="button"
                onClick={handleReset}
                className="mt-2 h-10 px-6 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#1C1C20] dark:hover:bg-[#25252A] text-text-main border border-border-main dark:border-white/10 text-xs font-bold uppercase tracking-wider cursor-pointer transition-all"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Shutter Controls & Employee Code Option */}
        {!attendanceResult && !errorMessage && (
          <div className="mt-3 sm:mt-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="w-full lg:w-64 shrink-0">
              <label className="block lg:hidden text-[10px] font-bold text-text-muted mb-1 uppercase tracking-wider ml-1">Manual Override</label>
              <input
                type="text"
                value={employeeCode}
                onChange={e => setEmployeeCode(e.target.value)}
                placeholder="Optional Employee ID (e.g. EMP-99)"
                aria-label="Optional Employee ID"
                className="w-full h-11 bg-white dark:bg-[#121214] border border-border-main dark:border-white/15 rounded-xl px-4 text-xs text-text-main font-mono placeholder-zinc-500 dark:placeholder-zinc-500 focus:outline-none focus:border-primary dark:focus:border-[#D4AF37] transition-all font-medium"
              />
            </div>

            <div className="flex flex-row items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex-1 lg:flex-none h-11 px-4 sm:px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-sm"
                >
                  <Video size={14} className="shrink-0" />
                  <span>Enable Camera</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex-1 lg:flex-none h-11 px-4 sm:px-5 rounded-xl bg-rose-500/10 text-rose-700 border border-rose-500/30 hover:bg-rose-500/20 hover:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30 dark:hover:bg-rose-500/20 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <VideoOff size={14} className="shrink-0" />
                  <span>Disable</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCaptureAndSubmit}
                disabled={isSubmitting || !cameraActive}
                title={isSubmitting ? "Verifying..." : !cameraActive ? "Enable camera first" : undefined}
                className="flex-1 lg:flex-none h-11 px-5 rounded-xl primary-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Camera size={14} className="shrink-0" />
                <span>{isSubmitting ? 'Verifying...' : 'Verify Face'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
