import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  Users,
  LineChart,
  Calendar,
  CalendarDays,
  Clock,
  Settings,
  LogOut,
  Menu,
  Wallet,
  FileText,
  Building2,
  Timer,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAdmin } from "@/contexts/AdminContext";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LineChart },
  { to: "/admin/users", label: "Employees", icon: Users },
  { to: "/admin/payroll", label: "Payroll", icon: Wallet },
  { to: "/admin/overtime", label: "Overtime", icon: Timer },
  { to: "/admin/attendance", label: "Attendance", icon: Calendar },
  { to: "/admin/timesheet", label: "Timesheet", icon: Clock },
  { to: "/admin/roster", label: "Roster", icon: CalendarDays },
  { to: "/admin/leaves", label: "Leaves", icon: FileText },
  { to: "/admin/hr-policies", label: "HR Policies", icon: Building2 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function NavLinks({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const location = useLocation();

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        const active = location.pathname === to;
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-attendance-primary/10 text-attendance-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

const AdminLayout = () => {
  const { admin, logout } = useAdmin();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  const sidebarFooter = admin && (
    <div className="border-t p-4">
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="h-9 w-9">
          <AvatarImage src={admin.avatar} alt={admin.name} />
          <AvatarFallback className="bg-purple-700 text-white text-xs">
            {admin.name ? getInitials(admin.name) : "A"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{admin.name}</p>
          <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={logout}
      >
        <LogOut className="h-4 w-4 mr-2" />
        Log out
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-white z-30">
        <div className="flex h-16 items-center gap-2 border-b px-4 shrink-0">
          <ShieldCheck className="h-6 w-6 text-attendance-primary shrink-0" />
          <Link to="/admin/dashboard" className="font-semibold text-lg truncate">
            Admin Portal
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <NavLinks />
        </div>
        {sidebarFooter}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col md:ml-64 min-w-0">
        {/* Mobile menu trigger — no top navbar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Open menu"
              className="md:hidden fixed top-4 left-4 z-40 h-10 w-10 rounded-full shadow-md bg-white"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <div className="flex h-14 items-center gap-2 border-b px-4">
              <ShieldCheck className="h-5 w-5 text-attendance-primary" />
              <span className="font-semibold">Admin Portal</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
            {sidebarFooter}
          </SheetContent>
        </Sheet>

        <main className="flex-1 min-w-0 pt-14 md:pt-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
