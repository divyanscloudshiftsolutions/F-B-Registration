import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

/**
 * Public employee self-registration is disabled.
 * Employees are created by admins. This route remains only to redirect old links.
 */
const Register = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Registration closed</h1>
        <p className="text-muted-foreground text-sm">
          Public employee registration is disabled. Ask your administrator to create
          your account, then sign in.
        </p>
        <Button asChild className="attendance-gradient">
          <Link to="/login">Go to Sign In</Link>
        </Button>
      </div>
    </div>
  );
};

export default Register;
