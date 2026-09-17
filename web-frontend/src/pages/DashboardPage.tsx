import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Grid3X3, 
  Wine, 
  DollarSign, 
  TrendingUp,
  Clock, 
  LogOut, 
  UserCheck, 
  CalendarRange, 
  Activity, 
  Bell, 
  BarChart3, 
  AlertCircle, 
  Camera, 
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Search,
  Sparkles,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import type { Token, DashboardReport } from '../types';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ExtendSessionModal } from '../components/modals/ExtendSessionModal';
import { CheckoutConfirmationModal } from '../components/modals/CheckoutConfirmationModal';

interface LiveSessionTimerProps {
  endTime: string | Date;
  status: string;
}

const LiveSessionTimer: React.FC<LiveSessionTimerProps> = ({ endTime, status }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const diffMs = new Date(endTime).getTime() - Date.now();
      return Math.max(0, Math.floor(diffMs / 1000));
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  const upperStatus = String(status).toUpperCase();
  if (upperStatus === 'CLOSED' || upperStatus === 'COMPLETED') {
    return <span className="text-text-muted font-bold text-xs">Closed</span>;
  }
  if (upperStatus === 'EXPIRED' || timeLeft <= 0) {
    return <span className="text-red-500 font-bold text-xs animate-pulse">Expired</span>;
  }

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const paddedMins = String(minutes).padStart(2, '0');
  const paddedSecs = String(seconds).padStart(2, '0');

  // Time-left visual state thresholds:
  // > 15 minutes (900 seconds) -> green text
  // 5 to 15 minutes (300 to 900 seconds) -> amber text
  // < 5 minutes (< 300 seconds) -> red text
  let colorClass = 'text-emerald-400';
  if (timeLeft < 300) {
    colorClass = 'text-red-500 animate-pulse';
  } else if (timeLeft <= 900) {
    colorClass = 'text-amber-400';
  }

  if (hours > 0) {
    const paddedHours = String(hours).padStart(2, '0');
    return <span className={`font-mono font-bold text-xs ${colorClass}`}>{paddedHours}:{paddedMins}:{paddedSecs}</span>;
  }

  return <span className={`font-mono font-bold text-xs ${colorClass}`}>{paddedMins}:{paddedSecs}</span>;
};

interface DashboardPageProps {
  onNavigate?: (tabId: string, adminSubtab?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { showToast, user } = useAuth();
  const { 
    tokens, 
    allSessions, 
    tables, 
    isLoading, 
    refreshTokens, 
    refreshAllSessions, 
    refreshTables, 
    sessionAlerts, 
    rates 
  } = useData();

  // Normalize user role before branching
  const rawRole = user?.role ? user.role.toLowerCase() : '';
  const isAdmin = rawRole === 'admin';
  const isManager = rawRole === 'manager';
  const isReceptionist = rawRole === 'receptionist';
  const isBartender = rawRole === 'bartender';
  const isManagement = isAdmin || isManager;

  // Touch/Interactive Chart Selection State
  const [selectedRevenueNode, setSelectedRevenueNode] = useState<number | null>(null);
  const [selectedSeatingNode, setSelectedSeatingNode] = useState<number | null>(null);

  // Live Session Filter & Search State
  const [sessionFilter, setSessionFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING' | 'PENDING_PAYMENT'>('ALL');
  const [sessionSearch, setSessionSearch] = useState<string>('');

  // Extend Modal State
  const [extendingToken, setExtendingToken] = useState<Token | null>(null);

  // Close Modal State
  const [closingToken, setClosingToken] = useState<Token | null>(null);

  // Dashboard Report Analytics State
  const [reportData, setReportData] = useState<DashboardReport['data'] | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [, setReportError] = useState<string | null>(null);

  const fetchReport = async (silent: boolean = false) => {
    if (!silent) setIsReportLoading(true);
    setReportError(null);
    try {
      const res = await api.getDashboardReport('day');
      if (res && res.success) {
        setReportData(res.data);
      } else {
        setReportError('Failed to load report data.');
      }
    } catch (err: any) {
      setReportError(err.message || 'Failed to load report data.');
    } finally {
      if (!silent) setIsReportLoading(false);
    }
  };

  useEffect(() => {
    // Only query report and all sessions APIs if management role is authorized to prevent 403 Forbidden responses
    if (isManagement) {
      fetchReport();
      refreshAllSessions();
    }

    const handleGlobalRefresh = () => {
      if (isManagement) {
        fetchReport(true);
      }
    };
    window.addEventListener('app:global-refresh', handleGlobalRefresh);
    return () => {
      window.removeEventListener('app:global-refresh', handleGlobalRefresh);
    };
  }, [user]);

  const activeTokens = tokens;
  const activeTokensCount = tokens.length;
  const occupiedTablesCount = tables.filter(t => t.status === 'occupied').length;
  const totalCapacity = tables.reduce((acc, t) => acc + t.capacity, 0);
  const totalGuestsInHouse = tokens.reduce((acc, tk) => acc + tk.personsCount, 0);
  const totalRedemptionsUsed = tokens.reduce((acc, tk) => acc + tk.redemptionsUsed, 0);
  
  // Authoritative daily revenue
  const totalRevenue = reportData ? reportData.salesSummary.todaySales : 0;
  
  // KPI Calculations
  const avgCheckoutVal = reportData && reportData.salesSummary.checkoutCount > 0
    ? (reportData.salesSummary.todaySales / reportData.salesSummary.checkoutCount)
    : 0;
  const avgCheckoutDisplay = reportData 
    ? (avgCheckoutVal > 0 ? `₹${Math.round(avgCheckoutVal).toLocaleString()}` : '—') 
    : (isReportLoading ? '...' : '--');

  const drinkConversionVal = reportData && reportData.salesSummary.totalCustomers > 0
    ? (reportData.salesSummary.todayRedemptions / reportData.salesSummary.totalCustomers)
    : 0;
  const drinkConversionDisplay = reportData
    ? `${drinkConversionVal.toFixed(2)}`
    : (isReportLoading ? '...' : '--');

  const qrPassActiveDisplay = isReportLoading || isLoading
    ? '...'
    : String(activeTokensCount);

  let peakSeatingCount = 0;
  if (reportData && reportData.hourlyBreakdown?.hourlyData) {
    reportData.hourlyBreakdown.hourlyData.forEach((h: any) => {
      if (h.activeTokens > peakSeatingCount) {
        peakSeatingCount = h.activeTokens;
      }
    });
  }
  const peakSeatingDisplay = reportData
    ? (peakSeatingCount > 0 ? `${Math.round(peakSeatingCount)} Sessions` : '—')
    : (isReportLoading ? '...' : '--');

  // Filtered Tokens for Live Sessions Section
  const filteredTokens = useMemo(() => {
    let result = activeTokens;

    if (sessionFilter === 'ACTIVE') {
      result = result.filter(tk => tk.status === 'ACTIVE' || tk.status === 'EXTENDED');
    } else if (sessionFilter === 'EXPIRING') {
      result = result.filter(tk => {
        const isExpiring = tk.status === 'EXPIRING';
        const timeLeftMs = new Date(tk.endTime).getTime() - Date.now();
        return isExpiring || (timeLeftMs <= 900000 && timeLeftMs > 0);
      });
    } else if (sessionFilter === 'PENDING_PAYMENT') {
      result = result.filter(tk => tk.status === 'PENDING_PAYMENT');
    }

    if (sessionSearch.trim()) {
      const q = sessionSearch.toLowerCase().trim();
      result = result.filter(tk => {
        const tokenNum = String(tk.tokenNumber || '').toLowerCase();
        const custName = String(tk.customer?.name || '').toLowerCase();
        const custPhone = String(tk.customer?.phoneNumber || '').toLowerCase();
        const tblNum = String(tk.tableNumber || tk.table?.tableNumber || '').toLowerCase();
        return tokenNum.includes(q) || custName.includes(q) || custPhone.includes(q) || tblNum.includes(q);
      });
    }

    return result;
  }, [activeTokens, sessionFilter, sessionSearch]);

  // Chart Mapping (Hourly Revenue Trends)
  const revenueTrends = useMemo(() => {
    if (!reportData || !reportData.hourlyBreakdown?.hourlyData) return [];
    return reportData.hourlyBreakdown.hourlyData.map((h: any) => {
      const ampm = h.hour >= 12 ? 'PM' : 'AM';
      const displayHour = h.hour % 12 || 12;
      return {
        time: `${displayHour}:00 ${ampm}`,
        value: h.revenue || 0
      };
    });
  }, [reportData]);

  // Max value of revenueTrends to scale the height of chart bars dynamically
  const maxChartVal = useMemo(() => {
    if (revenueTrends.length === 0) return 60000;
    const max = Math.max(...revenueTrends.map(t => t.value));
    return max > 0 ? max : 60000;
  }, [revenueTrends]);

  // Dynamic Y-Axis Labels based on maxChartVal
  const yAxisLabels = useMemo(() => {
    const step = maxChartVal / 4;
    return Array.from({ length: 5 }, (_, i) => {
      const val = maxChartVal - (i * step);
      if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
      return `₹${Math.round(val)}`;
    });
  }, [maxChartVal]);

  // Peak Sales Hour string calculation
  const peakSalesHourStr = useMemo(() => {
    if (!reportData || !reportData.hourlyBreakdown?.hourlyData) return 'No Data';
    let maxRevenue = -1;
    let peakHourIndex = -1;
    reportData.hourlyBreakdown.hourlyData.forEach((h: any) => {
      if ((h.revenue || 0) > maxRevenue) {
        maxRevenue = h.revenue || 0;
        peakHourIndex = h.hour;
      }
    });
    if (peakHourIndex !== -1 && maxRevenue > 0) {
      const ampm = peakHourIndex >= 12 ? 'PM' : 'AM';
      const displayHour = peakHourIndex % 12 || 12;
      return `Peak Sales Hour (${displayHour}:00 ${ampm})`;
    }
    return 'No Sales Today';
  }, [reportData]);

  // Seating Peaks Line Chart Mapper
  const seatingPeaksTrends = useMemo(() => {
    if (!reportData || !reportData.hourlyBreakdown?.hourlyData) return [];
    return reportData.hourlyBreakdown.hourlyData.map((h: any) => {
      const ampm = h.hour >= 12 ? 'PM' : 'AM';
      const displayHour = h.hour % 12 || 12;
      return {
        time: `${displayHour}:00 ${ampm}`,
        activeTokens: h.activeTokens || 0
      };
    });
  }, [reportData]);

  const maxActiveTokensVal = useMemo(() => {
    if (seatingPeaksTrends.length === 0) return 10;
    const max = Math.max(...seatingPeaksTrends.map(t => t.activeTokens));
    return max > 0 ? max : 10;
  }, [seatingPeaksTrends]);

  const lineChartPathData = useMemo(() => {
    if (seatingPeaksTrends.length < 2) return { linePath: '', areaPath: '', points: [] };
    const width = 500;
    const height = 120;
    const padding = 10;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    const points = seatingPeaksTrends.map((t, idx) => {
      const x = padding + (idx / (seatingPeaksTrends.length - 1)) * chartWidth;
      const y = padding + chartHeight - (t.activeTokens / maxActiveTokensVal) * chartHeight;
      return { x, y, time: t.time, value: t.activeTokens };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(height).toFixed(1)} L ${points[0].x.toFixed(1)} ${(height).toFixed(1)} Z`;
    
    return { linePath, areaPath, points };
  }, [seatingPeaksTrends, maxActiveTokensVal]);

  // Priority Actions Configuration depending on user role
  interface PriorityAction {
    step: string;
    title: string;
    desc: string;
    icon: React.ComponentType<any>;
    primary: boolean;
    onClick: () => void;
  }

  const priorityActionsList = useMemo<PriorityAction[]>(() => {
    if (isManagement) {
      return [
        { step: '01', title: 'New Check-In', desc: 'Register Guest & Issue QR', icon: UserCheck, primary: true, onClick: () => onNavigate?.('checkin') },
        { step: '02', title: 'Occupied Tables', desc: 'Live Floor Grid & Timers', icon: CalendarRange, primary: false, onClick: () => onNavigate?.('tables/occupied') },
        { step: '03', title: 'Table Layout', desc: 'Manage Capacity & Status', icon: Grid3X3, primary: false, onClick: () => onNavigate?.('tables') },
        { step: '04', title: 'Customer Sessions', desc: 'Guest Database & Passes', icon: Users, primary: true, onClick: () => onNavigate?.('admin', 'customers') },
      ];
    }
    if (isReceptionist) {
      return [
        { step: '01', title: 'New Check-In', desc: 'Start Guest Session', icon: UserCheck, primary: true, onClick: () => onNavigate?.('checkin') },
        { step: '02', title: 'Occupied Tables', desc: 'View Active Tables', icon: CalendarRange, primary: false, onClick: () => onNavigate?.('tables/occupied') },
        { step: '03', title: 'Table Layout', desc: 'Manage Floor Plan', icon: Grid3X3, primary: false, onClick: () => onNavigate?.('tables') },
        { step: '04', title: 'Attendance', desc: 'Staff Check-In Logs', icon: Camera, primary: false, onClick: () => onNavigate?.('quick_attendance') },
      ];
    }
    // Bartender
    return [
      { step: '01', title: 'QR Scan', desc: 'Redeem Guest Drinks', icon: Wine, primary: true, onClick: () => onNavigate?.('bartender/scan') },
      { step: '02', title: 'Occupied Tables', desc: 'Active Drink Entitlements', icon: CalendarRange, primary: false, onClick: () => onNavigate?.('tables/occupied') },
      { step: '03', title: 'Table Layout', desc: 'View Floor Plan', icon: Grid3X3, primary: false, onClick: () => onNavigate?.('tables') },
      { step: '04', title: 'Attendance', desc: 'Staff Clock In/Out', icon: Camera, primary: false, onClick: () => onNavigate?.('quick_attendance') },
    ];
  }, [isManagement, isReceptionist, onNavigate]);

  // Live Overview metric cards mapping with navigation linkages
  const metricCards = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      value: string | number;
      sub: React.ReactNode;
      icon: any;
      colorClass: string;
      iconBgClass: string;
      targetLink?: () => void;
      linkLabel?: string;
    }> = [
      {
        id: 'sessions',
        title: 'Active Sessions',
        value: activeTokensCount,
        sub: <span className="text-text-muted">{occupiedTablesCount} occupied tables</span>,
        icon: Users,
        colorClass: 'border-l-primary dark:border-l-[#D4AF37] dark:bg-[#D4AF37]/5',
        iconBgClass: 'dark:bg-primary/10 dark:text-[#D4AF37] text-primary',
        targetLink: () => isManagement ? onNavigate?.('admin', 'customers') : onNavigate?.('tables/occupied'),
        linkLabel: 'View Sessions'
      },
      {
        id: 'guests',
        title: 'Guests In-House',
        value: totalGuestsInHouse,
        sub: <span className="text-text-muted">Across {activeTokensCount} active sessions</span>,
        icon: Users,
        colorClass: 'border-l-emerald-500 bg-emerald-500/5',
        iconBgClass: 'dark:bg-emerald-500/10 dark:text-emerald-400 text-emerald-700',
        targetLink: () => onNavigate?.('tables/occupied'),
        linkLabel: 'Floor Status'
      },
    ];

    if (isManagement || isReceptionist) {
      const occupancyPercent = totalCapacity > 0 ? Math.round((totalGuestsInHouse / totalCapacity) * 100) : 0;
      list.push({
        id: 'occupancy',
        title: 'Floor Occupancy',
        value: `${occupancyPercent}%`,
        sub: <span className="text-text-muted">{totalGuestsInHouse} / {totalCapacity} Total Seats</span>,
        icon: Grid3X3,
        colorClass: 'border-l-emerald-500 bg-emerald-500/5',
        iconBgClass: 'dark:bg-emerald-500/10 dark:text-emerald-400 text-emerald-700',
        targetLink: () => onNavigate?.('tables'),
        linkLabel: 'Floor Plan'
      });
    }

    if (isManagement || isBartender) {
      list.push({
        id: 'drinks',
        title: 'Drink Redemptions',
        value: totalRedemptionsUsed,
        sub: <span className="text-text-muted">Dispensed today</span>,
        icon: Wine,
        colorClass: 'border-l-amber-500 bg-amber-500/5',
        iconBgClass: 'dark:bg-amber-500/10 dark:text-amber-400 text-amber-700',
        targetLink: () => onNavigate?.('bartender/scan'),
        linkLabel: 'Scan Drinks'
      });
    }

    if (isManagement) {
      list.push({
        id: 'revenue',
        title: 'Shift Revenue',
        value: `₹${totalRevenue.toLocaleString()}`,
        sub: <span className="text-text-muted">Verified Payments</span>,
        icon: DollarSign,
        colorClass: 'border-l-blue-500 bg-blue-500/5',
        iconBgClass: 'dark:bg-blue-500/10 dark:text-blue-400 text-blue-700',
        targetLink: () => {
          const el = document.getElementById('revenue-analytics-section');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        },
        linkLabel: 'Analytics'
      });
    }

    return list;
  }, [isManagement, isReceptionist, isBartender, activeTokensCount, occupiedTablesCount, totalGuestsInHouse, totalCapacity, totalRedemptionsUsed, totalRevenue, onNavigate]);

  // Dynamic alert list generation based on active tokens, table statuses, and role restriction
  const notifications = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      message: string;
      customerName: string;
      tableNumber: string;
      remainingTimeStr?: string;
      type: 'expire' | 'checkout' | 'assign' | 'attendance';
      actionLabel?: string;
      onAction?: () => void;
    }> = [];

    const handleNavigateToTable = (tableIdentifier: string) => {
      if (!tableIdentifier) return;
      localStorage.setItem('bar_auto_inspect_table_id', tableIdentifier);
      window.dispatchEvent(new CustomEvent('bar_auto_inspect', { detail: { tableId: tableIdentifier } }));
      if (onNavigate) {
        onNavigate('tables/occupied');
      }
    };

    // 1. Expiration alerts from data context
    sessionAlerts.forEach(a => {
      if (a.dismissed) return;
      const tk = tokens.find(t => t.id === a.id);
      const targetTableId = a.tableId || tk?.tableId || tk?.table?.id || (tables.find(t => t.tableNumber === a.tableNumber)?.id) || a.tableNumber;
      
      list.push({
        id: a.id,
        title: 'Session Expiring Soon',
        message: `Table ${a.tableNumber} • ${a.customerName}`,
        customerName: a.customerName,
        tableNumber: a.tableNumber,
        remainingTimeStr: a.remainingTimeStr,
        type: 'expire',
        actionLabel: 'Extend',
        onAction: () => {
          handleNavigateToTable(targetTableId);
        }
      });
    });

    // 2. Awaiting checkout alerts (active sessions in pending_payment state or fully expired)
    tokens.forEach(tk => {
      const isExpired = new Date(tk.endTime).getTime() <= Date.now();
      if (tk.status === 'PENDING_PAYMENT' || isExpired) {
        const targetTableId = tk.tableId || tk.table?.id || (tables.find(t => t.tableNumber === tk.tableNumber)?.id) || tk.tableNumber || '';
        list.push({
          id: `checkout-${tk.id}`,
          title: 'Table awaiting checkout',
          message: `Table ${tk.tableNumber || tk.table?.tableNumber || 'N/A'} • ${tk.customer?.name || 'Guest'}`,
          customerName: tk.customer?.name || 'Guest',
          tableNumber: tk.tableNumber || tk.table?.tableNumber || 'N/A',
          remainingTimeStr: isExpired ? '00:00:00' : 'Awaiting Payment',
          type: 'checkout',
          actionLabel: 'Checkout',
          onAction: () => {
            handleNavigateToTable(targetTableId);
          }
        });
      }
    });

    // 3. Vacant tables available (Filtered out for Bartender)
    if (!isBartender) {
      tables.filter(t => t.status === 'available').slice(0, 2).forEach(t => {
        list.push({
          id: `available-${t.id}`,
          title: `Table ${t.tableNumber} is ready`,
          message: `${t.capacity}-Seater • Available for guest check-in`,
          customerName: 'N/A',
          tableNumber: t.tableNumber,
          type: 'assign',
          actionLabel: 'Assign',
          onAction: () => onNavigate?.('tables')
        });
      });
    }

    // 4. Pending attendance check-ins (Filtered out for Bartender)
    if (!isBartender) {
      const pendingPaymentCount = tokens.filter(tk => tk.status === 'PENDING_PAYMENT').length;
      if (pendingPaymentCount > 0) {
        list.push({
          id: 'pending-attendance',
          title: 'Pending check-in verification',
          message: `${pendingPaymentCount} sessions awaiting payment confirmation`,
          customerName: 'Multiple',
          tableNumber: 'N/A',
          type: 'attendance',
          actionLabel: 'View',
          onAction: () => onNavigate?.('checkin')
        });
      }
    }

    return list;
  }, [sessionAlerts, tokens, tables, isBartender, onNavigate]);

  // Dynamic activities stream logs for Admin/Manager
  const activities = useMemo(() => {
    if (!isManagement) return [];
    
    const list: Array<{ id: string; desc: string; time: string; timestampVal: number; tag: 'CHECKIN' | 'CHECKOUT' | 'EXTENSION' }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    allSessions.forEach((s: any) => {
      const start = new Date(s.startTime);
      if (start >= today) {
        list.push({
          id: `checkin-${s.id}`,
          desc: `Token #${s.tokenNumber} checked in at ${s.tableNumber ? `Table ${s.tableNumber}` : 'Standing Bar'} (${s.persons || s.personsCount} guests)`,
          time: new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestampVal: start.getTime(),
          tag: 'CHECKIN'
        });
      }

      if (s.closedAt) {
        const closed = new Date(s.closedAt);
        if (closed >= today) {
          list.push({
            id: `checkout-${s.id}`,
            desc: `Token #${s.tokenNumber} completed checkout from ${s.tableNumber ? `Table ${s.tableNumber}` : 'Standing Bar'}`,
            time: closed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            timestampVal: closed.getTime(),
            tag: 'CHECKOUT'
          });
        }
      }

      if (Array.isArray(s.extensions)) {
        s.extensions.forEach((ext: any) => {
          const extTime = new Date(ext.extendedAt);
          if (extTime >= today) {
            list.push({
              id: `ext-${ext.id || Math.random()}`,
              desc: `Token #${s.tokenNumber} session extended by +${ext.extraMinutes} mins`,
              time: extTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestampVal: extTime.getTime(),
              tag: 'EXTENSION'
            });
          }
        });
      }
    });

    return list.sort((a, b) => b.timestampVal - a.timestampVal).slice(0, 5);
  }, [allSessions, isManagement]);

  return (
    <div className="space-y-8 text-text-main animate-fadeIn pb-12">

      {/* ========================================================================= */}
      {/* 1. OPERATIONAL WORKFLOW PIPELINE (Visual Connective Header)               */}
      {/* ========================================================================= */}
      <div className="glass-panel rounded-2xl p-3 sm:p-4 border border-border-main bg-bg-surface/50 backdrop-blur-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-text-main">Live Floor Operational Workflow</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 dark:bg-[#D4AF37]/10 text-primary dark:text-[#D4AF37] font-bold border border-primary/20 dark:border-[#D4AF37]/20">
                Shift Active
              </span>
            </div>
          </div>

          {/* Connected Pipeline Steps */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-text-muted overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-secondary-surface border border-border-main shrink-0">
              <span className="w-4 h-4 rounded-full bg-primary/20 dark:bg-[#D4AF37]/20 text-primary dark:text-[#D4AF37] text-[9px] flex items-center justify-center font-bold">1</span>
              <span>Registration</span>
            </div>
            <ChevronRight size={12} className="shrink-0 text-text-muted/60" />
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-secondary-surface border border-border-main shrink-0">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] flex items-center justify-center font-bold">2</span>
              <span>Floor Seating ({occupiedTablesCount})</span>
            </div>
            <ChevronRight size={12} className="shrink-0 text-text-muted/60" />
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-secondary-surface border border-border-main shrink-0">
              <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 text-[9px] flex items-center justify-center font-bold">3</span>
              <span>Service & Drinks ({totalRedemptionsUsed})</span>
            </div>
            <ChevronRight size={12} className="shrink-0 text-text-muted/60" />
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-secondary-surface border border-border-main shrink-0">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[9px] flex items-center justify-center font-bold">4</span>
              <span>Billing & Checkout</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ZONE 1: LIVE FLOOR PULSE & PRIORITY DISPATCH                           */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border-main pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-neutral-900 text-[#D4AF37] dark:bg-white/10 dark:text-[#D4AF37] tracking-wider uppercase">01</span>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-text-main">
              Live Floor Pulse & Priority Dispatch
            </h3>
          </div>
          <span className="text-[10px] text-text-muted font-semibold hidden sm:inline">Instant Operational Triggers & Key Gauges</span>
        </div>

        {/* Priority Actions Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {priorityActionsList.map((act, i) => {
            const Icon = act.icon;
            return (
              <button
                key={i}
                onClick={act.onClick}
                className="w-full p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row items-center sm:items-start justify-between gap-2 transition-all duration-300 text-center sm:text-left cursor-pointer group focus:outline-none focus:ring-2 dark:focus:ring-[#D4AF37]/50 focus:ring-primary/50 dark:bg-gradient-to-br dark:from-[#D4AF37]/10 dark:to-transparent bg-gradient-to-br from-primary/10 to-transparent dark:border-[#D4AF37]/30 border-primary/30 dark:hover:border-[#D4AF37] hover:border-primary dark:shadow-[0_0_12px_rgba(212,175,55,0.08)] shadow-[0_0_12px_rgba(124,58,237,0.08)] col-span-1 hover:-translate-y-0.5"
              >
                <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full min-w-0">
                  <div className="p-2 sm:p-2.5 rounded-lg shrink-0 dark:bg-[#D4AF37]/15 bg-primary/10 dark:text-[#D4AF37] text-primary transition-colors">
                    <Icon size={16} className="sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0 text-center sm:text-left w-full">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5">
                      <span className="text-[9px] font-mono font-bold dark:text-[#D4AF37]/70 text-primary/70">{act.step}</span>
                      <h5 className="text-[11px] sm:text-xs font-bold text-text-main dark:text-white transition-colors truncate">
                        {act.title}
                      </h5>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-text-muted mt-0.5 truncate">{act.desc}</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center text-xs font-bold transition-transform group-hover:translate-x-1 dark:text-[#D4AF37] text-primary">
                  <ArrowRight size={14} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Overview Metric Cards Grid with Interactive Navigation */}
        <div className={`grid grid-cols-2 md:grid-cols-3 ${isManagement ? 'xl:grid-cols-5' : 'xl:grid-cols-3'} gap-3 sm:gap-4`}>
          {metricCards.map((card) => {
            const Icon = card.icon;
            return (
              <div 
                key={card.id} 
                onClick={() => card.targetLink && card.targetLink()}
                className={`glass-panel p-3.5 sm:p-4 rounded-xl flex flex-col justify-between border-l-4 ${card.colorClass} border-border-main/50 gap-2 transition-all duration-200 ${
                  card.targetLink ? 'cursor-pointer hover:border-border-main hover:shadow-md hover:-translate-y-0.5 group' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider truncate">{card.title}</p>
                    <h3 className="text-xl sm:text-2xl font-black text-text-main mt-0.5 tracking-tight">{card.value}</h3>
                  </div>
                  <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 ${card.iconBgClass} transition-transform group-hover:scale-105`}>
                    <Icon size={16} className="sm:w-4 sm:h-4" />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border-main/40 pt-2 mt-1">
                  <div className="text-[9px] sm:text-[10px] font-semibold truncate text-text-muted">
                    {card.sub}
                  </div>
                  {card.linkLabel && (
                    <span className="text-[9px] font-bold flex items-center gap-0.5 dark:text-[#D4AF37] text-primary group-hover:underline">
                      {card.linkLabel} <ArrowUpRight size={10} />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. ZONE 2: ACTIVE GUEST SESSIONS & ATTENTION DISPATCH                     */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-border-main pb-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-neutral-900 text-[#D4AF37] dark:bg-white/10 dark:text-[#D4AF37] tracking-wider uppercase">02</span>
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-text-main">
              Live Guest Sessions & Attention Dispatch
            </h3>
          </div>
          <span className="text-[10px] text-text-muted font-semibold hidden sm:inline">
            Active Floor Management ({activeTokensCount} Live Sessions)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Live Customer Sessions Card (2/3) */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-4 sm:p-6 border border-border-main space-y-4">
            
            {/* Header & Filter/Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border-main pb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-text-main truncate">Live Floor Sessions</h3>
                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {activeTokensCount} Active
                  </span>
                </div>
                <p className="text-[11px] text-text-muted mt-0.5 truncate">Synchronized seating tickets, timers, and actions</p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-[10px] font-bold">
                <button
                  onClick={() => setSessionFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    sessionFilter === 'ALL'
                      ? 'bg-primary dark:bg-[#D4AF37] text-white dark:text-black border-transparent'
                      : 'bg-bg-secondary-surface text-text-muted border-border-main hover:text-text-main'
                  }`}
                >
                  All ({activeTokensCount})
                </button>
                <button
                  onClick={() => setSessionFilter('EXPIRING')}
                  className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    sessionFilter === 'EXPIRING'
                      ? 'bg-amber-500 text-white border-transparent'
                      : 'bg-bg-secondary-surface text-amber-500/80 border-border-main hover:text-amber-400'
                  }`}
                >
                  Expiring Soon
                </button>
                <button
                  onClick={() => setSessionFilter('PENDING_PAYMENT')}
                  className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    sessionFilter === 'PENDING_PAYMENT'
                      ? 'bg-blue-500 text-white border-transparent'
                      : 'bg-bg-secondary-surface text-blue-400/80 border-border-main hover:text-blue-400'
                  }`}
                >
                  Pending Checkout
                </button>
              </div>
            </div>

            {/* Quick Search Bar */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                placeholder="Filter by token #, guest name, phone, or table..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-bg-surface dark:bg-black/20 border border-border-main/70 rounded-xl text-text-main placeholder-text-muted focus:outline-none focus:ring-1 dark:focus:ring-[#D4AF37] focus:ring-primary"
              />
              {sessionSearch && (
                <button
                  onClick={() => setSessionSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted hover:text-text-main"
                >
                  Clear
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-text-muted text-xs">Loading live session data...</div>
            ) : filteredTokens.length === 0 ? (
              <div className="py-8 sm:py-12 text-center text-text-muted text-xs space-y-3">
                <p>{sessionSearch || sessionFilter !== 'ALL' ? 'No matching customer sessions found.' : 'No active customer sessions found.'}</p>
                {!isBartender && !sessionSearch && (
                  <button 
                    onClick={() => onNavigate?.('checkin')} 
                    className="px-3 py-1.5 rounded-lg dark:bg-[#D4AF37] dark:hover:bg-[#F5E08B] dark:text-black bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all cursor-pointer dark:shadow-[0_0_10px_rgba(212,175,55,0.2)] shadow-[0_0_10px_rgba(124,58,237,0.2)]"
                  >
                    New Check-In
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop view - Table layout with Table Number & Location Column */}
                <div className="hidden sm:block overflow-x-auto overflow-y-auto max-h-[340px] custom-scrollbar">
                  <table className="w-full text-left text-[11px] min-w-[720px]">
                    <thead>
                      <tr className="border-b border-border-main text-text-muted uppercase font-semibold text-[10px] tracking-wider bg-bg-secondary-surface/40">
                        <th className="py-2.5 px-3">Token & Location</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Guests</th>
                        <th className="py-2.5 px-3">Drink Entitlement</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-center">Time Left</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-main">
                      {filteredTokens.map(tk => {
                        const statusStr = String(tk.status).toUpperCase();
                        let badgeClass = 'bg-border-main/20 text-text-muted border border-border-main/30';
                        if (statusStr === 'ACTIVE' || statusStr === 'EXTENDED') {
                          badgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                        } else if (statusStr === 'EXPIRING') {
                          badgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                        } else if (statusStr === 'PENDING_PAYMENT') {
                          badgeClass = 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse';
                        }

                        const tableDisplay = tk.tableNumber || tk.table?.tableNumber ? `Table ${tk.tableNumber || tk.table?.tableNumber}` : 'Standing Bar';

                        return (
                          <tr key={tk.id} className="hover:bg-bg-card/50 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col">
                                <span className="font-mono font-bold text-text-main">#{tk.tokenNumber}</span>
                                <span className="text-[10px] font-bold text-primary dark:text-[#D4AF37] flex items-center gap-1 mt-0.5">
                                  <MapPin size={10} /> {tableDisplay}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-text-main">{tk.customer?.name || 'Walk-in Guest'}</span>
                                <span className="font-mono text-[9px] text-text-muted">{tk.customer?.phoneNumber || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-text-muted">
                              {tk.personsCount} Guests
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono dark:text-amber-300 text-amber-700 font-bold">{tk.redemptionsUsed}</span>
                                <span className="text-text-muted text-[10px]">/ {tk.totalRedemptionsAllowed} Drinks</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${badgeClass}`}>
                                {tk.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <LiveSessionTimer endTime={tk.endTime} status={tk.status} />
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setExtendingToken(tk)}
                                  className="px-2 py-1 rounded dark:bg-amber-500/10 bg-amber-500/5 hover:dark:bg-amber-500/20 hover:bg-amber-500/10 dark:text-amber-300 text-amber-700 text-[10px] font-bold border border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer"
                                  title="Extend Session Time"
                                >
                                  <Clock size={10} /> Extend
                                </button>
                                <button
                                  onClick={() => setClosingToken(tk)}
                                  className="px-2 py-1 rounded dark:bg-red-500/10 bg-red-500/5 hover:dark:bg-red-500/20 hover:bg-red-500/15 dark:text-red-400 text-red-700 text-[10px] font-bold border border-red-500/30 transition-all flex items-center gap-1 cursor-pointer"
                                  title="Process Final Checkout"
                                >
                                  <LogOut size={10} /> Checkout
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view - High-density cards */}
                <div className="block sm:hidden space-y-3">
                  {filteredTokens.map(tk => {
                    const statusStr = String(tk.status).toUpperCase();
                    let badgeClass = 'bg-border-main/20 text-text-muted border border-border-main/30';
                    if (statusStr === 'ACTIVE' || statusStr === 'EXTENDED') {
                      badgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                    } else if (statusStr === 'EXPIRING') {
                      badgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                    } else if (statusStr === 'PENDING_PAYMENT') {
                      badgeClass = 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse';
                    }

                    return (
                      <div key={tk.id} className="p-4 rounded-xl bg-bg-secondary-surface dark:bg-black/10 border border-border-main space-y-3 text-left">
                        <div className="flex items-center justify-between border-b border-border-main/55 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-text-main text-xs">#{tk.tokenNumber}</span>
                            <span className="text-[10px] font-bold text-primary dark:text-[#D4AF37]">
                              {tk.tableNumber ? `Table ${tk.tableNumber}` : 'Standing Bar'}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${badgeClass}`}>
                            {tk.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                          <div>
                            <span className="text-[9px] text-text-muted block font-semibold uppercase">Guest</span>
                            <span className="font-semibold text-text-main truncate block">{tk.customer?.name || 'Walk-in Guest'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-text-muted block font-semibold uppercase">Group Size</span>
                            <span className="font-semibold text-text-muted block">{tk.personsCount} Guests</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-text-muted block font-semibold uppercase">Drinks Redeemed</span>
                            <span className="font-semibold text-text-muted block">
                              <span className="dark:text-amber-300 text-amber-700 font-bold">{tk.redemptionsUsed}</span> / {tk.totalRedemptionsAllowed}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-text-muted block font-semibold uppercase">Time Left</span>
                            <LiveSessionTimer endTime={tk.endTime} status={tk.status} />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => setExtendingToken(tk)}
                            className="w-full py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-bold border border-amber-500/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Clock size={12} /> Extend
                          </button>
                          <button
                            onClick={() => setClosingToken(tk)}
                            className="w-full py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold border border-red-500/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <LogOut size={12} /> Checkout
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Attention Needed Column (1/3) */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-border-main flex flex-col justify-between min-h-[220px]">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-border-main shrink-0">
              <div className="flex items-center gap-2 dark:text-red-400 text-red-700 font-bold text-sm">
                <Bell size={18} /> <span>Attention Needed</span>
              </div>
              <span className="px-2 py-0.5 rounded-full dark:bg-red-500/10 bg-red-500/10 dark:text-red-400 text-red-700 dark:border-red-500/20 border-red-500/30 text-[10px] font-bold shrink-0">
                {notifications.length} Active
              </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto my-3 pr-1 max-h-[380px] custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center h-full text-text-muted text-xs py-8 space-y-2">
                  <CheckCircle2 size={24} className="text-emerald-500 opacity-60" />
                  <p>All floor operations running smoothly.</p>
                </div>
              ) : (
                notifications.map((notif) => {
                  let iconColorClass = 'text-primary bg-primary/10';
                  if (notif.type === 'expire') {
                    iconColorClass = 'text-amber-700 bg-amber-500/15 dark:bg-amber-500/10 dark:text-amber-400';
                  } else if (notif.type === 'checkout') {
                    iconColorClass = 'text-red-700 bg-red-500/15 dark:bg-red-500/10 dark:text-red-400';
                  } else if (notif.type === 'assign') {
                    iconColorClass = 'text-emerald-700 bg-emerald-500/15 dark:bg-emerald-500/10 dark:text-emerald-400';
                  } else if (notif.type === 'attendance') {
                    iconColorClass = 'dark:text-[#D4AF37] text-primary dark:bg-[#D4AF37]/10 bg-primary/10';
                  }

                  return (
                    <div 
                      key={notif.id} 
                      onClick={() => notif.onAction?.()}
                      className={`p-3 rounded-xl bg-bg-secondary-surface dark:bg-black/10 border border-border-main flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between animate-fadeIn text-left ${
                        notif.onAction ? 'cursor-pointer hover:border-primary/50 dark:hover:border-[#D4AF37]/50 hover:bg-neutral-50 dark:hover:bg-white/5 transition-all' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0 w-full">
                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${iconColorClass}`}>
                          <AlertCircle size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold text-text-main leading-tight truncate">
                            {notif.title}
                          </h5>
                          <p className="text-[11px] text-text-muted mt-0.5 break-words font-semibold">{notif.message}</p>
                          {notif.remainingTimeStr && notif.type === 'expire' && (
                            <p className="text-[10px] text-red-500 dark:text-red-400 font-extrabold mt-1">Expires in {notif.remainingTimeStr}</p>
                          )}
                        </div>
                      </div>
                      {notif.actionLabel && notif.onAction && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            notif.onAction?.();
                          }}
                          className="w-full sm:w-auto px-3 py-1.5 sm:py-1 rounded dark:bg-[#D4AF37]/10 dark:hover:bg-[#D4AF37]/25 dark:text-[#D4AF37] dark:border-[#D4AF37]/20 bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 text-xs sm:text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center justify-center shrink-0 self-stretch sm:self-center"
                        >
                          {notif.actionLabel}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. ZONE 3: SHIFT INTELLIGENCE & BUSINESS PERFORMANCE                      */}
      {/* ========================================================================= */}
      {isManagement && (
        <section id="revenue-analytics-section" className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-border-main pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black px-2 py-0.5 rounded bg-neutral-900 text-[#D4AF37] dark:bg-white/10 dark:text-[#D4AF37] tracking-wider uppercase">03</span>
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-text-main">
                Shift Intelligence & Business Performance
              </h3>
            </div>
            <span className="text-[10px] text-text-muted font-semibold hidden sm:inline">Daily Financial Reconciliation & Occupancy Velocity</span>
          </div>

          {/* KPI Analytics Summary Cards */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-border-main space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border-main">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Executive Performance Summary</h4>
              <span className="text-[10px] dark:text-[#D4AF37] text-primary font-bold flex items-center gap-1">
                <Sparkles size={12} /> Real-Time Shift KPIs
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-left">
              <div className="p-3.5 bg-bg-secondary-surface dark:bg-black/10 rounded-xl border border-border-main/50 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-text-muted block uppercase font-semibold tracking-wider">Avg Checkout Value</span>
                  <span className="text-sm sm:text-base font-black text-text-main block mt-1">{avgCheckoutDisplay}</span>
                </div>
                <span className="text-[9px] text-text-muted mt-2 block">Per completed session</span>
              </div>

              <div className="p-3.5 bg-bg-secondary-surface dark:bg-black/10 rounded-xl border border-border-main/50 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-text-muted block uppercase font-semibold tracking-wider">Drink Conversion</span>
                  <span className="text-sm sm:text-base font-black text-text-main block mt-1">{drinkConversionDisplay} Drinks</span>
                </div>
                <span className="text-[9px] text-text-muted mt-2 block">Average redemptions / guest</span>
              </div>

              <div className="p-3.5 bg-bg-secondary-surface dark:bg-black/10 rounded-xl border border-border-main/50 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-text-muted block uppercase font-semibold tracking-wider">QR Passes Issued</span>
                  <span className="text-sm sm:text-base font-black text-text-main block mt-1">{qrPassActiveDisplay} Active</span>
                </div>
                <span className="text-[9px] text-text-muted mt-2 block">Active digital tokens</span>
              </div>

              <div className="p-3.5 bg-bg-secondary-surface dark:bg-black/10 rounded-xl border border-border-main/50 flex flex-col justify-between">
                <div>
                  <span className="text-[9px] text-text-muted block uppercase font-semibold tracking-wider">Peak Seating Velocity</span>
                  <span className="text-sm sm:text-base font-black text-text-main block mt-1">{peakSeatingDisplay}</span>
                </div>
                <span className="text-[9px] text-text-muted mt-2 block">Highest concurrent session load</span>
              </div>
            </div>
          </div>

          {/* Side-by-Side Charts (2/3) & Audit Activity Stream (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Hourly Revenue Chart Card */}
              <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-border-main flex flex-col justify-between min-h-[340px]">
                <div className="flex items-center justify-between pb-3 border-b border-border-main shrink-0 text-left">
                  <div className="flex items-center gap-2 text-text-main font-bold text-xs sm:text-sm">
                    <BarChart3 size={16} className="shrink-0 text-[#D4AF37]" /> <span>HOURLY REVENUE</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#D4AF37] flex items-center gap-1 shrink-0">
                      {selectedRevenueNode !== null 
                        ? `₹${revenueTrends[selectedRevenueNode].value.toLocaleString()} at ${revenueTrends[selectedRevenueNode].time}`
                        : peakSalesHourStr}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col space-y-2 mt-4 flex-1 justify-center overflow-x-auto custom-scrollbar">
                  {revenueTrends.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
                      No revenue trends recorded today.
                    </div>
                  ) : (
                    <div className="min-w-[280px]">
                      {/* Top Legend Row */}
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-text-muted select-none pb-2 pl-12">
                        <div className="w-2.5 h-2.5 rounded bg-gradient-to-t from-[#D4AF37] to-[#F5E08B]" />
                        <span>Revenue (₹)</span>
                      </div>

                      {/* Main Chart Row */}
                      <div className="flex gap-2 items-stretch h-36">
                        {/* Y-Axis */}
                        <div className="flex flex-col justify-between text-[9px] font-mono text-text-muted font-bold py-1 text-right w-10 shrink-0">
                          {yAxisLabels.map((lbl, idx) => (
                            <span key={idx}>{lbl}</span>
                          ))}
                        </div>

                        {/* Bars Container */}
                        <div className="flex-1 border-l border-b border-border-main px-2 flex justify-between items-end relative h-full">
                          {/* Background Grid lines */}
                          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-1">
                            <div className="w-full border-t border-border-main/15 h-0" />
                            <div className="w-full border-t border-border-main/15 h-0" />
                            <div className="w-full border-t border-border-main/15 h-0" />
                            <div className="w-full border-t border-border-main/15 h-0" />
                            <div className="w-full h-0" />
                          </div>

                          {revenueTrends.map((trend, idx) => {
                            const isPeak = trend.value === maxChartVal;
                            const percent = Math.min(100, (trend.value / maxChartVal) * 100);
                            const isSelected = selectedRevenueNode === idx;
                            return (
                              <div 
                                key={idx} 
                                onClick={() => setSelectedRevenueNode(selectedRevenueNode === idx ? null : idx)}
                                className="flex flex-col items-center flex-1 group h-full justify-end relative z-10 mx-0.5"
                              >
                                {/* Tooltip amount on hover / touch toggle */}
                                <div className={`absolute -top-6 text-[9px] font-mono font-bold text-[#D4AF37] bg-bg-surface px-1.5 py-0.5 rounded border border-border-main z-20 pointer-events-none whitespace-nowrap ${
                                  isSelected ? 'block' : 'hidden group-hover:block'
                                }`}>
                                  ₹{trend.value.toLocaleString()}
                                </div>
                                <div 
                                  style={{ height: `${percent}%` }}
                                  className={`w-full rounded-t transition-all duration-300 cursor-pointer ${
                                    isSelected || isPeak 
                                      ? 'bg-gradient-to-t from-[#D4AF37] to-[#F5E08B] hover:scale-105 active:scale-95' 
                                      : 'analytics-bar-regular hover:scale-105 active:scale-95'
                                  }`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* X-Axis labels row */}
                      <div className="flex justify-between pl-12 pr-2 pb-1 mt-1 text-[8px] font-mono text-text-muted font-bold">
                        {revenueTrends.map((trend, idx) => {
                          const isTick = idx % 4 === 0;
                          return (
                            <span key={idx} className="flex-1 text-center whitespace-nowrap">
                              {isTick ? trend.time.replace(':00', '') : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Chart Legend */}
                <div className="flex items-center justify-center gap-4 pt-3 mt-2 border-t border-border-main text-[9px] font-bold text-text-muted shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded bg-gradient-to-t from-[#D4AF37] to-[#F5E08B]" />
                    <span>Peak Hour</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded analytics-bar-regular border border-border-main" />
                    <span>Shift Revenue</span>
                  </div>
                </div>
              </div>

              {/* Seating Peaks Custom SVG Line Chart Card */}
              <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-border-main flex flex-col justify-between min-h-[340px]">
                <div className="flex items-center justify-between pb-3 border-b border-border-main shrink-0 text-left">
                  <div className="flex items-center gap-2 text-text-main font-bold text-xs sm:text-sm">
                    <Grid3X3 size={16} className="shrink-0 text-[#D4AF37]" /> <span>SEATING PEAKS</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#D4AF37] shrink-0">
                    {selectedSeatingNode !== null 
                      ? `${seatingPeaksTrends[selectedSeatingNode].activeTokens} Guests at ${seatingPeaksTrends[selectedSeatingNode].time}`
                      : `Peak: ${peakSeatingDisplay}`}
                  </span>
                </div>

                <div className="flex flex-col space-y-2 mt-4 flex-1 justify-center overflow-x-auto custom-scrollbar">
                  {seatingPeaksTrends.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-text-muted text-xs">
                      No active occupancy trends logged.
                    </div>
                  ) : (
                    <div className="min-w-[280px]">
                      <div className="relative w-full h-[144px] flex items-end">
                        <svg className="w-full h-full" viewBox="0 0 500 144">
                          <defs>
                            <linearGradient id="goldAreaGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.25" />
                              <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          
                          {/* Grid lines */}
                          <line x1="0" y1="36" x2="500" y2="36" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                          <line x1="0" y1="72" x2="500" y2="72" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                          <line x1="0" y1="108" x2="500" y2="108" stroke="rgba(255,255,255,0.05)" strokeDasharray="3" />
                          
                          {/* Area */}
                          {lineChartPathData.areaPath && (
                            <path d={lineChartPathData.areaPath} fill="url(#goldAreaGradient)" />
                          )}
                          
                          {/* Line */}
                          {lineChartPathData.linePath && (
                            <path d={lineChartPathData.linePath} fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          )}
                          
                          {/* Dots */}
                          {lineChartPathData.points.map((p, idx) => {
                            const isPeak = p.value === maxActiveTokensVal;
                            const isSelected = selectedSeatingNode === idx;
                            return (
                              <g 
                                key={idx} 
                                onClick={() => setSelectedSeatingNode(selectedSeatingNode === idx ? null : idx)}
                                className="group/dot cursor-pointer"
                              >
                                <circle 
                                  cx={p.x} 
                                  cy={p.y} 
                                  r="12" 
                                  fill="transparent" 
                                />
                                <circle 
                                  cx={p.x} 
                                  cy={p.y} 
                                  r={isSelected || isPeak ? "5.5" : "3.5"} 
                                  fill={isSelected || isPeak ? "#F5E08B" : "#D4AF37"} 
                                  stroke="#1c1c1e" 
                                  strokeWidth="1.5"
                                />
                              </g>
                            );
                          })}
                        </svg>
                      </div>

                      {/* X-Axis labels row */}
                      <div className="flex gap-2 pl-2 pr-2 pb-1 mt-1 text-[8px] font-mono text-text-muted font-bold">
                        {seatingPeaksTrends.map((trend, idx) => (
                          <span key={idx} className={`flex-1 text-center truncate ${idx % 2 === 0 ? 'inline' : 'hidden sm:inline'}`}>
                            {trend.time.replace(':00', '')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Chart Legend */}
                <div className="flex items-center justify-center gap-4 pt-3 mt-2 border-t border-border-main text-[9px] font-bold text-text-muted shrink-0">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-0.5 bg-[#D4AF37]" />
                    <span>Guests In-House</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Recent Live Activities Timeline Card (1/3) */}
            <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-border-main flex flex-col justify-between min-h-[220px] lg:h-[340px]">
              <div className="flex items-center justify-between pb-3 border-b border-border-main shrink-0">
                <div className="flex items-center gap-2 text-text-main font-bold text-xs sm:text-sm">
                  <Activity size={16} className="shrink-0 text-[#D4AF37]" /> <span>Recent Activities</span>
                </div>
                <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider shrink-0">Audit Stream</span>
              </div>

              <div className="flex-1 overflow-y-auto my-3 pr-1 custom-scrollbar">
                {activities.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center h-full text-text-muted text-xs py-6">
                    No recent activities recorded today.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-4 border-l border-border-main ml-3 py-1 text-left">
                    {activities.map((act) => {
                      let nodeDotClass = 'bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.6)]';
                      let tagLabel = 'Check-In';
                      let tagBadgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';

                      if (act.tag === 'CHECKOUT') {
                        nodeDotClass = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
                        tagLabel = 'Checkout';
                        tagBadgeClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
                      } else if (act.tag === 'EXTENSION') {
                        nodeDotClass = 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]';
                        tagLabel = 'Extension';
                        tagBadgeClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                      }

                      return (
                        <div key={act.id} className="relative text-[11px]">
                          <div className={`absolute -left-[30px] top-1.5 w-2 h-2 rounded-full ${nodeDotClass} border-2 border-bg-surface z-10 animate-pulse`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${tagBadgeClass}`}>
                                {tagLabel}
                              </span>
                              <span className="text-[9px] text-text-muted font-mono">{act.time}</span>
                            </div>
                            <p className="text-text-main font-medium leading-relaxed mt-1">{act.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 5. EXTENSION AND CLOSE MODALS                                             */}
      {/* ========================================================================= */}
      <ExtendSessionModal
        isOpen={extendingToken !== null}
        token={extendingToken!}
        rates={rates}
        onClose={() => setExtendingToken(null)}
        onSuccess={() => {
          setExtendingToken(null);
          refreshTokens();
          if (isManagement) {
            refreshAllSessions();
          }
        }}
      />

      {closingToken && (
        <CheckoutConfirmationModal
          isOpen={!!closingToken}
          session={{
            tokenNumber: closingToken.tokenNumber,
            customerName: closingToken.customer?.name || 'Walk-in Guest',
            customerPhone: closingToken.customer?.phoneNumber || 'N/A',
            tableNumber: closingToken.table?.tableNumber || closingToken.tableNumber || 'N/A',
          }}
          onClose={() => setClosingToken(null)}
          onSuccess={() => {
            setClosingToken(null);
            refreshTokens();
            if (isManagement) {
              refreshAllSessions();
            }
          }}
        />
      )}
    </div>
  );
};
