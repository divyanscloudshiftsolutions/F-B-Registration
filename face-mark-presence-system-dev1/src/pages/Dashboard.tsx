import React, { useState, useEffect } from "react";
import { Calendar, CheckCircle, Clock, MapPin, ScanFace } from "lucide-react";
import Header from "@/components/Header";
import FaceDetection from "@/components/FaceDetection";
import GeolocationTracker from "@/components/GeolocationTracker";
import ManualCheckIn from "@/components/ManualCheckIn";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useAttendance } from "@/hooks/useAttendance";
import { faceCheckIn, faceCheckOut, getFaceEnrollmentStatus } from "@/services/faceService";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const Dashboard = () => {
  const { user } = useAuth();
  const { markAttendance, todayRecords, isLoading } = useAttendance();
  const [faceImage, setFaceImage] = useState<File>(null);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [faceEnrolled, setFaceEnrolled] = useState<boolean | null>(null);

  useEffect(() => {
    if (user?.userId) {
      getFaceEnrollmentStatus(user.userId)
        .then((s) => setFaceEnrolled(s.isEnrolled))
        .catch(() => setFaceEnrolled(false));
    }
  }, [user?.userId]);

  const [activeTab, setActiveTab] = useState<"face" | "manual">("face");
  const [checkInType, setCheckInType] = useState<"check-in" | "check-out">(
    "check-in"
  );

  useEffect(() => {
    if (todayRecords.checkIn && !todayRecords.checkOut) {
      setCheckInType("check-out");
    } else if (!todayRecords.checkIn) {
      setCheckInType("check-in");
    }
  }, [todayRecords.checkIn, todayRecords.checkOut]);

  // Handler for face detection capture
  const handleFaceCapture = (imageData: File) => {
    setFaceImage(imageData);
  };

  // Handler for location capture
  const handleLocationCaptured = (locationData: {
    latitude: number;
    longitude: number;
    accuracy: number;
  }) => {
    setLocation(locationData);
  };

  // Handler for manual check-in
  const handleManualSubmit = (note: string, imageData?: File) => {
    markAttendance(
      checkInType,
      "manual",
      location || undefined,
      note,
      imageData as File | undefined
    );
  };

  const handleFaceSubmit = async () => {
    if (!faceImage) {
      toast.error("Capture your face first");
      return;
    }
    if (!faceEnrolled) {
      toast.error("Complete face registration before using face attendance");
      return;
    }
    try {
      if (checkInType === "check-in") {
        await faceCheckIn(faceImage);
      } else {
        await faceCheckOut(faceImage);
      }
      toast.success(`${checkInType === "check-in" ? "Check-in" : "Check-out"} verified`);
      setFaceImage(null);
      setLocation(null);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Face attendance failed");
    }
  };

  // Format timestamp for display
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-md">
          <p>Please log in to access your dashboard.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-md">
          <p>Loading...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-1 container px-4 py-6 md:py-8">
        <div className="max-w-3xl mx-auto">
          {/* Welcome Section */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">
              Welcome back, {user?.userName || user?.email}!
            </h1>
            <p className="text-muted-foreground">
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Face enrollment banner */}
          {faceEnrolled === false && (
            <Card className="mb-6 border-amber-200 bg-amber-50">
              <CardContent className="pt-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-amber-800">
                  <ScanFace className="h-5 w-5" />
                  <span>Register your face (3+ samples) to use face attendance.</span>
                </div>
                <Button asChild variant="outline">
                  <Link to="/face-enrollment">Enroll Now</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Today's Attendance Summary */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-attendance-primary" />
                Today's Attendance
              </CardTitle>
              <CardDescription>
                Your check-in and check-out times for today
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-md p-4">
                  <div className="text-sm text-muted-foreground mb-1">
                    Check In
                  </div>
                  {todayRecords.checkIn ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium">
                        {formatTime(todayRecords.checkIn.timestamp)}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          todayRecords.checkIn.status === "approved"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-yellow-100 text-yellow-800 border-yellow-200"
                        }
                      >
                        {todayRecords.checkIn.status === "approved"
                          ? "Approved"
                          : "Pending"}
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      Not checked in yet
                    </span>
                  )}
                </div>

                <div className="border rounded-md p-4">
                  <div className="text-sm text-muted-foreground mb-1">
                    Check Out
                  </div>
                  {todayRecords.checkOut ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium">
                        {formatTime(todayRecords.checkOut.timestamp)}
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          todayRecords.checkOut.status === "approved"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-yellow-100 text-yellow-800 border-yellow-200"
                        }
                      >
                        {todayRecords.checkOut.status === "approved"
                          ? "Approved"
                          : "Pending"}
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      Not checked out yet
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Marking Section */}
          <Card>
            <CardHeader>
              <CardTitle>
                {!todayRecords.checkIn
                  ? "Mark Your Attendance"
                  : !todayRecords.checkOut
                  ? "Check Out"
                  : "Attendance Complete"}
              </CardTitle>
              <CardDescription>
                {!todayRecords.checkIn || !todayRecords.checkOut
                  ? "Use face recognition or manual check-in"
                  : "You have completed your attendance for today"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!todayRecords.checkIn || !todayRecords.checkOut ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="space-y-1">
                      <div className="font-medium">
                        {checkInType === "check-in" ? "Check In" : "Check Out"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {checkInType === "check-in"
                          ? "Mark your arrival time"
                          : "Mark your departure time"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCheckInType("check-in")}
                        className={checkInType === "check-in" ? "bg-muted" : ""}
                        disabled={!!todayRecords.checkIn}
                      >
                        <Clock className="mr-1 h-4 w-4" />
                        Check In
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCheckInType("check-out")}
                        className={
                          checkInType === "check-out" ? "bg-muted" : ""
                        }
                        disabled={
                          !todayRecords.checkIn || !!todayRecords.checkOut
                        }
                      >
                        <Clock className="mr-1 h-4 w-4" />
                        Check Out
                      </Button>
                    </div>
                  </div>

                  <Tabs
                    defaultValue="face"
                    value={activeTab}
                    onValueChange={(value) =>
                      setActiveTab(value as "face" | "manual")
                    }
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="face">Face Recognition</TabsTrigger>
                      <TabsTrigger value="manual">Manual Check-in</TabsTrigger>
                    </TabsList>

                    <TabsContent value="face" className="space-y-4">
                      <FaceDetection onCapture={handleFaceCapture} />

                      <div className="mt-4">
                        <GeolocationTracker
                          onLocationCaptured={handleLocationCaptured}
                        />
                      </div>

                      <div className="flex justify-end">
                        <Button
                          onClick={handleFaceSubmit}
                          disabled={!faceImage || isLoading || !faceEnrolled}
                          className="attendance-gradient"
                        >
                          {isLoading ? "Processing..." : "Submit Attendance"}
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="manual">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            Manual Check-in
                          </CardTitle>
                          <CardDescription>
                            Please provide reason and verification
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="mb-4">
                            <GeolocationTracker
                              onLocationCaptured={handleLocationCaptured}
                            />
                          </div>

                          <ManualCheckIn onSubmit={handleManualSubmit} />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium mb-1">
                    All Done for Today!
                  </h3>
                  <p className="text-muted-foreground">
                    You've completed your attendance for today
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
