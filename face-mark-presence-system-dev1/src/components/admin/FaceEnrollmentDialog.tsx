import React, { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { registerMultipleFaces } from "@/services/faceService";
import { toast } from "sonner";

const ANGLES = [
  "Front face",
  "Turn slightly right",
  "Turn slightly left",
  "Look up slightly",
  "Look down slightly",
  "Front with smile",
];

interface FaceEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  onComplete?: () => void;
}

const FaceEnrollmentDialog: React.FC<FaceEnrollmentDialogProps> = ({
  open,
  onOpenChange,
  userId,
  userName,
  onComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [samples, setSamples] = useState<File[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const reset = () => {
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setIsActive(false);
    setSamples([]);
  };

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open]);

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
    if (samples.length < 3) {
      toast.error("Capture at least 3 face samples");
      return;
    }
    setIsLoading(true);
    try {
      const result = await registerMultipleFaces(userId, samples, "admin");
      toast.success(`${result.message}. Profile photo updated.`);
      stopCamera();
      onOpenChange(false);
      onComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setIsLoading(false);
    }
  };

  const progress = Math.min(100, (samples.length / 3) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Face Enrollment — {userName}</DialogTitle>
          <DialogDescription>
            Capture 3–6 face samples. The first sample will be used as the employee profile photo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
              style={{ height: "260px", objectFit: "cover" }}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={submitEnrollment}
            disabled={isLoading || samples.length < 3}
            className="attendance-gradient"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registering…
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" /> Complete Enrollment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FaceEnrollmentDialog;
