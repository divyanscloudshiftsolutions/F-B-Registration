
import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminAuthForm from '@/components/AdminAuthForm';
import { useAdmin } from '@/contexts/AdminContext';

const AdminRegister = () => {
  const { isAuthenticated } = useAdmin();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Bootstrap only: admin registration is allowed when <strong>no admin exists</strong>.
          After the first admin is created, use an existing admin account to manage access.
        </div>
        <AdminAuthForm type="register" />
        <p className="text-center text-sm text-muted-foreground">
          Already have an admin account?{" "}
          <Link to="/admin/login" className="text-attendance-primary underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AdminRegister;
