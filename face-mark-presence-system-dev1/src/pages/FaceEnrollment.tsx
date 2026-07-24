import React, { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { registerMultipleFaces } from "@/services/faceService";
import { toast } from "sonner";
import Header from "@/components/Header";

const ANGLES = [
  "Front face",
  "Turn slightly right",
  "Turn slightly left",
  "Look up slightly",
  "Look down slightly",
  "Front with smile",
];

const FaceEnrollment = () => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [samples, setSamples] = useState<File[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

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
    if (!isActive || !stream || !videoRef.current) return;
    const video = videoRef.current;
    video.srcObject = stream;
    const onReady = () => void video.play();
    video.addEventListener("loadedmetadata", onReady);
    return () => video.removeEventListener("loadedmetadata", onReady);
  }, [isActive, stream]);

  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const media = videoRef.current.srcObject as MediaStream;
        media.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  const captureSample = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `face-sample-${samples.length + 1}.jpg`, {
        type: "image/jpeg",
      });
      setSamples((prev) => [...prev, file]);
      toast.success(`Sample ${samples.length + 1} captured`);
    }, "image/jpeg");
  };

  const submitEnrollment = async () => {
    if (!user) return;
    if (samples.length < 3) {
      toast.error("Capture at least 3 face samples");
      return;
    }
    setIsLoading(true);
    try {
      const result = await registerMultipleFaces(user.userId, samples);
      toast.success(result.message);
      stopCamera();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setIsLoading(false);
    }
  };

  const progress = Math.min(100, (samples.length / 3) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container max-w-2xl py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Face Registration</CardTitle>
            <p className="text-sm text-muted-foreground">
              Capture 3–6 face samples from different angles for attendance verification.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{samples.length} / 3 minimum samples</span>
                <span>{ANGLES[samples.length] || "Done"}</span>
              </div>
              <Progress value={progress} />
            </div>

            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full rounded-lg bg-black ${isActive ? "block" : "hidden"}`}
                style={{ height: "300px", objectFit: "cover" }}
              />
              {!isActive ? (
                <Button onClick={startCamera} className="w-full attendance-gradient">
                  <Camera className="mr-2 h-4 w-4" /> Start Camera
                </Button>
              ) : (
                <div className="flex gap-2 mt-3">
                  <Button onClick={captureSample} className="flex-1" disabled={samples.length >= 8}>
                    Capture Sample
                  </Button>
                  <Button variant="outline" onClick={stopCamera}>
                    Stop
                  </Button>
                </div>
              )}
            </div>

            {samples.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {samples.map((s, i) => (
                  <img
                    key={i}
                    src={URL.createObjectURL(s)}
                    alt={`sample-${i}`}
                    className="rounded border h-20 object-cover w-full"
                  />
                ))}
              </div>
            )}

            <Button
              onClick={submitEnrollment}
              disabled={isLoading || samples.length < 3}
              className="w-full attendance-gradient"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" /> Complete Face Registration
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default FaceEnrollment;
