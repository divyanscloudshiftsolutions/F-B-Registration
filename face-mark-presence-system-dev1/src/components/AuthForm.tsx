import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "admin@presentsir.com";

interface AuthFormProps {
  type: "login" | "register";
  className?: string;
}

const AuthForm: React.FC<AuthFormProps> = ({ type, className }) => {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isAdminRedirect, setIsAdminRedirect] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsAdminRedirect(false);
    setIsLoading(true);

    try {
      if (type === "register") {
        // Validate passwords match
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match");
        }

        if (!image) {
          throw new Error("Profile image is required");
        }

        await register(name, email, password, image);
      } else {
        if (email.trim().toLowerCase() === ADMIN_EMAIL) {
          setIsAdminRedirect(true);
          setError(
            "This is an admin account. Employee sign-in cannot be used for admin users."
          );
          return;
        }

        await login(email, password);
      }

      // Navigate to dashboard on success
      navigate("/dashboard");
    } catch (err) {
      console.error("Authentication error:", err);
      const message =
        err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      setIsAdminRedirect(
        message.toLowerCase().includes("admin") &&
          message.toLowerCase().includes("sign in")
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("w-full max-w-md mx-auto", className)}>
      <div className="flex flex-col items-center justify-center mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Clock4 className="h-8 w-8 text-attendance-primary" />
          <h1 className="text-2xl font-bold">Present Sir</h1>
        </div>
        <p className="text-muted-foreground text-center">
          {type === "login"
            ? "Sign in to mark your attendance"
            : "Create an account to get started"}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md p-3 mb-4 text-sm space-y-2">
          <p>{error}</p>
          {isAdminRedirect && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigate("/admin/login")}
            >
              Go to Admin Sign In
            </Button>
          )}
        </div>
      )}

      {type === "login" && (
        <div className="bg-muted/50 border rounded-md p-3 mb-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Employee demo account</p>
          <p>Email: <span className="font-mono">employee@presentsir.com</span></p>
          <p>Password: <span className="font-mono">Employee@123</span></p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {type === "register" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">Upload Image</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={(e) => setImage(e.target.files?.[0] || null)}
                required
              />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
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
            ? "Sign In"
            : "Create Account"}
        </Button>
      </form>

      <div className="mt-4 text-center text-sm space-y-2">
        {type === "login" ? (
          <>
            <p className="text-muted-foreground">
              Need an account? Ask your administrator to create one.
            </p>
            <p>
              Admin user?{" "}
              <Link
                to="/admin/login"
                className="text-attendance-primary hover:underline"
              >
                Admin Sign In
              </Link>
            </p>
          </>
        ) : (
          <p>
            Already have an account?{" "}
            <a
              href="/login"
              className="text-attendance-primary hover:underline"
            >
              Sign In
            </a>
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthForm;
