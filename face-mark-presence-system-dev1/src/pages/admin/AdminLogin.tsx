
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminAuthForm from '@/components/AdminAuthForm';
import { useAdmin } from '@/contexts/AdminContext';

const AdminLogin = () => {
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
      <div className="w-full max-w-md">
        <AdminAuthForm type="login" />
      </div>
    </div>
  );
};

export default AdminLogin;
