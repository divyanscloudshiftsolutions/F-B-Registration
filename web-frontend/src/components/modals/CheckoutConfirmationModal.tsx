import React, { useState, useEffect } from 'react';
import { X, LogOut } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface CheckoutConfirmationModalProps {
  isOpen: boolean;
  session: {
    tokenNumber: string;
    customerName: string;
    customerPhone: string;
    tableNumber: string;
  } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CheckoutConfirmationModal: React.FC<CheckoutConfirmationModalProps> = ({
  isOpen,
  session,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useAuth();
  const [closeReason, setCloseReason] = useState('Customer Vacated Early');
  const [closeReasonDetail, setCloseReasonDetail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !session) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        if (!isSubmitting) {
          e.preventDefault();
          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
          handleSubmit(fakeEvent);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, session, isSubmitting, closeReason, closeReasonDetail, onClose]);

  if (!isOpen || !session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const reasonDetail = closeReason === 'Other / Administrative Closure' ? closeReasonDetail : '';
      await api.closeToken(session.tokenNumber, closeReason, reasonDetail);
      showToast(`Session ${session.tokenNumber} checked out successfully.`, 'success');
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Failed to checkout session.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-4">
      <div className="bg-bg-surface border border-border-main rounded-3xl p-5 sm:p-6 w-full max-w-md space-y-4 relative text-text-main animate-fadeIn">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-main cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 text-text-main font-bold text-sm">
          <LogOut size={18} className="text-red-500" /> Checkout
        </div>

        <div className="space-y-2">
          <p className="text-xs text-text-muted">
            Are you sure you want to checkout this session:
          </p>
          <div className="p-3 bg-bg-primary rounded-xl space-y-1 text-xs text-left">
            <div>Customer: <span className="font-bold text-text-main">{session.customerName}</span></div>
            <div>Phone: <span className="font-mono font-bold text-text-main">{session.customerPhone || 'N/A'}</span></div>
            <div>Table: <span className="font-bold text-text-main">{session.tableNumber || 'N/A'}</span></div>
            <div>Session Token: <span className="font-mono font-bold text-text-main">{session.tokenNumber}</span></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-left">
            <label className="block text-xs font-semibold text-text-muted mb-1">Reason for Closure *</label>
            <select
              value={closeReason}
              onChange={e => setCloseReason(e.target.value)}
              className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary"
              required
            >
              <option value="Customer Vacated Early">Customer Vacated Early</option>
              <option value="Session Opened by Mistake">Session Opened by Mistake</option>
              <option value="Standard Guest Checkout">Standard Guest Checkout</option>
              <option value="Session Time Expired">Session Time Expired</option>
              <option value="Session Cancelled by Reception">Session Cancelled by Reception</option>
              <option value="Other / Administrative Closure">Other / Administrative Closure</option>
            </select>
          </div>

          {closeReason === 'Other / Administrative Closure' && (
            <div className="text-left">
              <label className="block text-xs font-semibold text-text-muted mb-1">Explanation *</label>
              <textarea
                value={closeReasonDetail}
                onChange={e => setCloseReasonDetail(e.target.value)}
                placeholder="Enter details about why this session is being checked out..."
                className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary min-h-[60px]"
                required
              />
            </div>
          )}

          <p className="text-[10px] text-text-muted text-left">
            This will checkout the active session and release the table back to "available" immediately.
          </p>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-xs font-semibold transition-all premium-btn-secondary"
            >
              No, Keep it
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl dark:bg-red-500/20 bg-red-500/10 dark:hover:bg-red-600 hover:bg-red-600 dark:text-red-200 text-red-700 dark:hover:text-white hover:text-white text-xs font-bold uppercase tracking-wider border border-red-500/30 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/20"
            >
              {isSubmitting ? 'Checking out...' : 'Yes, Checkout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
