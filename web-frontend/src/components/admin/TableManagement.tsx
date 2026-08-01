import React, { useState } from 'react';
import { Grid3X3, Plus, RefreshCw, X } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

export const TableManagement: React.FC = () => {
  const { showToast } = useAuth();
  const { tables, isLoading, refreshTables } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<'STANDING_BAR' | 'PREMIUM_LOUNGE'>('STANDING_BAR');

  // Form State
  const [tableNumber, setTableNumber] = useState('S-01');
  const [capacity, setCapacity] = useState('4');
  const [placeType, setPlaceType] = useState('STANDING_BAR');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTables = tables.filter(tb => {
    const p = (tb.placeTypeId || tb.categoryName || tb.tableNumber || '').toUpperCase();
    if (selectedPlace === 'STANDING_BAR') {
      return p.includes('STANDING') || p.includes('BAR') || tb.tableNumber.startsWith('S-');
    }
    return p.includes('PREMIUM') || p.includes('LOUNGE') || tb.tableNumber.startsWith('L-');
  });

  // Real-time validations matching AdminPortal.tsx:L269
  const isTableNumberValid = /^[SL]-\d{2,3}$/.test(tableNumber.trim().toUpperCase());
  const capVal = parseInt(capacity, 10);
  const isCapacityValid = !isNaN(capVal) && capVal >= 1 && capVal <= 100;
  const isFormValid = isTableNumberValid && isCapacityValid;

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    try {
      await api.createTable({
        tableNumber: tableNumber.trim().toUpperCase(),
        capacity: parseInt(capacity, 10),
        placeTypeId: placeType,
      });
      showToast(`Table ${tableNumber} created successfully!`, 'success');
      setIsModalOpen(false);
      refreshTables();
    } catch (err: any) {
      showToast(err.message || 'Failed to create table.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelease = async (tableId: string) => {
    try {
      await api.releaseTable(tableId);
      showToast('Table released successfully!', 'success');
      refreshTables();
    } catch (err: any) {
      showToast(err.message || 'Failed to release table.', 'danger');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar with Place Type Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedPlace('STANDING_BAR')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
              selectedPlace === 'STANDING_BAR'
                ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-lg font-black'
                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
            }`}
          >
            Standard Zone (Standing Bar)
          </button>

          <button
            onClick={() => setSelectedPlace('PREMIUM_LOUNGE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
              selectedPlace === 'PREMIUM_LOUNGE'
                ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-lg font-black'
                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
            }`}
          >
            Premium Zone (Lounge)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshTables}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 border border-white/10 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl gold-gradient-btn text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-lg"
          >
            <Plus size={16} /> Add New Table
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading floor tables...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTables.map(tb => (
            <div key={tb.id} className="p-5 rounded-2xl glass-panel border border-white/10 flex flex-col justify-between h-44">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[#D4AF37] font-black text-lg">{tb.tableNumber}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  tb.status === 'occupied' ? 'badge-active' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                }`}>
                  {tb.status}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-300 font-medium">Capacity: {tb.capacity} Guests</p>
                <p className="text-[11px] text-[#D4AF37] font-semibold mt-0.5 uppercase tracking-wider">
                  {tb.categoryName || 'Standard'}
                </p>
              </div>

              {tb.status === 'occupied' && (
                <button
                  onClick={() => handleRelease(tb.id)}
                  className="w-full py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/30 transition-all"
                >
                  Clear & Release Table
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ADD TABLE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121620] border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 text-[#D4AF37] font-bold text-sm">
              <Grid3X3 size={18} /> Add New Seating Table
            </div>

            <form onSubmit={handleCreateTable} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Table Number <span className="text-gray-500">(Must match pattern S-01, L-01)</span>
                </label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. S-01"
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Guest Seat Capacity (1 - 100)</label>
                <input
                  type="number"
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                  min={1}
                  max={100}
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Place Type Category</label>
                <select
                  value={placeType}
                  onChange={e => setPlaceType(e.target.value)}
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="STANDING_BAR">Standing Bar Zone</option>
                  <option value="PREMIUM_LOUNGE">Premium Lounge Zone</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isFormValid}
                  className="flex-1 py-2.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Confirm Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
