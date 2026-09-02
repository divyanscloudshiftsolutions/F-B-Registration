import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  QrCode,
  Utensils,
  ChefHat,
  BellRing,
  LayoutDashboard,
  Wine,
  UserCheck,
  RotateCcw,
  Play,
  CheckCircle2,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Trash2,
  Sun,
  Moon,
  Grid3X3,
  Layers,
  ShieldCheck,
  Camera,
  Loader2,
  Tablet,
} from 'lucide-react';

const ROLE_PRESETS = {
  customer: { user: 'guest', pin: '2019', route: '/customer/home', tab: 'home' },
  waiter: { user: 'waiter', pin: 'waiter123', route: '/waiter', tab: 'waiter_overview' },
  chef: { user: 'chef', pin: 'chef123', route: '/kds/kitchen', tab: 'kds_kitchen' },
  bar: { user: 'bartender', pin: 'bar123', route: '/kds/bar', tab: 'kds_bar' },
  bartender: { user: 'bartender', pin: 'bar123', route: '/bartender', tab: 'bartender/checkins' },
  receptionist: { user: 'receptionist', pin: 'recep123', route: '/checkin', tab: 'checkin' },
  tables: { user: 'receptionist', pin: 'recep123', route: '/tables', tab: 'tables/layout' },
  admin: { user: 'admin', pin: 'admin123', route: '/dashboard', tab: 'dashboard' },
  staff_mgmt: { user: 'admin', pin: 'admin123', route: '/admin', tab: 'admin/staff' },
  attendance: { user: 'admin', pin: 'admin123', route: '/quick_attendance', tab: 'quick_attendance' },
};

export const DemoHubPage: React.FC = () => {
  const { login, showToast, isDark, toggleTheme } = useAuth();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  const handleLaunchRole = async (
    roleKey: keyof typeof ROLE_PRESETS,
    customRoute?: string,
    customTab?: string
  ) => {
    if (loadingRole) return;
    const preset = ROLE_PRESETS[roleKey];
    if (!preset) return;

    setLoadingRole(roleKey);
    const targetRoute = customRoute || preset.route;
    const targetTab = customTab || preset.tab;

    try {
      localStorage.setItem('bar_web_active_tab', targetTab);
      await login(preset.user, preset.pin);
      window.location.assign(targetRoute);
    } catch (err: any) {
      showToast(err.message || `Failed to launch ${roleKey} session`, 'danger');
      setLoadingRole(null);
    }
  };

  const handleLaunchCustomer = (token = 'BAR-DEMO-001', tableNum = 'C5') => {
    localStorage.setItem('bar_active_token', token);
    localStorage.setItem('bar_active_table_num', tableNum);
    window.location.assign(`/customer/access/${token}`);
  };

  const handleClearStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      showToast('All local storage & cached sessions cleared', 'info');
      setTimeout(() => {
        window.location.assign('/demo');
      }, 400);
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="h-[100dvh] w-full overflow-y-auto dark:bg-[#12111F] bg-[#F7F6FC] text-text-primary dark:text-white font-sans transition-colors relative">
      {/* Top Ambient Light Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#8D6CE5]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Sticky Header */}
      <header className="border-b border-[#8D6CE5]/15 dark:bg-[#1A1829]/95 bg-white/95 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8D6CE5] to-indigo-500 text-white font-black flex items-center justify-center text-sm shadow-md">
              P
            </div>
            <div>
              <div className="font-extrabold text-sm text-text-primary dark:text-white leading-tight">Pegs N Bottles</div>
              <div className="text-[11px] text-text-muted">Production Demo Hub & Launcher</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl border border-[#8D6CE5]/20 hover:bg-[#8D6CE5]/10 text-text-primary dark:text-white transition-colors cursor-pointer"
              title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#8D6CE5]" />}
            </button>
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full border border-[#8D6CE5]/20 bg-[#8D6CE5]/5 text-[#8D6CE5] text-xs font-bold">
              Authoritative API
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-10 pb-32">
        {/* Hero Section */}
        <section>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#8D6CE5]/20 bg-[#8D6CE5]/10 text-[#8D6CE5] text-xs font-extrabold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Complete Dine-In Ordering & Operations</span>
          </div>
          <h1 className="font-black text-3xl sm:text-4xl text-text-primary dark:text-white tracking-tight">
            One connected system. All operational roles.
          </h1>
          <p className="mt-2 max-w-2xl text-xs sm:text-sm text-text-muted">
            Customer QR self-order ➔ Kitchen & Bar KDS preparation ➔ Waiter ready delivery ➔ Bartender drink redemption ➔ Receptionist check-in ➔ Cashier bill settlement.
          </p>
        </section>

        {/* Primary Role Cards Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-xl text-text-primary dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#8D6CE5]" />
              <span>Role Applications</span>
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Customer Scan QR */}
            <div
              onClick={() => handleLaunchCustomer('BAR-DEMO-001', 'C5')}
              className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex flex-col justify-between"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                    Customer — Self-Order
                  </h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    QR menu catalog, customization modifiers, cart with 5% SC + 5% GST, and live 5-stage order tracking.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#8D6CE5]/10 flex items-center justify-between text-xs font-bold text-[#8D6CE5]">
                <span>Launch Dining Session</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 2. Waiter Station */}
            <div
              onClick={() => handleLaunchRole('waiter')}
              className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex flex-col justify-between"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  {loadingRole === 'waiter' ? <Loader2 className="w-5 h-5 animate-spin" /> : <BellRing className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                    Waiter — Floor Station
                  </h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Live floor occupancy, customer service requests, ready pickup stream, and assisted ordering.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#8D6CE5]/10 flex items-center justify-between text-xs font-bold text-indigo-500">
                <span>{loadingRole === 'waiter' ? 'Connecting...' : 'Open Waiter App'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 3. Kitchen KDS */}
            <div
              onClick={() => handleLaunchRole('chef')}
              className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex flex-col justify-between"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-[#8D6CE5]/15 text-[#8D6CE5] flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  {loadingRole === 'chef' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChefHat className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                    Kitchen Display (KDS)
                  </h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    4-stage food preparation Kanban: Placed ➔ Accepted ➔ Preparing ➔ Ready for Waiter pickup.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#8D6CE5]/10 flex items-center justify-between text-xs font-bold text-[#8D6CE5]">
                <span>{loadingRole === 'chef' ? 'Connecting...' : 'Open Kitchen KDS'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 4. Bar KDS */}
            <div
              onClick={() => handleLaunchRole('bar')}
              className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex flex-col justify-between"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  {loadingRole === 'bar' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wine className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                    Bar Display (KDS)
                  </h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Dedicated beverage station display for cocktails, pints, and spirit pours with bump actions.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#8D6CE5]/10 flex items-center justify-between text-xs font-bold text-purple-400">
                <span>{loadingRole === 'bar' ? 'Connecting...' : 'Open Bar KDS'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 5. Receptionist Check-In */}
            <div
              onClick={() => handleLaunchRole('receptionist')}
              className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex flex-col justify-between"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  {loadingRole === 'receptionist' ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                    Receptionist — Check-In
                  </h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Guest registration wizard, seating place type, table assignment, and entry token generation.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#8D6CE5]/10 flex items-center justify-between text-xs font-bold text-emerald-500">
                <span>{loadingRole === 'receptionist' ? 'Connecting...' : 'Start Check-In'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 6. Admin Dashboard */}
            <div
              onClick={() => handleLaunchRole('admin')}
              className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex flex-col justify-between"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  {loadingRole === 'admin' ? <Loader2 className="w-5 h-5 animate-spin" /> : <LayoutDashboard className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                    Admin — Executive Hub
                  </h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Floor layout, staff management, menu 86 availability toggle, rate cards, and sales analytics.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#8D6CE5]/10 flex items-center justify-between text-xs font-bold text-amber-500">
                <span>{loadingRole === 'admin' ? 'Connecting...' : 'Open Dashboard'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 7. Table Display Terminal (Table S-01) */}
            <div
              onClick={() => {
                window.location.assign('/table/S-01');
              }}
              className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex flex-col justify-between"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <Tablet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                    Table Display — S-01 (Tablet)
                  </h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Dedicated tablet display locked to Table S-01. Auto-activates on check-in & auto-resets on bill settlement.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#8D6CE5]/10 flex items-center justify-between text-xs font-bold text-cyan-400">
                <span>Launch Table S-01 Terminal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* 8. Table Display Terminal (Table L-01) */}
            <div
              onClick={() => {
                window.location.assign('/table/L-01');
              }}
              className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex flex-col justify-between"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/15 text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <Tablet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                    Table Display — L-01 (Tablet)
                  </h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Dedicated tablet display locked to Lounge Table L-01 with phone number fallback verification.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-[#8D6CE5]/10 flex items-center justify-between text-xs font-bold text-teal-400">
                <span>Launch Table L-01 Terminal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </section>

        {/* Demo Controls Section */}
        <section className="space-y-4 pt-4 border-t border-[#8D6CE5]/15">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8D6CE5]" />
            <h2 className="font-black text-xl text-text-primary dark:text-white">Quick Station Launchers</h2>
          </div>
          <p className="text-xs text-text-muted">
            1-click role switches and environment reset tools for multi-terminal workflow testing.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Bartender Station */}
            <button
              onClick={() => handleLaunchRole('bartender')}
              disabled={!!loadingRole}
              className="p-4 rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white text-left hover:border-[#8D6CE5] transition-all flex items-center justify-between group shadow-xs cursor-pointer disabled:opacity-50"
            >
              <div>
                <div className="font-bold text-xs text-text-primary dark:text-white">Bartender Station</div>
                <div className="text-[10px] text-text-muted mt-0.5">Drink pouring & token redemptions</div>
              </div>
              {loadingRole === 'bartender' ? <Loader2 className="w-4 h-4 text-[#8D6CE5] animate-spin" /> : <Play className="w-4 h-4 text-[#8D6CE5] group-hover:translate-x-1 transition-transform shrink-0" />}
            </button>

            {/* Live Floor Plan */}
            <button
              onClick={() => handleLaunchRole('tables')}
              disabled={!!loadingRole}
              className="p-4 rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white text-left hover:border-[#8D6CE5] transition-all flex items-center justify-between group shadow-xs cursor-pointer disabled:opacity-50"
            >
              <div>
                <div className="font-bold text-xs text-text-primary dark:text-white">Live Floor Plan</div>
                <div className="text-[10px] text-text-muted mt-0.5">Table turnover & active occupancy</div>
              </div>
              {loadingRole === 'tables' ? <Loader2 className="w-4 h-4 text-[#8D6CE5] animate-spin" /> : <Play className="w-4 h-4 text-[#8D6CE5] group-hover:translate-x-1 transition-transform shrink-0" />}
            </button>

            {/* Staff Management */}
            <button
              onClick={() => handleLaunchRole('staff_mgmt')}
              disabled={!!loadingRole}
              className="p-4 rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white text-left hover:border-[#8D6CE5] transition-all flex items-center justify-between group shadow-xs cursor-pointer disabled:opacity-50"
            >
              <div>
                <div className="font-bold text-xs text-text-primary dark:text-white">Staff Management</div>
                <div className="text-[10px] text-text-muted mt-0.5">Role assignments & PIN setup</div>
              </div>
              {loadingRole === 'staff_mgmt' ? <Loader2 className="w-4 h-4 text-[#8D6CE5] animate-spin" /> : <Play className="w-4 h-4 text-[#8D6CE5] group-hover:translate-x-1 transition-transform shrink-0" />}
            </button>

            {/* Reset Local Storage */}
            <button
              onClick={handleClearStorage}
              className="p-4 rounded-2xl border border-rose-500/20 dark:bg-[#1A1829] bg-white text-left hover:border-rose-500 transition-all flex items-center justify-between group shadow-xs cursor-pointer"
            >
              <div>
                <div className="font-bold text-xs text-rose-500">Reset Local Storage</div>
                <div className="text-[10px] text-text-muted mt-0.5">Clear cached tokens & user state</div>
              </div>
              <Trash2 className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform shrink-0" />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DemoHubPage;
