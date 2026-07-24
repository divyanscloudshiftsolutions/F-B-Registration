import React, { useRef, useState, useEffect } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FaceDetectionProps {
  onCapture: (imageFile: File | Blob) => void;
  className?: string;
}

const FaceDetection: React.FC<FaceDetectionProps> = ({
  onCapture,
  className,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [hasFace, setHasFace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImageData, SetImageData] = useState<Blob | File>(null);

  // Start the webcam
  const startCamera = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      console.log("Webcam stream:", stream);
      // Even if the video is hidden, its ref exists in the DOM.
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Use onloadedmetadata to ensure the video is ready to play.
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsActive(true);
          console.log("Camera started successfully");
        };
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      setError(
        "Could not access camera. Please check permissions and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Stop the webcam
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setIsActive(false);
      setHasFace(false);
    }
  };

  // Capture image from the webcam
  const captureImage = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], "captured-image.jpg", {
            type: "image/jpeg",
          });
          SetImageData(file);
          onCapture(file);
        }
      }, "image/jpeg");
    }

    // Stop camera after capture
    stopCamera();
  };

  // Enable capture once camera is active (server verifies face on submit)
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => setHasFace(true), 800);
      return () => clearTimeout(timer);
    }
    setHasFace(false);
  }, [isActive]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div
      className={cn(
        "face-detection-container w-full max-w-md mx-auto",
        className
      )}
    >
      {/* Control panel when camera not active */}
      {!isActive && (
        <div className="flex flex-col items-center justify-center p-8 bg-muted h-64 rounded-lg">
          {error && <p className="text-destructive mb-4">{error}</p>}
          <Button
            onClick={startCamera}
            disabled={isLoading}
            className="attendance-gradient"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Accessing Camera...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Start Camera
              </>
            )}
          </Button>
        </div>
      )}

      {/* Always render the video element; conditionally show overlay */}
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn("w-full rounded-lg", { hidden: !isActive })}
          style={{ height: "300px", objectFit: "cover" }}
        />
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            {hasFace ? (
              <div className="detection-box w-32 h-40 opacity-70 animate-pulse"></div>
            ) : (
              <div className="text-white bg-black/50 px-3 py-1 rounded-full text-sm">
                Looking for face...
              </div>
            )}
          </div>
        )}
        {isActive && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <Button
              onClick={captureImage}
              disabled={!hasFace}
              variant="default"
              className="attendance-gradient"
            >
              {hasFace ? "Capture & Verify" : "Waiting for face..."}
            </Button>
          </div>
        )}
        {isImageData && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center">
            <img
              src={URL.createObjectURL(isImageData)}
              alt="Captured"
              className="w-full border-2 border-white"
            />
            <p className="text-white text-sm mt-2">Face captured!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceDetection;
