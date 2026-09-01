import React, { useState } from 'react';
import { Droplet, Utensils, Trash2, HelpCircle, Receipt, HandHelping, MoreHorizontal, X, Clock, CheckCircle2 } from 'lucide-react';
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

const OPTIONS: { type: ServiceRequestType; label: string; icon: React.ReactNode; desc: string }[] = [
  { type: 'WATER', label: 'Drinking Water', desc: 'Glass or pitcher refill', icon: <Droplet className="w-5 h-5 text-sky-400" /> },
  { type: 'CUTLERY', label: 'Extra Cutlery', desc: 'Forks, spoons, knives', icon: <Utensils className="w-5 h-5 text-[#8D6CE5]" /> },
  { type: 'NAPKINS', label: 'Table Napkins', desc: 'Tissue / napkin refill', icon: <HandHelping className="w-5 h-5 text-amber-400" /> },
  { type: 'CLEAN_UP', label: 'Table Cleanup', desc: 'Spill or table wipe', icon: <Trash2 className="w-5 h-5 text-emerald-400" /> },
  { type: 'ASSISTANCE', label: 'Order Help', desc: 'Ask waiter to take order', icon: <HelpCircle className="w-5 h-5 text-indigo-400" /> },
  { type: 'BILL', label: 'Bill Help', desc: 'Request bill / split advice', icon: <Receipt className="w-5 h-5 text-purple-400" /> },
  { type: 'OTHER', label: 'Other Request', desc: 'Custom note to floor staff', icon: <MoreHorizontal className="w-5 h-5 text-zinc-400" /> },
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
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  if (!open) return null;

  const handleSubmit = async (type: ServiceRequestType, note?: string) => {
    if (submitting) return;
    setSubmitting(true);
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
        setFeedback(null);
        setShowOther(false);
        setOtherNote('');
        onClose();
      }, 1500);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to send service request.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in">
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl dark:bg-[#1A1829] bg-white border border-[#8D6CE5]/20 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#8D6CE5]/15 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-text-primary dark:text-white">Call Waiter</h3>
            <p className="text-xs text-text-muted mt-0.5">What can our floor team assist you with?</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#8D6CE5]/10 text-text-muted hover:text-text-primary transition-colors"
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
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Active Pending Requests */}
          {activeRequests.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider block mb-2">
                Active Requests
              </label>
              <div className="space-y-1.5">
                {activeRequests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-[#8D6CE5]/15 dark:bg-[#141225]/40 bg-zinc-50 text-xs"
                  >
                    <div className="flex items-center gap-2 text-text-primary dark:text-zinc-200">
                      <Clock className="w-3.5 h-3.5 text-[#8D6CE5]" />
                      <span className="font-semibold">{r.type}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold">
                      {r.status === 'NEW' ? 'Staff Notified' : 'Attending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Options Grid */}
          {!showOther ? (
            <div className="grid grid-cols-2 gap-2.5">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    if (opt.type === 'OTHER') {
                      setShowOther(true);
                    } else {
                      handleSubmit(opt.type);
                    }
                  }}
                  className="flex flex-col items-start gap-1.5 p-3 rounded-xl border border-[#8D6CE5]/15 hover:border-[#8D6CE5] dark:bg-[#141225]/30 bg-white hover:bg-[#8D6CE5]/5 transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#8D6CE5]/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {opt.icon}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-text-primary dark:text-white">{opt.label}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              ))}
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
                className="w-full text-xs p-3 rounded-xl border border-[#8D6CE5]/20 bg-transparent dark:text-white placeholder:text-text-muted/60 focus:outline-none focus:border-[#8D6CE5]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowOther(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#8D6CE5]/20 hover:bg-[#8D6CE5]/10 text-xs font-bold text-text-primary dark:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!otherNote.trim() || submitting}
                  onClick={() => handleSubmit('OTHER', otherNote.trim())}
                  className="flex-1 py-2.5 rounded-xl bg-[#8D6CE5] hover:bg-[#7B59D8] disabled:opacity-50 text-xs font-bold text-white transition-all shadow-sm"
                >
                  {submitting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
