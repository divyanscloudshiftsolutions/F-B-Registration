import React, { useState } from 'react';
import { UserPlus, QrCode, CreditCard, CheckCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const CheckInPage: React.FC = () => {
  const { showToast } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [personsCount, setPersonsCount] = useState<number>(2);
  const [placeTypeId, setPlaceTypeId] = useState<string>('pt-general');
  const [deliveryMode, setDeliveryMode] = useState<'NFC_CARD' | 'EMAIL_QR'>('EMAIL_QR');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdToken, setCreatedToken] = useState<any | null>(null);

  const ratePerPerson = placeTypeId === 'pt-vip' ? 1500 : 800;
  const totalAmount = ratePerPerson * personsCount;

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !customerName) {
      showToast('Customer name and phone number are required.', 'warning');
      return;
    }

    setIsSubmitting(true);
    setCreatedToken(null);

    try {
      const res = await api.createCustomerCheckIn({
        phoneNumber: phoneNumber.trim(),
        customerName: customerName.trim(),
        email: email.trim() || undefined,
        personsCount,
        placeTypeId,
        deliveryMode,
      });

      if (res.success && res.token) {
        setCreatedToken(res.token);
        showToast(`Token #${res.token.tokenNumber} issued successfully!`, 'success');
        // Reset Form
        setPhoneNumber('');
        setCustomerName('');
        setEmail('');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to complete customer check-in.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="glass-panel p-8 rounded-3xl border border-white/10">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] flex items-center justify-center font-bold">
            <UserPlus size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Reception Check-In & Ticket Issuance</h3>
            <p className="text-xs text-gray-400">Register arriving guests and generate seating token passes</p>
          </div>
        </div>

        <form onSubmit={handleCheckIn} className="space-y-6">
          {/* Guest Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Customer Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37] transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Mobile Phone Number *</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-[#D4AF37] transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Email Address (Optional for QR)</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="rahul@example.com"
                className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37] transition-all"
              />
            </div>
          </div>

          {/* Persons Count & Place Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Number of Guests</label>
              <div className="flex items-center gap-2">
                {[1, 2, 4, 6, 8].map(count => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setPersonsCount(count)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                      personsCount === count
                        ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {count} {count === 1 ? 'Guest' : 'Guests'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Seating Category Rate</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPlaceTypeId('pt-general')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold text-left transition-all border ${
                    placeTypeId === 'pt-general'
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : 'bg-white/5 text-gray-400 border-white/10'
                  }`}
                >
                  <div>General Lounge</div>
                  <div className="text-[10px] text-gray-400">₹800 / person</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPlaceTypeId('pt-vip')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold text-left transition-all border ${
                    placeTypeId === 'pt-vip'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-white/5 text-gray-400 border-white/10'
                  }`}
                >
                  <div>VIP Lounge</div>
                  <div className="text-[10px] text-gray-400">₹1,500 / person</div>
                </button>
              </div>
            </div>
          </div>

          {/* Delivery Method Choice */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Pass Ticket Delivery Method</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setDeliveryMode('EMAIL_QR')}
                className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                  deliveryMode === 'EMAIL_QR'
                    ? 'bg-[#D4AF37]/15 text-white border-[#D4AF37]/50 shadow-lg shadow-[#D4AF37]/5'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-white/10 text-[#D4AF37]">
                  <QrCode size={24} />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Email Digital QR Pass</div>
                  <div className="text-xs text-gray-400">Dispatches QR code ticket to customer email</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryMode('NFC_CARD')}
                className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                  deliveryMode === 'NFC_CARD'
                    ? 'bg-emerald-500/15 text-white border-emerald-500/50 shadow-lg shadow-emerald-500/5'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-white/10 text-emerald-400">
                  <CreditCard size={24} />
                </div>
                <div>
                  <div className="font-bold text-sm text-white">Physical NFC Card</div>
                  <div className="text-xs text-gray-400">Pair reusable NFC smartcard tag</div>
                </div>
              </button>
            </div>
          </div>

          {/* Gate Payment Summary Bar */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Gate Entry Total Charge</p>
              <p className="text-2xl font-black text-[#D4AF37]">₹{totalAmount.toLocaleString()}</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 rounded-xl gold-gradient-btn flex items-center gap-2 text-sm uppercase tracking-wider disabled:opacity-50"
            >
              {isSubmitting ? 'Issuing Ticket...' : 'Confirm Payment & Issue Token'}
            </button>
          </div>
        </form>

        {/* Issued Token Card Preview */}
        {createdToken && (
          <div className="mt-8 p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-white space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle size={18} /> Token Pass Created Successfully
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-gray-400 block">Token Number</span>
                <span className="font-mono text-base font-bold text-[#D4AF37]">{createdToken.tokenNumber}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Customer</span>
                <span className="font-semibold">{createdToken.customer?.name}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Drink Redemptions</span>
                <span className="font-bold text-amber-300">{createdToken.totalRedemptionsAllowed} Drinks</span>
              </div>
              <div>
                <span className="text-gray-400 block">Delivery Method</span>
                <span className="font-mono uppercase">{createdToken.deliveryMode}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
