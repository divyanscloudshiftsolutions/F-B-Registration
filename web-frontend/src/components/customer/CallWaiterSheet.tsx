import React, { useState, useEffect } from 'react';
import {
  Droplet,
  Utensils,
  Trash2,
  HelpCircle,
  Receipt,
  HandHelping,
  MoreHorizontal,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { api } from '../../services/api';

export type ServiceRequestType =
  | 'WATER'
  | 'CUTLERY'
  | 'NAPKINS'
  | 'CLEAN_UP'
  | 'ASSISTANCE'
  | 'BILL'
  | 'OTHER';

interface ServiceRequestItem {
  id: string;
  type: string;
  status: 'NEW' | 'ACKNOWLEDGED' | 'COMPLETED' | string;
  createdAt: string;
  assignedStaffName?: string;
}

interface CallWaiterSheetProps {
  open: boolean;
  onClose: () => void;
  tokenNumber: string;
  tableId?: string;
  activeRequests?: ServiceRequestItem[];
  onRequestSubmitted?: (req: any) => void;
}

const OPTIONS: {
  type: ServiceRequestType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: 'WATER', label: 'Drinking Water', desc: 'Glass or pitcher refill', icon: Droplet },
  { type: 'CUTLERY', label: 'Extra Cutlery', desc: 'Forks, spoons, knives', icon: Utensils },
  { type: 'NAPKINS', label: 'Table Napkins', desc: 'Tissue / napkin refill', icon: HandHelping },
  { type: 'CLEAN_UP', label: 'Table Cleanup', desc: 'Spill or table wipe', icon: Trash2 },
  { type: 'ASSISTANCE', label: 'Order Help', desc: 'Ask waiter to take order', icon: HelpCircle },
  { type: 'BILL', label: 'Bill Help', desc: 'Request bill / split advice', icon: Receipt },
  { type: 'OTHER', label: 'Other Request', desc: 'Custom note to floor staff', icon: MoreHorizontal },
];

export const CallWaiterSheet: React.FC<CallWaiterSheetProps> = ({
  open,
  onClose,
  tokenNumber,
  tableId,
  activeRequests = [],
  onRequestSubmitted,
}) => {
  const [showOther, setShowOther] = useState(false);
  const [otherNote, setOtherNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittingType, setSubmittingType] = useState<ServiceRequestType | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  const handleClose = () => {
    setShowOther(false);
    setOtherNote('');
    setFeedback(null);
    setSubmittingType(null);
    onClose();
  };

  // Close on Escape key press
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (type: ServiceRequestType, note?: string) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmittingType(type);
    setFeedback(null);

    try {
      const created = await api.createServiceRequest({
        tokenNumber,
        tableId,
        type,
        note,
      });

      if (created.isDuplicate) {
        setFeedback({
          type: 'info',
          message: created.message || `Your request for ${type} is already registered with our staff.`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Request for ${type} sent! A staff member has been notified.`,
        });
        if (onRequestSubmitted) onRequestSubmitted(created);
      }

      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to send service request.',
      });
    } finally {
      setSubmitting(false);
      setSubmittingType(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-waiter-title"
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md md:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white dark:bg-[#18181B] border border-border/80 dark:border-white/10 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b border-border/80 dark:border-white/10 flex items-center justify-between">
          <div>
            <h3 id="call-waiter-title" className="font-bold text-base text-text-primary dark:text-white">
              Call Waiter
            </h3>
            <p className="text-xs text-text-muted mt-0.5">What can our floor team assist you with?</p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close call waiter dialog"
            className="min-h-[44px] min-w-[44px] rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-text-muted hover:text-text-primary dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : feedback.type === 'info'
                  ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : feedback.type === 'info' ? (
                <Clock className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Active Pending Requests */}
          {activeRequests.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-2">
                Active Requests ({activeRequests.length})
              </label>
              <div className="space-y-1.5" aria-live="polite">
                {activeRequests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border/80 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2 text-text-primary dark:text-zinc-200">
                      <Clock className="w-3.5 h-3.5 text-primary dark:text-[#D4AF37]" />
                      <span className="font-semibold">{r.type.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20">
                      {r.status === 'NEW' ? 'Staff Notified' : r.status === 'ACKNOWLEDGED' ? 'Attending' : r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Options Grid */}
          {!showOther ? (
            <div className="grid grid-cols-2 gap-2.5">
              {OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSubmittingThis = submittingType === opt.type;

                if (opt.type === 'OTHER') {
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      disabled={submitting}
                      onClick={() => setShowOther(true)}
                      className="col-span-2 flex items-center justify-between p-3 rounded-xl border border-border/80 dark:border-white/10 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 bg-white dark:bg-white/5 hover:bg-primary/5 dark:hover:bg-[#D4AF37]/10 transition-all text-left group cursor-pointer disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-[#D4AF37]/15 flex items-center justify-center text-primary dark:text-[#D4AF37] group-hover:scale-105 transition-transform">
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-text-primary dark:text-white">{opt.label}</div>
                          <div className="text-[10px] text-text-muted dark:text-zinc-400 mt-0.5">{opt.desc}</div>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-primary dark:text-[#D4AF37] px-2 py-1 rounded-lg bg-primary/10 dark:bg-[#D4AF37]/15">
                        Add Note
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={opt.type}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmit(opt.type)}
                    className="flex flex-col items-start gap-1.5 p-3 rounded-xl border border-border/80 dark:border-white/10 hover:border-primary/50 dark:hover:border-[#D4AF37]/50 bg-white dark:bg-white/5 hover:bg-primary/5 dark:hover:bg-[#D4AF37]/10 transition-all text-left group cursor-pointer disabled:opacity-60"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-[#D4AF37]/15 flex items-center justify-center text-primary dark:text-[#D4AF37] group-hover:scale-105 transition-transform">
                      {isSubmittingThis ? (
                        <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      ) : (
                        <Icon className="w-4.5 h-4.5" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-text-primary dark:text-white">{opt.label}</div>
                      <div className="text-[10px] text-text-muted dark:text-zinc-400 mt-0.5">{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-text-primary dark:text-white block">
                Tell us what you need
              </label>
              <textarea
                value={otherNote}
                onChange={(e) => setOtherNote(e.target.value)}
                placeholder="e.g. Please dim the lights, high chair for toddler..."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-border/80 dark:border-white/10 bg-transparent text-text-primary dark:text-white placeholder:text-text-muted/60 focus:outline-none focus:border-primary dark:focus:border-[#D4AF37]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowOther(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border/80 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-xs font-bold text-text-primary dark:text-white transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!otherNote.trim() || submitting}
                  onClick={() => handleSubmit('OTHER', otherNote.trim())}
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-black disabled:opacity-50 text-xs font-bold text-white transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submitting ? 'Sending...' : 'Send Request'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

