import React, { useEffect, useMemo } from 'react';
import { BarChart3, Download, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';

export const RevenueAnalyticsChart: React.FC = () => {
  const { showToast, isDark } = useAuth();
  const { allSessions, isLoading, refreshAllSessions } = useData();

  useEffect(() => {
    refreshAllSessions();
  }, []);

  const today = useMemo(() => new Date(), []);
  const targetYear = today.getFullYear();
  const targetMonth = today.getMonth();
  const targetDate = today.getDate();

  const isToday = (dateInput: string | Date | undefined) => {
    if (!dateInput) return false;
    const d = new Date(dateInput);
    return d.getFullYear() === targetYear &&
           d.getMonth() === targetMonth &&
           d.getDate() === targetDate;
  };

  // Filter valid revenue-generating tokens/sessions for today
  const todayRevenueTokens = useMemo(() => {
    return allSessions.filter(t => {
      // paymentVerified must be true and status must not be CANCELLED
      if (!t.paymentVerified || String(t.status).toUpperCase() === 'CANCELLED') {
        return false;
      }
      const startIsToday = isToday(t.startTime);
      const hasTodayExtension = t.extensions?.some((ext: any) => isToday(ext.extendedAt));
      return startIsToday || hasTodayExtension;
    });
  }, [allSessions, targetYear, targetMonth, targetDate]);

  // Aggregate hourly revenue buckets for the chart (continuous operational window: 6 PM to 1 AM)
  const hourlyData = useMemo(() => {
    const template = [
      { hour: '6 PM', amount: 0, hourInt: 18, peak: false },
      { hour: '7 PM', amount: 0, hourInt: 19, peak: false },
      { hour: '8 PM', amount: 0, hourInt: 20, peak: false },
      { hour: '9 PM', amount: 0, hourInt: 21, peak: false },
      { hour: '10 PM', amount: 0, hourInt: 22, peak: false },
      { hour: '11 PM', amount: 0, hourInt: 23, peak: false },
      { hour: '12 AM', amount: 0, hourInt: 0, peak: false },
      { hour: '1 AM', amount: 0, hourInt: 1, peak: false },
    ];

    const mapHourToBucketIndex = (hour: number) => {
      if (hour >= 18 && hour <= 23) {
        return hour - 18;
      }
      if (hour === 0 || hour === 1) {
        return hour + 6;
      }
      return -1;
    };

    todayRevenueTokens.forEach(t => {
      // 1. Cover Charge: occurs at session startTime
      if (isToday(t.startTime)) {
        const startHour = new Date(t.startTime).getHours();
        const idx = mapHourToBucketIndex(startHour);
        if (idx !== -1) {
          const extSum = t.extensions?.reduce((acc: number, ext: any) => acc + Number(ext.additionalAmount || 0), 0) || 0;
          const coverCharge = Number(t.amountPaid || 0) - extSum;
          template[idx].amount += coverCharge;
        }
      }

      // 2. Extensions: occurs at extension extendedAt time
      if (t.extensions && Array.isArray(t.extensions)) {
        t.extensions.forEach((ext: any) => {
          if (isToday(ext.extendedAt)) {
            const extHour = new Date(ext.extendedAt).getHours();
            const idx = mapHourToBucketIndex(extHour);
            if (idx !== -1) {
              template[idx].amount += Number(ext.additionalAmount || 0);
            }
          }
        });
      }
    });

    // Find the peak hour index dynamically
    let peakIndex = -1;
    let maxAmount = 0;
    template.forEach((item, index) => {
      if (item.amount > maxAmount) {
        maxAmount = item.amount;
        peakIndex = index;
      }
    });

    if (peakIndex !== -1 && maxAmount > 0) {
      template[peakIndex].peak = true;
    }

    return template;
  }, [todayRevenueTokens, targetYear, targetMonth, targetDate]);

  const { peakHourName, peakAmount } = useMemo(() => {
    const peakItem = hourlyData.find(d => d.peak);
    return {
      peakHourName: peakItem ? peakItem.hour : 'N/A',
      peakAmount: peakItem ? peakItem.amount : 0
    };
  }, [hourlyData]);

  const maxVal = useMemo(() => {
    const amt = Math.max(...hourlyData.map(d => d.amount));
    return amt > 0 ? amt : 1; // Prevent division by zero
  }, [hourlyData]);

  const yAxisLabels = useMemo(() => {
    const formatYLabel = (val: number) => {
      if (val >= 100000) return `₹${(val / 1000).toFixed(0)}k`;
      if (val >= 1000) return `₹${(val / 1000).toFixed(1).replace('.0', '')}k`;
      return `₹${Math.round(val)}`;
    };
    return [
      formatYLabel(maxVal),
      formatYLabel(maxVal * 0.75),
      formatYLabel(maxVal * 0.5),
      formatYLabel(maxVal * 0.25),
      formatYLabel(0)
    ];
  }, [maxVal]);

  const handleExportCSV = () => {
    try {
      const headers = 'TokenNumber,CustomerName,PhoneNumber,EmailAddress,Persons,RedemptionsUsed,TotalRedemptions,DeliveryMode,AmountPaid,TodayRevenueContribution,Status\n';
      const rows = todayRevenueTokens.map(t => {
        const baseRev = isToday(t.startTime) ? Number(t.amountPaid || 0) : 0;
        const extRev = (t.extensions || []).reduce((sum: number, ext: any) => {
          return sum + (isToday(ext.extendedAt) ? Number(ext.additionalAmount || 0) : 0);
        }, 0);
        const totalSessionTodayRevenue = baseRev + extRev;

        const custName = t.customerName || t.customer?.name || '';
        const phone = t.phoneNumber || t.customer?.phoneNumber || '';
        const email = t.email || t.customer?.email || '';
        const persons = t.persons || t.personsCount || 0;
        const redemptions = t.redemptionCount || t.redemptionsUsed || 0;
        const totalRed = t.redemptionLimit || t.totalRedemptionsAllowed || 0;
        const mode = t.deliveryMode || '';
        const amt = t.amountPaid || 0;
        const status = t.status || '';

        return `"${t.tokenNumber}","${custName}","${phone}","${email}",${persons},${redemptions},${totalRed},"${mode}",${amt},${totalSessionTodayRevenue},"${status}"`;
      }).join('\n');

      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `revenue_report_${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDate).padStart(2, '0')}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Revenue sessions export CSV downloaded successfully!', 'success');
    } catch (err: any) {
      showToast('Failed to export CSV logs.', 'danger');
    }
  };

  const peakText = peakAmount > 0 
    ? `Peak Hour: ${peakHourName} (₹${peakAmount.toLocaleString()})`
    : 'No sales recorded today';

  // Loading Presentation Skeleton
  if (isLoading) {
    return (
      <section role="region" aria-label="Hourly Revenue Analytics Loading" className="space-y-6">
        <div className="glass-panel rounded-2xl border border-border-main overflow-hidden shadow-xs animate-pulse">
          {/* Action Header Skeleton */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 border-b border-border-main bg-white/40 dark:bg-white/[0.02]">
            <div className="space-y-1.5">
              <div className="h-4 w-48 bg-zinc-200 dark:bg-white/10 rounded-md" />
              <div className="h-3 w-64 bg-zinc-200 dark:bg-white/10 rounded-md" />
            </div>
            <div className="h-9 w-36 bg-zinc-200 dark:bg-white/10 rounded-xl" />
          </div>

          {/* Chart Area Skeleton */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 pb-3 border-b border-border-main">
              <div className="h-4 w-60 bg-zinc-200 dark:bg-white/10 rounded" />
              <div className="h-4 w-40 bg-zinc-200 dark:bg-white/10 rounded" />
            </div>

            {/* Grid Skeleton */}
            <div className="flex gap-2 sm:gap-4 items-stretch h-64 mt-2">
              <div className="flex flex-col justify-between py-5 w-11 shrink-0 space-y-4 pr-2">
                <div className="h-2.5 w-8 bg-zinc-200 dark:bg-white/10 rounded ml-auto" />
                <div className="h-2.5 w-8 bg-zinc-200 dark:bg-white/10 rounded ml-auto" />
                <div className="h-2.5 w-8 bg-zinc-200 dark:bg-white/10 rounded ml-auto" />
                <div className="h-2.5 w-8 bg-zinc-200 dark:bg-white/10 rounded ml-auto" />
                <div className="h-2.5 w-6 bg-zinc-200 dark:bg-white/10 rounded ml-auto" />
              </div>
              <div className="flex-1 flex items-end justify-between gap-1.5 sm:gap-3 border-l border-b border-zinc-200 dark:border-white/10 pb-6 pt-5 px-1 sm:px-2">
                {[35, 55, 80, 45, 60, 95, 40, 25].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div
                      style={{ height: `${h}%` }}
                      className="w-full max-w-[44px] sm:max-w-[52px] bg-zinc-200/70 dark:bg-white/10 rounded-t-xl"
                    />
                    <div className="h-2.5 w-8 bg-zinc-200 dark:bg-white/10 rounded mt-3" />
                  </div>
                ))}
              </div>
            </div>

            {/* Legend Skeleton */}
            <div className="flex items-center justify-center gap-6 pt-3 sm:pt-4 border-t border-border-main">
              <div className="h-3 w-28 bg-zinc-200 dark:bg-white/10 rounded" />
              <div className="h-3 w-32 bg-zinc-200 dark:bg-white/10 rounded" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section role="region" aria-labelledby="revenue-analytics-heading" className="space-y-6">
      {/* Screen Reader Accessible Summary Table (Zero Visual UI Duplication) */}
      <div className="sr-only">
        <table>
          <caption>Hourly Revenue Breakdown for Today</caption>
          <thead>
            <tr>
              <th scope="col">Hour</th>
              <th scope="col">Revenue Amount</th>
              <th scope="col">Shift Status</th>
            </tr>
          </thead>
          <tbody>
            {hourlyData.map(d => (
              <tr key={d.hour}>
                <td>{d.hour}</td>
                <td>₹{d.amount.toLocaleString()}</td>
                <td>{d.peak ? 'Peak Hour' : 'Regular Shift'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unified Master Analytics Card (Removes Double Glass Seam) */}
      <div className="glass-panel rounded-2xl border border-border-main overflow-hidden shadow-xs">
        {/* Unified Action Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5 border-b border-border-main bg-white/40 dark:bg-white/[0.02]">
          <div>
            <h2 id="revenue-analytics-heading" className="text-sm sm:text-base font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">
              Revenue Analytics & Sales Summary
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Peak hour analysis and financial collections
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            aria-label="Export today's revenue sessions as CSV"
            className="w-full sm:w-auto justify-center px-3.5 sm:px-4 py-2 rounded-xl primary-btn text-white dark:text-black text-[11px] sm:text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 active:scale-95 shadow-xs"
          >
            <Download size={14} className="shrink-0" />
            <span className="hidden sm:inline">Export Sessions CSV</span>
            <span className="sm:hidden">Export CSV</span>
          </button>
        </div>

        {/* Hourly Sales Bar Chart Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 pb-3 border-b border-border-main">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-xs sm:text-sm min-w-0">
              <BarChart3 size={17} className="shrink-0 text-primary dark:text-[#D4AF37]" />
              <span className="truncate">Hourly Revenue Breakdown & Peak Collections</span>
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-[#D4AF37] flex items-center gap-1.5 shrink-0">
              <TrendingUp size={14} className="shrink-0" /> {peakText}
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0">
            <div className="flex items-stretch h-64 mt-2 min-w-[420px] sm:min-w-[500px]">
              {/* Sticky Y-Axis Labels Column on Small Screens */}
              <div className="sticky left-0 z-20 bg-white/95 dark:bg-[#18181A]/95 backdrop-blur-xs flex flex-col justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400 font-bold select-none text-right w-11 pr-2 pb-6 pt-5 shrink-0 border-r border-zinc-200/50 dark:border-white/5">
                {yAxisLabels.map((lbl, idx) => (
                  <span key={idx}>{lbl}</span>
                ))}
              </div>

              {/* Chart Content Base Grid Area */}
              <div className="flex-1 relative border-l border-b border-zinc-200 dark:border-white/10 pb-6 pt-5 px-1 sm:px-2">
                {/* Background Grid Lines with Aligned Baseline */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none select-none pb-6 pt-5">
                  <div className="w-full border-t border-zinc-200/80 dark:border-white/10 h-0" />
                  <div className="w-full border-t border-zinc-200/80 dark:border-white/10 h-0" />
                  <div className="w-full border-t border-zinc-200/80 dark:border-white/10 h-0" />
                  <div className="w-full border-t border-zinc-200/80 dark:border-white/10 h-0" />
                  <div className="w-full border-t border-zinc-200 dark:border-white/10 h-0" />
                </div>

                {/* Columns Container */}
                <div className="relative z-10 flex items-end justify-between gap-1.5 sm:gap-3 h-full">
                  {hourlyData.map((d, index) => {
                    const heightPercent = maxVal > 0 ? Math.round((d.amount / maxVal) * 100) : 0;
                    const isEdgeLeft = index === 0;
                    const isEdgeRight = index === hourlyData.length - 1;

                    return (
                      <div key={d.hour} className="group flex-1 flex flex-col items-center h-full justify-end relative">
                        {/* Hover & Focus Floating Tooltip Popup */}
                        <div
                          className={`absolute bottom-full mb-2 hidden group-hover:flex group-focus-within:flex flex-col z-30 transition-all duration-200 pointer-events-none ${
                            isEdgeLeft ? 'items-start left-0' : isEdgeRight ? 'items-end right-0' : 'items-center'
                          }`}
                        >
                          <div className="bg-zinc-900 border border-zinc-700/70 dark:border-white/15 px-3 py-2 rounded-xl text-[10px] whitespace-nowrap text-white font-bold shadow-xl">
                            <p className="text-zinc-400">Hour: {d.hour}</p>
                            <p className="text-amber-300 dark:text-[#D4AF37] font-black text-xs mt-0.5">₹{d.amount.toLocaleString()}</p>
                            <p className="text-[9px] text-zinc-400 font-medium mt-0.5">
                              {d.peak ? '🔥 Peak Hour' : 'Regular Shift'}
                            </p>
                          </div>
                          <div
                            className={`w-2 h-2 bg-zinc-900 border-r border-b border-zinc-700/70 dark:border-white/15 rotate-45 -mt-1 ${
                              isEdgeLeft ? 'ml-3' : isEdgeRight ? 'mr-3' : ''
                            }`}
                          />
                        </div>

                        {/* Numerical Label on top of the Bar (Visible across desktop, tablet, and mobile) */}
                        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 font-bold mb-1 select-none whitespace-nowrap">
                          {d.amount === 0 
                            ? '' 
                            : d.amount < 1000 
                              ? `₹${d.amount}` 
                              : `₹${(d.amount / 1000).toFixed(1).replace('.0', '')}k`
                          }
                        </span>

                        {/* Accessible Interactive Bar Visual Element */}
                        <button
                          type="button"
                          role="button"
                          tabIndex={0}
                          onClick={() => showToast(`Hour: ${d.hour} - Revenue: ₹${d.amount.toLocaleString()}${d.peak ? ' (Peak)' : ''}`, 'info')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              showToast(`Hour: ${d.hour} - Revenue: ₹${d.amount.toLocaleString()}${d.peak ? ' (Peak)' : ''}`, 'info');
                            }
                          }}
                          aria-label={`Hour: ${d.hour}, Revenue: ₹${d.amount.toLocaleString()}${d.peak ? ' (Peak Hour)' : ''}`}
                          style={{ height: d.amount > 0 ? `${heightPercent}%` : '6px' }}
                          className={`w-full max-w-[44px] sm:max-w-[52px] mx-auto rounded-t-xl transition-all duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-[#D4AF37] ${
                            d.amount === 0
                              ? 'bg-zinc-200/60 dark:bg-white/10 hover:bg-zinc-300 dark:hover:bg-white/20'
                              : d.peak 
                                ? 'bg-gradient-to-t from-[#D4AF37] to-[#F5E08B] hover:scale-105 active:scale-95' 
                                : 'analytics-bar-regular hover:scale-105 active:scale-95'
                          }`}
                        />

                        {/* X-Axis Tick Label */}
                        <span className={`text-[10px] font-bold absolute top-full mt-2 whitespace-nowrap select-none ${
                          d.peak ? (isDark ? 'text-[#D4AF37]' : 'text-primary') : 'text-zinc-500 dark:text-zinc-400'
                        }`}>
                          {d.hour}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Chart Legend Footer */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-3 sm:pt-4 border-t border-border-main text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 select-none">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-t from-[#D4AF37] to-[#F5E08B]" />
              <span>Peak Hour Revenue</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="w-3 h-3 rounded analytics-bar-regular" />
              <span>Regular Shift Revenue</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

