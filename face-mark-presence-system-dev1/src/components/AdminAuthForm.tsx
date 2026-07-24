import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdmin } from "@/contexts/AdminContext";
import { cn } from "@/lib/utils";

interface AdminAuthFormProps {
  type: "login" | "register";
  className?: string;
}

const AdminAuthForm: React.FC<AdminAuthFormProps> = ({ type, className }) => {
  const { login, register } = useAdmin();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (type === "register") {
        // Validate passwords match
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        // // Validate admin email
        // if (!email.endsWith('@admin.com')) {
        //   throw new Error('Admin registration requires an admin email domain (@admin.com)');
        // }

        // Register admin
        await register(name, email, password);
      } else {
        // Login admin
        await login(email, password);
      }

      // Navigate to admin dashboard on success
      navigate("/admin/dashboard");
    } catch (err) {
      console.error("Admin authentication error:", err);
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <div className="flex flex-col items-center justify-center mb-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-8 w-8 text-attendance-primary" />
          <h1 className="text-2xl font-bold">Admin Portal</h1>
        </div>
        <p className="text-muted-foreground text-center">
          {type === "login"
            ? "Sign in to access admin features"
            : "Create an admin account"}
        </p>
      </div>

      {type === "login" && (
        <div className="bg-muted/50 border rounded-md p-3 mb-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Default admin account</p>
          <p>Email: <span className="font-mono">admin@presentsir.com</span></p>
          <p>Password: <span className="font-mono">Admin@123</span></p>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {type === "register" && (
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Admin Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@presentsir.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {type === "register" && (
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        )}

        <Button
          type="submit"
          className="w-full attendance-gradient"
          disabled={isLoading}
        >
          {isLoading
            ? "Processing..."
            : type === "login"
            ? "Admin Sign In"
            : "Create Admin Account"}
        </Button>
      </form>

      <div className="mt-4 text-center text-sm">
        {type === "login" ? (
          <p className="text-muted-foreground">
            First-time setup only:{" "}
            <a
              href="/admin/register"
              className="text-attendance-primary hover:underline"
            >
              Bootstrap admin
            </a>{" "}
            (blocked after the first admin exists).
          </p>
        ) : (
          <p>
            Already have an admin account?{" "}
            <a
              href="/admin/login"
              className="text-attendance-primary hover:underline"
            >
              Admin Sign In
            </a>
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminAuthForm;
