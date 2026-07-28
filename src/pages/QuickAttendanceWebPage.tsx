import React, { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, AlertTriangle, UserCheck, Shield } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const QuickAttendanceWebPage: React.FC = () => {
  const { showToast } = useAuth();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [employeeCode, setEmployeeCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = async () => {
    setErrorMessage(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setCameraActive(true);
    } catch (err: any) {
      setErrorMessage('Camera access required for facial attendance. Please check browser permissions.');
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
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const handleCaptureAndSubmit = async () => {
    if (isSubmitting || !videoRef.current) return;

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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="glass-panel p-8 rounded-3xl border border-white/10 relative overflow-hidden">
        {/* Header Title */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">FaceMark Quick Facial Attendance Kiosk</h3>
              <p className="text-xs text-gray-400">Biometric facial recognition check-in & check-out</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-gray-300">
            <Shield size={14} className="text-[#D4AF37]" />
            <span>FaceMark AI Enabled</span>
          </div>
        </div>

        {/* Video Camera View Box */}
        <div className="relative rounded-2xl bg-black overflow-hidden aspect-video border border-white/10 flex items-center justify-center shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />

          {/* Hidden Canvas for Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanning Reticle Frame Overlay */}
          {!attendanceResult && !errorMessage && cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-dashed border-[#D4AF37]/60 rounded-full animate-pulse flex items-center justify-center">
                <div className="w-56 h-56 border border-white/20 rounded-full" />
              </div>
            </div>
          )}

          {/* Result Card Overlay */}
          {attendanceResult && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
                attendanceResult.action === 'check-in' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500' : 'bg-blue-500/20 text-blue-400 border border-blue-500'
              }`}>
                <CheckCircle2 size={40} />
              </div>

              <div>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
                  attendanceResult.action === 'check-in' ? 'badge-active' : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                }`}>
                  {attendanceResult.action}
                </span>
                <h3 className="text-2xl font-black text-white mt-2">{attendanceResult.userName || 'Employee Identified'}</h3>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{attendanceResult.userEmail}</p>
              </div>

              {attendanceResult.confidence && (
                <div className="text-xs font-semibold text-[#D4AF37] bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  Confidence Score: {(attendanceResult.confidence * 100).toFixed(1)}%
                </div>
              )}

              <button
                onClick={handleReset}
                className="mt-4 px-8 py-3 rounded-xl gold-gradient-btn text-xs uppercase font-bold tracking-wider"
              >
                Scan Next Employee
              </button>
            </div>
          )}

          {/* Error State Overlay */}
          {errorMessage && (
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500 text-red-400 flex items-center justify-center text-2xl">
                <AlertTriangle size={36} />
              </div>

              <h4 className="text-lg font-bold text-red-400">Attendance Verification Failed</h4>
              <p className="text-xs text-gray-300 max-w-md">{errorMessage}</p>

              <button
                onClick={handleReset}
                className="mt-4 px-8 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider transition-all"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Shutter Controls & Employee Code Option */}
        {!attendanceResult && !errorMessage && (
          <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-80">
              <input
                type="text"
                value={employeeCode}
                onChange={e => setEmployeeCode(e.target.value)}
                placeholder="Optional Employee ID (e.g. EMP-99)"
                className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            <button
              onClick={handleCaptureAndSubmit}
              disabled={isSubmitting || !cameraActive}
              className="w-full md:w-auto px-10 py-3.5 rounded-2xl gold-gradient-btn flex items-center justify-center gap-2 text-sm uppercase font-black tracking-wider disabled:opacity-50 shadow-xl"
            >
              <Camera size={20} />
              <span>{isSubmitting ? 'Verifying Face...' : 'Capture & Verify Attendance'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
