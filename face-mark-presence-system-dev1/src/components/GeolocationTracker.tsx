
import React, { useState, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface GeolocationTrackerProps {
  onLocationCaptured: (location: { latitude: number; longitude: number; accuracy: number }) => void;
  className?: string;
}

const GeolocationTracker: React.FC<GeolocationTrackerProps> = ({ 
  onLocationCaptured, 
  className 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ 
    latitude: number; 
    longitude: number; 
    accuracy: number;
  } | null>(null);

  // Start tracking location
  const startTracking = () => {
    setIsLoading(true);
    setError(null);
    setProgress(0);
    setIsTracking(true);
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsLoading(false);
      setIsTracking(false);
      return;
    }
    
    // Request location with high accuracy
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({ latitude, longitude, accuracy });
        onLocationCaptured({ latitude, longitude, accuracy });
        setIsLoading(false);
      },
      (err) => {
        console.error('Error getting location:', err);
        setError(`Location error: ${err.message}`);
        setIsLoading(false);
        setIsTracking(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );
  };

  // Simulate progress for UX feedback
  useEffect(() => {
    if (isTracking && !location) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + 5;
          if (newProgress >= 100) {
            clearInterval(interval);
          }
          return newProgress > 100 ? 100 : newProgress;
        });
      }, 200);
      
      return () => clearInterval(interval);
    }
  }, [isTracking, location]);

  return (
    <div className={cn('p-4 bg-white rounded-lg shadow-sm', className)}>
      {error && (
        <div className="mb-4 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-sm">
          {error}
        </div>
      )}
      
      {!isTracking ? (
        <Button
          onClick={startTracking}
          disabled={isLoading}
          className="w-full attendance-gradient"
        >
          <MapPin className="mr-2 h-4 w-4" />
          Verify Location
        </Button>
      ) : location ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Location verified</span>
            <span className="text-xs text-muted-foreground">
              Accuracy: {location.accuracy.toFixed(1)}m
            </span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="mr-2 h-4 w-4 text-attendance-primary" />
            <span className="truncate">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-attendance-primary" />
            <span className="text-sm">Getting your location...</span>
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      )}
    </div>
  );
};

export default GeolocationTracker;
