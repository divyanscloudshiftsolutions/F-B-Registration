import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { VenueConfig } from '../../types';
import { X, Receipt, Save, Loader2, Check, AlertCircle, Tag, ArrowRight } from 'lucide-react';

interface VenueBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
  onOpenGstManagement?: () => void;
}

export const VenueBillingModal: React.FC<VenueBillingModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  onOpenGstManagement,
}) => {
  const [config, setConfig] = useState<VenueConfig | null>(null);
  const [gstEnabled, setGstEnabled] = useState<boolean>(true);
  const [gstPercent, setGstPercent] = useState<number>(5);
  const [scEnabled, setScEnabled] = useState<boolean>(true);
  const [scPercent, setScPercent] = useState<number>(5);
  const [roundingEnabled, setRoundingEnabled] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadConfig();
  }, [isOpen]);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const cfg = await api.getBillingConfig();
      setConfig(cfg);
      setGstEnabled(cfg.gstEnabled ?? true);
      setGstPercent(Number(cfg.gstRate || 0.05) * 100);
      setScEnabled(cfg.scEnabled ?? true);
      setScPercent(Number(cfg.scRate || 0.05) * 100);
      setRoundingEnabled(cfg.roundingEnabled ?? true);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load billing config' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);
    try {
      const updated = await api.updateBillingConfig({
        gstEnabled,
        gstRate: Number(gstPercent) / 100,
        scEnabled,
        scRate: Number(scPercent) / 100,
        roundingEnabled,
      });
      setConfig(updated);
      setFeedback({ type: 'success', message: 'Venue billing configuration updated successfully!' });
      if (onConfigSaved) onConfigSaved();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save billing configuration' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="billing-modal-title"
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-[#D4AF37]/10 text-purple-600 dark:text-[#D4AF37] flex items-center justify-center border border-purple-200 dark:border-[#D4AF37]/30">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 id="billing-modal-title" className="text-base font-black text-zinc-900 dark:text-white">Venue Billing Configuration</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Manage taxes, service charges, and rounding</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400'
              }`}
            >
              {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {feedback.message}
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-zinc-400 text-xs">Loading configuration...</div>
          ) : (
            <>
              {/* GST Section */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-zinc-900 dark:text-white">Goods & Services Tax (GST)</span>
                    <p className="text-[11px] text-zinc-500">Apply GST to taxable food and beverage orders</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={gstEnabled}
                      onChange={(e) => setGstEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-purple-600 dark:peer-checked:bg-[#D4AF37]"></div>
                  </label>
                </div>

                {gstEnabled && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold">Fallback Default Rate (%):</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        required
                        value={gstPercent}
                        onChange={(e) => setGstPercent(Number(e.target.value))}
                        className="w-24 px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
                      />
                      <span className="text-xs text-zinc-400">%</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-750 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                          Product GST Tag Management
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          Bulk-assign menu items to 5% GST, 3% GST, or No GST
                        </span>
                      </div>
                      {onOpenGstManagement && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenGstManagement();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[#D4AF37] font-bold text-[11px] border border-zinc-200 dark:border-zinc-700 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Tag className="w-3.5 h-3.5" />
                          <span>GST Tags</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Service Charge Section */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-zinc-900 dark:text-white">Service Charge (SC)</span>
                    <p className="text-[11px] text-zinc-500">Venue hospitality service charge applied on subtotal</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scEnabled}
                      onChange={(e) => setScEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-purple-600 dark:peer-checked:bg-[#D4AF37]"></div>
                  </label>
                </div>

                {scEnabled && (
                  <div className="flex items-center gap-2 pt-1">
                    <label className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold">Charge Rate (%):</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      value={scPercent}
                      onChange={(e) => setScPercent(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-[#D4AF37]"
                    />
                    <span className="text-xs text-zinc-400">%</span>
                  </div>
                )}
              </div>

              {/* Rounding Section */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-black text-zinc-900 dark:text-white">Commercial Cash Rounding</span>
                    <p className="text-[11px] text-zinc-500">Round payable totals to nearest integer rupee</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roundingEnabled}
                      onChange={(e) => setRoundingEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-purple-600 dark:peer-checked:bg-[#D4AF37]"></div>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Footer actions */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white dark:bg-[#D4AF37] dark:hover:bg-[#c49f30] dark:text-zinc-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default VenueBillingModal;
