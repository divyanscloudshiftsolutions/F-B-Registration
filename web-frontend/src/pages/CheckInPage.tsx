import React, { useState, useEffect } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  Users, 
  CreditCard, 
  QrCode, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Grid3X3,
  Receipt,
  RotateCcw
} from 'lucide-react';
import { api } from '../services/api';
import type { Table, Token } from '../types';
import { useAuth } from '../context/AuthContext';

export const CheckInPage: React.FC = () => {
  const { showToast } = useAuth();
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);

  // Stage 1: Customer Info State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [personsCount, setPersonsCount] = useState(2);

  // Stage 2: Seating & Rate Selection State
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedPlaceTypeId, setSelectedPlaceTypeId] = useState('standing_bar');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'NFC_CARD' | 'EMAIL_QR'>('EMAIL_QR');

  // Stage 3: Payment Details State
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI'>('CASH');
  const [cardUid, setCardUid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stage 4: Check-in Output Ticket Result
  const [createdToken, setCreatedToken] = useState<Token | null>(null);

  // Rates definition (matches backend place type config)
  const placeCategories = [
    { id: 'standing_bar', name: 'Standing Bar', ratePerPerson: 500, drinks: 2, duration: '2 Hours' },
    { id: 'premium_lounge', name: 'Premium Lounge', ratePerPerson: 1000, drinks: 4, duration: '3 Hours' },
  ];

  const currentRate = placeCategories.find(r => r.id === selectedPlaceTypeId) || placeCategories[0];
  const calculatedTotal = personsCount * currentRate.ratePerPerson;
  const totalAllowedDrinks = personsCount * currentRate.drinks;

  const loadData = async () => {
    try {
      const [tableData, mode] = await Promise.all([
        api.getTables(),
        api.getDeliveryMode(),
      ]);
      setTables(tableData);
      if (mode === 'NFC_CARD' || mode === 'EMAIL_QR') {
        setDeliveryMode(mode);
      }
    } catch (err: any) {
      console.warn('CheckIn data load error:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStage1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.trim().length < 8) {
      showToast('Please enter a valid phone number.', 'danger');
      return;
    }
    if (!customerName || customerName.trim().length < 2) {
      showToast('Please enter customer full name.', 'danger');
      return;
    }
    setStage(2);
  };

  const handleStage2Next = () => {
    setStage(3);
  };

  const handleFinalCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await api.createCustomerCheckIn({
        phoneNumber: phoneNumber.trim(),
        customerName: customerName.trim(),
        email: email.trim() || undefined,
        personsCount,
        placeTypeId: selectedPlaceTypeId,
        deliveryMode,
        cardUid: deliveryMode === 'NFC_CARD' ? (cardUid.trim() || `NFC-${Date.now().toString(36)}`) : undefined,
      });

      if (res.success && res.token) {
        setCreatedToken(res.token);
        if (selectedTableId) {
          await api.assignTable(selectedTableId, res.token.id).catch(() => {});
        }
        showToast(`Guest ${customerName} checked in successfully! Token: ${res.token.tokenNumber}`, 'success');
        setStage(4);
      } else {
        showToast('Check-in failed. Please try again.', 'danger');
      }
    } catch (err: any) {
      showToast(err.message || 'Check-in failed.', 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetWizard = () => {
    setStage(1);
    setPhoneNumber('');
    setCustomerName('');
    setEmail('');
    setPersonsCount(2);
    setSelectedTableId('');
    setCardUid('');
    setCreatedToken(null);
  };

  const availableTablesForSelectedType = tables.filter(t => t.status === 'available');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Wizard Progress Header Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between">
        {[
          { num: 1, label: '1. Customer Info' },
          { num: 2, label: '2. Seating & Plan' },
          { num: 3, label: '3. Payment & Mode' },
          { num: 4, label: '4. Pass Generated' },
        ].map(step => (
          <div 
            key={step.num} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              stage === step.num 
                ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20 font-black' 
                : stage > step.num 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                : 'text-gray-500 bg-white/5'
            }`}
          >
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-black/20 font-mono">
              {stage > step.num ? '✓' : step.num}
            </span>
            <span>{step.label}</span>
          </div>
        ))}
      </div>

      {/* STAGE 1: CUSTOMER DETAILS ENTRY */}
      {stage === 1 && (
        <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-white/10">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
              <User size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Stage 1: Guest Information & Headcount</h3>
              <p className="text-xs text-gray-400">Enter customer contact details and headcount</p>
            </div>
          </div>

          <form onSubmit={handleStage1Next} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Phone size={14} className="text-[#D4AF37]" /> Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <User size={14} className="text-[#D4AF37]" /> Customer Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Mail size={14} className="text-[#D4AF37]" /> Email Address (Optional for QR delivery)
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. rahul@example.com"
                  className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                  <Users size={14} className="text-[#D4AF37]" /> Guest Headcount (Persons)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5, 6, 8, 10].map(count => (
                    <button
                      type="button"
                      key={count}
                      onClick={() => setPersonsCount(count)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                        personsCount === count
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-black'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="px-8 py-3.5 rounded-xl gold-gradient-btn flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-xl"
              >
                <span>Proceed to Seating Plan</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STAGE 2: SEATING PLACE TYPE & TABLE SELECTION */}
      {stage === 2 && (
        <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                <Grid3X3 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Stage 2: Select Rate Plan & Seating Table</h3>
                <p className="text-xs text-gray-400">Choose seating zone and allocate available table</p>
              </div>
            </div>

            <button
              onClick={() => setStage(1)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 flex items-center gap-1 border border-white/10"
            >
              <ChevronLeft size={14} /> Back
            </button>
          </div>

          {/* Rate Category Selector Cards */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">1. Select Rate Category</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {placeCategories.map(rc => {
                const isSel = selectedPlaceTypeId === rc.id;
                return (
                  <div
                    key={rc.id}
                    onClick={() => setSelectedPlaceTypeId(rc.id)}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      isSel 
                        ? 'bg-[#D4AF37]/15 border-[#D4AF37] shadow-xl shadow-[#D4AF37]/10' 
                        : 'bg-[#141A25] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white text-sm">{rc.name}</span>
                      {isSel && <CheckCircle2 size={16} className="text-[#D4AF37]" />}
                    </div>
                    <p className="text-2xl font-black text-[#D4AF37]">₹{rc.ratePerPerson} <span className="text-xs text-gray-400 font-normal">/ person</span></p>
                    <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-gray-400 space-y-1">
                      <p>🥤 Drinks Allowed: <span className="text-amber-300 font-bold">{rc.drinks * personsCount} Drinks Total</span></p>
                      <p>⏱ Duration: {rc.duration}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Allocation Options */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">2. Assign Available Table (Optional)</label>
            {availableTablesForSelectedType.length === 0 ? (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 text-center">
                No specific tables available. Customer will be checked in as Standing/Floating guest.
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTableId('')}
                  className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all ${
                    selectedTableId === '' 
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37]' 
                      : 'bg-white/5 text-gray-300 border-white/10'
                  }`}
                >
                  Unassigned
                </button>
                {availableTablesForSelectedType.map(tb => (
                  <button
                    type="button"
                    key={tb.id}
                    onClick={() => setSelectedTableId(tb.id)}
                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all ${
                      selectedTableId === tb.id 
                        ? 'bg-[#D4AF37] text-black border-[#D4AF37]' 
                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Table {tb.tableNumber}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-between items-center">
            <button
              onClick={() => setStage(1)}
              className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 flex items-center gap-1 border border-white/10"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={handleStage2Next}
              className="px-8 py-3.5 rounded-xl gold-gradient-btn flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-xl"
            >
              <span>Proceed to Payment</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3: PAYMENT & DELIVERY MODE SELECTION */}
      {stage === 3 && (
        <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                <Receipt size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Stage 3: Review Rate & Select Pass Delivery</h3>
                <p className="text-xs text-gray-400">Final bill review and ticket issuance mode</p>
              </div>
            </div>

            <button
              onClick={() => setStage(2)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 flex items-center gap-1 border border-white/10"
            >
              <ChevronLeft size={14} /> Back
            </button>
          </div>

          {/* Pricing Summary Box */}
          <div className="p-5 rounded-2xl bg-[#141A25] border border-white/10 space-y-3">
            <h4 className="text-xs font-bold uppercase text-[#D4AF37] tracking-wider">Billing Summary</h4>
            <div className="flex justify-between text-xs text-gray-300">
              <span>Customer:</span>
              <span className="font-bold text-white">{customerName} ({phoneNumber})</span>
            </div>
            <div className="flex justify-between text-xs text-gray-300">
              <span>Category & Headcount:</span>
              <span className="font-semibold text-white">{currentRate.name} × {personsCount} Guests</span>
            </div>
            <div className="flex justify-between text-xs text-gray-300">
              <span>Total Drink Quota:</span>
              <span className="font-semibold text-amber-300">{totalAllowedDrinks} Drinks Included</span>
            </div>
            <div className="pt-3 border-t border-white/10 flex justify-between items-center">
              <span className="text-sm font-bold text-white">Total Amount Due:</span>
              <span className="text-2xl font-black text-[#D4AF37]">₹{calculatedTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Delivery Mode Choice */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">Select Ticket Delivery Mode</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setDeliveryMode('EMAIL_QR')}
                className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                  deliveryMode === 'EMAIL_QR'
                    ? 'bg-[#D4AF37]/15 border-[#D4AF37]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                  <QrCode size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Email QR Pass</p>
                  <p className="text-[10px] text-gray-400">Digital pass sent to guest phone/email</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryMode('NFC_CARD')}
                className={`p-4 rounded-2xl border text-left flex items-center gap-3 transition-all ${
                  deliveryMode === 'NFC_CARD'
                    ? 'bg-[#D4AF37]/15 border-[#D4AF37]'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
                  <CreditCard size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">NFC Smart Card</p>
                  <p className="text-[10px] text-gray-400">Physical smart card pair</p>
                </div>
              </button>
            </div>
          </div>

          {/* NFC Card UID Input if NFC Selected */}
          {deliveryMode === 'NFC_CARD' && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">NFC Card UID Tag (Optional / Auto Generated)</label>
              <input
                type="text"
                value={cardUid}
                onChange={e => setCardUid(e.target.value)}
                placeholder="e.g. 04:A2:8F:B1:C4"
                className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
          )}

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">Payment Method Received</label>
            <div className="flex gap-4">
              {['CASH', 'UPI'].map(m => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setPaymentMode(m as any)}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all ${
                    paymentMode === m
                      ? 'bg-[#D4AF37] text-black border-[#D4AF37]'
                      : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {m === 'CASH' ? '💵 Cash Received' : '📱 UPI / Scanner'}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center">
            <button
              type="button"
              onClick={() => setStage(2)}
              className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 flex items-center gap-1 border border-white/10"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={handleFinalCheckInSubmit}
              disabled={isSubmitting}
              className="px-10 py-3.5 rounded-xl gold-gradient-btn flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-xl disabled:opacity-50"
            >
              <Sparkles size={16} />
              <span>{isSubmitting ? 'Issuing Pass...' : 'Confirm & Complete Check-In'}</span>
            </button>
          </div>
        </div>
      )}

      {/* STAGE 4: CHECK-IN SUCCESS TICKET TICKET */}
      {stage === 4 && createdToken && (
        <div className="glass-panel p-8 rounded-3xl border border-emerald-500/30 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500 flex items-center justify-center mx-auto text-3xl">
            <CheckCircle2 size={40} />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest badge-active">
              CHECK-IN CONFIRMED
            </span>
            <h2 className="text-3xl font-black text-white mt-2">{customerName}</h2>
            <p className="text-xs text-gray-400 font-mono mt-1">{phoneNumber}</p>
          </div>

          {/* Ticket Receipt Box */}
          <div className="max-w-md mx-auto p-6 rounded-2xl bg-[#141A25] border border-white/10 space-y-3 text-left">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <span className="text-xs text-gray-400">Token Pass Number:</span>
              <span className="text-xl font-black font-mono text-[#D4AF37]">{createdToken.tokenNumber}</span>
            </div>

            <div className="flex justify-between text-xs text-gray-300">
              <span>Delivery Mode:</span>
              <span className="font-bold text-white">{createdToken.deliveryMode}</span>
            </div>

            <div className="flex justify-between text-xs text-gray-300">
              <span>Persons Allowed:</span>
              <span className="font-semibold text-white">{createdToken.personsCount} Guests</span>
            </div>

            <div className="flex justify-between text-xs text-gray-300">
              <span>Drink Quota:</span>
              <span className="font-semibold text-amber-300">{createdToken.totalRedemptionsAllowed} Drinks Included</span>
            </div>

            {createdToken.amountPaid && (
              <div className="flex justify-between text-xs text-gray-300 pt-2 border-t border-white/10">
                <span>Amount Paid:</span>
                <span className="font-bold text-[#D4AF37]">₹{createdToken.amountPaid.toLocaleString()}</span>
              </div>
            )}
          </div>

          <button
            onClick={handleResetWizard}
            className="px-10 py-3.5 rounded-xl gold-gradient-btn text-xs font-bold uppercase tracking-wider shadow-xl inline-flex items-center gap-2"
          >
            <RotateCcw size={16} />
            <span>Start Next Customer Check-In</span>
          </button>
        </div>
      )}
    </div>
  );
};
