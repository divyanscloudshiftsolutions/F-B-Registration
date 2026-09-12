import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Grid3X3, X, CheckCircle2, Users, ArrowRight, Search, UserPlus, AlertTriangle, Clock, Lock, Mail, User, Phone, Filter, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import type { Table, Token } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ExtendSessionModal } from '../components/modals/ExtendSessionModal';
import { CheckoutConfirmationModal } from '../components/modals/CheckoutConfirmationModal';
import { TableDiagram } from '../components/TableDiagram';
import { SeatingRow } from '../components/SeatingRow';

interface TablesPageProps {
 onNavigateToCheckIn?: () => void;
 activeTab: string;
 setActiveTab: (tab: string) => void;
}

export const TableTimer: React.FC<{ endTime: string }> = ({ endTime }) => {
  const [remainingTime, setRemainingTime] = useState<string>('--:--:--');
  const [isCloseToExpiry, setIsCloseToExpiry] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    const calculate = () => {
      const end = new Date(endTime).getTime();
      const diffMs = end - Date.now();

      if (diffMs <= 0) {
        setRemainingTime('00:00:00');
        setIsCloseToExpiry(false);
        setIsExpired(true);
        return;
      }

      setIsExpired(false);
      
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      // Close to expiry is defined as <= 10 minutes remaining (600 seconds)
      const closeToExpiry = totalSecs <= 10 * 60;
      setIsCloseToExpiry(closeToExpiry);

      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      const sStr = String(seconds).padStart(2, '0');

      setRemainingTime(`${hStr}:${mStr}:${sStr}`);
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  if (isExpired) {
    return (
      <span className="font-mono text-red-500 dark:text-red-400 font-extrabold animate-pulse">
        Expired
      </span>
    );
  }

  return (
    <span className={`font-mono font-bold transition-colors ${
      isCloseToExpiry ? 'text-red-500 dark:text-red-400 font-black animate-pulse' : 'text-text-main font-bold'
    }`}>
      {remainingTime}
    </span>
  );
};

export const TablesPage: React.FC<TablesPageProps> = ({ onNavigateToCheckIn, activeTab, setActiveTab }) => {
 const { showToast, user } = useAuth();
 const { 
    tables: realTables, 
    tokens: realTokens, 
    reservations: realReservations,
    rates,
    isLoading, 
    refreshTables, 
    refreshTokens,
    refreshReservations
  } = useData();

  const tables = realTables;
  const tokens = realTokens;
 const [placeZone, setPlaceZoneState] = useState<'STANDING_BAR' | 'PREMIUM_LOUNGE'>(() => {
 return (localStorage.getItem('bar_web_tables_zone') as 'STANDING_BAR' | 'PREMIUM_LOUNGE') || 'STANDING_BAR';
 });
const setPlaceZone = (zone: 'STANDING_BAR' | 'PREMIUM_LOUNGE') => {
 setPlaceZoneState(zone);
 localStorage.setItem('bar_web_tables_zone', zone);
 };
 
 // Local layout filter for when the route is 'tables/layout'
 const [layoutFilter, setLayoutFilter] = useState<string>('all');

 // Compute actual filter based on the activeTab route
 const filter = activeTab === 'tables/reservations' 
   ? 'reserved' 
   : activeTab === 'tables/occupied' 
   ? 'occupied' 
   : layoutFilter;

 const setFilter = (val: string) => {
 if (val === 'reserved') {
 setActiveTab('tables/reservations');
 } else if (val === 'occupied') {
 setActiveTab('tables/occupied');
 } else {
 setLayoutFilter(val);
 setActiveTab('tables/layout');
 }
 };

 // Assign Modal State
 const [assigningTable, setAssigningTable] = useState<Table | null>(null);
 const [selectedTokenId, setSelectedTokenId] = useState('');
 const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

 // Centered Table Inspection Dialog Modal State
 const [inspectingTable, setInspectingTable] = useState<Table | null>(null);

  type ValidationStatus = 'IDLE' | 'PENDING' | 'VALID' | 'CONFLICT' | 'INVALID';

  // Reserve Form State
  const [reservingTable, setReservingTable] = useState<Table | null>(null);
  const [resName, setResName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resEmail, setResEmail] = useState('');
  const [resPersons, setResPersons] = useState(2);
  const [resPhoneValidationStatus, setResPhoneValidationStatus] = useState<ValidationStatus>('IDLE');
  const [resEmailValidationStatus, setResEmailValidationStatus] = useState<ValidationStatus>('IDLE');
  const [resValidatedPhone, setResValidatedPhone] = useState('');
  const [resValidatedEmail, setResValidatedEmail] = useState('');
  const [resEmailConflict, setResEmailConflict] = useState(false);
  const [resPhoneConflict, setResPhoneConflict] = useState(false);
  const [resPhoneConflictDetail, setResPhoneConflictDetail] = useState<{ type: 'CHECKIN' | 'RESERVATION'; name: string } | null>(null);
  const [resEmailConflictDetail, setResEmailConflictDetail] = useState<{ type: 'CHECKIN' | 'RESERVATION'; name: string } | null>(null);
  const [isResValidating, setIsResValidating] = useState(false);
  const resValidationRequestIdRef = useRef<number>(0);
  const [isSubmittingReserve, setIsSubmittingReserve] = useState(false);
  const [isAssignFlow, setIsAssignFlow] = useState(false);

  const handleResPhoneChange = (val: string) => {
    setResPhone(val);
    setResPhoneConflictDetail(null);
    const trimmed = val.trim();
    if (!trimmed) {
      setResPhoneValidationStatus('IDLE');
      setResPhoneConflict(false);
      setResValidatedPhone('');
    } else if (!isValidPhone(trimmed)) {
      setResPhoneValidationStatus('INVALID');
      setResPhoneConflict(false);
      setResValidatedPhone('');
    } else {
      setResPhoneValidationStatus('PENDING');
      setResValidatedPhone('');
    }
  };

  const handleResEmailChange = (val: string) => {
    setResEmail(val);
    setResEmailConflictDetail(null);
    const trimmed = val.trim();
    if (!trimmed) {
      setResEmailValidationStatus('IDLE');
      setResEmailConflict(false);
      setResValidatedEmail('');
    } else if (!isValidEmail(trimmed)) {
      setResEmailValidationStatus('INVALID');
      setResEmailConflict(false);
      setResValidatedEmail('');
    } else {
      setResEmailValidationStatus('PENDING');
      setResValidatedEmail('');
    }
  };

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isResRefreshing, setIsResRefreshing] = useState(false);

  const handleModalRefresh = async () => {
    if (isResRefreshing) return;
    setIsResRefreshing(true);
    const start = Date.now();
    try {
      setResValidatedPhone('');
      setResValidatedEmail('');
      setRefreshTrigger(prev => prev + 1);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('app:global-refresh'));
      }
      await Promise.allSettled([
        refreshTables(),
        refreshTokens(),
        refreshReservations(),
      ]);
    } finally {
      const elapsed = Date.now() - start;
      const delay = Math.max(0, 500 - elapsed);
      setTimeout(() => setIsResRefreshing(false), delay);
    }
  };

  // Listen for global header refresh button click to immediately re-validate input state in the background without whole-page reload
  useEffect(() => {
    const handleGlobalRefresh = () => {
      setResValidatedPhone('');
      setResValidatedEmail('');
      setRefreshTrigger(prev => prev + 1);
      refreshTables();
      refreshTokens();
      refreshReservations();
    };
    window.addEventListener('app:global-refresh', handleGlobalRefresh);
    return () => {
      window.removeEventListener('app:global-refresh', handleGlobalRefresh);
    };
  }, []);

  // When global reservations or tokens update in background (e.g. reservation cancelled elsewhere), re-evaluate if in conflict
  useEffect(() => {
    if (resPhoneConflict || resEmailConflict || resPhoneValidationStatus === 'CONFLICT' || resEmailValidationStatus === 'CONFLICT') {
      setResValidatedPhone('');
      setResValidatedEmail('');
      setRefreshTrigger(prev => prev + 1);
    }
  }, [realReservations, realTokens]);

  // Real-time backend validation with request versioning and 300ms debounce for Assign/Reserve Table Dialog
  useEffect(() => {
    if (!reservingTable) {
      setResPhoneConflict(false);
      setResEmailConflict(false);
      setResPhoneConflictDetail(null);
      setResEmailConflictDetail(null);
      setResPhoneValidationStatus('IDLE');
      setResEmailValidationStatus('IDLE');
      setResValidatedPhone('');
      setResValidatedEmail('');
      return;
    }

    const p = resPhone.trim();
    const e = resEmail.trim();

    const isPFormatValid = isValidPhone(p);
    const isEFormatValid = isValidEmail(e);

    if (!p) {
      setResPhoneValidationStatus('IDLE');
      setResPhoneConflict(false);
      setResPhoneConflictDetail(null);
      setResValidatedPhone('');
    } else if (!isPFormatValid) {
      setResPhoneValidationStatus('INVALID');
      setResPhoneConflict(false);
      setResPhoneConflictDetail(null);
      setResValidatedPhone('');
    }

    if (!e) {
      setResEmailValidationStatus('IDLE');
      setResEmailConflict(false);
      setResEmailConflictDetail(null);
      setResValidatedEmail('');
    } else if (!isEFormatValid) {
      setResEmailValidationStatus('INVALID');
      setResEmailConflict(false);
      setResEmailConflictDetail(null);
      setResValidatedEmail('');
    }

    const needsPhoneValidation = isPFormatValid && (resPhoneValidationStatus !== 'VALID' || resValidatedPhone !== p);
    const needsEmailValidation = isEFormatValid && (resEmailValidationStatus !== 'VALID' || resValidatedEmail !== e);

    if (!needsPhoneValidation && !needsEmailValidation) {
      return;
    }

    if (needsPhoneValidation) {
      setResPhoneValidationStatus('PENDING');
    }
    if (needsEmailValidation) {
      setResEmailValidationStatus('PENDING');
    }

    const currentRequestId = ++resValidationRequestIdRef.current;

    const timer = setTimeout(async () => {
      try {
        const body: any = {};
        if (isPFormatValid) body.phoneNumber = p;
        if (isEFormatValid) body.email = e;

        const res = await api.validateDuplicate(body);
        if (currentRequestId !== resValidationRequestIdRef.current) {
          return;
        }

        if (isPFormatValid) {
          const hasPhoneConflict = !!res?.conflicts?.phone;
          setResPhoneConflict(hasPhoneConflict);
          setResPhoneConflictDetail(res?.conflictDetails?.phone || null);
          setResPhoneValidationStatus(hasPhoneConflict ? 'CONFLICT' : 'VALID');
          setResValidatedPhone(p);
        }

        if (isEFormatValid) {
          const hasEmailConflict = !!res?.conflicts?.email;
          setResEmailConflict(hasEmailConflict);
          setResEmailConflictDetail(res?.conflictDetails?.email || null);
          setResEmailValidationStatus(hasEmailConflict ? 'CONFLICT' : 'VALID');
          setResValidatedEmail(e);
        }
      } catch (err) {
        if (currentRequestId !== resValidationRequestIdRef.current) return;
        console.error('Error during duplicate validation in Assign/Reserve Dialog:', err);
        if (isPFormatValid) setResPhoneValidationStatus('INVALID');
        if (isEFormatValid) setResEmailValidationStatus('INVALID');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [resPhone, resEmail, reservingTable, refreshTrigger]);

  // Validation functions matching CheckInPage exactly
  const isValidName = (name: string): boolean => {
    const trimmed = name.trim();
    return /^[a-zA-Z\s.'-]{2,100}$/.test(trimmed);
  };

  const isValidPhone = (phone: string): boolean => {
    const trimmed = phone.trim();
    return /^(?:\+91)?[6-9]\d{9}$/.test(trimmed);
  };

  const isValidEmail = (emailStr: string): boolean => {
    if (!emailStr || !emailStr.trim()) return false;
    const trimmed = emailStr.trim().toLowerCase();
    const regex = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9]+(\.[a-z0-9]+)*@gmail\.com$/;
    return regex.test(trimmed);
  };

  // Active Check-in Duplicate Session Check for Dialog
  const normalizedResPhone = resPhone.trim().startsWith('+91') ? resPhone.trim() : `+91${resPhone.trim()}`;
  const isResPhoneActive = tokens.some(t => 
    (t.customer?.phoneNumber === resPhone.trim() || t.customer?.phoneNumber === normalizedResPhone) &&
    (t.status?.toUpperCase() === 'ACTIVE' || t.status?.toUpperCase() === 'EXTENDED') &&
    t.paymentVerified === true
  );

  const isResEmailActive = resEmail.trim() ? tokens.some(t =>
    t.customer?.email?.toLowerCase() === resEmail.trim().toLowerCase() &&
    (t.status?.toUpperCase() === 'ACTIVE' || t.status?.toUpperCase() === 'EXTENDED') &&
    t.paymentVerified === true
  ) : false;

  const isResNameOk = isValidName(resName);
  const isResPhoneOk =
    isValidPhone(resPhone) &&
    resPhoneValidationStatus === 'VALID' &&
    resValidatedPhone === resPhone.trim() &&
    !isResPhoneActive &&
    !resPhoneConflict;

  const isResEmailOk =
    resEmail.trim().length > 0 &&
    isValidEmail(resEmail) &&
    resEmailValidationStatus === 'VALID' &&
    resValidatedEmail === resEmail.trim() &&
    !isResEmailActive &&
    !resEmailConflict;

  const isResCapacityOk = typeof resPersons === 'number' && resPersons > 0 && (!reservingTable || resPersons <= (reservingTable.capacity || 4));

  const isResFormValid = isResNameOk && isResPhoneOk && isResEmailOk && isResCapacityOk && !isResValidating;

  // Reservation Tab Search and Filter States
  const [reservationSearchQuery, setReservationSearchQuery] = useState('');
  const [reservationUserFilter, setReservationUserFilter] = useState<'all' | 'mine' | 'others'>('all');
  const [reservationCapacityFilter, setReservationCapacityFilter] = useState<number | 'all'>('all');

  const getReservedByName = (res: any) => {
    if (res.user) {
      const name = res.user.fullName || res.user.username || 'Staff';
      const roleName = res.user.role?.name || (typeof res.user.role === 'string' ? res.user.role : '');
      const roleTitle = roleName.toLowerCase() === 'admin' 
        ? 'Lead Admin' 
        : roleName.toLowerCase() === 'manager' 
        ? 'Floor Manager' 
        : roleName.toLowerCase() === 'receptionist' 
        ? 'Receptionist' 
        : roleName;
      return roleTitle ? `${name} (${roleTitle})` : name;
    }
    return res.customerName || 'Staff';
  };

  const availableReservationCapacities = useMemo(() => {
    const caps = new Set<number>();
    realReservations.forEach((r: any) => {
      if (r.table?.capacity) caps.add(r.table.capacity);
      if (r.personsCount) caps.add(r.personsCount);
    });
    realTables.forEach(t => {
      if (t.capacity) caps.add(t.capacity);
    });
    return Array.from(caps).sort((a, b) => a - b);
  }, [realReservations, realTables]);

  const filteredReservations = useMemo(() => {
    const pending = realReservations.filter((r: any) => r.status === 'PENDING');
    const q = reservationSearchQuery.trim().toLowerCase();

    return pending.filter((res: any) => {
      // 1. User Filter ('all' | 'mine' | 'others')
      const isMine = res.userId === user?.id;
      if (reservationUserFilter === 'mine' && !isMine) return false;
      if (reservationUserFilter === 'others' && isMine) return false;

      // 2. Capacity Filter
      if (reservationCapacityFilter !== 'all') {
        const tableCap = res.table?.capacity;
        const guestCount = res.personsCount;
        if (tableCap !== reservationCapacityFilter && guestCount !== reservationCapacityFilter) {
          return false;
        }
      }

      // 3. Search Query (Customer Name, Reserving Staff Name, Phone Number, Email ID, Table Number, Capacity/Headcount)
      if (q) {
        const customerName = (res.customerName || '').toLowerCase();
        const reservingUserName = (res.user?.fullName || res.user?.username || '').toLowerCase();
        const phone = (res.phoneNumber || '').toLowerCase();
        const email = (res.email || '').toLowerCase();
        const tableNum = (res.table?.tableNumber || '').toLowerCase();
        const capacityStr = String(res.table?.capacity || '');
        const membersStr = String(res.personsCount || '');

        const match =
          customerName.includes(q) ||
          reservingUserName.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          tableNum.includes(q) ||
          capacityStr === q ||
          membersStr === q;

        if (!match) return false;
      }

      return true;
    });
  }, [realReservations, reservationSearchQuery, reservationUserFilter, reservationCapacityFilter, user]);

  const myReservationsCount = useMemo(() => {
    return realReservations.filter((r: any) => r.status === 'PENDING' && r.userId === user?.id).length;
  }, [realReservations, user]);

  const otherReservationsCount = useMemo(() => {
    return realReservations.filter((r: any) => r.status === 'PENDING' && r.userId !== user?.id).length;
  }, [realReservations, user]);

  // Cancel Confirmation State
  const [cancellingReservation, setCancellingReservation] = useState<any | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Keyboard listener for Cancel Reservation Modal
  useEffect(() => {
    if (!cancellingReservation) return;

    const handleCancelKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (!isSubmittingCancel) {
          e.preventDefault();
          handleCancelConfirm();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setCancellingReservation(null);
      }
    };

    window.addEventListener('keydown', handleCancelKeyDown);
    return () => window.removeEventListener('keydown', handleCancelKeyDown);
  }, [cancellingReservation, isSubmittingCancel]);

  // Keyboard listener for Inspect Table Drawer (Escape to close)
  useEffect(() => {
    if (!inspectingTable) return;
    const handleInspectKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setInspectingTable(null);
      }
    };
    window.addEventListener('keydown', handleInspectKeyDown);
    return () => window.removeEventListener('keydown', handleInspectKeyDown);
  }, [inspectingTable]);

  // Keyboard listener for Reserve / Assign Modal (Escape to close and unlock)
  useEffect(() => {
    if (!reservingTable) return;
    const handleReserveKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseReserveModal();
      }
    };
    window.addEventListener('keydown', handleReserveKeyDown);
    return () => window.removeEventListener('keydown', handleReserveKeyDown);
  }, [reservingTable, isAssignFlow]);

  // Extend Modal State
  const [extendingTable, setExtendingTable] = useState<Table | null>(null);


 // Close Session Modal State
 const [closingTableSession, setClosingTableSession] = useState<Table | null>(null);
 const [closureReasonOption, setClosureReasonOption] = useState('Customer Vacated Early');
 const [closureCustomExplanation, setClosureCustomExplanation] = useState('');
 const [isSubmittingCloseSession, setIsSubmittingCloseSession] = useState(false);

  const refreshAllTableData = () => {
    return Promise.all([refreshTables(), refreshTokens(), refreshReservations()]);
  };

  useEffect(() => {
    refreshAllTableData();
    const handleGlobalRefresh = () => refreshAllTableData();
    window.addEventListener('app:global-refresh', handleGlobalRefresh);
    return () => {
      window.removeEventListener('app:global-refresh', handleGlobalRefresh);
    };
  }, [activeTab]);

  const inspectTableById = (tableIdentifier: string) => {
    if (!tableIdentifier || realTables.length === 0) return;
    const clean = String(tableIdentifier).trim();

    // Match table by table.id, table.tableNumber, currentTokenId, or token relation
    const targetTable = realTables.find(t => 
      t.id === clean || 
      t.tableNumber.toLowerCase() === clean.toLowerCase() ||
      t.tableNumber.toLowerCase() === clean.replace(/^t-/, '').toLowerCase() ||
      (t.currentTokenId && t.currentTokenId === clean) ||
      tokens.some(tk => (tk.id === clean || tk.tokenNumber === clean) && (tk.tableId === t.id || (tk.table && tk.table.id === t.id)))
    );

    if (targetTable) {
      localStorage.removeItem('bar_auto_inspect_table_id');
      
      const isLounge = targetTable.placeTypeId === 'PREMIUM_LOUNGE' || targetTable.tableNumber.startsWith('L-');
      const targetZone = isLounge ? 'PREMIUM_LOUNGE' : 'STANDING_BAR';
      if (placeZone !== targetZone) {
        setPlaceZone(targetZone);
      }
      if (activeTab !== 'tables/occupied') {
        setActiveTab('tables/occupied');
      }
      setInspectingTable(targetTable);
    } else {
      localStorage.removeItem('bar_auto_inspect_table_id');
    }
  };

  useEffect(() => {
    const autoInspectId = localStorage.getItem('bar_auto_inspect_table_id');
    if (autoInspectId) {
      inspectTableById(autoInspectId);
    }
  }, [realTables, activeTab]);

  useEffect(() => {
    const handleAutoInspect = (e: Event) => {
      const customEvent = e as CustomEvent;
      const tableId = customEvent.detail?.tableId;
      if (tableId) {
        inspectTableById(tableId);
      }
    };
    window.addEventListener('bar_auto_inspect', handleAutoInspect);
    return () => {
      window.removeEventListener('bar_auto_inspect', handleAutoInspect);
    };
  }, [realTables, placeZone, activeTab]);

 const zoneFilteredTables = tables.filter(tb => {
 const p = (tb.placeTypeId || tb.categoryName || tb.tableNumber || '').toUpperCase();
 if (placeZone === 'STANDING_BAR') {
 return p.includes('STANDING') || p.includes('BAR') || tb.tableNumber.startsWith('S-');
 }
 return p.includes('PREMIUM') || p.includes('LOUNGE') || tb.tableNumber.startsWith('L-');
 });

 const filteredTables = zoneFilteredTables.filter(t => {
    if (filter === 'reserved') {
      return t.status === 'reserved' || t.status === 'in_checkin';
    } else if (filter === 'available') {
      return t.status === 'available';
    } else if (filter === 'occupied') {
      return t.status === 'occupied';
    }
    return true;
  });

  const handleCloseSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingTableSession) return;
    const token = tokens.find(tk => tk.tableId === closingTableSession.id || (tk.table && tk.table.id === closingTableSession.id));
    if (!token) {
      showToast('No active token session found for this table.', 'danger');
      return;
    }

    setIsSubmittingCloseSession(true);
    try {
      const reasonDetail = closureReasonOption === 'Other / Administrative Closure' && closureCustomExplanation
        ? `Other - ${closureCustomExplanation}`
        : closureReasonOption;

      await api.closeToken(token.tokenNumber, reasonDetail);
      showToast(`Session for Table ${closingTableSession.tableNumber} checked out successfully!`, 'success');
      setClosingTableSession(null);
      setClosureCustomExplanation('');
      if (inspectingTable && inspectingTable.id === closingTableSession.id) {
        setInspectingTable(null);
      }
      refreshTables();
      refreshTokens();
    } catch (err: any) {
      showToast(err.message || 'Failed to checkout session.', 'danger');
    } finally {
      setIsSubmittingCloseSession(false);
    }
  };



 const handleAssignSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!assigningTable || !selectedTokenId) return;

 setIsSubmittingAssign(true);
 try {
 await api.assignTable(assigningTable.id, selectedTokenId);
 showToast(`Table ${assigningTable.tableNumber} assigned successfully!`, 'success');
 setAssigningTable(null);
 setSelectedTokenId('');
 refreshTables();
 refreshTokens();
 } catch (err: any) {
 showToast(err.message || 'Failed to assign table.', 'danger');
 } finally {
 setIsSubmittingAssign(false);
 }
 };
  const handleAssignClick = async (tb: Table) => {
    try {
      await api.lockTable(tb.id);
      setReservingTable(tb);
      setIsAssignFlow(true);
      setResPersons(tb.capacity || 4);
      setResName('');
      setResPhone('');
      setResEmail('');
      setResPhoneValidationStatus('IDLE');
      setResEmailValidationStatus('IDLE');
      setResPhoneConflict(false);
      setResEmailConflict(false);
      setResPhoneConflictDetail(null);
      setResEmailConflictDetail(null);
      setResValidatedPhone('');
      setResValidatedEmail('');
      refreshTables();
    } catch (err: any) {
      showToast(err.message || `Table ${tb.tableNumber} is locked or unavailable.`, 'danger');
      refreshTables();
    }
  };

  const handleReserveClick = (tb: Table) => {
    setReservingTable(tb);
    setIsAssignFlow(false);
    setResPersons(tb.capacity || 4);
    setResName('');
    setResPhone('');
    setResEmail('');
    setResPhoneValidationStatus('IDLE');
    setResEmailValidationStatus('IDLE');
    setResPhoneConflict(false);
    setResEmailConflict(false);
    setResPhoneConflictDetail(null);
    setResEmailConflictDetail(null);
    setResValidatedPhone('');
    setResValidatedEmail('');
  };

  const handleCloseReserveModal = async () => {
    if (isAssignFlow && reservingTable) {
      try {
        await api.unlockTable(reservingTable.id);
      } catch (err) {
        console.warn('Failed to unlock table on modal close:', err);
      }
    }
    setReservingTable(null);
    setIsAssignFlow(false);
    setResName('');
    setResPhone('');
    setResEmail('');
    setResPhoneValidationStatus('IDLE');
    setResEmailValidationStatus('IDLE');
    setResPhoneConflict(false);
    setResEmailConflict(false);
    setResPhoneConflictDetail(null);
    setResEmailConflictDetail(null);
    setResValidatedPhone('');
    setResValidatedEmail('');
    refreshTables();
  };

  const handleReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservingTable || !isResFormValid) return;

    const trimmedName = resName.trim();
    const trimmedPhone = resPhone.trim();
    const trimmedEmail = resEmail.trim();

    const nameRegex = /^[a-zA-Z\s.'-]{2,100}$/;
    const phoneRegex = /^(?:\+91)?[6-9]\d{9}$/;
    const emailRegex = /^(?!.*\.\.)(?!\.)(?!.*\.$)[a-z0-9]+(\.[a-z0-9]+)*@gmail\.com$/;

    // 1. Mandatory & Format Validations
    if (!trimmedName || !trimmedPhone || !trimmedEmail || !resPersons) {
      showToast('All fields are mandatory to confirm the reservation.', 'warning');
      return;
    }

    if (!nameRegex.test(trimmedName)) {
      showToast('Please enter a valid customer full name (2-100 letters).', 'danger');
      return;
    }

    if (!phoneRegex.test(trimmedPhone)) {
      showToast('Please enter a valid 10-digit Indian mobile number.', 'danger');
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      showToast('Please enter a valid email address.', 'danger');
      return;
    }

    const countVal = Number(resPersons);
    if (isNaN(countVal) || countVal <= 0 || countVal % 1 !== 0) {
      showToast('Please enter a valid, non-decimal guest count.', 'warning');
      return;
    }

    if (countVal > reservingTable.capacity) {
      showToast(`Headcount cannot exceed Table maximum capacity of ${reservingTable.capacity} seats.`, 'warning');
      return;
    }

    setIsSubmittingReserve(true);

    try {
      // 2. Local Duplicate Session Check against Active Tokens
      const normalizedPhone = trimmedPhone.startsWith('+91') ? trimmedPhone : `+91${trimmedPhone}`;
      const isPhoneActive = tokens.some(t => 
        (t.customer?.phoneNumber === trimmedPhone || t.customer?.phoneNumber === normalizedPhone) &&
        (t.status?.toUpperCase() === 'ACTIVE' || t.status?.toUpperCase() === 'EXTENDED')
      );

      const isEmailActive = trimmedEmail ? tokens.some(t =>
        t.customer?.email?.toLowerCase() === trimmedEmail.toLowerCase() &&
        (t.status?.toUpperCase() === 'ACTIVE' || t.status?.toUpperCase() === 'EXTENDED')
      ) : false;

      if (isPhoneActive) {
        showToast('This phone number is already checked in.', 'danger');
        setIsSubmittingReserve(false);
        return;
      }

      if (isEmailActive) {
        showToast('This email ID is already checked in.', 'danger');
        setIsSubmittingReserve(false);
        return;
      }

      // 3. Backend Duplicate Validation Check
      try {
        const validateRes = await api.validateDuplicate({
          phoneNumber: trimmedPhone,
          email: trimmedEmail
        });

        if (validateRes && validateRes.conflicts) {
          if (validateRes.conflicts.phone) {
            setResPhoneConflict(true);
            setResPhoneConflictDetail(validateRes.conflictDetails?.phone || null);
            setResPhoneValidationStatus('CONFLICT');
            const phoneOwner = validateRes.conflictDetails?.phone?.name;
            const phoneMsg = validateRes.conflictDetails?.phone?.type === 'RESERVATION'
              ? `This phone number is already reserved by ${phoneOwner || 'a customer'}.`
              : `This phone number is currently being used by ${phoneOwner || 'another user'}.`;
            showToast(phoneMsg, 'danger');
            setIsSubmittingReserve(false);
            return;
          }
          if (validateRes.conflicts.email) {
            setResEmailConflict(true);
            setResEmailConflictDetail(validateRes.conflictDetails?.email || null);
            setResEmailValidationStatus('CONFLICT');
            const emailOwner = validateRes.conflictDetails?.email?.name;
            const emailMsg = validateRes.conflictDetails?.email?.type === 'RESERVATION'
              ? `This email address is already reserved by ${emailOwner || 'a customer'}.`
              : `This email address is currently being used by ${emailOwner || 'another user'}.`;
            showToast(emailMsg, 'danger');
            setIsSubmittingReserve(false);
            return;
          }
        }
      } catch (validateErr) {
        console.warn('Backend duplicate validation check failed, relying on local state check:', validateErr);
      }
      if (isAssignFlow) {
        // Store assign target details for check-in WITHOUT creating a reservation or pre-locking the table
        localStorage.setItem('bar_checkin_assign_target', JSON.stringify({
          customerName: resName.trim(),
          phoneNumber: resPhone.trim(),
          email: resEmail.trim(),
          personsCount: Number(resPersons),
          tableId: reservingTable.id,
          tableNumber: reservingTable.tableNumber,
          capacity: reservingTable.capacity || 4,
          placeTypeId: reservingTable.placeTypeId || (reservingTable.tableNumber.startsWith('L-') ? 'PREMIUM_LOUNGE' : 'STANDING_BAR'),
        }));
        localStorage.setItem('bar_checkin_just_assigned', 'true');

        showToast(`Table ${reservingTable.tableNumber} details saved! Proceeding to check-in.`, 'success');
        setReservingTable(null);
        setResName('');
        setResPhone('');
        setResEmail('');
        if (onNavigateToCheckIn) {
          onNavigateToCheckIn();
        }
      } else {
        // Normal reservation creation flow
        const res = await api.createReservation({
          customerName: resName.trim(),
          phoneNumber: resPhone.trim(),
          email: resEmail.trim(),
          personsCount: Number(resPersons),
          tableId: reservingTable.id
        });
        
        if (res.success && res.reservation) {
          showToast(`Reservation for Table ${reservingTable.tableNumber} confirmed!`, 'success');
          setReservingTable(null);
          setResName('');
          setResPhone('');
          setResEmail('');
          refreshTables();
          refreshReservations();
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to complete action.', 'danger');
    } finally {
      setIsSubmittingReserve(false);
    }
  };

  const handleCancelClick = (tb: Table) => {
    const res = realReservations.find((r: any) => r.tableId === tb.id && r.status === 'PENDING');
    if (res) {
      setCancellingReservation(res);
    } else {
      // Fallback
      setCancellingReservation({
        id: '',
        tableId: tb.id,
        customerName: 'Reserved Table',
        table: tb
      });
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancellingReservation) return;
    setIsSubmittingCancel(true);
    try {
      if (cancellingReservation.id) {
        await api.cancelReservation(cancellingReservation.id);
      } else {
        await api.patchTableStatus(cancellingReservation.tableId, 'available');
      }
      showToast('Reservation cancelled successfully.', 'success');
      setCancellingReservation(null);
      if (inspectingTable && inspectingTable.id === cancellingReservation.tableId) {
        setInspectingTable(null);
      }
      refreshTables();
      refreshReservations();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel reservation.', 'danger');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleAssignReservation = async (res: any) => {
    try {
      await api.lockTable(res.tableId);

      try {
        const oldDraftStr = localStorage.getItem('bar_incomplete_checkin');
        if (oldDraftStr) {
          const oldDraft = JSON.parse(oldDraftStr);
          if (oldDraft.selectedTableId && oldDraft.selectedTableId !== res.tableId) {
            api.unlockTable(oldDraft.selectedTableId).catch(() => {});
          }
        }
      } catch (e) {}
      
      localStorage.setItem('bar_checkin_assign_target', JSON.stringify({
        reservationId: res.id,
        customerName: res.customerName,
        phoneNumber: res.phoneNumber,
        email: res.email,
        personsCount: res.personsCount,
        tableId: res.tableId,
        tableNumber: res.table?.tableNumber || '',
        capacity: res.table?.capacity || 4,
        placeTypeId: res.table?.placeTypeId || 'standing_bar'
      }));
      localStorage.setItem('bar_checkin_original_status', 'reserved');
      localStorage.setItem('bar_checkin_just_assigned', 'true');
      
      setInspectingTable(null);
      if (onNavigateToCheckIn) {
        onNavigateToCheckIn();
      }
      refreshTables();
      refreshReservations();
    } catch (err: any) {
      showToast(err.message || 'Failed to lock table for check-in. It may have been selected by another user.', 'danger');
    }
  };

  const handleCheckInReservedTable = (tb: Table) => {
    const res = realReservations.find((r: any) => r.tableId === tb.id && r.status === 'PENDING');
    if (res) {
      handleAssignReservation(res);
    } else {
      handleRedirectToCheckIn(tb);
    }
  };

  const handleRedirectToCheckIn = async (tb: Table) => {
    try {
      const originalStatus = tb.status; // 'available' or 'reserved'
      await api.lockTable(tb.id);

      try {
        const oldDraftStr = localStorage.getItem('bar_incomplete_checkin');
        if (oldDraftStr) {
          const oldDraft = JSON.parse(oldDraftStr);
          if (oldDraft.selectedTableId && oldDraft.selectedTableId !== tb.id) {
            api.unlockTable(oldDraft.selectedTableId).catch(() => {});
          }
        }
      } catch (e) {}
      
      localStorage.setItem('bar_checkin_assign_target', JSON.stringify({
        tableId: tb.id,
        tableNumber: tb.tableNumber,
        capacity: tb.capacity || 4,
        placeTypeId: (tb.tableNumber.startsWith('S-') || tb.tableNumber.startsWith('M')) ? 'standing_bar' : 'premium_lounge'
      }));
      localStorage.setItem('bar_checkin_original_status', originalStatus);
      localStorage.setItem('bar_checkin_just_assigned', 'true');
      
      setInspectingTable(null);
      if (onNavigateToCheckIn) {
        onNavigateToCheckIn();
      }
      refreshTables();
      refreshReservations();
    } catch (err: any) {
      showToast(err.message || 'Failed to lock table for check-in. It may have been selected by another user.', 'danger');
    }
  };

 const inspectingToken = inspectingTable 
 ? tokens.find(tk => tk.tableId === inspectingTable.id || (tk.table && tk.table.id === inspectingTable.id))
 : null;

 return (
 <div className="space-y-6 text-text-main">
 
  {/* Non-Overlapping Structured Control Toolbar - Only for Floor Plan Layout */}
  {activeTab !== 'tables/reservations' && (
    <div className="dark:bg-transparent glass-panel border border-border-main border-x-0 border-t-0 rounded-none p-0 pb-4 mb-6 space-y-4">
      {/* Tier 1: Primary Zone Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 pb-4 border-b border-border-main w-full">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto px-4">
          <button
            onClick={() => setPlaceZone('STANDING_BAR')}
            className={`w-full sm:w-auto px-4 py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all premium-tab-primary text-center shrink-0 ${
              placeZone === 'STANDING_BAR' ? 'active' : ''
            }`}
          >
            Standard Zone (Standing Bar)
          </button>

          <button
            onClick={() => setPlaceZone('PREMIUM_LOUNGE')}
            className={`w-full sm:w-auto px-4 py-2.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all premium-tab-primary text-center shrink-0 ${
              placeZone === 'PREMIUM_LOUNGE' ? 'active' : ''
            }`}
          >
            Premium Zone (Lounge)
          </button>
        </div>

        <div className="text-xs font-bold text-text-muted w-full sm:w-auto text-left sm:text-right flex items-center justify-between sm:block px-4">
          <span>Total Tables:</span> <span className="text-text-main font-mono text-sm sm:text-xs">{filteredTables.length}</span>
        </div>
      </div>

      {/* Tier 2: Secondary Status Filters & Refresh Action */}
      <div className="flex items-center justify-between gap-3 w-full px-4">
        <div className="flex flex-nowrap overflow-x-auto custom-scrollbar items-center gap-2 flex-1 sm:flex-initial pb-1 sm:pb-0">
          <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider mr-1 hidden sm:inline-block">Status Filter:</span>
          {['all', 'available', 'occupied', 'reserved'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 sm:px-3.5 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all premium-tab-secondary shrink-0 ${
                filter === f ? 'active' : ''
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  )}

  {/* Active Reservations View */}
  {activeTab === 'tables/reservations' ? (
    <div className="space-y-6">
      {/* Reservation Search & Filter Toolbar */}
      <div className="p-4 sm:p-5 rounded-3xl dark:rounded-xl border dark:border-white/10 dark:bg-[#1C1C1E] bg-bg-surface space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={reservationSearchQuery}
              onChange={(e) => setReservationSearchQuery(e.target.value)}
              placeholder="Search by customer name, staff name, phone, email, table #..."
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-border-main bg-bg-primary text-text-main text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-text-muted/60 transition-all"
            />
            {reservationSearchQuery && (
              <button
                onClick={() => setReservationSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters Group: Capacity Selector & Quick Reserve */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border-main bg-bg-primary text-xs shrink-0">
              <Filter size={13} className="text-text-muted shrink-0" />
              <span className="text-text-muted font-semibold hidden sm:inline">Capacity:</span>
              <select
                value={reservationCapacityFilter}
                onChange={(e) => setReservationCapacityFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="bg-transparent text-text-main font-bold focus:outline-none cursor-pointer text-xs"
              >
                <option value="all" className="bg-bg-surface text-text-main">All Capacities</option>
                {availableReservationCapacities.map((cap) => (
                  <option key={cap} value={cap} className="bg-bg-surface text-text-main">
                    {cap} Guests Max
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                setActiveTab('tables/all');
                setFilter('available');
              }}
              className="px-4 py-2.5 rounded-xl primary-btn text-xs font-bold whitespace-nowrap flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <UserPlus size={14} />
              <span>+ Reserve Table</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Segmented Pills */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-main/50 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider mr-1 hidden sm:inline-block">Filter By:</span>
            <button
              onClick={() => setReservationUserFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                reservationUserFilter === 'all'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-bg-primary text-text-muted hover:text-text-main border border-border-main'
              }`}
            >
              All Reservations ({realReservations.filter((r: any) => r.status === 'PENDING').length})
            </button>
            <button
              onClick={() => setReservationUserFilter('mine')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                reservationUserFilter === 'mine'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-bg-primary text-text-muted hover:text-text-main border border-border-main'
              }`}
            >
              My Reservations ({myReservationsCount})
            </button>
            <button
              onClick={() => setReservationUserFilter('others')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                reservationUserFilter === 'others'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-bg-primary text-text-muted hover:text-text-main border border-border-main'
              }`}
            >
              Other Staff ({otherReservationsCount})
            </button>
          </div>

          <div className="text-xs text-text-muted font-medium">
            Showing <span className="font-bold text-text-main">{filteredReservations.length}</span> matching
          </div>
        </div>
      </div>

      {/* Content Cards */}
      {isLoading && realReservations.length === 0 ? (
        <div className="py-20 text-center text-text-muted text-sm">Loading active reservations...</div>
      ) : filteredReservations.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl border border-border-main text-center space-y-3">
          <p className="text-text-muted text-sm">
            {reservationSearchQuery || reservationUserFilter !== 'all' || reservationCapacityFilter !== 'all'
              ? 'No reservations match your search or filter criteria.'
              : 'No active reservations found.'}
          </p>
          {(reservationSearchQuery || reservationUserFilter !== 'all' || reservationCapacityFilter !== 'all') && (
            <button
              onClick={() => {
                setReservationSearchQuery('');
                setReservationUserFilter('all');
                setReservationCapacityFilter('all');
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-primary text-primary border border-primary/30 hover:bg-primary/10 transition-all cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReservations.map((res: any) => {
            const isMine = res.userId === user?.id;
            const isPrivileged = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'manager';
            const isOwner = !res.userId || isMine || isPrivileged;
            const resOwner = getReservedByName(res);
            const isTableOccupied = (res.table?.status || '').toLowerCase() === 'occupied';

            const assignDisabled = !isOwner || isTableOccupied;
            const assignTooltip = !isOwner
              ? `This table was reserved by ${resOwner}. Only ${resOwner} or an Admin can check in this table.`
              : isTableOccupied
              ? 'Table is currently occupied by an active session.'
              : undefined;

            const cancelDisabled = !isOwner || isTableOccupied;
            const cancelTooltip = !isOwner
              ? `This reservation was created by ${resOwner}. Only ${resOwner} or an Admin can cancel it.`
              : isTableOccupied
              ? 'Reservation cannot be cancelled because table is occupied.'
              : undefined;

            return (
              <div
                key={res.id}
                className={`p-5 rounded-3xl dark:rounded-xl border flex flex-col justify-between gap-4 transition-all animate-fadeIn ${
                  isMine
                    ? 'border-primary/40 dark:border-primary/40 dark:bg-[#1C1C1E] bg-bg-surface shadow-sm'
                    : 'dark:border-white/10 dark:bg-[#1C1C1E] bg-bg-surface'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-border-main/50 gap-2">
                  <div>
                    <h4 className="font-bold text-base text-text-main">{res.customerName}</h4>
                    <p className="text-xs font-mono text-text-muted mt-0.5">{res.phoneNumber}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider dark:bg-blue-500/15 bg-blue-500/10 dark:text-blue-400 text-blue-700 border border-blue-500/30">
                      Reserved
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-tight ${
                      isMine
                        ? 'bg-purple-500/15 text-primary dark:text-purple-300 border border-purple-500/30'
                        : 'bg-neutral-500/10 text-text-muted border border-border-main'
                    }`}>
                      {isMine ? '👤 Reserved by You' : `🔒 Reserved by ${resOwner}`}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs text-text-muted">
                  <div className="flex justify-between items-center">
                    <span>Table Assigned:</span>
                    <span className="font-bold text-primary font-mono text-sm">
                      {res.table?.tableNumber ? `Table ${res.table.tableNumber}` : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Capacity / Headcount:</span>
                    <span className="font-semibold text-text-main">
                      {res.personsCount} Guests (Max {res.table?.capacity || 4})
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Email ID:</span>
                    <span className="font-semibold text-text-main truncate max-w-[190px]" title={res.email}>
                      {res.email || '—'}
                    </span>
                  </div>
                  {res.createdAt && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span>Created:</span>
                      <span className="text-text-muted">
                        {new Date(res.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>

                {/* Ownership Notice if not owner */}
                {!isOwner && (
                  <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 border border-border-main text-[11px] text-text-muted flex items-center gap-2">
                    <Lock size={13} className="text-amber-500 shrink-0" />
                    <span>Reserved by <strong className="text-text-main">{resOwner}</strong>. You cannot check in this table.</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleAssignReservation(res)}
                    disabled={assignDisabled}
                    title={assignTooltip}
                    className={`flex-1 py-2.5 rounded-xl primary-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                      assignDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {assignDisabled && !isOwner ? (
                      <>
                        <Lock size={13} /> Check-In Locked
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} /> Check-In / Assign
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setCancellingReservation(res)}
                    disabled={cancelDisabled}
                    title={cancelTooltip}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                      cancelDisabled
                        ? 'bg-gray-100 dark:bg-[#1C1C1E]/50 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-white/5 cursor-not-allowed opacity-40'
                        : 'dark:bg-red-500/10 bg-red-500/5 hover:dark:bg-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-700 dark:hover:text-red-300 active:bg-red-500/20 dark:active:bg-red-500/30 dark:text-red-400 text-red-600 border border-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  ) : isLoading && filteredTables.length === 0 ? (
  <div className="py-20 text-center text-text-muted text-sm">Loading floor layout & seat maps...</div>
  ) : filteredTables.length === 0 ? (
  <div className="glass-panel p-12 rounded-3xl border border-border-main text-center space-y-3">
  <p className="text-text-muted text-sm">No tables match your filter parameters.</p>
  </div>
  ) : (
 <div className="space-y-8">
 {Array.from(new Set(filteredTables.map(tb => tb.capacity || 4)))
 .sort((a, b) => b - a)
 .map(cap => {
 const capTables = filteredTables
 .filter(tb => (tb.capacity || 4) === cap)
 .sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true, sensitivity: 'base' }));

 if (capTables.length === 0) return null;

 return (
 <SeatingRow key={cap} capacity={cap} tableCount={capTables.length}>
 {capTables.map(tb => {
 const isOccupied = tb.status === 'occupied';
 const capacity = tb.capacity || 4;
 const assignedToken = tokens.find(tk => tk.tableId === tb.id || (tk.table && tk.table.id === tb.id));
 const occupiedCount = assignedToken ? (assignedToken.personsCount || 1) : (isOccupied ? capacity : 0);
 const sizeCategory = capacity <= 2 ? 'Small' : capacity <= 4 ? 'Medium' : capacity <= 6 ? 'Large' : 'VIP Executive';

 const isFull = isOccupied && occupiedCount >= capacity;
 const isPartial = isOccupied && occupiedCount > 0 && occupiedCount < capacity;

 return (
 <div
 key={tb.id}
 onClick={() => setInspectingTable(tb)}
 className={`w-[290px] shrink-0 snap-start p-5 rounded-3xl dark:rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-3 min-h-[295px] dark:bg-[#1C1C1E] ${
 inspectingTable?.id === tb.id ? 'dark:border-primary' : 'dark:border-white/10'
 } ${
  isFull
  ? 'bg-bg-surface/50 border-red-500/30 '
  : isPartial
  ? 'bg-bg-surface/50 border-amber-500/30 '
  : tb.status === 'in_checkin'
  ? 'bg-bg-surface/90 border-amber-500/40 opacity-90 '
  : tb.status === 'reserved'
  ? 'bg-bg-surface border-blue-500/20 '
  : tb.status === 'maintenance'
  ? 'bg-bg-surface/50 border-border-main opacity-60 '
  : 'bg-bg-surface border-emerald-500/30 dark:hover:border-primary/50 hover:border-primary/50 dark: '
  }`}
  >
  {/* Header: Table Number & Semantic Status Pill */}
  <div className="flex items-center justify-between">
  <div>
  <span className="font-mono dark:text-[#D4AF37] text-primary font-black text-xl tracking-wide">{tb.tableNumber}</span>
  <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block mt-0.5">
  {placeZone === 'STANDING_BAR' ? 'Standard Zone' : 'Premium Zone'}
  </p>
  </div>

  <span
  className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
  isFull
  ? 'dark:bg-red-500/15 bg-red-500/10 dark:text-red-400 text-red-700 border border-red-500/30'
  : isPartial
  ? 'dark:bg-amber-500/15 bg-amber-500/10 dark:text-amber-400 text-amber-700 border border-amber-500/30'
  : tb.status === 'in_checkin'
  ? 'dark:bg-amber-500/10 bg-amber-500/5 dark:text-amber-400 text-amber-600 border border-amber-500/25'
  : tb.status === 'reserved'
  ? 'dark:bg-blue-500/15 bg-blue-500/10 dark:text-blue-400 text-blue-700 border border-blue-500/30'
  : tb.status === 'maintenance'
  ? 'dark:bg-zinc-800/50 bg-zinc-200/50 text-text-muted border border-border-main'
  : 'dark:bg-emerald-500/15 bg-emerald-500/10 dark:text-emerald-400 text-emerald-700 border border-emerald-500/30'
  }`}
  >
  {isOccupied ? <Users size={12} /> : tb.status === 'in_checkin' ? <Lock size={12} /> : <CheckCircle2 size={12} />}
  <span className="capitalize">
  {isFull ? 'Occupied' : isPartial ? 'Partially Occupied' : tb.status === 'in_checkin' ? 'In Check-In' : tb.status}
  </span>
  </span>
  </div>

 {/* Central Dynamic Table Diagram Container */}
 <div className="py-1 px-2 rounded-2xl bg-bg-primary/80 border border-border-main flex items-center justify-center h-28 relative">
 <TableDiagram
 capacity={capacity}
 occupiedCount={occupiedCount}
 status={tb.status}
 tableNumber={tb.tableNumber}
 />
 </div>

 {/* Info Bar - Size, Capacity & Token Metadata */}
 <div className="space-y-1 text-xs px-1">
 <div className="flex items-center justify-between text-[11px] font-bold text-text-muted">
 <span className="uppercase text-[10px] tracking-wider">{sizeCategory} • {capacity} {capacity === 1 ? 'Person' : 'Persons'}</span>
 <span className={
 isFull
 ? 'dark:text-red-400 text-red-700 font-extrabold'
 : isPartial
 ? 'dark:text-amber-400 text-amber-700 font-extrabold'
 : tb.status === 'in_checkin'
 ? 'dark:text-amber-400 text-amber-700 font-extrabold'
 : tb.status === 'reserved'
 ? 'dark:text-blue-400 text-blue-700 font-extrabold'
 : 'dark:text-emerald-400 text-emerald-700 font-extrabold'
 }>
 {occupiedCount} / {capacity} Seats
 </span>
 </div>

 {assignedToken ? (
  <div className="space-y-1 border-t border-border-main/40 pt-1 text-text-muted">
    <div className="flex items-center justify-between text-[11px]">
      <span className="font-semibold truncate max-w-[120px]">👤 {assignedToken.customer?.name || 'Guest'}</span>
      <span className="font-mono text-text-main font-bold">{assignedToken.tokenNumber}</span>
    </div>
    {tb.status === 'occupied' && (
      <div className="mt-2 px-3 py-2 rounded-2xl bg-bg-secondary-surface dark:bg-black/25 border border-border-main/60 flex items-center justify-between text-xs font-semibold shadow-sm animate-fadeIn">
        <span className="text-[10px] text-text-muted uppercase tracking-wider font-extrabold">Time Remaining</span>
        <div className="text-[13px] font-black tracking-wide">
          <TableTimer endTime={assignedToken.endTime} />
        </div>
      </div>
    )}
  </div>
 ) : (
 <div className="text-[10px] text-text-muted border-t border-border-main/30 pt-1 flex justify-between">
 <span>Rate Allowance:</span>
 <span className="font-mono font-bold text-text-main">₹500 / Session</span>
 </div>
 )}
 </div>

 {/* Card Action Row */}
 <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-border-main/50">
    {tb.status === 'occupied' ? (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setInspectingTable(tb);
        }}
        className="w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 dark:hover:bg-amber-500/20 dark:text-amber-300 text-amber-700 text-xs font-bold border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <Search size={14} /> Inspect Details
      </button>
    ) : tb.status === 'in_checkin' ? (
      <button
        disabled
        onClick={(e) => e.stopPropagation()}
        className="w-full py-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30 text-xs font-bold transition-all text-center cursor-not-allowed"
      >
        In Check-In
      </button>
    ) : tb.status === 'reserved' ? (
      (() => {
        const res = realReservations.find((r: any) => r.tableId === tb.id && r.status === 'PENDING');
        const isMine = res && res.userId === user?.id;
        const isPrivileged = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'manager';
        const isOwner = !res || !res.userId || isMine || isPrivileged;
        const resOwner = res ? getReservedByName(res) : 'Staff';
        return (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCheckInReservedTable(tb);
              }}
              disabled={!isOwner}
              title={!isOwner ? `This table was reserved by ${resOwner}. Only ${resOwner} or an Admin can check in this table.` : undefined}
              className={`flex-1 py-2.5 rounded-xl primary-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                !isOwner ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {!isOwner ? (
                <>
                  <Lock size={13} /> Locked
                </>
              ) : (
                <>
                  <UserPlus size={14} /> Check-In
                </>
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancelClick(tb);
              }}
              disabled={!isOwner}
              title={!isOwner ? `This reservation was created by ${resOwner}. Only ${resOwner} or an Admin can cancel it.` : undefined}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                !isOwner 
                  ? 'bg-gray-100 dark:bg-[#1C1C1E]/50 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-white/5 cursor-not-allowed opacity-40' 
                  : 'dark:bg-red-500/10 bg-red-500/5 hover:dark:bg-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-700 dark:hover:text-red-300 active:bg-red-500/20 dark:active:bg-red-500/30 dark:text-red-400 text-red-600 border border-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer'
              }`}
            >
              Cancel
            </button>
          </>
        );
      })()
    ) : tb.status === 'available' ? (
      <>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAssignClick(tb);
          }}
          className="flex-1 py-2.5 rounded-xl primary-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <UserPlus size={14} /> Assign
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleReserveClick(tb);
          }}
          className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-primary text-primary hover:bg-primary/5 transition-all cursor-pointer text-center"
        >
          Reserve
        </button>
      </>
    ) : (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setInspectingTable(tb);
        }}
        className="w-full py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card border border-border-main text-text-muted hover:text-text-main transition-all cursor-pointer flex items-center justify-center gap-1.5"
      >
        <Search size={14} /> Inspect
      </button>
    )}
 </div>
 </div>
 );
 })}
 </SeatingRow>
 );
 })}
 </div>
 )}

 {/* INSPECT DETAILS DRAWER */}
  {(() => {
    if (!inspectingTable) return null;
    const capacity = inspectingTable.capacity || 4;
    const assignedToken = tokens.find(tk => tk.tableId === inspectingTable.id || (tk.table && tk.table.id === inspectingTable.id));
    const isOccupied = inspectingTable.status === 'occupied';
    const occupiedCount = assignedToken ? (assignedToken.personsCount || 1) : (isOccupied ? capacity : 0);

    return (
      <div 
        className="fixed inset-0 z-[100] bg-black/40 dark:bg-black/60 backdrop-blur-[2px] flex items-stretch justify-end p-0 animate-fadeIn"
        onClick={() => setInspectingTable(null)}
      >
        <div 
          className="w-full sm:w-[380px] md:w-[400px] bg-bg-surface dark:bg-[#18181B] border-l border-border-main dark:border-white/10 p-5 relative text-text-main h-[100dvh] max-h-screen shadow-2xl flex flex-col justify-between"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border-main dark:border-white/10 shrink-0">
            <div className="flex items-center gap-2 text-text-main font-bold text-base dark:text-white pr-2">
              <span className="font-mono text-lg font-black tracking-wide dark:text-[#D4AF37] text-primary">
                {inspectingTable.tableNumber.startsWith('S-') || inspectingTable.tableNumber.startsWith('L-') || inspectingTable.tableNumber.startsWith('M')
                  ? inspectingTable.tableNumber 
                  : `T-${inspectingTable.tableNumber}`}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-bg-primary dark:bg-white/5 text-text-muted border border-border-main dark:border-white/10">
                {(inspectingTable.placeTypeId === 'PREMIUM_LOUNGE' || inspectingTable.tableNumber.startsWith('L-')) ? 'Premium Lounge' : 'Standing Bar'}
              </span>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setInspectingTable(null);
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-text-muted hover:text-text-main hover:bg-neutral-100 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-primary"
              title="Close inspection drawer"
              aria-label="Close inspection drawer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto py-5 space-y-5 custom-scrollbar no-scrollbar">
            {/* Top Center Visual Seating View using TableDiagram */}
            <div className="p-4 rounded-2xl bg-bg-primary dark:bg-[#121214] border border-border-main dark:border-white/10 flex flex-col items-center justify-center space-y-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-text-muted">
                Visual Seating Alignment ({occupiedCount} / {capacity} Seats Occupied)
              </p>

              <div className="w-full max-w-sm h-32 flex items-center justify-center">
                <TableDiagram
                  capacity={capacity}
                  occupiedCount={occupiedCount}
                  status={inspectingTable.status}
                  tableNumber={inspectingTable.tableNumber}
                />
              </div>
            </div>

            {/* Table & Session Metrics */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-bg-primary dark:bg-[#121214] border border-border-main dark:border-white/10 space-y-1">
                <span className="text-text-muted text-[10px] font-bold uppercase">Status</span>
                <p className={`font-bold text-sm uppercase ${
                  inspectingTable.status === 'occupied' 
                    ? 'dark:text-amber-400 text-amber-700' 
                    : inspectingTable.status === 'reserved'
                    ? 'dark:text-blue-400 text-blue-700'
                    : inspectingTable.status === 'maintenance'
                    ? 'text-text-muted'
                    : 'dark:text-emerald-400 text-emerald-700'
                }`}>
                  {inspectingTable.status}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-bg-primary dark:bg-[#121214] border border-border-main dark:border-white/10 space-y-1">
                <span className="text-text-muted text-[10px] font-bold uppercase">Capacity Limit</span>
                <p className="font-bold text-sm text-text-main">{inspectingTable.capacity || 4} Guests Max</p>
              </div>
            </div>

            {inspectingToken && (
              <div className="p-4 rounded-2xl bg-bg-primary dark:bg-[#121214] border border-border-main dark:border-white/10 space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Customer Name:</span>
                  <span className="font-bold text-text-main text-right truncate max-w-[190px]" title={inspectingToken.customer?.name || 'Walk-in Guest'}>
                    {inspectingToken.customer?.name || 'Walk-in Guest'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Phone Number:</span>
                  <span className="font-mono font-semibold text-text-main text-right">
                    {inspectingToken.customer?.phoneNumber || '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Email ID:</span>
                  <span className="font-mono text-text-main text-right truncate max-w-[190px]" title={inspectingToken.customer?.email || (inspectingToken as any).email || '—'}>
                    {inspectingToken.customer?.email || (inspectingToken as any).email || '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Token Pass:</span>
                  <span className="font-mono text-text-main font-bold text-right">{inspectingToken.tokenNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Guests Headcount:</span>
                  <span className="font-bold text-text-main text-right">{inspectingToken.personsCount || 1} {inspectingToken.personsCount === 1 ? 'Guest' : 'Guests'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Drinks Used / Total:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">
                    {inspectingToken.redemptionsUsed} / {inspectingToken.totalRedemptionsAllowed} Used
                  </span>
                </div>
                {inspectingTable.status === 'occupied' && (
                  <div className="flex justify-between items-center pt-2 border-t border-border-main/50 dark:border-white/10">
                    <span className="text-text-muted font-medium">Time Remaining:</span>
                    <TableTimer endTime={inspectingToken.endTime} />
                  </div>
                )}
              </div>
            )}

            {inspectingTable.status === 'reserved' && (() => {
              const res = realReservations.find((r: any) => r.tableId === inspectingTable.id && (r.status === 'PENDING' || r.status === 'CONFIRMED'));
              if (!res) return null;
              const isMine = res && res.userId === user?.id;
              const resOwner = getReservedByName(res);
              return (
                <div className="p-4 rounded-2xl bg-bg-primary dark:bg-[#121214] border border-border-main dark:border-white/10 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-border-main/40">
                    <span className="text-text-muted">Reserved By:</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      isMine 
                        ? 'bg-purple-500/15 text-primary dark:text-purple-300 border border-purple-500/30' 
                        : 'bg-neutral-500/10 text-text-muted border border-border-main'
                    }`}>
                      {isMine ? '👤 You' : `🔒 ${resOwner}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Reserved Customer:</span>
                    <span className="font-bold text-text-main text-right truncate max-w-[190px]" title={res.customerName}>
                      {res.customerName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Phone Number:</span>
                    <span className="font-mono font-semibold text-text-main text-right">{res.phoneNumber || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Email ID:</span>
                    <span className="font-mono text-text-main text-right truncate max-w-[190px]" title={res.email || '—'}>
                      {res.email || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Guests Headcount:</span>
                    <span className="font-bold text-text-main text-right">{res.personsCount} Guests</span>
                  </div>
                </div>
              );
            })()}

            {!inspectingToken && inspectingTable.status === 'available' && (
              <div className="p-4 rounded-2xl bg-bg-primary dark:bg-[#121214] border border-border-main dark:border-white/10 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Session Rate Allowance:</span>
                  <span className="font-mono font-bold text-text-main">₹500 / Session</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Default Headcount:</span>
                  <span className="font-bold text-text-main">{capacity} Guests</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons (Footer) */}
          <div className="pt-4 border-t border-border-main dark:border-white/10 flex flex-col gap-2.5 shrink-0">
            {inspectingTable.status === 'occupied' ? (
              <div className="flex flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setClosingTableSession(inspectingTable)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/25 text-red-700 dark:text-red-400 font-bold text-xs border border-red-500/30 transition-all text-center cursor-pointer"
                >
                  Checkout
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setExtendingTable(inspectingTable);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 active:bg-purple-500/25 text-purple-700 dark:text-purple-400 border border-purple-500/30 font-bold text-xs transition-all cursor-pointer"
                >
                  Extend Session
                </button>
              </div>
            ) : inspectingTable.status === 'in_checkin' ? (
              <button
                type="button"
                disabled
                className="w-full py-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30 text-xs font-bold text-center cursor-not-allowed"
              >
                In Check-In (Locked)
              </button>
            ) : (
              (() => {
                const res = realReservations.find((r: any) => r.tableId === inspectingTable.id && r.status === 'PENDING');
                const isMine = res && res.userId === user?.id;
                const isPrivileged = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'manager';
                const isOwner = !res || !res.userId || isMine || isPrivileged;
                const resOwner = res ? getReservedByName(res) : 'Staff';
                const isReserved = inspectingTable.status === 'reserved';
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => isReserved ? handleCheckInReservedTable(inspectingTable) : handleAssignClick(inspectingTable)}
                      disabled={isReserved && !isOwner}
                      title={isReserved && !isOwner ? `This table was reserved by ${resOwner}. Only ${resOwner} or an Admin can check in this table.` : undefined}
                      className={`w-full py-3 rounded-xl primary-btn text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 ${
                        isReserved && !isOwner ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      {isReserved && !isOwner ? (
                        <>
                          <Lock size={14} />
                          <span>Check-In Locked</span>
                        </>
                      ) : (
                        <>
                          <span>Assign Guest & Check-In</span>
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                    
                    {isReserved && (
                      <button
                        type="button"
                        onClick={() => handleCancelClick(inspectingTable)}
                        disabled={!isOwner}
                        title={!isOwner ? `This reservation was created by ${resOwner}. Only ${resOwner} or an Admin can cancel it.` : undefined}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs border transition-all text-center ${
                          !isOwner 
                            ? 'bg-gray-100 dark:bg-[#1C1C1E]/50 text-gray-400 dark:text-gray-600 border-gray-200 dark:border-white/5 cursor-not-allowed opacity-40' 
                            : 'bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/25 text-rose-700 dark:text-rose-400 border border-rose-500/30 cursor-pointer'
                        }`}
                      >
                        Clear Reservation
                      </button>
                    )}

                    {inspectingTable.status === 'available' && (
                      <button
                        type="button"
                        onClick={() => { setInspectingTable(null); handleReserveClick(inspectingTable); }}
                        className="w-full py-2.5 rounded-xl bg-transparent border border-primary text-primary font-bold text-xs hover:bg-primary/5 transition-all text-center cursor-pointer"
                      >
                        Reserve Table
                      </button>
                    )}
                  </>
                );
              })()
            )}

            <button
              type="button"
              onClick={() => setInspectingTable(null)}
              className="w-full py-2.5 rounded-xl bg-transparent text-xs font-bold text-text-muted hover:text-text-main border border-border-main dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/5 transition-all cursor-pointer"
            >
              Close Drawer
            </button>
          </div>
        </div>
      </div>
    );
  })()}

  {/* ASSIGN TABLE MODAL */}
  {assigningTable && (
  <div className="fixed inset-0 z-[100] dark:bg-black/75 bg-slate-900/35 flex items-center justify-center p-4">
  <div className="bg-bg-surface border border-border-main rounded-3xl p-4 sm:p-6 w-full max-w-md space-y-4 relative text-text-main animate-fadeIn">
  <div className="absolute top-4 right-4 flex items-center gap-1.5">
    <button 
      type="button"
      onClick={handleModalRefresh}
      disabled={isResRefreshing}
      className="w-8 h-8 rounded-full text-text-muted hover:text-text-main hover:bg-neutral-100 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer transition-all disabled:opacity-50"
      title={isResRefreshing ? "Refreshing live data..." : "Refresh Live Status"}
      aria-label="Refresh live status"
    >
      <RefreshCw size={15} className={isResRefreshing ? 'animate-spin text-primary' : ''} />
    </button>
    <button 
      type="button"
      onClick={() => setAssigningTable(null)}
      className="w-8 h-8 rounded-full text-text-muted hover:text-text-main hover:bg-neutral-100 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer transition-all"
      title="Close dialog"
      aria-label="Close dialog"
    >
      <X size={18} />
    </button>
  </div>

  <div className="flex items-center gap-2 text-text-main font-bold text-sm pr-20">
  <Grid3X3 size={18} className="shrink-0" /> <span className="truncate">Assign Table {assigningTable.tableNumber}</span>
  </div>

  <form onSubmit={handleAssignSubmit} className="space-y-4">
  <div>
  <label className="block text-xs font-semibold text-text-muted mb-1">Active Guest Token Pass</label>
  {tokens.length === 0 ? (
  <p className="text-xs text-text-muted p-2 bg-bg-primary rounded-xl">No active guest tokens available for assignment.</p>
  ) : (
  <select
  value={selectedTokenId}
  onChange={e => setSelectedTokenId(e.target.value)}
  className="w-full bg-bg-primary border border-border-main rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary"
  required
  >
  <option value="">Select Token Pass...</option>
  {tokens.map(tk => (
  <option key={tk.id} value={tk.id}>
  {tk.tokenNumber} — {tk.customer?.name || 'Guest'} ({tk.personsCount} Persons)
  </option>
  ))}
  </select>
  )}
  </div>

  <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
  <button
  type="button"
  onClick={() => setAssigningTable(null)}
  className="flex-1 py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-semibold text-text-muted hover:text-text-main border border-border-main cursor-pointer"
  >
  Cancel
  </button>
  <button
  type="submit"
  disabled={isSubmittingAssign || !selectedTokenId}
  title={isSubmittingAssign ? "Assigning seat..." : !selectedTokenId ? "Select active token" : undefined}
  className="flex-1 py-2.5 rounded-xl primary-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer"
  >
{isSubmittingAssign ? 'Assigning...' : 'Confirm Seating'}
  </button>
  </div>
  </form>
  </div>
  </div>
  )}

  {/* RESERVE / ASSIGN TABLE MODAL */}
  {reservingTable && (
    <div className="fixed inset-0 z-[100] dark:bg-black/75 bg-slate-900/35 flex items-center justify-center p-4">
      <div className="bg-bg-surface border border-border-main rounded-3xl p-5 sm:p-6 w-full max-w-md space-y-4 relative text-text-main animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          <button 
            type="button"
            onClick={handleModalRefresh}
            disabled={isResRefreshing}
            className="w-8 h-8 rounded-full text-text-muted hover:text-text-main hover:bg-neutral-100 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer transition-all disabled:opacity-50"
            title={isResRefreshing ? "Refreshing live data..." : "Refresh Live Status"}
            aria-label="Refresh live status"
          >
            <RefreshCw size={15} className={isResRefreshing ? 'animate-spin text-primary' : ''} />
          </button>
          <button 
            type="button"
            onClick={handleCloseReserveModal}
            className="w-8 h-8 rounded-full text-text-muted hover:text-text-main hover:bg-neutral-100 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer transition-all"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 text-text-main font-bold text-sm pr-20">
          <Grid3X3 size={18} className="shrink-0" /> <span className="truncate">{isAssignFlow ? 'Assign' : 'Reserve'} Table {reservingTable.tableNumber}</span>
        </div>

        <form onSubmit={handleReserveSubmit} className="space-y-4 text-left">
          {/* 1. Customer Full Name */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
              <User size={14} className="text-text-main" /> Customer Full Name <span className="dark:text-red-400 text-red-700">*</span>
            </label>
            <input
              type="text"
              value={resName}
              onChange={e => setResName(e.target.value)}
              placeholder="e.g. First Last"
              className={`w-full bg-bg-primary border rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none transition-all ${
                resName.trim().length > 0 && !isResNameOk
                  ? 'border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                  : 'border-border-main dark:focus:border-[#D4AF37] focus:border-primary focus:ring-2 dark:focus:ring-[#D4AF37]/20 focus:ring-primary/20'
              }`}
              required
            />
            {resName.trim().length > 0 && !isResNameOk && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Full name must be 2-100 characters (letters, spaces, dots, apostrophes only).</span>
              </div>
            )}
          </div>

          {/* 2. Phone Number */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
              <Phone size={14} className="text-text-main" /> Phone Number <span className="dark:text-red-400 text-red-700">*</span>
            </label>
            <input
              type="tel"
              value={resPhone}
              onChange={e => handleResPhoneChange(e.target.value)}
              placeholder="e.g. 9999999999"
              className={`w-full bg-bg-primary border rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none transition-all ${
                resPhone.trim().length > 0 && (!isValidPhone(resPhone) || resPhoneConflict || isResPhoneActive || resPhoneValidationStatus === 'CONFLICT')
                  ? 'border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                  : 'border-border-main dark:focus:border-[#D4AF37] focus:border-primary focus:ring-2 dark:focus:ring-[#D4AF37]/20 focus:ring-primary/20'
              }`}
              required
            />
            {resPhone.trim().length > 0 && !isValidPhone(resPhone) && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Please enter a valid 10-digit Indian mobile number (starts with 6-9).</span>
              </div>
            )}
            {(resPhoneConflict || resPhoneValidationStatus === 'CONFLICT') && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  {resPhoneConflictDetail?.type === 'RESERVATION'
                    ? `This phone number is already reserved by ${resPhoneConflictDetail.name || 'a customer'}.`
                    : `This phone number is currently being used by ${resPhoneConflictDetail?.name || 'another user'}.`}
                </span>
              </div>
            )}
          </div>

          {/* 3. Email ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-1.5">
                <Mail size={14} className="text-text-main" /> Email Address
              </label>
              <span className="text-[10px] font-extrabold uppercase tracking-wider dark:text-red-400 text-red-700">
                REQUIRED
              </span>
            </div>
            <input
              type="email"
              value={resEmail}
              onChange={e => handleResEmailChange(e.target.value)}
              placeholder="e.g. name@example.com"
              className={`w-full bg-bg-primary border rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none transition-all ${
                resEmail.trim().length === 0 || !isValidEmail(resEmail) || resEmailConflict || isResEmailActive || resEmailValidationStatus === 'CONFLICT'
                  ? 'border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                  : 'border-border-main dark:focus:border-[#D4AF37] focus:border-primary focus:ring-2 dark:focus:ring-[#D4AF37]/20 focus:ring-primary/20'
              }`}
              required
            />
            {resEmail.trim().length === 0 && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Email address is strictly required for Digital Email QR Pass delivery.</span>
              </div>
            )}
            {resEmail.trim().length > 0 && !isValidEmail(resEmail) && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>Please enter a valid email address (e.g. name@domain.com).</span>
              </div>
            )}
            {(resEmailConflict || resEmailValidationStatus === 'CONFLICT') && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 mt-1.5 flex items-center gap-1.5 text-[11px] dark:text-red-400 text-red-700">
                <AlertTriangle size={14} className="shrink-0" />
                <span>
                  {resEmailConflictDetail?.type === 'RESERVATION'
                    ? `This email address is already reserved by ${resEmailConflictDetail.name || 'a customer'}.`
                    : `This email address is currently being used by ${resEmailConflictDetail?.name || 'another user'}.`}
                </span>
              </div>
            )}
          </div>

          {/* 4. Number of Members */}
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center gap-1.5">
              <Users size={14} className="text-text-main" /> Number of Members <span className="dark:text-red-400 text-red-700">*</span>
            </label>
            <select
              value={resPersons}
              onChange={e => setResPersons(Number(e.target.value))}
              className="w-full bg-bg-primary border border-border-main rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none dark:focus:border-[#D4AF37] focus:border-primary cursor-pointer"
              required
            >
              {Array.from({ length: reservingTable.capacity || 4 }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>{num} {num === 1 ? 'Guest' : 'Guests'}</option>
              ))}
            </select>
          </div>

          {/* Step Validation Status Indicator */}
          <div className="pt-2 text-xs text-text-muted w-full text-center">
            {resPhoneValidationStatus === 'PENDING' || resEmailValidationStatus === 'PENDING' || isResValidating ? (
              <span className="dark:text-amber-400 text-amber-700 flex items-center justify-center gap-1 text-[11px] font-semibold">
                <AlertTriangle size={14} className="animate-spin shrink-0" /> Validating guest details...
              </span>
            ) : !isResFormValid ? (
              <span className="dark:text-amber-400 text-amber-700 flex items-center justify-center gap-1 text-[11px]">
                <AlertTriangle size={14} className="shrink-0" /> Complete all required fields above to proceed
              </span>
            ) : (
              <span className="dark:text-emerald-400 text-emerald-700 font-bold flex items-center justify-center gap-1 text-[11px]">
                ✓ All inputs validated
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={handleCloseReserveModal}
              className="flex-1 py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-semibold text-text-muted hover:text-text-main border border-border-main cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isResFormValid || isSubmittingReserve || resPhoneValidationStatus !== 'VALID' || resEmailValidationStatus !== 'VALID' || resPhoneConflict || resEmailConflict || isResPhoneActive || isResEmailActive}
              className="flex-1 py-2.5 rounded-xl primary-btn text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmittingReserve ? 'Confirming...' : isAssignFlow ? 'Confirm Assign & Check-In' : 'Confirm Reserve'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )}

 {/* CANCEL RESERVATION CONFIRMATION MODAL */}
 {cancellingReservation && (
   <div className="fixed inset-0 z-[100] dark:bg-black/75 bg-slate-900/35 flex items-center justify-center p-4">
     <div className="bg-bg-surface border border-border-main rounded-3xl p-4 sm:p-6 w-full max-w-md space-y-4 relative text-text-main animate-fadeIn">
       <button 
         onClick={() => setCancellingReservation(null)}
         className="absolute top-4 right-4 text-text-muted hover:text-text-main cursor-pointer p-1"
       >
         <X size={18} />
       </button>

       <div className="flex items-center gap-2 text-text-main font-bold text-sm pr-8 text-red-500">
         <AlertTriangle size={18} className="shrink-0" /> <span className="truncate">Cancel Reservation</span>
       </div>

       <div className="space-y-2">
         <p className="text-xs text-text-muted">
           Are you sure you want to cancel the reservation for:
         </p>
         <div className="p-3 bg-bg-primary rounded-xl space-y-1 text-xs">
           <div className="flex justify-between">
             <span className="text-text-muted">Customer:</span>
             <span className="font-semibold text-text-main">{cancellingReservation.customerName}</span>
           </div>
           {cancellingReservation.phoneNumber && (
             <div className="flex justify-between">
               <span className="text-text-muted">Phone:</span>
               <span className="font-semibold text-text-main">{cancellingReservation.phoneNumber}</span>
             </div>
           )}
           <div className="flex justify-between">
             <span className="text-text-muted">Table:</span>
             <span className="font-bold dark:text-primary text-primary font-mono">{cancellingReservation.table?.tableNumber || 'N/A'}</span>
           </div>
         </div>
         <p className="text-[11px] text-red-500/80 italic">
           This will release the table back to "available" immediately.
         </p>
       </div>

       <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
         <button
           type="button"
           onClick={() => setCancellingReservation(null)}
           className="flex-1 py-2.5 rounded-xl bg-bg-primary hover:bg-bg-card text-xs font-semibold text-text-muted hover:text-text-main border border-border-main cursor-pointer"
         >
           No, Keep it
         </button>
         <button
           onClick={handleCancelConfirm}
           disabled={isSubmittingCancel}
           className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 active:bg-red-700 text-xs font-bold uppercase tracking-wider disabled:opacity-50 cursor-pointer border-none"
         >
           {isSubmittingCancel ? 'Cancelling...' : 'Yes, Cancel'}
         </button>
       </div>
     </div>
   </div>
 )}

  {/* TRANSFER TABLE MODAL */}


  {/* EXTEND SESSION MODAL */}
  {extendingTable && (() => {
    const token = tokens.find(tk => tk.tableId === extendingTable.id || (tk.table && tk.table.id === extendingTable.id));
    if (!token) return null;
    return (
      <ExtendSessionModal
        isOpen={extendingTable !== null}
        token={token}
        rates={rates}
        onClose={() => setExtendingTable(null)}
        onSuccess={() => {
          setExtendingTable(null);
          if (inspectingTable && inspectingTable.id === extendingTable.id) {
            setInspectingTable(null);
          }
          refreshTables();
          refreshTokens();
        }}
      />
    );
  })()}

  {/* CLOSE SESSION MODAL */}
  {(() => {
    if (!closingTableSession) return null;
    const sessionToken = tokens.find(tk => tk.tableId === closingTableSession.id || (tk.table && tk.table.id === closingTableSession.id));
    if (!sessionToken) return null;
    return (
      <CheckoutConfirmationModal
        isOpen={!!closingTableSession}
        session={{
          tokenNumber: sessionToken.tokenNumber,
          customerName: sessionToken.customer?.name || 'Walk-in Guest',
          customerPhone: sessionToken.customer?.phoneNumber || 'N/A',
          tableNumber: closingTableSession.tableNumber || 'N/A',
        }}
        onClose={() => setClosingTableSession(null)}
        onSuccess={() => {
          setClosingTableSession(null);
          if (inspectingTable && inspectingTable.id === closingTableSession.id) {
            setInspectingTable(null);
          }
          refreshTables();
          refreshTokens();
        }}
      />
    );
  })()}



 </div>
 );
};
