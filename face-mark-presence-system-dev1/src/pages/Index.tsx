import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock4, ShieldCheck, MapPin, Camera, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-attendance-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Clock4 className="h-6 w-6 text-attendance-primary" />
            <span className="font-semibold text-lg">Present Sir</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/quick-attendance")}
              className="hidden sm:inline-flex"
            >
              Quick Attendance
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              className="border-attendance-primary text-attendance-primary hover:bg-attendance-primary/10"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-attendance-light/20 to-white">
        <div className="container px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Seamless Attendance Tracking with Face Recognition
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Mark your presence with a simple selfie. Our advanced system
              combines face recognition and geolocation for secure attendance
              management.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => navigate("/login")}
                className="attendance-gradient w-full sm:w-auto"
              >
                Employee Sign In
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => navigate("/login")}
                className="w-full sm:w-auto"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Advanced Attendance Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="bg-attendance-primary/10 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <Camera className="h-6 w-6 text-attendance-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Face Recognition</h3>
              <p className="text-muted-foreground">
                Simply use your face to verify your identity and mark attendance
                securely.
              </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="bg-attendance-primary/10 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <MapPin className="h-6 w-6 text-attendance-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">
                Geolocation Verification
              </h3>
              <p className="text-muted-foreground">
                Confirm you're at the right location with built-in geolocation
                tracking.
              </p>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg">
              <div className="bg-attendance-primary/10 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-attendance-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">Secure & Reliable</h3>
              <p className="text-muted-foreground">
                Your data is protected with advanced security measures and
                reliable backup options.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-attendance-dark text-white">
        <div className="container px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Modernize Your Attendance System?
          </h2>
          <p className="text-lg opacity-80 mb-8 max-w-2xl mx-auto">
            Join thousands of professionals using FacePresence for seamless
            attendance tracking.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/login")}
            className="attendance-gradient"
          >
            Employee Sign In
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 py-8">
        <div className="container px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Clock4 className="h-5 w-5 text-attendance-primary" />
              <span className="font-semibold">Present Sir</span>
            </div>
            <div className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} UnifiedSaaS. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
