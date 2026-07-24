import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AdminProvider, useAdmin } from "./contexts/AdminContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminRegister from "./pages/admin/AdminRegister";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Profile from "./pages/Profile";
import Users from "./pages/admin/Users";
import Attendance from "./pages/admin/Attendance";
import Timesheet from "./pages/admin/Timesheet";
import Roster from "./pages/admin/Roster";
import Leaves from "./pages/admin/Leaves";
import HRPolicies from "./pages/admin/HRPolicies";
import FaceEnrollment from "./pages/FaceEnrollment";
import Payroll from "./pages/admin/Payroll";
import OvertimeApprovals from "./pages/admin/OvertimeApprovals";
import QuickAttendance from "./pages/QuickAttendance";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminLayout from "./components/admin/AdminLayout";
import LeavePage from "./pages/Leave";
import Payslips from "./pages/Payslips";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-attendance-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAdmin();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-700 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/quick-attendance" element={<QuickAttendance />} />

    {/* User routes */}
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/history"
      element={
        <ProtectedRoute>
          <History />
        </ProtectedRoute>
      }
    />
    <Route
      path="/face-enrollment"
      element={
        <ProtectedRoute>
          <FaceEnrollment />
        </ProtectedRoute>
      }
    />
    <Route
      path="/profile"
      element={
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      }
    />
    <Route
      path="/leave"
      element={
        <ProtectedRoute>
          <LeavePage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/payslips"
      element={
        <ProtectedRoute>
          <Payslips />
        </ProtectedRoute>
      }
    />

    {/* Admin routes */}
    <Route path="/admin/login" element={<AdminLogin />} />
    <Route path="/admin/register" element={<AdminRegister />} />
    <Route
      path="/admin"
      element={
        <AdminProtectedRoute>
          <AdminLayout />
        </AdminProtectedRoute>
      }
    >
      <Route index element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="users" element={<Users />} />
      <Route path="payroll" element={<Payroll />} />
      <Route path="overtime" element={<OvertimeApprovals />} />
      <Route path="attendance" element={<Attendance />} />
      <Route path="timesheet" element={<Timesheet />} />
      <Route path="roster" element={<Roster />} />
      <Route path="leaves" element={<Leaves />} />
      <Route path="hr-policies" element={<HRPolicies />} />
      <Route path="settings" element={<AdminSettings />} />
    </Route>

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AdminProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </AdminProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
