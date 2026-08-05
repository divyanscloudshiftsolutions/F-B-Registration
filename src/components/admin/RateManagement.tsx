import React, { useState, useEffect } from 'react';
import { DollarSign, Edit3, RefreshCw, X, Clock, Wine } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

export const RateManagement: React.FC = () => {
  const { showToast } = useAuth();
  const { rates: rawRates, isLoading, refreshRates } = useData();
  const [editingRate, setEditingRate] = useState<any | null>(null);

  // Fetch rates on component mount
  useEffect(() => {
    refreshRates();
  }, []);

  // Form State
  const [ratePerPerson, setRatePerPerson] = useState('500');
  const [durationHours, setDurationHours] = useState('2');
  const [drinkAllowance, setDrinkAllowance] = useState('2');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rates = rawRates.filter((r: any) => (r.id !== 'vip_lounge' && r.name !== 'VIP Lounge' && r.placeType !== 'VIP_LOUNGE'));

  const openEditModal = (r: any) => {
    setEditingRate(r);
    setRatePerPerson(String(r.ratePerPerson || 500));
    setDurationHours(String(Math.round((r.baseTimeMinutes || 120) / 60)));
    setDrinkAllowance(String(r.redemptionsPerPerson || 2));
  };

  // Validation rules matching AdminPortal.tsx:L293-L300
  const priceVal = parseFloat(ratePerPerson);
  const isPriceValid = !isNaN(priceVal) && priceVal >= 0;
  const durationVal = parseFloat(durationHours);
  const isDurationValid = !isNaN(durationVal) && durationVal >= 0.5 && durationVal <= 24;
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
        baseTimeMinutes: Math.round(durationVal * 60),
        redemptionsPerPerson: drinksVal,
      });
      showToast(`Rate card for ${editingRate.name || editingRate.placeType} updated!`, 'success');
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
      <div className="flex items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-border-main">
        <div>
          <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">Place Type Rate Cards & Pricing Config</h3>
          <p className="text-xs text-text-muted">Configure cover charge rates, base hours, and drink allowances</p>
        </div>

        <button
          onClick={refreshRates}
          className="px-3.5 py-2 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-semibold text-text-muted border border-border-main flex items-center gap-1.5 transition-all"
        >
          <RefreshCw size={14} /> Refresh Rates
        </button>
      </div>

      {/* Rates Cards Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-text-muted text-sm">Loading rate cards...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rates.map(r => (
            <div key={r.id} className="glass-panel p-6 rounded-3xl border border-border-main space-y-4 relative overflow-hidden flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-text-main text-base">{r.name || r.placeType}</span>
                  <button
                    onClick={() => openEditModal(r)}
                    className="p-2 rounded-xl bg-[#8D6CE5]/15 hover:bg-[#8D6CE5]/25 text-[#8D6CE5] transition-all"
                    title="Edit Rate Card"
                  >
                    <Edit3 size={16} />
                  </button>
                </div>

                <p className="text-3xl font-black text-[#8D6CE5]">₹{r.ratePerPerson} <span className="text-xs font-normal text-text-muted">/ person</span></p>

                <div className="mt-4 pt-4 border-t border-border-main text-xs text-text-muted space-y-2">
                  <p className="flex items-center justify-between">
                    <span className="text-text-muted flex items-center gap-1.5"><Clock size={14} /> Base Duration:</span>
                    <span className="font-bold text-text-main">{Math.round((r.baseTimeMinutes || 120) / 60)} Hours</span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-text-muted flex items-center gap-1.5"><Wine size={14} /> Drink Allowance:</span>
                    <span className="font-bold dark:text-amber-300 text-amber-700">{r.redemptionsPerPerson || 2} Drinks / Guest</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* EDIT RATE CARD MODAL */}
      {editingRate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-main rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setEditingRate(null)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-main"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-[#8D6CE5] font-bold text-sm">
              <DollarSign size={18} /> Edit Rate Card ({editingRate.name || editingRate.placeType})
            </div>

            <form onSubmit={handleUpdateRate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Rate Per Person (₹)</label>
                <input
                  type="number"
                  value={ratePerPerson}
                  onChange={e => setRatePerPerson(e.target.value)}
                  min={0}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none focus:border-[#8D6CE5]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Base Duration (Hours: 0.5 - 24)</label>
                <input
                  type="number"
                  step="0.5"
                  value={durationHours}
                  onChange={e => setDurationHours(e.target.value)}
                  min={0.5}
                  max={24}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none focus:border-[#8D6CE5]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1">Drink Allowance Per Person (0 - 50)</label>
                <input
                  type="number"
                  value={drinkAllowance}
                  onChange={e => setDrinkAllowance(e.target.value)}
                  min={0}
                  max={50}
                  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main font-mono focus:outline-none focus:border-[#8D6CE5]"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRate(null)}
                  className="flex-1 py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-semibold text-text-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid}
                  className="flex-1 py-2.5 rounded-xl primary-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Update Pricing'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

