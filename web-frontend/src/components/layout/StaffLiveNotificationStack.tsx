import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Sparkles,
  BellRing,
  X,
  Layers,
} from 'lucide-react';
import type { ToastMessage } from '../../context/AuthContext';

interface StaffLiveNotificationStackProps {
  toasts: ToastMessage[];
  activeToast: ToastMessage | null;
  onDismiss: () => void;
  onActionClick?: (toast: ToastMessage) => void;
}

export const StaffLiveNotificationStack: React.FC<StaffLiveNotificationStackProps> = ({
  toasts,
  activeToast,
  onDismiss,
  onActionClick,
}) => {
  if (!toasts || toasts.length === 0 || !activeToast) {
    return null;
  }

  return (
    <aside
      aria-label="Staff live operational notification stack"
      className="fixed top-3 inset-x-0 z-[9999] flex flex-col items-center pointer-events-none px-2 sm:px-4"
    >
      <div className="relative w-full max-w-md sm:max-w-lg flex flex-col items-center">
        {/* Background Stacked Preview Cards (Up to 2 queued notifications shown behind active card) */}
        {toasts.slice(1, 3).map((stackedToast, index) => {
          const depth = index + 1;
          const translateYClass = depth === 1 ? '-translate-y-2' : '-translate-y-3.5';
          const scaleClass = depth === 1 ? 'scale-[0.97]' : 'scale-[0.94]';
          const opacityClass = depth === 1 ? 'opacity-60' : 'opacity-35';
          const zIndex = 60 - depth * 10;

          return (
            <div
              key={stackedToast.id}
              style={{ zIndex }}
              className={`absolute top-0 w-full px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl shadow-md backdrop-blur-md bg-white/95 dark:bg-[#18181B]/95 border border-border/80 dark:border-white/10 pointer-events-none transition-all duration-300 ease-out ${translateYClass} ${scaleClass} ${opacityClass}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-primary/10 border border-primary/20 shrink-0 flex items-center justify-center">
                  <Layers className="w-3 h-3 text-primary dark:text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {stackedToast.tableNumber && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-primary/15 text-primary dark:text-purple-300 border border-primary/30">
                        {stackedToast.tableNumber.startsWith('T') || stackedToast.tableNumber.startsWith('L') ? stackedToast.tableNumber : `Table ${stackedToast.tableNumber}`}
                      </span>
                    )}
                    <h5 className="text-[11px] sm:text-xs font-bold text-zinc-900 dark:text-white leading-tight truncate">
                      {stackedToast.title || stackedToast.message}
                    </h5>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Active Live Notification Card */}
        <div className="relative w-full z-[70]">
          <StaffLiveNotificationCard
            key={activeToast.id}
            toast={activeToast}
            onDismiss={onDismiss}
            onActionClick={onActionClick}
            queueCount={toasts.length}
          />
        </div>
      </div>
    </aside>
  );
};

interface StaffLiveNotificationCardProps {
  toast: ToastMessage;
  onDismiss: () => void;
  onActionClick?: (toast: ToastMessage) => void;
  queueCount: number;
}

const StaffLiveNotificationCard: React.FC<StaffLiveNotificationCardProps> = ({
  toast,
  onDismiss,
  onActionClick,
  queueCount,
}) => {
  const [dragOffsetX, setDragOffsetX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSnappingBack, setIsSnappingBack] = useState<boolean>(false);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right'>('right');

  const pointerStartRef = useRef<{ x: number; y: number; startTime: number; pointerId?: number } | null>(null);
  const hasDraggedRef = useRef<boolean>(false);
  const dismissTimerRef = useRef<any>(null);
  const exitTimerRef = useRef<any>(null);
  const snapBackTimerRef = useRef<any>(null);
  const isDismissingRef = useRef<boolean>(false);
  const isHoveredRef = useRef<boolean>(false);
  const remainingTimeRef = useRef<number>(3000);
  const timerStartedAtRef = useRef<number>(Date.now());

  // Single Authoritative Dismissal Path (Guarded against double-dismiss or race conditions)
  const triggerDismiss = useCallback((dir: 'left' | 'right' = 'right') => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);

    setExitDirection(dir);
    setIsDragging(false);
    setIsSnappingBack(false);
    setIsExiting(true);

    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      onDismiss();
    }, 200); // 200ms animation completion before handoff
  }, [onDismiss]);

  // Visibility Timer: Runs for the exact remainingMs (or durationMs, default 3000ms)
  useEffect(() => {
    if (!toast || !toast.id) return;
    setIsExiting(false);
    setDragOffsetX(0);
    setIsDragging(false);
    setIsSnappingBack(false);
    isDismissingRef.current = false;
    hasDraggedRef.current = false;
    isHoveredRef.current = false;

    const timeoutDuration =
      Number(toast.remainingMs) > 0
        ? Number(toast.remainingMs)
        : Number(toast.durationMs) > 0
        ? Number(toast.durationMs)
        : 3000;

    remainingTimeRef.current = timeoutDuration;
    timerStartedAtRef.current = Date.now();

    dismissTimerRef.current = setTimeout(() => {
      if (!isHoveredRef.current) {
        triggerDismiss('right');
      }
    }, timeoutDuration);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement;
        const isTextInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (!isTextInput) {
          e.preventDefault();
          triggerDismiss('right');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
    };
  }, [toast?.id, toast?.remainingMs, triggerDismiss]);

  // Hover Pause Handlers (Desktop)
  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    const elapsed = Date.now() - timerStartedAtRef.current;
    remainingTimeRef.current = Math.max(1000, remainingTimeRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
    if (!isDismissingRef.current && !dismissTimerRef.current) {
      timerStartedAtRef.current = Date.now();
      dismissTimerRef.current = setTimeout(() => {
        triggerDismiss('right');
      }, remainingTimeRef.current);
    }
  };

  const formattedTableNumber = toast.tableNumber
    ? toast.tableNumber.startsWith('T') || toast.tableNumber.startsWith('L')
      ? toast.tableNumber
      : `Table ${toast.tableNumber}`
    : null;

  // Pointer / Touch Gestures with Pointer Capture (Touch devices only so mouse can select text freely)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    if (isDismissingRef.current || e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;

    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startTime: Date.now(),
      pointerId: e.pointerId,
    };
    hasDraggedRef.current = false;
    setIsSnappingBack(false);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    if (!pointerStartRef.current || isDismissingRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    if (!hasDraggedRef.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      hasDraggedRef.current = true;
      setIsDragging(true);
      try {
        e.currentTarget.setPointerCapture(pointerStartRef.current.pointerId!);
      } catch {}
    }

    if (hasDraggedRef.current) {
      setDragOffsetX(dx);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    if (!pointerStartRef.current || isDismissingRef.current) return;

    try {
      if (pointerStartRef.current.pointerId && e.currentTarget.hasPointerCapture(pointerStartRef.current.pointerId)) {
        e.currentTarget.releasePointerCapture(pointerStartRef.current.pointerId);
      }
    } catch {}

    const currentOffset = dragOffsetX;
    const wasDragged = hasDraggedRef.current;
    const gestureElapsed = Date.now() - pointerStartRef.current.startTime;
    pointerStartRef.current = null;

    if (wasDragged && currentOffset > 45) {
      triggerDismiss('right');
    } else if (wasDragged && currentOffset < -45) {
      triggerDismiss('left');
    } else {
      setIsDragging(false);
      setIsSnappingBack(true);
      setDragOffsetX(0);

      snapBackTimerRef.current = setTimeout(() => {
        setIsSnappingBack(false);
      }, 200);

      const currentRemaining = remainingTimeRef.current;
      const newRemaining = Math.max(800, currentRemaining - gestureElapsed);
      remainingTimeRef.current = newRemaining;
      timerStartedAtRef.current = Date.now();

      if (!isHoveredRef.current) {
        dismissTimerRef.current = setTimeout(() => {
          triggerDismiss('right');
        }, newRemaining);
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch') return;
    if (!pointerStartRef.current || isDismissingRef.current) return;
    try {
      if (pointerStartRef.current.pointerId && e.currentTarget.hasPointerCapture(pointerStartRef.current.pointerId)) {
        e.currentTarget.releasePointerCapture(pointerStartRef.current.pointerId);
      }
    } catch {}
    pointerStartRef.current = null;
    setIsDragging(false);
    setIsSnappingBack(true);
    setDragOffsetX(0);
    snapBackTimerRef.current = setTimeout(() => {
      setIsSnappingBack(false);
    }, 200);
  };

  const severity = toast.type || 'info';

  const renderIcon = () => {
    switch (severity) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'danger':
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'primary':
        return <Sparkles className="w-4 h-4 text-primary dark:text-purple-400" />;
      case 'info':
      default:
        return <BellRing className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
    }
  };

  const getIconPillBg = () => {
    switch (severity) {
      case 'success':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
      case 'warning':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400';
      case 'danger':
      case 'error':
        return 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400';
      case 'primary':
        return 'bg-primary/15 border-primary/30 text-primary dark:text-purple-400';
      case 'info':
      default:
        return 'bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-400';
    }
  };

  const getBorderAccent = () => {
    switch (severity) {
      case 'success':
        return 'border-emerald-500/40 shadow-emerald-500/10';
      case 'warning':
        return 'border-amber-500/40 shadow-amber-500/10';
      case 'danger':
      case 'error':
        return 'border-rose-500/40 shadow-rose-500/10';
      case 'primary':
        return 'border-primary/40 dark:border-primary/40 shadow-primary/10';
      case 'info':
      default:
        return 'border-sky-500/40 shadow-sky-500/10';
    }
  };

  const getDynamicStyle = (): React.CSSProperties => {
    if (isExiting) {
      const exitTranslateX = exitDirection === 'left' ? '-115%' : '115%';
      return {
        transform: `translate3d(${exitTranslateX}, 0, 0)`,
        opacity: 0,
        transition: 'transform 200ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 180ms ease-out',
        willChange: 'transform, opacity',
        pointerEvents: 'none',
      };
    }

    if (isDragging) {
      const opacity = Math.max(0.25, 1 - Math.abs(dragOffsetX) / 280);
      return {
        transform: `translate3d(${dragOffsetX}px, 0, 0)`,
        opacity,
        transition: 'none',
        willChange: 'transform, opacity',
      };
    }

    if (isSnappingBack) {
      return {
        transform: 'translate3d(0, 0, 0)',
        opacity: 1,
        transition: 'transform 200ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 200ms ease-out',
        willChange: 'transform, opacity',
      };
    }

    return {
      transform: 'translate3d(0, 0, 0)',
      opacity: 1,
      willChange: 'transform, opacity',
    };
  };

  return (
    <div
      role="status"
      aria-live="polite"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={getDynamicStyle()}
      onClick={() => {
        if (hasDraggedRef.current) return;
        if (typeof window !== 'undefined' && window.getSelection && (window.getSelection()?.toString() || '').trim().length > 0) {
          return;
        }
        if (toast.onAction) {
          toast.onAction();
        } else if (onActionClick) {
          onActionClick(toast);
        }
      }}
      className={`pointer-events-auto w-full rounded-2xl shadow-xl backdrop-blur-md bg-white/95 dark:bg-[#18181B]/95 text-zinc-900 dark:text-white border ${getBorderAccent()} select-text touch-pan-y transition-shadow ${
        !isExiting && !isDragging && !isSnappingBack
          ? 'animate-in fade-in slide-in-from-top-2 duration-200'
          : ''
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. WEB / DESKTOP VIEW (Laptop / Desktop Layout)                            */}
      {/* ========================================================================= */}
      <div className="hidden sm:flex items-center justify-between gap-3 px-4 py-3 min-h-[58px]">
        {/* Left Icon Pill */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border select-none ${getIconPillBg()}`}>
          {renderIcon()}
        </div>

        {/* Center Content (Title, Table Chip, Operational Text) - Fully Selectable by Mouse */}
        <div className="min-w-0 flex-1 select-text">
          <div className="flex items-center gap-2 flex-wrap">
            {toast.title && (
              <h5 className="text-[13px] font-bold text-zinc-900 dark:text-white tracking-tight leading-none select-text cursor-text">
                {toast.title}
              </h5>
            )}
            {formattedTableNumber && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-primary/10 text-primary dark:text-purple-300 border border-primary/25 tracking-wide select-text cursor-text">
                {formattedTableNumber}
              </span>
            )}
            {queueCount > 1 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-border/50 select-none">
                +{queueCount - 1} more
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium leading-snug mt-0.5 select-text cursor-text">
            {toast.message}
          </p>
          {toast.subMessage && (
            <p className="text-[11px] text-zinc-400 dark:text-zinc-400 leading-tight mt-0.5 select-text cursor-text">
              {toast.subMessage}
            </p>
          )}
        </div>

        {/* Right Actions & Dismiss Button */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1 select-none">
          {toast.actionLabel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (toast.onAction) toast.onAction();
                else if (onActionClick) onActionClick(toast);
                triggerDismiss('right');
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-sm transition-all cursor-pointer"
            >
              {toast.actionLabel}
            </button>
          )}

          {/* Dismiss Button */}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={(e) => {
              e.stopPropagation();
              triggerDismiss('right');
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MOBILE VIEW (Phone 320px–430px Layout)                                  */}
      {/* ========================================================================= */}
      <div className="flex sm:hidden items-center justify-between gap-2.5 px-3 py-2 min-h-[50px]">
        {/* Compact Icon */}
        <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border select-none ${getIconPillBg()}`}>
          {renderIcon()}
        </div>

        {/* Ultra-compact High Density Operational Info - Fully Selectable by Mouse */}
        <div className="min-w-0 flex-1 select-text">
          <div className="flex items-center gap-1.5">
            {formattedTableNumber && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-primary/15 text-primary dark:text-purple-300 border border-primary/30 select-text cursor-text">
                {formattedTableNumber}
              </span>
            )}
            {toast.title && (
              <h5 className="text-[11px] font-bold text-zinc-900 dark:text-white leading-tight truncate select-text cursor-text">
                {toast.title}
              </h5>
            )}
            {queueCount > 1 && (
              <span className="inline-flex items-center px-1 py-0.2 rounded text-[8px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 select-none">
                +{queueCount - 1}
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-700 dark:text-zinc-200 font-medium leading-snug select-text cursor-text">
            {toast.message}
          </p>
        </div>

        {/* Mobile Action / Dismiss Touch Area */}
        <div className="flex items-center gap-1 shrink-0 select-none">
          {toast.actionLabel && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (toast.onAction) toast.onAction();
                else if (onActionClick) onActionClick(toast);
                triggerDismiss('right');
              }}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary text-white hover:bg-primary-hover shadow-sm cursor-pointer"
            >
              {toast.actionLabel}
            </button>
          )}

          {/* Dismiss Button */}
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={(e) => {
              e.stopPropagation();
              triggerDismiss('right');
            }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
