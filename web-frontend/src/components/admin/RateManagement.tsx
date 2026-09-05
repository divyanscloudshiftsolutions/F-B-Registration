import React, { useState, useEffect } from 'react';
import { DollarSign, Edit3, X, Clock, Wine } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

export const RateManagement: React.FC = () => {
  const { user, showToast } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const { rates: rawRates, isLoading: contextLoading, refreshRates } = useData();
  const [localLoading, setLocalLoading] = useState(true);
  const [editingRate, setEditingRate] = useState<any | null>(null);

  // Fetch rates on component mount and synchronize loading state
  useEffect(() => {
    let isMounted = true;
    setLocalLoading(true);
    refreshRates()
      .finally(() => {
        if (isMounted) setLocalLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Form State
  const [ratePerPerson, setRatePerPerson] = useState('500');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [drinkAllowance, setDrinkAllowance] = useState('2');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out VIP lounge as per business rules
  const rates = rawRates.filter((r: any) => (r.id !== 'vip_lounge' && r.name !== 'VIP Lounge' && r.placeType !== 'VIP_LOUNGE'));
  const isLoading = contextLoading || (localLoading && (!rawRates || rawRates.length === 0));

  const openEditModal = (r: any) => {
    setEditingRate(r);
    setRatePerPerson(String(r.ratePerPerson || 500));
    setDurationMinutes(String(r.baseTimeMinutes || 30));
    setDrinkAllowance(String(r.redemptionsPerPerson || 2));
  };

  // Keyboard accessibility: Escape closes drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingRate) {
        setEditingRate(null);
      }
    };
    if (editingRate) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingRate]);

  // Display Formatting Helpers
  const formatPlaceTypeName = (rawName?: string) => {
    if (!rawName) return 'Rate Card';
    return rawName
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, char => char.toUpperCase());
  };

  const formatDuration = (minutes: number) => {
    const mins = minutes || 30;
    if (mins % 60 === 0) {
      const hours = mins / 60;
      return `${hours} ${hours === 1 ? 'Hour' : 'Hours'} (${mins} min)`;
    }
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours > 0) {
      return `${hours}h ${remMins}m (${mins} min)`;
    }
    return `${mins} Minutes`;
  };

  const formatCurrency = (val: number | string) => {
    const num = Number(val) || 0;
    return num.toLocaleString('en-IN');
  };

  // Validation rules matching AdminPortal.tsx:L293-L300
  const priceVal = parseFloat(ratePerPerson);
  const isPriceValid = !isNaN(priceVal) && priceVal >= 0;
  const durationVal = parseInt(durationMinutes, 10);
  const isDurationValid = !isNaN(durationVal) && durationVal >= 30 && durationVal <= 1440;
  const drinksVal = parseInt(drinkAllowance, 10);
  const isDrinksValid = !isNaN(drinksVal) && drinksVal >= 0 && drinksVal <= 50;
  const isFormValid = isPriceValid && isDurationValid && isDrinksValid;

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRate || !isFormValid) return;

    setIsSubmitting(true);
    try {
      await api.updateRateCard(editingRate.id, {
        ratePerPerson: priceVal,
        baseTimeMinutes: durationVal,
        redemptionsPerPerson: drinksVal,
      });
      showToast(`Rate card for ${formatPlaceTypeName(editingRate.name || editingRate.placeType)} updated!`, 'success');
      setEditingRate(null);
      refreshRates();
    } catch (err: any) {
      showToast(err.message || 'Failed to update rate card.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border-main pb-4 mb-6">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-text-main uppercase tracking-wider truncate">
            Place Type Rate Cards & Pricing Config
          </h2>
          <p className="text-xs text-text-muted truncate">
            Configure cover charge rates, base hours, and drink allowances
          </p>
        </div>
      </div>

      {/* Rates Cards Grid / Loading / Empty States */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl">
          {[1, 2].map(idx => (
            <div
              key={idx}
              className="glass-panel dark:bg-[#111114] bg-white p-5 sm:p-6 rounded-2xl border border-border-main dark:border-white/10 space-y-4 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 w-32 bg-zinc-200 dark:bg-white/10 rounded-md" />
                <div className="w-10 h-10 bg-zinc-200 dark:bg-white/10 rounded-xl" />
              </div>
              <div className="h-8 w-28 bg-zinc-200 dark:bg-white/10 rounded-md mt-2" />
              <div className="pt-4 border-t border-border-main dark:border-white/10 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="h-4 w-24 bg-zinc-200 dark:bg-white/10 rounded" />
                  <div className="h-4 w-28 bg-zinc-200 dark:bg-white/10 rounded" />
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-4 w-24 bg-zinc-200 dark:bg-white/10 rounded" />
                  <div className="h-4 w-28 bg-zinc-200 dark:bg-white/10 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : rates.length === 0 ? (
        <div className="glass-panel dark:bg-[#111114] bg-white rounded-2xl p-8 sm:p-12 text-center border border-border-main dark:border-white/10 space-y-3 max-w-4xl">
          <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-white/5 border border-border-main dark:border-white/10 flex items-center justify-center mx-auto text-text-muted">
            <DollarSign size={24} className="opacity-60" />
          </div>
          <h4 className="text-sm font-bold text-text-main">No Rate Cards Configured</h4>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Rate cards for place types have not been set up or are currently unavailable in the database.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl">
          {rates.map(r => (
            <div
              key={r.id}
              className="glass-panel dark:bg-[#111114] bg-white p-5 sm:p-6 rounded-2xl border border-border-main dark:border-white/10 space-y-3 sm:space-y-4 relative overflow-hidden flex flex-col justify-between hover:border-zinc-300 dark:hover:border-white/20 transition-all shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-text-main text-base">
                      {formatPlaceTypeName(r.name || r.placeType)}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                  {isAdmin ? (
                    <button
                      onClick={() => openEditModal(r)}
                      className="w-10 h-10 rounded-xl transition-all premium-btn-secondary flex items-center justify-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-[#D4AF37]"
                      title={`Edit ${formatPlaceTypeName(r.name || r.placeType)} rate card`}
                      aria-label={`Edit ${formatPlaceTypeName(r.name || r.placeType)} rate card`}
                    >
                      <Edit3 size={14} />
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-text-muted italic px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-white/5 border border-border-main dark:border-white/10">
                      View Only
                    </span>
                  )}
                </div>

                <p className="text-3xl font-black dark:text-[#D4AF37] text-primary">
                  ₹{formatCurrency(r.ratePerPerson)}{' '}
                  <span className="text-xs font-normal text-text-muted">/ person</span>
                </p>

                <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border-main dark:border-white/10 text-xs text-text-muted space-y-2">
                  <p className="flex items-center justify-between">
                    <span className="text-text-muted flex items-center gap-1.5">
                      <Clock size={14} className="opacity-70" /> Base Duration:
                    </span>
                    <span className="font-bold text-text-main">{formatDuration(r.baseTimeMinutes)}</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-text-muted flex items-center gap-1.5">
                      <Wine size={14} className="opacity-70" /> Drink Allowance:
                    </span>
                    <span className="font-bold dark:text-amber-300 text-amber-700">
                      {r.redemptionsPerPerson || 2} Drinks / Guest
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT RATE CARD MODAL / DRAWER */}
      {editingRate && (
        <div
          onClick={() => setEditingRate(null)}
          className="fixed inset-0 z-50 bg-black/60 dark:bg-black/70 backdrop-blur-xs flex items-center justify-end p-0 cursor-pointer animate-fadeIn"
          role="presentation"
        >
          <div
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-rate-card-title"
            className="bg-white dark:bg-[#111114] border-y-0 border-r-0 border-l border-border-main dark:border-white/10 p-5 sm:p-6 w-full md:w-[400px] space-y-4 relative text-text-main h-[100dvh] flex flex-col cursor-default shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 dark:pb-5 border-b border-border-main dark:border-white/10 shrink-0">
              <div className="flex items-center gap-2 text-text-main font-bold text-sm min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-[#D4AF37]/10 flex items-center justify-center text-primary dark:text-[#D4AF37] shrink-0">
                  <DollarSign size={16} />
                </div>
                <span id="edit-rate-card-title" className="truncate">
                  Edit Rate Card ({formatPlaceTypeName(editingRate.name || editingRate.placeType)})
                </span>
              </div>
              <button
                onClick={() => setEditingRate(null)}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 dark:bg-white/5 dark:hover:bg-white/10 text-text-muted hover:text-text-main transition-colors shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-[#D4AF37]"
                aria-label="Close edit drawer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body Form */}
            <div className="flex-1 overflow-y-auto py-2 space-y-5 no-scrollbar">
              <form onSubmit={handleUpdateRate} className="space-y-4">
                {/* Rate Per Person */}
                <div>
                  <label htmlFor="rate-per-person" className="block text-xs font-semibold text-text-muted mb-1.5">
                    Rate Per Person (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xs font-bold pointer-events-none select-none">
                      ₹
                    </span>
                    <input
                      id="rate-per-person"
                      type="number"
                      value={ratePerPerson}
                      onChange={e => setRatePerPerson(e.target.value)}
                      min={0}
                      className={`w-full bg-bg-primary border rounded-xl pl-8 pr-3 py-2.5 text-xs text-text-main font-mono focus:outline-none focus:ring-2 transition-all ${
                        !isPriceValid && ratePerPerson !== ''
                          ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                          : 'border-border-main dark:border-white/10 dark:focus:border-[#D4AF37] focus:border-primary dark:focus:ring-[#D4AF37]/20 focus:ring-primary/20'
                      }`}
                      required
                    />
                  </div>
                  {!isPriceValid && ratePerPerson !== '' && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-medium">
                      Rate must be 0 or greater.
                    </p>
                  )}
                </div>

                {/* Base Duration */}
                <div>
                  <label htmlFor="duration-minutes" className="block text-xs font-semibold text-text-muted mb-1.5">
                    Base Duration (Minutes: 30 – 1440)
                  </label>
                  <input
                    id="duration-minutes"
                    type="number"
                    value={durationMinutes}
                    onChange={e => setDurationMinutes(e.target.value)}
                    min={30}
                    max={1440}
                    className={`w-full bg-bg-primary border rounded-xl px-3 py-2.5 text-xs text-text-main font-mono focus:outline-none focus:ring-2 transition-all ${
                      !isDurationValid && durationMinutes !== ''
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-border-main dark:border-white/10 dark:focus:border-[#D4AF37] focus:border-primary dark:focus:ring-[#D4AF37]/20 focus:ring-primary/20'
                    }`}
                    required
                  />
                  {!isDurationValid && durationMinutes !== '' ? (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-medium">
                      Duration must be between 30 and 1,440 minutes (24 hours).
                    </p>
                  ) : (
                    <p className="text-[11px] text-text-muted mt-1">
                      Formatted: <span className="font-semibold text-text-main">{formatDuration(durationVal)}</span>
                    </p>
                  )}
                </div>

                {/* Drink Allowance */}
                <div>
                  <label htmlFor="drink-allowance" className="block text-xs font-semibold text-text-muted mb-1.5">
                    Drink Allowance Per Person (0 – 50)
                  </label>
                  <input
                    id="drink-allowance"
                    type="number"
                    value={drinkAllowance}
                    onChange={e => setDrinkAllowance(e.target.value)}
                    min={0}
                    max={50}
                    className={`w-full bg-bg-primary border rounded-xl px-3 py-2.5 text-xs text-text-main font-mono focus:outline-none focus:ring-2 transition-all ${
                      !isDrinksValid && drinkAllowance !== ''
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-border-main dark:border-white/10 dark:focus:border-[#D4AF37] focus:border-primary dark:focus:ring-[#D4AF37]/20 focus:ring-primary/20'
                    }`}
                    required
                  />
                  {!isDrinksValid && drinkAllowance !== '' && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-medium">
                      Drink allowance must be between 0 and 50 drinks per guest.
                    </p>
                  )}
                </div>

                {/* Drawer Action Footer */}
                <div className="flex flex-row gap-3 pt-5 border-t border-border-main dark:border-white/10 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingRate(null)}
                    className="flex-1 py-2.5 rounded-xl bg-transparent border border-border-main dark:border-white/10 text-xs font-bold text-text-muted hover:text-text-main transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !isFormValid}
                    className="flex-1 py-2.5 rounded-xl primary-btn text-white dark:text-black text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all shadow-sm"
                  >
                    {isSubmitting ? 'Saving...' : (
                      <>
                        <span className="hidden sm:inline">Update Pricing</span>
                        <span className="sm:hidden">Update</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
