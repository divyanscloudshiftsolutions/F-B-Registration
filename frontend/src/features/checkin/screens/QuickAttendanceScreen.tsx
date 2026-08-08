import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  SafeAreaView,
  TextInput,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useBar } from '../../../context/BarContext';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';

export const QuickAttendanceScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { markQuickAttendance, setScreen, currentScreen, user } = useBar();
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employeeCode, setEmployeeCode] = useState('');
  const [attendanceResult, setAttendanceResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cameraRef = useRef<any>(null);

  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
  const headerTopPadding = Platform.OS === 'android' 
    ? Math.max(statusBarHeight, insets.top) + 8 
    : Math.max(insets.top, 12);
  const bottomControlsPadding = Math.max(insets.bottom + 16, 24);

  const handleCaptureAndSubmit = async () => {
    if (isSubmitting) return;

    if (!permission || !permission.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setErrorMessage('Camera permission is required to verify face attendance.');
        return;
      }
    }

    if (!cameraRef.current) {
      setErrorMessage('Camera view is initializing. Please try again in a moment.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setAttendanceResult(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
        skipProcessing: Platform.OS === 'web',
      });

      if (!photo || !photo.base64) {
        setErrorMessage('Failed to capture photo from camera. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const res = await markQuickAttendance(photo.base64, employeeCode.trim() || undefined);

      if (res.success) {
        setAttendanceResult(res);
      } else {
        setErrorMessage(res.error || 'Attendance verification failed.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred while processing attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setAttendanceResult(null);
    setErrorMessage(null);
  };

  const handleBack = () => {
    if (user) {
      setScreen('app');
    } else {
      setScreen('login');
    }
  };

  if (!permission) {
    return (
      <View className="flex-1 justify-center items-center bg-black p-6">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-white text-xs mt-4">Initializing camera access...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
        <View className="flex-1 justify-center items-center p-6 text-center">
          <Text className="text-4xl mb-4">📷</Text>
          <Text className="text-white text-lg font-bold text-center mb-2">Camera Access Required</Text>
          <Text className="text-white/60 text-xs text-center mb-6 leading-5">
            Quick Face Attendance requires camera permission to capture and verify employee attendance.
          </Text>
          <TouchableOpacity
            onPress={requestPermission}
            style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
          >
            <Text style={{ color: colors.goldButtonText, fontWeight: 'bold', fontSize: 13 }}>Grant Camera Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleBack} className="mt-4">
            <Text className="text-white/50 text-xs font-semibold">Return Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {/* Header Bar */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: headerTopPadding,
        paddingBottom: 12,
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        zIndex: 20
      }}>
        <TouchableOpacity
          onPress={handleBack}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}
        >
          <AppIcon name="arrow-right" color={colors.primary} size={16} />
          <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 13 }}>Back</Text>
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: 'white', fontWeight: 'black', fontSize: 14, letterSpacing: 0.5 }}>Quick Face Attendance</Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>FaceMark Biometric Kiosk</Text>
        </View>

        <TouchableOpacity
          onPress={() => setFacing(prev => (prev === 'front' ? 'back' : 'front'))}
          style={{ padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)' }}
        >
          <AppIcon name="refresh" color="white" size={14} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, position: 'relative' }}>
        {/* Live Camera Preview */}
        <CameraView
          ref={cameraRef}
          facing={facing}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
        />

        {/* Dark Mask with Oval Alignment Overlay */}
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.35)'
        }}>
          <View
            style={{
              width: 250,
              height: 320,
              borderRadius: 160,
              borderWidth: 3,
              borderColor: attendanceResult ? '#22c55e' : errorMessage ? '#ef4444' : colors.primary,
              borderStyle: isSubmitting ? 'solid' : 'dashed',
              backgroundColor: 'transparent',
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 16,
            }}
          />

          {!attendanceResult && !errorMessage && (
            <View className="mt-6 px-4 py-2 rounded-full bg-black/80 border border-white/10 shadow-lg">
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
                Align your face within the frame
              </Text>
            </View>
          )}
        </View>

        {/* Processing Spinner Overlay */}
        {isSubmitting && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 30
          }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: 'white', fontSize: 13, fontWeight: 'bold', marginTop: 16 }}>
              Verifying face with FaceMark...
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4 }}>
              Processing POST /api/attendance/quick
            </Text>
          </View>
        )}

        {/* Result Overlay Card (Success / Error) */}
        {(attendanceResult || errorMessage) && (
          <View style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            zIndex: 40
          }}>
            {attendanceResult ? (
              <View style={{
                width: '100%',
                backgroundColor: '#111827',
                borderRadius: 24,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: '#22c55e',
                shadowColor: '#22c55e',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12
              }}>
                <View style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: 'rgba(34,197,94,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#22c55e'
                }}>
                  <Text style={{ fontSize: 28 }}>✅</Text>
                </View>

                <View style={{
                  backgroundColor: attendanceResult.action === 'check-out' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                  paddingHorizontal: 14,
                  paddingVertical: 4,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: attendanceResult.action === 'check-out' ? '#ef4444' : '#22c55e',
                  marginBottom: 12
                }}>
                  <Text style={{
                    color: attendanceResult.action === 'check-out' ? '#f87171' : '#4ade80',
                    fontSize: 11,
                    fontWeight: 'black',
                    textTransform: 'uppercase',
                    letterSpacing: 1
                  }}>
                    {attendanceResult.action === 'check-out' ? 'OUT — CHECK-OUT RECORDED' : 'IN — CHECK-IN RECORDED'}
                  </Text>
                </View>

                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 }}>
                  {attendanceResult.userName || 'Employee Identified'}
                </Text>

                {attendanceResult.userEmail ? (
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 12 }}>
                    {attendanceResult.userEmail}
                  </Text>
                ) : null}

                <View style={{
                  width: '100%',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: 12,
                  padding: 12,
                  marginVertical: 12,
                  gap: 6
                }}>
                  {attendanceResult.confidence !== undefined && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Match Score:</Text>
                      <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 11 }}>
                        {Math.round(attendanceResult.confidence * 100)}%
                      </Text>
                    </View>
                  )}
                  {attendanceResult.timestamp && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Timestamp:</Text>
                      <Text style={{ color: 'white', fontSize: 11 }}>
                        {new Date(attendanceResult.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
                  {attendanceResult.message}
                </Text>

                <TouchableOpacity
                  onPress={handleReset}
                  style={{
                    width: '100%',
                    backgroundColor: colors.primary,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: colors.goldButtonText, fontWeight: 'black', fontSize: 13, textTransform: 'uppercase' }}>Done / Next Verification</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{
                width: '100%',
                backgroundColor: '#111827',
                borderRadius: 24,
                padding: 24,
                alignItems: 'center',
                borderWidth: 1.5,
                borderColor: '#ef4444',
                shadowColor: '#ef4444',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12
              }}>
                <View style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: 'rgba(239,68,68,0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#ef4444'
                }}>
                  <Text style={{ fontSize: 28 }}>⚠️</Text>
                </View>

                <Text style={{ color: '#ef4444', fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 }}>
                  Attendance Verification Failed
                </Text>

                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', lineHeight: 18, marginBottom: 24 }}>
                  {errorMessage}
                </Text>

                <TouchableOpacity
                  onPress={handleReset}
                  style={{
                    width: '100%',
                    backgroundColor: '#ef4444',
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: 'center'
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: 'black', fontSize: 13, textTransform: 'uppercase' }}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Bottom Controls Bar */}
      {!attendanceResult && !errorMessage && (
        <View style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: bottomControlsPadding,
          backgroundColor: 'black',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.1)',
          alignItems: 'center',
          gap: 14
        }}>
          {/* Optional Employee Code Filter */}
          <View style={{ width: '100%', maxWidth: 320 }}>
            <TextInput
              placeholder="Optional Employee ID (e.g. EMP-99)"
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={employeeCode}
              onChangeText={setEmployeeCode}
              autoCapitalize="characters"
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: 'white',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 12,
                fontSize: 12,
                textAlign: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.15)'
              }}
            />
          </View>

          {/* Shutter Trigger Button */}
          <TouchableOpacity
            disabled={isSubmitting}
            onPress={handleCaptureAndSubmit}
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              borderWidth: 4,
              borderColor: 'white',
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isSubmitting ? 0.5 : 1
            }}
            activeOpacity={0.8}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.4)' }} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default QuickAttendanceScreen;

