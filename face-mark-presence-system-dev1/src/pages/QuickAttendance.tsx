import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, CheckCircle, Clock4, Loader2, LogIn, LogOut, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { quickMarkAttendance, QuickAttendanceResult } from "@/services/quickAttendanceService";
import { toast } from "sonner";

const formatConfidence = (value: number) => `${(value * 100).toFixed(1)}%`;

const QuickAttendance = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<QuickAttendanceResult | null>(null);
  const [employeeCode, setEmployeeCode] = useState("");

  const startCamera = async () => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(media);
      setIsActive(true);
    } catch {
      toast.error("Could not access camera. Check permissions and try again.");
    }
  };

  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (!isActive || !stream || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = stream;
    const onReady = () => void video.play();
    video.addEventListener("loadedmetadata", onReady);
    return () => video.removeEventListener("loadedmetadata", onReady);
  }, [isActive, stream]);

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => {
      setResult(null);
      if (!isActive) startCamera();
    }, 5000);
    return () => clearTimeout(timer);
  }, [result]);

  const captureFrame = (): Promise<File | null> =>
    new Promise((resolve) => {
      if (!videoRef.current) {
        resolve(null);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(null);
          return;
        }
        resolve(new File([blob], "quick-attendance.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.92);
    });

  const handleMarkAttendance = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const file = await captureFrame();
      if (!file) {
        toast.error("Could not capture image. Try again.");
        return;
      }
      const response = await quickMarkAttendance(file, employeeCode || undefined);
      setResult(response);
      stopCamera();
      toast.success(response.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Attendance failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCheckIn = result?.action === "check-in";

  return (
    <div className="min-h-screen bg-gradient-to-b from-attendance-light/30 to-gray-50 flex flex-col">
      <header className="border-b bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Clock4 className="h-6 w-6 text-attendance-primary" />
            <span className="font-semibold text-lg">Present Sir</span>
            <Badge variant="outline" className="ml-2">Quick Attendance</Badge>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Employee Login</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container max-w-lg mx-auto py-8 px-4 flex flex-col justify-center">
        {result ? (
          <Card className="border-2 border-green-200 shadow-lg">
            <CardContent className="pt-10 pb-10 text-center space-y-4">
              <div className="mx-auto h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-12 w-12 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground uppercase tracking-wide">Success</p>
                <h2 className="text-2xl font-bold mt-1">{result.userName}</h2>
              </div>
              <div className="flex items-center justify-center gap-2">
                {isCheckIn ? (
                  <Badge className="bg-green-600 text-white px-4 py-1 text-sm">
                    <LogIn className="h-4 w-4 mr-1" /> Check In
                  </Badge>
                ) : (
                  <Badge className="bg-indigo-600 text-white px-4 py-1 text-sm">
                    <LogOut className="h-4 w-4 mr-1" /> Check Out
                  </Badge>
                )}
                <Badge variant="outline">
                  {formatConfidence(result.confidence)} match
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {new Date(result.timestamp).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">Next employee in a few seconds…</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-2">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <ScanFace className="h-7 w-7 text-attendance-primary" />
                Quick Attendance
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Look at the camera — we&apos;ll find you and mark check-in or check-out automatically.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="employeeCode">Employee ID (optional)</Label>
                <Input
                  id="employeeCode"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="Confirm identity with employee code"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  When provided, the face must match that employee.
                </p>
              </div>

              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isActive ? "block" : "hidden"}`}
                />
                {!isActive && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                )}
              </div>

              <Button
                onClick={handleMarkAttendance}
                disabled={!isActive || isSubmitting}
                className="w-full h-14 text-lg attendance-gradient"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Recognizing…
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-5 w-5" />
                    Mark Attendance
                  </>
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                No login required. Face must be registered first.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default QuickAttendance;
