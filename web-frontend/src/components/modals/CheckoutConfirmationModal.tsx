import React, { useState, useEffect } from 'react';
import { X, LogOut, Receipt, CheckCircle } from 'lucide-react';
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
  const { showToast, user } = useAuth();
  const [closeReason, setCloseReason] = useState('Standard Guest Checkout');
  const [closeReasonDetail, setCloseReasonDetail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'OTHER'>('CASH');
  const [billData, setBillData] = useState<any>(null);
  const [isLoadingBill, setIsLoadingBill] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !session) {
      setBillData(null);
      return;
    }

    setIsLoadingBill(true);
    api.calculateBill(session.tokenNumber)
      .then((res) => {
        if (res.success && res.bill) {
          setBillData(res.bill);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingBill(false));

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
      if (billData && billData.items && billData.items.length > 0) {
        // Settle authoritative bill
        await api.settleBill({
          tokenNumber: session.tokenNumber,
          paymentMethod,
          settledByStaffId: user?.id,
          settlementReference: `${paymentMethod}-${Date.now().toString().slice(-6)}`,
        });
      } else {
        // Standard session close
        const reasonDetail = closeReason === 'Other / Administrative Closure' ? closeReasonDetail : '';
        await api.closeToken(session.tokenNumber, closeReason, reasonDetail);
      }

      showToast(`Session ${session.tokenNumber} checked out and table released.`, 'success');
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'Failed to checkout session.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasOrders = billData && billData.items && billData.items.length > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-4">
      <div className="bg-bg-surface border border-border-main rounded-3xl p-5 sm:p-6 w-full max-w-md space-y-4 relative text-text-main animate-fadeIn max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-text-muted hover:text-text-main cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 text-text-main font-bold text-sm">
          <LogOut size={18} className="text-red-500" /> Checkout & Table Turnover
        </div>

        <div className="space-y-2">
          <div className="p-3 bg-bg-primary rounded-xl space-y-1 text-xs text-left">
            <div>Customer: <span className="font-bold text-text-main">{session.customerName}</span></div>
            <div>Phone: <span className="font-mono font-bold text-text-main">{session.customerPhone || 'N/A'}</span></div>
            <div>Table: <span className="font-bold text-text-main">{session.tableNumber || 'N/A'}</span></div>
            <div>Session Token: <span className="font-mono font-bold text-text-main">{session.tokenNumber}</span></div>
          </div>
        </div>

        {/* Live Bill Summary */}
        {isLoadingBill ? (
          <div className="p-3 bg-bg-primary/50 border border-border-main rounded-xl text-xs text-text-muted text-center animate-pulse">
            Calculating authoritative bill & redemption...
          </div>
        ) : hasOrders ? (
          <div className="p-3.5 bg-bg-primary border border-purple-500/30 rounded-xl space-y-2 text-xs text-left">
            <div className="flex items-center justify-between font-bold text-purple-600 dark:text-purple-400">
              <span className="flex items-center gap-1.5"><Receipt size={14} /> Consumption Bill</span>
              <span>{billData.items.length} Items</span>
            </div>
            <div className="space-y-1 text-[11px] text-text-muted border-t border-border-main pt-1.5">
              <div className="flex justify-between">
                <span>Gross Subtotal:</span>
                <span className="font-semibold text-text-main">₹{billData.grossSubtotal}</span>
              </div>
              <div className="flex justify-between">
                <span>Service Charge (5%):</span>
                <span>₹{billData.serviceChargeTotal}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (5%):</span>
                <span>₹{billData.taxTotal}</span>
              </div>
              {Number(billData.redemptionDeduction) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Drink Redemption Offset:</span>
                  <span>-₹{billData.redemptionDeduction}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-text-main border-t border-border-main pt-1.5 text-purple-600 dark:text-purple-400">
                <span>Amount to Collect:</span>
                <span>₹{billData.remainingPayable}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="pt-2 border-t border-border-main">
              <label className="block text-[11px] font-semibold text-text-muted mb-1">Payment Method *</label>
              <div className="grid grid-cols-3 gap-2">
                {(['CASH', 'UPI', 'CARD'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      paymentMethod === method
                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                        : 'bg-bg-primary text-text-muted border-border-main hover:text-text-main'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-bg-primary/50 border border-border-main rounded-xl text-xs text-text-muted text-center">
            No table consumption orders placed. Standard entry check-in session.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!hasOrders && (
            <div className="text-left">
              <label className="block text-xs font-semibold text-text-muted mb-1">Reason for Closure *</label>
              <select
                value={closeReason}
                onChange={e => setCloseReason(e.target.value)}
                className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary"
                required
              >
                <option value="Standard Guest Checkout">Standard Guest Checkout</option>
                <option value="Customer Vacated Early">Customer Vacated Early</option>
                <option value="Session Opened by Mistake">Session Opened by Mistake</option>
                <option value="Session Time Expired">Session Time Expired</option>
                <option value="Session Cancelled by Reception">Session Cancelled by Reception</option>
                <option value="Other / Administrative Closure">Other / Administrative Closure</option>
              </select>
            </div>
          )}

          {closeReason === 'Other / Administrative Closure' && !hasOrders && (
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
            This will collect remaining payable amount (if any), close the session, and release the table back to "available" immediately.
          </p>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-xs font-semibold transition-all premium-btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Processing...' : hasOrders ? `Collect ₹${billData?.remainingPayable} & Settle` : 'Confirm Checkout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
