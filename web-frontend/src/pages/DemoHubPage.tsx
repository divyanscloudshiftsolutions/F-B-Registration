import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  QrCode,
  Utensils,
  ChefHat,
  BellRing,
  LayoutDashboard,
  RotateCcw,
  Play,
  CheckCircle2,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Trash2,
} from 'lucide-react';

export const DemoHubPage: React.FC = () => {
  const { login, showToast } = useAuth();

  const handleLaunchRole = async (username: string, password = `${username}123`, targetRoute = '/') => {
    try {
      await login(username, password);
      window.location.href = targetRoute;
    } catch (err: any) {
      showToast(err.message || 'Login failed', 'danger');
    }
  };

  const handleClearStorage = () => {
    localStorage.clear();
    showToast('All local storage cleared', 'info');
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="min-h-screen dark:bg-[#12111F] bg-[#F7F6FC] text-text-primary dark:text-white font-sans pb-16">
      {/* Header matching table/ DemoHub */}
      <header className="border-b border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8D6CE5] to-indigo-500 text-white font-black flex items-center justify-center text-sm shadow-md">
              P
            </div>
            <div>
              <div className="font-extrabold text-sm text-text-primary dark:text-white leading-tight">Pegs N Bottles</div>
              <div className="text-[11px] text-text-muted">Demo Hub</div>
            </div>
          </div>
          <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full border border-[#8D6CE5]/20 bg-[#8D6CE5]/5 text-[#8D6CE5] text-xs font-bold">
            Authoritative Production API
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-10">
        {/* Hero */}
        <section>
          <h1 className="font-black text-3xl sm:text-4xl text-text-primary dark:text-white tracking-tight">
            A complete dine-in ordering system.
          </h1>
          <p className="mt-2 max-w-2xl text-xs sm:text-sm text-text-muted">
            Scan → join table → self-order → kitchen & bar prepare → waiter delivers → bill calculation → cashier settlement.
            Everything is natively wired to authoritative Express REST endpoints, Prisma PostgreSQL, and Socket.io rooms.
          </p>
        </section>

        {/* 2-Column Role Cards Grid matching table/ DemoHub */}
        <section className="grid gap-4 md:grid-cols-2">
          {/* Role 1: Customer Scan QR */}
          <div
            onClick={() => {
              localStorage.setItem('bar_active_token', 'BAR-DEMO-001');
              localStorage.setItem('bar_active_table_num', 'C5');
              window.location.href = '/t/BAR-DEMO-001';
            }}
            className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex items-start justify-between"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                  Customer — Scan QR
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Enter as a guest scanning Table C5's QR code with token PIN.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-[#8D6CE5] group-hover:translate-x-1 transition-all shrink-0 mt-1" />
          </div>

          {/* Role 2: Customer Direct Home */}
          <div
            onClick={() => {
              localStorage.setItem('bar_active_token', 'BAR-DEMO-001');
              localStorage.setItem('bar_active_table_num', 'C5');
              window.location.href = '/customer/home';
            }}
            className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex items-start justify-between"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <Utensils className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                  Customer — Skip to Home
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Jump straight into an active dining session with food/drink catalog and live tracking.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-[#8D6CE5] group-hover:translate-x-1 transition-all shrink-0 mt-1" />
          </div>

          {/* Role 3: Waiter / Staff App */}
          <div
            onClick={() => handleLaunchRole('waiter', 'waiter123', '/waiter')}
            className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex items-start justify-between"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                  Waiter / Staff App
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Handle floor occupancy, service requests, ready pickup queue, and table-side orders.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-[#8D6CE5] group-hover:translate-x-1 transition-all shrink-0 mt-1" />
          </div>

          {/* Role 4: Kitchen Display (KDS) */}
          <div
            onClick={() => handleLaunchRole('chef', 'chef123', '/kds/kitchen')}
            className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex items-start justify-between"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-[#8D6CE5]/15 text-[#8D6CE5] flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <ChefHat className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                  Kitchen Display (KDS)
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Accept, prepare and mark ready — 4-stage kanban for kitchen and bar stations.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-[#8D6CE5] group-hover:translate-x-1 transition-all shrink-0 mt-1" />
          </div>

          {/* Role 5: Admin Dashboard */}
          <div
            onClick={() => handleLaunchRole('admin', 'admin123', '/dashboard')}
            className="cursor-pointer rounded-2xl border border-[#8D6CE5]/20 dark:bg-[#1A1829] bg-white p-5 hover:border-[#8D6CE5] transition-all shadow-xs group flex items-start justify-between md:col-span-2"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-text-primary dark:text-white group-hover:text-[#8D6CE5] transition-colors">
                  Admin Dashboard & Back-Office
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Operations overview, floor tables, staff directory, menu availability 86 toggle, billing rules, and sales reports.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-[#8D6CE5] group-hover:translate-x-1 transition-all shrink-0 mt-1" />
          </div>
        </section>

        {/* Demo Controls Section matching table/ DemoHub */}
        <section className="space-y-4 pt-4 border-t border-[#8D6CE5]/15">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8D6CE5]" />
            <h2 className="font-black text-xl text-text-primary dark:text-white">Demo Controls</h2>
          </div>
          <p className="text-xs text-text-muted">
            Quick-switch and reset tools to test multi-role state transitions across the platform.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={handleClearStorage}
              className="p-4 rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white text-left hover:border-[#8D6CE5] transition-all flex items-center justify-between group shadow-xs"
            >
              <div>
                <div className="font-bold text-xs text-text-primary dark:text-white">Clear All Local Storage</div>
                <div className="text-[10px] text-text-muted mt-0.5">Wipe cached session tokens and credentials</div>
              </div>
              <Trash2 className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform shrink-0" />
            </button>

            <button
              onClick={() => handleLaunchRole('receptionist', 'recep123', '/checkin')}
              className="p-4 rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white text-left hover:border-[#8D6CE5] transition-all flex items-center justify-between group shadow-xs"
            >
              <div>
                <div className="font-bold text-xs text-text-primary dark:text-white">Receptionist Check-In</div>
                <div className="text-[10px] text-text-muted mt-0.5">Launch 5-step front-desk check-in wizard</div>
              </div>
              <Play className="w-4 h-4 text-[#8D6CE5] group-hover:translate-x-1 transition-transform shrink-0" />
            </button>

            <button
              onClick={() => handleLaunchRole('bartender', 'bar123', '/kds/bar')}
              className="p-4 rounded-2xl border border-[#8D6CE5]/15 dark:bg-[#1A1829] bg-white text-left hover:border-[#8D6CE5] transition-all flex items-center justify-between group shadow-xs"
            >
              <div>
                <div className="font-bold text-xs text-text-primary dark:text-white">Bartender Station</div>
                <div className="text-[10px] text-text-muted mt-0.5">Drink pouring bump bar & token redemptions</div>
              </div>
              <Play className="w-4 h-4 text-[#8D6CE5] group-hover:translate-x-1 transition-transform shrink-0" />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default DemoHubPage;
