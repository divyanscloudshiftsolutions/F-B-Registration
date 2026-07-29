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
  Grid3X3,
  Receipt,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import type { Table, Token } from '../types';
import { useAuth } from '../context/AuthContext';

export const CheckInPage: React.FC = () => {
  const { showToast, preselectedTable, setPreselectedTable } = useAuth();
  const [stage, setStage] = useState<1 | 2 | 3 | 4>(1);

  // Stage 1: Form Input States
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [personsCount, setPersonsCount] = useState(2);
  const [deliveryMode, setDeliveryMode] = useState<'NFC_CARD' | 'EMAIL_QR'>('EMAIL_QR');

  // Dynamic Rates State loaded from API
  const [rates, setRates] = useState<any[]>([]);
  const [selectedPlaceTypeId, setSelectedPlaceTypeId] = useState('standing_bar');

  // Stage 2: Seating State
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [activeTokens, setActiveTokens] = useState<Token[]>([]);

  // Stage 3: Payment Details State
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI'>('CASH');
  const [cardUid, setCardUid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stage 4: Output Pass Ticket
  const [createdToken, setCreatedToken] = useState<Token | null>(null);

  // ----------------------------------------------------
  // EXACT VALIDATION REGEXES MATCHING REACT NATIVE SOURCE OF TRUTH
  // ----------------------------------------------------
  const isValidName = (name: string): boolean => {
    const trimmed = name.trim();
    return /^[a-zA-Z\s.'-]{2,100}$/.test(trimmed);
  };

  const isValidPhone = (phone: string): boolean => {
    const trimmed = phone.trim();
    return /^(?:\+91)?[6-9]\d{9}$/.test(trimmed);
  };

  const isValidEmail = (emailStr: string): boolean => {
    if (!emailStr || !emailStr.trim()) return true;
    const trimmed = emailStr.trim().toLowerCase();
    const regex = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9]+(\.[a-z0-9]+)*@gmail\.com$/;
    return regex.test(trimmed);
  };

  // Active Check-in Duplicate Session Check
  const normalizedPhone = phoneNumber.trim().startsWith('+91') ? phoneNumber.trim() : `+91${phoneNumber.trim()}`;
  const isPhoneActive = activeTokens.some(t => 
    (t.customer?.phoneNumber === phoneNumber.trim() || t.customer?.phoneNumber === normalizedPhone) &&
    (t.status?.toUpperCase() === 'ACTIVE' || t.status?.toUpperCase() === 'EXTENDED')
  );

  const isEmailActive = email.trim() ? activeTokens.some(t =>
    t.customer?.email?.toLowerCase() === email.trim().toLowerCase() &&
    (t.status?.toUpperCase() === 'ACTIVE' || t.status?.toUpperCase() === 'EXTENDED')
  ) : false;

  // React Native exact step validation booleans
  const isNameOk = isValidName(customerName);
  const isPhoneOk = isValidPhone(phoneNumber) && !isPhoneActive;
  const isEmailOk = deliveryMode === 'EMAIL_QR'
    ? (email.trim().length > 0 && isValidEmail(email) && !isEmailActive)
    : (isValidEmail(email) && !isEmailActive);

  const selectedTableObj = tables.find(t => t.id === selectedTableId);
  const maxCapacity = selectedTableObj ? selectedTableObj.capacity : (preselectedTable ? preselectedTable.capacity : 20);
  const isCapacityOk = personsCount > 0 && personsCount <= maxCapacity;

  // STEP 1 VALIDATION BARRIER (Button disabled if false)
  const isStep1Valid = isNameOk && isPhoneOk && isEmailOk && isCapacityOk;

  const loadData = async () => {
    try {
      const [tableData, mode, ratesData, tokensData] = await Promise.all([
        api.getTables(),
        api.getDeliveryMode(),
        api.getRates(),
        api.getActiveTokens(),
      ]);
      setTables(tableData);
      if (mode === 'NFC_CARD' || mode === 'EMAIL_QR') {
        setDeliveryMode(mode);
      }
      if (Array.isArray(ratesData) && ratesData.length > 0) {
        setRates(ratesData);
      }
      if (Array.isArray(tokensData)) {
        setActiveTokens(tokensData);
      }
    } catch {
      // Graceful fallback
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Pre-select table if navigated from Tables floor plan
  useEffect(() => {
    if (preselectedTable) {
      const matchedCategory = preselectedTable.number.startsWith('L-') ? 'premium_lounge' : 'standing_bar';
      setSelectedPlaceTypeId(preselectedTable.placeTypeId || matchedCategory);
      setSelectedTableId(preselectedTable.id);
      setPersonsCount(Math.min(preselectedTable.capacity, 10));
      showToast(`Table ${preselectedTable.number} (Max ${preselectedTable.capacity} guests) pre-selected for check-in.`, 'info');
    }
  }, [preselectedTable]);

  // Derived current rate card
  const currentRateCard = rates.find(r => r.id === selectedPlaceTypeId) || {
    id: selectedPlaceTypeId,
    name: selectedPlaceTypeId === 'premium_lounge' ? 'Premium Lounge' : 'Standing Bar',
    ratePerPerson: selectedPlaceTypeId === 'premium_lounge' ? 1000 : 500,
    baseTimeMinutes: selectedPlaceTypeId === 'premium_lounge' ? 180 : 120,
    redemptionsPerPerson: selectedPlaceTypeId === 'premium_lounge' ? 4 : 2,
  };

  const calculatedTotal = personsCount * currentRateCard.ratePerPerson;
  const totalAllowedDrinks = personsCount * currentRateCard.redemptionsPerPerson;

  const handleSetHeadcount = (count: number) => {
    if (selectedTableObj && count > selectedTableObj.capacity) {
      showToast(`Headcount cannot exceed Table ${selectedTableObj.tableNumber} capacity of ${selectedTableObj.capacity} seats.`, 'warning');
      setPersonsCount(selectedTableObj.capacity);
    } else {
      setPersonsCount(count);
    }
  };

  const handleStage1Next = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isStep1Valid) {
      if (!isNameOk) showToast('Please enter a valid customer full name (2-100 letters).', 'danger');
      else if (!isPhoneOk) showToast('Please enter a valid 10-digit Indian mobile number.', 'danger');
      else if (!isEmailOk) showToast('Please enter a valid email address.', 'danger');
      return;
    }

    if (preselectedTable) {
      setStage(3); // Skip directly to payment stage if table preselected from floor plan
    } else {
      setStage(2);
    }
  };

  const handleStage2Next = () => {
    setStage(3);
  };

  const handleFinalCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStep1Valid) {
      showToast('Form inputs are invalid. Please check Stage 1 details.', 'danger');
      setStage(1);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.createCustomerCheckIn({
        phoneNumber: phoneNumber.trim(),
        customerName: customerName.trim(),
        email: email.trim() || undefined,
        personsCount,
        placeTypeId: selectedPlaceTypeId,
        deliveryMode,
        cardUid: deliveryMode === 'NFC_CARD' ? (cardUid.trim() || `NFC-${Date.now().toString(36).toUpperCase()}`) : undefined,
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
    setPreselectedTable(null);
  };

  // Filter available tables by place category & seating capacity compatibility matching React Native
  const compatibleAvailableTables = tables.filter(t => {
    const isAvailable = t.status === 'available';
    const isCapacitySuitable = t.capacity >= personsCount;
    const matchesCategory = selectedPlaceTypeId === 'premium_lounge'
      ? (t.placeTypeId === 'PREMIUM_LOUNGE' || t.tableNumber.startsWith('L-'))
      : (t.placeTypeId === 'STANDING_BAR' || t.tableNumber.startsWith('S-') || !t.tableNumber.startsWith('L-'));
    return isAvailable && isCapacitySuitable && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
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

      {/* Main Dual-Column Desktop Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 8 Columns: Active Stage Form Panel */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* STAGE 1: CUSTOMER DETAILS ENTRY */}
          {stage === 1 && (
            <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Stage 1: Guest Information & Pass Channel</h3>
                  <p className="text-xs text-gray-400">Select pass delivery channel and enter customer contact details</p>
                </div>
              </div>

              <form onSubmit={handleStage1Next} className="space-y-5">
                
                {/* 1. PASS DELIVERY CHANNEL SELECTOR MATCHING REACT NATIVE STEP 1 */}
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-2">
                    📦 Select Delivery Channel <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      onClick={() => setDeliveryMode('EMAIL_QR')}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                        deliveryMode === 'EMAIL_QR'
                          ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white shadow-lg shadow-[#D4AF37]/10'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <QrCode size={24} className={deliveryMode === 'EMAIL_QR' ? 'text-[#D4AF37]' : ''} />
                      <div>
                        <p className="text-xs font-bold text-white">Digital Email QR Pass</p>
                        <p className="text-[10px] text-gray-400">Sent instantly to guest email & phone</p>
                      </div>
                    </div>

                    <div
                      onClick={() => setDeliveryMode('NFC_CARD')}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                        deliveryMode === 'NFC_CARD'
                          ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white shadow-lg shadow-[#D4AF37]/10'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <CreditCard size={24} className={deliveryMode === 'NFC_CARD' ? 'text-[#D4AF37]' : ''} />
                      <div>
                        <p className="text-xs font-bold text-white">NFC Smart Card</p>
                        <p className="text-[10px] text-gray-400">Physical smart card UID pairing</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CUSTOMER INPUT FIELDS WITH INLINE REAL-TIME VALIDATION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <Phone size={14} className="text-[#D4AF37]" /> Phone Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className={`w-full bg-[#1A202C] border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all ${
                        phoneNumber.trim().length > 0 && !isValidPhone(phoneNumber)
                          ? 'border-red-500/80 focus:border-red-500'
                          : 'border-white/10 focus:border-[#D4AF37]'
                      }`}
                      required
                    />
                    {phoneNumber.trim().length > 0 && !isValidPhone(phoneNumber) && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] text-red-400">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Please enter a valid 10-digit Indian mobile number (starts with 6-9).</span>
                      </div>
                    )}
                    {isPhoneActive && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] text-red-400">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Active check-in session already exists for this phone number.</span>
                      </div>
                    )}
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
                      className={`w-full bg-[#1A202C] border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all ${
                        customerName.trim().length > 0 && !isNameOk
                          ? 'border-red-500/80 focus:border-red-500'
                          : 'border-white/10 focus:border-[#D4AF37]'
                      }`}
                      required
                    />
                    {customerName.trim().length > 0 && !isNameOk && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] text-red-400">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Full name must be 2-100 characters (letters, spaces, dots, apostrophes only).</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                        <Mail size={14} className="text-[#D4AF37]" /> Email Address
                      </label>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                        deliveryMode === 'EMAIL_QR' ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {deliveryMode === 'EMAIL_QR' ? 'REQUIRED' : 'OPTIONAL'}
                      </span>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. rahul@gmail.com"
                      className={`w-full bg-[#1A202C] border rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-all ${
                        (deliveryMode === 'EMAIL_QR' && email.trim().length === 0) || (email.trim().length > 0 && !isValidEmail(email))
                          ? 'border-red-500/80 focus:border-red-500'
                          : 'border-white/10 focus:border-[#D4AF37]'
                      }`}
                    />
                    {deliveryMode === 'EMAIL_QR' && email.trim().length === 0 && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] text-red-400">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Email address is strictly required for Digital Email QR Pass delivery.</span>
                      </div>
                    )}
                    {email.trim().length > 0 && !isValidEmail(email) && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] text-red-400">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Please enter a valid email address (e.g. name@domain.com).</span>
                      </div>
                    )}
                    {isEmailActive && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] text-red-400">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Active check-in session already exists for this email.</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                      <Users size={14} className="text-[#D4AF37]" /> Guest Headcount (Persons)
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {[1, 2, 3, 4, 5, 6, 8, 10].map(count => (
                        <button
                          type="button"
                          key={count}
                          onClick={() => handleSetHeadcount(count)}
                          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                            personsCount === count
                              ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-black shadow-lg shadow-[#D4AF37]/20'
                              : count > maxCapacity 
                              ? 'bg-white/5 text-gray-600 border-white/5 line-through opacity-50 cursor-not-allowed'
                              : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                          }`}
                        >
                          {count} {count === 1 ? 'Guest' : 'Guests'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* STAGE 1 SUBMIT BUTTON (STRICTLY DISABLED UNTIL isStep1Valid IS TRUE) */}
                <div className="pt-4 flex items-center justify-between border-t border-white/10">
                  <div className="text-xs text-gray-400">
                    {!isStep1Valid ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle size={14} /> Complete all required fields above to proceed
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        ✓ All inputs validated
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={!isStep1Valid}
                    className={`px-8 py-3.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-xl transition-all ${
                      isStep1Valid
                        ? 'gold-gradient-btn opacity-100 cursor-pointer'
                        : 'bg-white/10 text-gray-500 border border-white/10 opacity-40 cursor-not-allowed pointer-events-none'
                    }`}
                  >
                    <span>Proceed to Seating Plan</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STAGE 2: SEATING ZONE & RATE SELECTION */}
          {stage === 2 && (
            <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                  <Grid3X3 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Stage 2: Rate Category & Seating Plan</h3>
                  <p className="text-xs text-gray-400">Select rate plan and assign floor seating table</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">1. Select Rate Category</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(rates.length > 0 ? rates : [
                    { id: 'standing_bar', name: 'Standing Bar', ratePerPerson: 500, redemptionsPerPerson: 2, baseTimeMinutes: 120 },
                    { id: 'premium_lounge', name: 'Premium Lounge', ratePerPerson: 1000, redemptionsPerPerson: 4, baseTimeMinutes: 180 },
                  ]).map(rc => {
                    const rcId = rc.id || (rc.name?.toLowerCase().includes('lounge') ? 'premium_lounge' : 'standing_bar');
                    const isSel = selectedPlaceTypeId === rcId;
                    return (
                      <div
                        key={rcId}
                        onClick={() => setSelectedPlaceTypeId(rcId)}
                        className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between h-36 ${
                          isSel
                            ? 'bg-[#D4AF37]/15 border-[#D4AF37] shadow-xl shadow-[#D4AF37]/10'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm">{rc.name || (rcId === 'premium_lounge' ? 'Premium Lounge' : 'Standing Bar')}</span>
                          {isSel && <CheckCircle2 size={18} className="text-[#D4AF37]" />}
                        </div>
                        <div>
                          <p className="text-2xl font-black text-[#D4AF37]">₹{rc.ratePerPerson} <span className="text-xs text-gray-400 font-normal">/ person</span></p>
                          <p className="text-[11px] text-amber-300 mt-1 font-semibold">
                            {rc.redemptionsPerPerson || 2} Drinks Included • {Math.round((rc.baseTimeMinutes || 120) / 60)} Hours
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">2. Assign Seating Table (Filtered for {personsCount} Guests)</label>
                {compatibleAvailableTables.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3">No available tables with capacity for {personsCount} guests in this zone. You may proceed without table assignment.</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {compatibleAvailableTables.map(tb => {
                      const isSel = selectedTableId === tb.id;
                      return (
                        <button
                          key={tb.id}
                          type="button"
                          onClick={() => setSelectedTableId(isSel ? '' : tb.id)}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            isSel
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold shadow-lg'
                              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          <p className="font-mono text-sm font-black">{tb.tableNumber}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{personsCount} / {tb.capacity} Seats</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStage(1)}
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold flex items-center gap-2"
                >
                  <ChevronLeft size={16} /> Back
                </button>

                <button
                  type="button"
                  onClick={handleStage2Next}
                  className="px-8 py-3.5 rounded-xl gold-gradient-btn flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-xl"
                >
                  <span>Proceed to Payment</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: PAYMENT DETAILS */}
          {stage === 3 && (
            <div className="glass-panel p-8 rounded-3xl border border-white/10 space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Stage 3: Payment Method & Confirmation</h3>
                  <p className="text-xs text-gray-400">Collect payment and complete check-in pass issuance</p>
                </div>
              </div>

              <form onSubmit={handleFinalCheckInSubmit} className="space-y-6">
                {deliveryMode === 'NFC_CARD' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1.5">NFC Smart Card UID</label>
                    <input
                      type="text"
                      value={cardUid}
                      onChange={e => setCardUid(e.target.value)}
                      placeholder="e.g. NFC-883921"
                      className="w-full bg-[#1A202C] border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('CASH')}
                      className={`py-3.5 rounded-xl border text-xs font-bold transition-all ${
                        paymentMode === 'CASH'
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-black shadow-lg shadow-[#D4AF37]/20'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      💵 Cash Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('UPI')}
                      className={`py-3.5 rounded-xl border text-xs font-bold transition-all ${
                        paymentMode === 'UPI'
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-black shadow-lg shadow-[#D4AF37]/20'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      📲 UPI / Digital Pay
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStage(2)}
                    className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold flex items-center gap-2"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || !isStep1Valid}
                    className="px-8 py-3.5 rounded-xl gold-gradient-btn flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-xl disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <span>Issuing Pass...</span>
                    ) : (
                      <>
                        <span>Confirm Check-In & Issue Pass</span>
                        <CheckCircle2 size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STAGE 4: CHECK-IN SUCCESS PASS TICKET */}
          {stage === 4 && createdToken && (
            <div className="glass-panel p-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">Check-In Successful!</h3>
                <p className="text-xs text-gray-400 mt-1">Pass Issued for {createdToken.customer?.name}</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-white/10 text-left space-y-3 font-mono text-xs max-w-md mx-auto">
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-400">Token Number:</span>
                  <span className="font-bold text-[#D4AF37]">{createdToken.tokenNumber}</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-400">Customer Phone:</span>
                  <span className="text-white">{createdToken.customer?.phoneNumber}</span>
                </div>
                <div className="flex justify-between border-b border-white/10 pb-2">
                  <span className="text-gray-400">Drink Allowance:</span>
                  <span className="text-amber-300 font-bold">{totalAllowedDrinks} Drinks ({createdToken.redemptionsUsed} Used)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Delivery Channel:</span>
                  <span className="text-emerald-400 font-bold">{createdToken.deliveryMode}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetWizard}
                className="px-8 py-3.5 rounded-xl gold-gradient-btn text-xs font-black uppercase tracking-wider shadow-xl inline-flex items-center gap-2"
              >
                <RotateCcw size={16} /> Check In Next Guest
              </button>
            </div>
          )}
        </div>

        {/* Right 4 Columns: Live Billing Summary Receipt Side Panel */}
        <div className="lg:col-span-4 glass-panel p-6 rounded-3xl border border-white/10 space-y-6 sticky top-6">
          <div className="flex items-center gap-2 pb-4 border-b border-white/10">
            <Receipt size={18} className="text-[#D4AF37]" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Live Check-In Receipt</h4>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Customer Name:</span>
              <span className="font-bold text-white">{customerName || '—'}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Phone Number:</span>
              <span className="font-mono text-white">{phoneNumber || '—'}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Delivery Channel:</span>
              <span className="font-bold text-emerald-400">{deliveryMode === 'EMAIL_QR' ? 'Digital Email QR' : 'NFC Smart Card'}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Headcount:</span>
              <span className="font-bold text-amber-300">{personsCount} Persons</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Category / Rate:</span>
              <span className="font-bold text-white">{currentRateCard.name}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Assigned Table:</span>
              <span className="font-mono font-bold text-emerald-400">{selectedTableObj ? selectedTableObj.tableNumber : 'Unassigned'}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Drink Allowance:</span>
              <span className="font-bold text-amber-400">{totalAllowedDrinks} Drinks Included</span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-400 uppercase font-semibold">Total Payable Amount</span>
              <span className="text-2xl font-black text-[#D4AF37]">₹{calculatedTotal}</span>
            </div>
            <p className="text-[10px] text-gray-500">Includes entry cover & drink allowances</p>
          </div>
        </div>

      </div>
    </div>
  );
};
