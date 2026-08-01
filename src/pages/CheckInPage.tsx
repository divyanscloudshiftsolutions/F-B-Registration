import React, { useState, useEffect, useRef } from 'react';
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
  AlertTriangle,
  Camera
} from 'lucide-react';
import { api } from '../services/api';
import type { Token } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

export const CheckInPage: React.FC = () => {
  const { showToast, preselectedTable, setPreselectedTable } = useAuth();
  const { tables, rates, tokens: activeTokens, refreshTables, refreshTokens } = useData();
  const [stage, setStage] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Stage 1: Form Input States
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [personsCount, setPersonsCount] = useState(2);
  const [deliveryMode, setDeliveryMode] = useState<'NFC_CARD' | 'EMAIL_QR'>('EMAIL_QR');
  const [selectedPlaceTypeId, setSelectedPlaceTypeId] = useState('standing_bar');

  // Stage 2: Seating State
  const [selectedTableId, setSelectedTableId] = useState('');

  // Stage 3: Camera & QR Scanner State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [qrCodeInput, setQrCodeInput] = useState('');
  const [isVerifyingQr, setIsVerifyingQr] = useState(false);
  const [qrVerificationSuccess, setQrVerificationSuccess] = useState(false);
  const [qrVerificationError, setQrVerificationError] = useState<string | null>(null);

  // Stage 4: Payment Details State
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI'>('CASH');
  const [cardUid, setCardUid] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stage 5: Output Pass Ticket
  const [createdToken, setCreatedToken] = useState<Token | null>(null);

  // Delivery mode defaults to EMAIL_QR always, operator switches manually if needed

  // EXACT VALIDATION REGEXES MATCHING REACT NATIVE SOURCE OF TRUTH
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

  const handleStage1Next = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isStep1Valid) {
      if (!isNameOk) showToast('Please enter a valid customer full name (2-100 letters).', 'danger');
      else if (!isPhoneOk) showToast('Please enter a valid 10-digit Indian mobile number.', 'danger');
      else if (!isEmailOk) showToast('Please enter a valid email address.', 'danger');
      return;
    }

    if (preselectedTable) {
      setStage(3); // Go to Stage 3 (QR Scan) if preselected
    } else {
      setStage(2);
    }
  };

  const handleStage2Next = () => {
    setStage(3);
  };

  // Camera & QR control methods
  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      setStream(mediaStream);
      setCameraActive(true);
    } catch {
      setCameraError('Camera access unavailable. Please grant browser camera permissions or use manual token verification.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (cameraActive) {
      startCamera(nextMode);
    }
  };

  // Bind video stream whenever stream state or videoRef mounts
  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive, stream, stage]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const handleVerifyQR = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    setIsVerifyingQr(true);
    setQrVerificationError(null);
    setQrVerificationSuccess(false);

    try {
      const res = await api.verifyQR(cleanCode);
      if (res.success && res.token) {
        setQrVerificationSuccess(true);
        showToast(`Token #${res.token.tokenNumber} verified successfully!`, 'success');
        
        // Populate inputs if verified pre-registered session returned
        if (res.token.customer?.name) setCustomerName(res.token.customer.name);
        if (res.token.customer?.phoneNumber) setPhoneNumber(res.token.customer.phoneNumber);
        if (res.token.customer?.email) setEmail(res.token.customer.email);
        if (res.token.personsCount) setPersonsCount(res.token.personsCount);
        
        setStage(4); // Advance to payment
        stopCamera();
      } else {
        setQrVerificationError('Token verification failed.');
        showToast('Token QR verification failed.', 'danger');
      }
    } catch (err: any) {
      setQrVerificationError(err.message || 'Invalid or expired QR token.');
      showToast(err.message || 'Token verification failed.', 'danger');
    } finally {
      setIsVerifyingQr(false);
    }
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
        refreshTokens();
        refreshTables();
        setStage(5);
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
    setDeliveryMode('EMAIL_QR');
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
      <div className="glass-panel p-6 rounded-2xl border border-border-main relative overflow-hidden">
        {/* Background connector line */}
        <div className="absolute left-[6%] right-[6%] top-1/2 -translate-y-1/2 h-[2px] bg-bg-primary -z-10" />
        
        {/* Progress fill line */}
        <div 
          className="absolute left-[6%] top-1/2 -translate-y-1/2 h-[2px] bg-[#D4AF37] transition-all duration-500 ease-out -z-10"
          style={{ width: `${((stage - 1) / 4) * 88}%` }}
        />

        <div className="flex items-center justify-between w-full">
          {[
            { num: 1, label: 'Customer Info' },
            { num: 2, label: 'Table Seating' },
            { num: 3, label: 'QR Verification' },
            { num: 4, label: 'Payment Details' },
            { num: 5, label: 'Pass Generated' },
          ].map(step => {
            const isCompleted = stage > step.num;
            const isActive = stage === step.num;
            return (
              <div key={step.num} className="flex flex-col items-center gap-2 relative z-10">
                <div 
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-emerald-500 text-black font-black shadow-lg shadow-emerald-500/20' 
                      : isActive 
                      ? 'bg-[#D4AF37] text-black font-black shadow-lg shadow-[#D4AF37]/35 ring-4 ring-[#D4AF37]/20 scale-110' 
                      : 'bg-bg-primary text-text-muted border border-border-main'
                  }`}
                >
                  {isCompleted ? '✓' : step.num}
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-extrabold transition-all ${
                  isActive ? 'text-[#D4AF37]' : isCompleted ? 'dark:text-emerald-400 text-emerald-700' : 'text-text-muted'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Dual-Column Desktop Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left 8 Columns: Active Stage Form Panel */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* STAGE 1: CUSTOMER DETAILS ENTRY */}
          {stage === 1 && (
            <div className="glass-panel p-8 rounded-3xl border border-border-main space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border-main">
                <div className="w-10 h-10 rounded-xl dark:bg-amber-500/15 bg-amber-500/10 dark:text-amber-400 text-amber-700 flex items-center justify-center font-bold">
                  <User size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main">Stage 1: Guest Information & Pass Channel</h3>
                  <p className="text-xs text-text-muted">Select pass delivery channel and enter customer contact details</p>
                </div>
              </div>

              <form onSubmit={handleStage1Next} className="space-y-5">
                
                {/* 1. PASS DELIVERY CHANNEL SELECTOR MATCHING REACT NATIVE STEP 1 */}
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] uppercase tracking-wider mb-2">
                    📦 Select Delivery Channel <span className="dark:text-red-400 text-red-700">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      onClick={() => setDeliveryMode('EMAIL_QR')}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                        deliveryMode === 'EMAIL_QR'
                          ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-text-main shadow-lg shadow-[#D4AF37]/10'
                          : 'bg-bg-primary border-border-main text-text-muted hover:bg-bg-card'
                      }`}
                    >
                      <QrCode size={24} className={deliveryMode === 'EMAIL_QR' ? 'text-[#D4AF37]' : ''} />
                      <div>
                        <p className="text-xs font-bold text-text-main">Digital Email QR Pass</p>
                        <p className="text-[10px] text-text-muted">Sent instantly to guest email & phone</p>
                      </div>
                    </div>

                    <div
                      onClick={() => setDeliveryMode('NFC_CARD')}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                        deliveryMode === 'NFC_CARD'
                          ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-text-main shadow-lg shadow-[#D4AF37]/10'
                          : 'bg-bg-primary border-border-main text-text-muted hover:bg-bg-card'
                      }`}
                    >
                      <CreditCard size={24} className={deliveryMode === 'NFC_CARD' ? 'text-[#D4AF37]' : ''} />
                      <div>
                        <p className="text-xs font-bold text-text-main">NFC Smart Card</p>
                        <p className="text-[10px] text-text-muted">Physical smart card UID pairing</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. CUSTOMER INPUT FIELDS WITH INLINE REAL-TIME VALIDATION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
                      <Phone size={14} className="text-[#D4AF37]" /> Phone Number <span className="dark:text-red-400 text-red-700">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className={`w-full bg-bg-primary border rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none transition-all ${
                        phoneNumber.trim().length > 0 && !isValidPhone(phoneNumber)
                          ? 'border-red-500/80 focus:border-red-500'
                          : 'border-border-main focus:border-[#D4AF37]'
                      }`}
                      required
                    />
                    {phoneNumber.trim().length > 0 && !isValidPhone(phoneNumber) && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Please enter a valid 10-digit Indian mobile number (starts with 6-9).</span>
                      </div>
                    )}
                    {isPhoneActive && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Active check-in session already exists for this phone number.</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
                      <User size={14} className="text-[#D4AF37]" /> Customer Full Name <span className="dark:text-red-400 text-red-700">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className={`w-full bg-bg-primary border rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none transition-all ${
                        customerName.trim().length > 0 && !isNameOk
                          ? 'border-red-500/80 focus:border-red-500'
                          : 'border-border-main focus:border-[#D4AF37]'
                      }`}
                      required
                    />
                    {customerName.trim().length > 0 && !isNameOk && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Full name must be 2-100 characters (letters, spaces, dots, apostrophes only).</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                        <Mail size={14} className="text-[#D4AF37]" /> Email Address
                      </label>
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider ${
                        deliveryMode === 'EMAIL_QR' ? 'dark:text-red-400 text-red-700' : 'text-text-muted'
                      }`}>
                        {deliveryMode === 'EMAIL_QR' ? 'REQUIRED' : 'OPTIONAL'}
                      </span>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="e.g. rahul@gmail.com"
                      className={`w-full bg-bg-primary border rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none transition-all ${
                        (deliveryMode === 'EMAIL_QR' && email.trim().length === 0) || (email.trim().length > 0 && !isValidEmail(email))
                          ? 'border-red-500/80 focus:border-red-500'
                          : 'border-border-main focus:border-[#D4AF37]'
                      }`}
                    />
                    {deliveryMode === 'EMAIL_QR' && email.trim().length === 0 && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Email address is strictly required for Digital Email QR Pass delivery.</span>
                      </div>
                    )}
                    {email.trim().length > 0 && !isValidEmail(email) && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Please enter a valid email address (e.g. name@domain.com).</span>
                      </div>
                    )}
                    {isEmailActive && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>Active check-in session already exists for this email.</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
                      <Users size={14} className="text-[#D4AF37]" /> Guest Headcount (Persons)
                    </label>
                    
                    {/* Custom Increment/Decrement and Editable Input Control */}
                    <div className="flex items-center gap-3 mb-3 bg-bg-primary border border-border-main rounded-xl p-2 max-w-[240px]">
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = Math.max(1, personsCount - 1);
                          setPersonsCount(nextVal);
                        }}
                        disabled={personsCount <= 1}
                        className="w-8 h-8 rounded-lg bg-bg-primary hover:bg-bg-card text-text-main font-black flex items-center justify-center disabled:opacity-40 transition-all cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={maxCapacity}
                        value={personsCount}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val >= 1) {
                            if (val > maxCapacity) {
                              showToast(`Headcount cannot exceed Table maximum capacity of ${maxCapacity} seats.`, 'warning');
                              setPersonsCount(maxCapacity);
                            } else {
                              setPersonsCount(val);
                            }
                          }
                        }}
                        className="flex-1 bg-transparent text-center text-sm font-bold text-text-main focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (personsCount >= maxCapacity) {
                            showToast(`Headcount cannot exceed Table maximum capacity of ${maxCapacity} seats.`, 'warning');
                          } else {
                            setPersonsCount(personsCount + 1);
                          }
                        }}
                        disabled={personsCount >= maxCapacity}
                        className="w-8 h-8 rounded-lg bg-bg-primary hover:bg-bg-card text-text-main font-black flex items-center justify-center disabled:opacity-40 transition-all cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {[1, 2, 3, 4, 5, 6, 8, 10].map(count => (
                        <button
                          type="button"
                          key={count}
                          onClick={() => {
                            if (count > maxCapacity) {
                              showToast(`Headcount cannot exceed Table maximum capacity of ${maxCapacity} seats.`, 'warning');
                              setPersonsCount(maxCapacity);
                            } else {
                              setPersonsCount(count);
                            }
                          }}
                          className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                            personsCount === count
                              ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-black shadow-lg shadow-[#D4AF37]/20'
                              : count > maxCapacity 
                              ? 'bg-bg-primary text-gray-600 border-border-main line-through opacity-50 cursor-not-allowed'
                              : 'bg-bg-primary text-text-muted border-border-main hover:bg-bg-card'
                          }`}
                        >
                          {count} {count === 1 ? 'Guest' : 'Guests'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* STAGE 1 SUBMIT BUTTON (STRICTLY DISABLED UNTIL isStep1Valid IS TRUE) */}
                <div className="pt-4 flex items-center justify-between border-t border-border-main">
                  <div className="text-xs text-text-muted">
                    {!isStep1Valid ? (
                      <span className="dark:text-amber-400 text-amber-700 flex items-center gap-1">
                        <AlertTriangle size={14} /> Complete all required fields above to proceed
                      </span>
                    ) : (
                      <span className="dark:text-emerald-400 text-emerald-700 font-bold flex items-center gap-1">
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
                        : 'bg-bg-card text-text-muted border border-border-main opacity-40 cursor-not-allowed pointer-events-none'
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
            <div className="glass-panel p-8 rounded-3xl border border-border-main space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border-main">
                <div className="w-10 h-10 rounded-xl dark:bg-amber-500/15 bg-amber-500/10 dark:text-amber-400 text-amber-700 flex items-center justify-center font-bold">
                  <Grid3X3 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main">Stage 2: Rate Category & Seating Plan</h3>
                  <p className="text-xs text-text-muted">Select rate plan and assign floor seating table</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2">1. Select Rate Category</label>
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
                            : 'bg-bg-primary border-border-main hover:bg-bg-card'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-text-main text-sm">{rc.name || (rcId === 'premium_lounge' ? 'Premium Lounge' : 'Standing Bar')}</span>
                          {isSel && <CheckCircle2 size={18} className="text-[#D4AF37]" />}
                        </div>
                        <div>
                          <p className="text-2xl font-black text-[#D4AF37]">₹{rc.ratePerPerson} <span className="text-xs text-text-muted font-normal">/ person</span></p>
                          <p className="text-[11px] dark:text-amber-300 text-amber-700 mt-1 font-semibold">
                            {rc.redemptionsPerPerson || 2} Drinks Included • {Math.round((rc.baseTimeMinutes || 120) / 60)} Hours
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-2">2. Assign Seating Table (Filtered for {personsCount} Guests)</label>
                {compatibleAvailableTables.length === 0 ? (
                  <p className="text-xs text-text-muted py-3">No available tables with capacity for {personsCount} guests in this zone. You may proceed without table assignment.</p>
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
                              ? 'bg-emerald-500/20 border-emerald-400 dark:text-emerald-300 text-emerald-700 font-bold shadow-lg'
                              : 'bg-bg-primary border-border-main text-text-muted hover:bg-bg-card'
                          }`}
                        >
                          <p className="font-mono text-sm font-black">{tb.tableNumber}</p>
                          <p className="text-[10px] text-text-muted mt-0.5">{personsCount} / {tb.capacity} Seats</p>
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
                  className="px-6 py-3 rounded-xl bg-bg-primary hover:bg-bg-card text-text-muted text-xs font-bold flex items-center gap-2"
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

          {/* STAGE 3: QR PASS SCAN & VERIFY */}
          {stage === 3 && (
            <div className="glass-panel p-8 rounded-3xl border border-border-main space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border-main">
                <div className="w-10 h-10 rounded-xl dark:bg-amber-500/15 bg-amber-500/10 dark:text-amber-400 text-amber-700 flex items-center justify-center font-bold">
                  <QrCode size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main">Stage 3: Guest QR Verification</h3>
                  <p className="text-xs text-text-muted">Scan pre-registration QR code or enter token number manually</p>
                </div>
              </div>

              {/* Live Camera Viewfinder Layer */}
              <div className="relative rounded-2xl overflow-hidden bg-bg-primary border border-border-main aspect-video flex flex-col items-center justify-center shadow-inner">
                {cameraActive ? (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover" 
                    />
                    
                    {/* Pulsing red laser scanner overlay */}
                    <div className="absolute left-[15%] right-[15%] h-[2px] bg-red-500 top-1/2 -translate-y-1/2 z-20 shadow-[0_0_8px_#EF4444] animate-pulse" />
                    
                    {/* Golden target guide frame overlay */}
                    <div className="absolute w-44 h-44 border-2 border-[#D4AF37] rounded-3xl z-10 flex items-center justify-center bg-black/10 shadow-[0_0_15px_rgba(212,175,55,0.25)]">
                      <span className="text-[9px] text-[#D4AF37] font-black uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded-md">Viewfinder</span>
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-1.5 rounded-full border border-border-main z-30">
                      <p className="text-[10px] text-text-main font-extrabold uppercase tracking-widest text-center">
                        Align QR Code within the golden frame
                      </p>
                    </div>

                    {/* Camera Control Switches */}
                    <div className="absolute top-4 right-4 flex gap-2 z-30">
                      <button
                        type="button"
                        onClick={toggleFacingMode}
                        className="px-2.5 py-1.5 rounded-lg bg-black/75 hover:bg-black text-[10px] font-bold text-text-main border border-white/15 transition-all cursor-pointer"
                      >
                        Switch Source
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-2.5 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-500 text-[10px] font-bold text-text-main border border-red-500/30 transition-all cursor-pointer"
                      >
                        Close Viewfinder
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 space-y-4">
                    <QrCode className="mx-auto text-text-muted animate-pulse" size={44} />
                    <div>
                      <p className="text-xs text-text-muted font-bold">Live QR Scanner Inactive</p>
                      <p className="text-[10px] text-text-muted mt-0.5">Activate camera to verify digital passes automatically</p>
                    </div>
                    {cameraError && (
                      <p className="text-[11px] dark:text-amber-400 text-amber-700 font-semibold max-w-md mx-auto">{cameraError}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-5 py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-bold text-text-muted border border-border-main inline-flex items-center gap-2 transition-all cursor-pointer shadow-md"
                    >
                      <Camera size={14} /> Start Camera Scanner
                    </button>
                  </div>
                )}
              </div>

              {/* Manual Input Fallback */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-text-muted">Or Input Token Number Manually</label>
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    value={qrCodeInput}
                    onChange={e => {
                      setQrCodeInput(e.target.value.toUpperCase());
                      setQrVerificationError(null);
                    }}
                    placeholder="e.g. BAR-20260728-1"
                    className="flex-1 bg-bg-primary border border-border-main rounded-xl px-4 py-2.5 text-sm text-text-main font-mono placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                  />
                  <button
                    type="button"
                    disabled={isVerifyingQr || !qrCodeInput.trim()}
                    onClick={() => handleVerifyQR(qrCodeInput)}
                    className="px-6 py-2.5 rounded-xl gold-gradient-btn text-xs font-black uppercase tracking-wider disabled:opacity-40 transition-all cursor-pointer shadow-md"
                  >
                    {isVerifyingQr ? 'Verifying...' : 'Verify Token'}
                  </button>
                </div>

                {qrVerificationError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{qrVerificationError}</span>
                  </div>
                )}

                {qrVerificationSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-center gap-1.5 text-[11px] dark:text-emerald-400 text-emerald-700">
                    <CheckCircle2 size={14} className="shrink-0" />
                    <span>Token verified! Member details populated successfully.</span>
                  </div>
                )}
              </div>

              {/* Stage Navigation Buttons */}
              <div className="pt-4 border-t border-border-main flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    if (preselectedTable) {
                      setStage(1); // Go back to stage 1 if preselected from table plan
                    } else {
                      setStage(2);
                    }
                  }}
                  className="px-6 py-3 rounded-xl bg-bg-primary hover:bg-bg-card text-text-muted text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
                >
                  <ChevronLeft size={16} /> Back
                </button>

                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setStage(4); // Manual proceed to Payment
                  }}
                  className="px-8 py-3.5 rounded-xl gold-gradient-btn flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-xl cursor-pointer"
                >
                  <span>Proceed to Payment</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 4: PAYMENT DETAILS */}
          {stage === 4 && (
            <div className="glass-panel p-8 rounded-3xl border border-border-main space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-border-main">
                <div className="w-10 h-10 rounded-xl dark:bg-amber-500/15 bg-amber-500/10 dark:text-amber-400 text-amber-700 flex items-center justify-center font-bold">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-main">Stage 4: Payment Method & Confirmation</h3>
                  <p className="text-xs text-text-muted">Collect payment and complete check-in pass issuance</p>
                </div>
              </div>

              <form onSubmit={handleFinalCheckInSubmit} className="space-y-6">
                {deliveryMode === 'NFC_CARD' && (
                  <div>
                    <label className="block text-xs font-semibold text-text-muted mb-1.5">NFC Smart Card UID</label>
                    <input
                      type="text"
                      value={cardUid}
                      onChange={e => setCardUid(e.target.value)}
                      placeholder="e.g. NFC-883921"
                      className="w-full bg-bg-primary border border-border-main rounded-xl px-4 py-3 text-sm text-text-main font-mono focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('CASH')}
                      className={`py-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        paymentMode === 'CASH'
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-black shadow-lg shadow-[#D4AF37]/20'
                          : 'bg-bg-primary text-text-muted border-border-main hover:bg-bg-card'
                      }`}
                    >
                      💵 Cash Payment
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('UPI')}
                      className={`py-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        paymentMode === 'UPI'
                          ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-black shadow-lg shadow-[#D4AF37]/20'
                          : 'bg-bg-primary text-text-muted border-border-main hover:bg-bg-card'
                      }`}
                    >
                      📲 UPI / Digital Pay
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStage(3)}
                    className="px-6 py-3 rounded-xl bg-bg-primary hover:bg-bg-card text-text-muted text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <ChevronLeft size={16} /> Back
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || !isStep1Valid}
                    className="px-8 py-3.5 rounded-xl gold-gradient-btn flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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

          {/* STAGE 5: CHECK-IN SUCCESS PASS TICKET */}
          {stage === 5 && createdToken && (
            <div className="glass-panel p-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 dark:text-emerald-400 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h3 className="text-xl font-black text-text-main">Check-In Successful!</h3>
                <p className="text-xs text-text-muted mt-1">Pass Issued for {createdToken.customer?.name}</p>
              </div>

              <div className="glass-panel p-6 rounded-2xl border border-border-main text-left space-y-3 font-mono text-xs max-w-md mx-auto">
                <div className="flex justify-between border-b border-border-main pb-2">
                  <span className="text-text-muted">Token Number:</span>
                  <span className="font-bold text-[#D4AF37]">{createdToken.tokenNumber}</span>
                </div>
                <div className="flex justify-between border-b border-border-main pb-2">
                  <span className="text-text-muted">Customer Phone:</span>
                  <span className="text-text-main">{createdToken.customer?.phoneNumber}</span>
                </div>
                <div className="flex justify-between border-b border-border-main pb-2">
                  <span className="text-text-muted">Drink Allowance:</span>
                  <span className="dark:text-amber-300 text-amber-700 font-bold">{totalAllowedDrinks} Drinks ({createdToken.redemptionsUsed} Used)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Delivery Channel:</span>
                  <span className="dark:text-emerald-400 text-emerald-700 font-bold">{createdToken.deliveryMode}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetWizard}
                className="px-8 py-3.5 rounded-xl gold-gradient-btn text-xs font-black uppercase tracking-wider shadow-xl inline-flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw size={16} /> Check In Next Guest
              </button>
            </div>
          )}
        </div>

        {/* Right 4 Columns: Live Billing Summary Receipt Side Panel */}
        <div className="lg:col-span-4 glass-panel p-6 rounded-3xl border border-border-main space-y-6 sticky top-6">
          <div className="flex items-center gap-2 pb-4 border-b border-border-main">
            <Receipt size={18} className="text-[#D4AF37]" />
            <h4 className="text-sm font-bold text-text-main uppercase tracking-wider">Live Check-In Receipt</h4>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex justify-between text-text-muted border-b border-border-main pb-2">
              <span>Customer Name:</span>
              <span className="font-bold text-text-main">{customerName || '—'}</span>
            </div>
            <div className="flex justify-between text-text-muted border-b border-border-main pb-2">
              <span>Phone Number:</span>
              <span className="font-mono text-text-main">{phoneNumber || '—'}</span>
            </div>
            <div className="flex justify-between text-text-muted border-b border-border-main pb-2">
              <span>Delivery Channel:</span>
              <span className="font-bold dark:text-emerald-400 text-emerald-700">{deliveryMode === 'EMAIL_QR' ? 'Digital Email QR' : 'NFC Smart Card'}</span>
            </div>
            <div className="flex justify-between text-text-muted border-b border-border-main pb-2">
              <span>Selected Area:</span>
              <span className="font-bold text-[#D4AF37]">{currentRateCard.name}</span>
            </div>
            <div className="flex justify-between text-text-muted border-b border-border-main pb-2">
              <span>Assigned Table:</span>
              <span className="font-mono font-bold dark:text-emerald-400 text-emerald-700">{selectedTableObj ? selectedTableObj.tableNumber : 'Unassigned'}</span>
            </div>
            
            {/* Dynamic Rates Table Details */}
            <div className="p-3.5 rounded-2xl bg-bg-primary border border-border-main space-y-2 mt-2">
              <p className="text-[10px] font-black uppercase text-text-muted tracking-wider">Pricing Details</p>
              <div className="flex justify-between text-text-muted">
                <span>Base Cover / Person:</span>
                <span className="text-text-main font-bold">₹{currentRateCard.ratePerPerson}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Beverages Included:</span>
                <span className="dark:text-amber-300 text-amber-700 font-bold">{currentRateCard.redemptionsPerPerson} drinks/guest</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Session Duration:</span>
                <span className="dark:text-emerald-400 text-emerald-700 font-bold">{Math.round((currentRateCard.baseTimeMinutes || 120) / 60)} hours</span>
              </div>
              <div className="flex justify-between text-text-muted border-t border-border-main pt-2 mt-1">
                <span>Calculated Subtotal:</span>
                <span className="text-text-main font-black">₹{currentRateCard.ratePerPerson} × {personsCount}</span>
              </div>
            </div>

            <div className="flex justify-between text-text-muted">
              <span>Total Allowed Drinks:</span>
              <span className="font-bold dark:text-amber-300 text-amber-700">{totalAllowedDrinks} Drinks</span>
            </div>
          </div>

          <div className="pt-4 border-t border-border-main space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-text-muted uppercase font-semibold">Total Payable Amount</span>
              <span className="text-2xl font-black text-[#D4AF37]">₹{calculatedTotal}</span>
            </div>
            <p className="text-[10px] text-text-muted">Includes entry cover & drink allowances</p>
          </div>
        </div>

      </div>
    </div>
  );
};
