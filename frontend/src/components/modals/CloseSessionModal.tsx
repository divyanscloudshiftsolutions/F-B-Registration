import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, ScrollView, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBar, getBackendUrl } from '../../context/BarContext';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionToken, TokenStatus } from '../../types/bar_types';
import { useResponsive } from '../../utils/responsive';
import { useActionProgress } from '../../utils/actionProgress';
import { AlertModal } from '../common/AlertModal';

const formatRedemptionTime = (timestampStr: string) => {
  const date = new Date(timestampStr);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');
  const strMinutes = String(minutes).padStart(2, '0');
  const strSeconds = String(seconds).padStart(2, '0');
  return `${strHours}:${strMinutes}:${strSeconds} ${ampm}`;
};

interface CloseSessionModalProps {
  onClose: () => void;
}

export const CloseSessionModal: React.FC<CloseSessionModalProps> = ({ onClose }) => {
  const { sessions, closeGuestSession, showToast } = useBar();
  const { loadingAction, secondsLeft, startAction, stopAction, isProcessing } = useActionProgress();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTablet, isLargeScreen } = useResponsive();
  const isCentered = isTablet || isLargeScreen;
  const [returnStep, setReturnStep] = useState<number>(1);
  
  // Scanned Session details
  const [sessionDetails, setSessionDetails] = useState<SessionToken | null>(null);
  const [redemptionsHistory, setRedemptionsHistory] = useState<any[]>([]);

  useEffect(() => {
    const handleReturnBack = () => {
      // Go back one step in ReturnCardModal
      if (returnStep > 1) {
        setReturnStep(returnStep - 1);
        return true;
      }

      // Otherwise close the checkout flow modal
      onClose();
      return true;
    };

    let subscription: any;
    if (Platform.OS === 'android') {
      subscription = BackHandler.addEventListener('hardwareBackPress', handleReturnBack);
    }
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [returnStep, onClose]);

  const BACKEND_URL = getBackendUrl();

  const fetchRedemptionsHistory = async (tokenNum: string) => {
    try {
      const token = await AsyncStorage.getItem('bar_user_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/tokens/${tokenNum}/redemptions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRedemptionsHistory(data);
      }
    } catch (err) {
      console.warn('Failed to fetch redemption history:', err);
    }
  };

  React.useEffect(() => {
    if (sessionDetails) {
      fetchRedemptionsHistory(sessionDetails.tokenNumber);
    } else {
      setRedemptionsHistory([]);
    }
  }, [sessionDetails]);

  const handleConfirmClosure = async () => {
    if (!sessionDetails) return;
    if (!startAction('close_session')) return;
    
    try {
      const success = await closeGuestSession(sessionDetails.tokenNumber);
      stopAction();
      if (success) {
        setReturnStep(3);
      }
    } catch (e) {
      stopAction();
      showToast('Unable to complete the check-out. Please try again.', 'danger');
    }
  };

  const formatMinutesUsed = (startTimeStr: string) => {
    const diff = new Date().getTime() - new Date(startTimeStr).getTime();
    return Math.max(0, Math.floor(diff / (60 * 1000)));
  };

  return (
    <>
      <AlertModal
        visible={true}
        onClose={onClose}
        title="Guest Checkout / Close Session"
      >
        <View>
          {/* STEP 1: SELECT SESSION */}
          {returnStep === 1 && (
            <View className="py-2">
              <View className="flex-col justify-start">
                <Text className="text-[10px] font-bold uppercase tracking-wider mb-2 px-1" style={{ color: colors.muted }}>Select Guest to Check Out:</Text>
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                  {sessions.filter(s => s.status === TokenStatus.ACTIVE).length === 0 ? (
                    <View className="py-8 items-center">
                      <Text style={{ color: colors.muted, fontSize: 12 }}>No active guest sessions found.</Text>
                    </View>
                  ) : (
                    sessions.filter(s => s.status === TokenStatus.ACTIVE).map(s => (
                      <TouchableOpacity
                        key={s.id}
                        className="rounded-xl p-4 mb-2 flex-row justify-between items-center border"
                        style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1.5 }}
                        onPress={() => {
                          setSessionDetails(s);
                          setReturnStep(2);
                        }}
                      >
                        <View>
                          <Text className="text-xs font-bold" style={{ color: colors.text }}>{s.customerName}</Text>
                          <Text className="text-[9px] font-mono mt-0.5" style={{ color: colors.muted }}>{s.tokenNumber}</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-[10px] font-extrabold uppercase" style={{ color: colors.gold }}>Table {s.tableNumber}</Text>
                          <Text className="text-[9px] mt-0.5" style={{ color: colors.muted }}>Drinks: {s.redemptionCount}/{s.redemptionLimit}</Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          )}

          {/* STEP 2: SUMMARY CONFIRM */}
          {returnStep === 2 && sessionDetails && (
            <View className="py-2">
              <Text className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: colors.gold }}>Session Summary Log</Text>
              
              {/* Itemized Invoice Grid */}
              <View 
                className="rounded-xl p-4 border mb-4"
                style={{ backgroundColor: colors.secondarySurface, borderColor: colors.border, borderWidth: 1.5 }}
              >
                <View className="flex-row justify-between py-2 border-b" style={{ borderBottomColor: colors.divider }}>
                  <Text className="text-[11px]" style={{ color: colors.muted }}>Customer Name</Text>
                  <Text className="text-[11px] font-bold" style={{ color: colors.text }}>{sessionDetails.customerName}</Text>
                </View>
                <View className="flex-row justify-between py-2 border-b" style={{ borderBottomColor: colors.divider }}>
                  <Text className="text-[11px]" style={{ color: colors.muted }}>Table Occupied</Text>
                  <Text className="text-[11px] font-bold" style={{ color: colors.text }}>{sessionDetails.tableNumber} ({sessionDetails.placeType.replace('_', ' ')})</Text>
                </View>
                <View className="flex-row justify-between py-2 border-b" style={{ borderBottomColor: colors.divider }}>
                  <Text className="text-[11px]" style={{ color: colors.muted }}>Time Duration</Text>
                  <Text className="text-[11px] font-bold" style={{ color: colors.text }}>{formatMinutesUsed(sessionDetails.startTime)} Min</Text>
                </View>
                <View className="flex-row justify-between py-2">
                  <Text className="text-[11px]" style={{ color: colors.muted }}>Drinks Allotted / Used</Text>
                  <Text className="text-[11px] font-bold" style={{ color: colors.text }}>{sessionDetails.redemptionCount} / {sessionDetails.redemptionLimit} served</Text>
                </View>
              </View>

              {redemptionsHistory && redemptionsHistory.length > 0 && (
                <View className="mb-4" style={{ maxHeight: 120 }}>
                  <Text className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>Drinks Redemption Timeline</Text>
                  <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
                    <View className="rounded-xl p-3 border" style={{ backgroundColor: colors.secondarySurface, borderColor: colors.border, borderWidth: 1.5 }}>
                      {redemptionsHistory.map((item, index) => (
                        <View key={item.id || index} className="flex-row justify-between py-1.5 border-b" style={{ borderBottomColor: colors.divider }}>
                          <Text className="text-[10px]" style={{ color: colors.text }}>Drink #{index + 1}</Text>
                          <Text className="text-[10px] font-mono font-bold" style={{ color: colors.gold }}>
                            {formatRedemptionTime(item.timestamp)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}

              <Text className="text-red text-center text-[10px] leading-4 mb-4 font-semibold" style={{ color: colors.red }}>
                Confirm closure: This will mark table {sessionDetails.tableNumber} as available and close the check-in session.
              </Text>

              <View className="flex-row gap-3">
                <TouchableOpacity 
                  className="flex-1 py-3 rounded-xl border items-center justify-center min-h-[44px]" 
                  style={{ backgroundColor: colors.secondaryButtonBg, borderColor: colors.border, borderWidth: 1.5, opacity: isProcessing ? 0.5 : 1 }}
                  onPress={() => setReturnStep(1)}
                  disabled={isProcessing}
                >
                  <Text className="font-bold text-xs" style={{ color: colors.secondaryButtonText }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  className="flex-1 py-3 rounded-xl items-center justify-center min-h-[44px] border" 
                  style={{ 
                    backgroundColor: isProcessing ? (isDark ? '#27272A' : '#E4E4E7') : (isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2'),
                    borderColor: isProcessing ? (isDark ? '#3F3F46' : '#D4D4D8') : (isDark ? 'rgba(239, 68, 68, 0.35)' : '#FCA5A5'),
                    borderWidth: 1.5,
                    opacity: isProcessing ? 0.5 : 1 
                  }} 
                  onPress={handleConfirmClosure}
                  disabled={isProcessing}
                >
                  <Text className="font-bold text-xs" style={{ color: isProcessing ? colors.muted : colors.red }}>
                    {loadingAction === 'close_session' ? `Closing... (${secondsLeft}s)` : 'Close Session'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3: SUCCESS WRAP */}
          {returnStep === 3 && (
            <View className="items-center justify-center py-4">
              <View 
                className="w-16 h-16 rounded-full border justify-center items-center mb-4" 
                style={{ 
                  backgroundColor: isDark ? 'rgba(34, 197, 94, 0.12)' : '#F0FDF4', 
                  borderColor: isDark ? 'rgba(34, 197, 94, 0.4)' : '#BBF7D0', 
                  borderWidth: 1.5 
                }}
              >
                <Text className="text-3xl font-extrabold" style={{ color: colors.teal }}>✓</Text>
              </View>
              <Text className="text-base font-bold mb-2 text-center" style={{ color: colors.text }}>Session Closed Successfully</Text>
              <Text className="text-[11px] text-center leading-4 max-w-[85%] mb-6" style={{ color: colors.muted }}>
                Table seating freed and check-in session marked as closed.
              </Text>
              <TouchableOpacity 
                className="py-3.5 rounded-xl w-full items-center justify-center min-h-[48px] border" 
                style={{ backgroundColor: colors.gold, borderColor: colors.gold, borderWidth: 1.5 }} 
                onPress={onClose}
              >
                <Text className="font-extrabold text-sm" style={{ color: colors.goldButtonText }}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </AlertModal>
    </>
  );
};

export default CloseSessionModal;

