import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';
import { api } from '../../../services/api';
import { CustomerPortal } from './CustomerPortal';

interface CustomerAccessScreenProps {
  tokenNumber: string;
  onExitSession: () => void;
}

export const CustomerAccessScreen: React.FC<CustomerAccessScreenProps> = ({
  tokenNumber,
  onExitSession,
}) => {
  const { colors, isDark } = useTheme();

  const [accessState, setAccessState] = useState<'VERIFYING' | 'AUTHORIZED' | 'UNVERIFIED' | 'CLOSED' | 'ERROR'>('VERIFYING');
  const [sessionData, setSessionData] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRechecking, setIsRechecking] = useState<boolean>(false);

  const verifySession = useCallback(async () => {
    if (!tokenNumber) {
      setAccessState('ERROR');
      setErrorMessage('No table token provided.');
      return;
    }

    try {
      const data = await api.getCustomerSession(tokenNumber);
      setSessionData(data);

      if (!data || !data.token) {
        setAccessState('ERROR');
        setErrorMessage('Session not found or expired.');
        return;
      }

      const tokenStatus = data.token.status;
      if (tokenStatus === 'ACTIVE' || tokenStatus === 'OCCUPIED') {
        setAccessState('AUTHORIZED');
      } else if (tokenStatus === 'CLOSED' || tokenStatus === 'RELEASED') {
        setAccessState('CLOSED');
      } else if (tokenStatus === 'PENDING' || tokenStatus === 'UNVERIFIED') {
        setAccessState('UNVERIFIED');
      } else {
        setAccessState('AUTHORIZED');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to connect to session. Please verify your token.');
      setAccessState('ERROR');
    }
  }, [tokenNumber]);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const handleRecheck = async () => {
    setIsRechecking(true);
    await verifySession();
    setIsRechecking(false);
  };

  // 1. Loading / Verifying State
  if (accessState === 'VERIFYING') {
    return (
      <View
        style={{ backgroundColor: colors.background }}
        className="flex-1 items-center justify-center p-6"
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          style={{ color: colors.textPrimary }}
          className="text-base font-extrabold mt-4 text-center"
        >
          Connecting to TableFlow...
        </Text>
        <Text
          style={{ color: colors.textMuted }}
          className="text-xs text-center mt-1 font-mono"
        >
          Verifying Token: {tokenNumber}
        </Text>
      </View>
    );
  }

  // 2. Authorized State: render CustomerPortal
  if (accessState === 'AUTHORIZED') {
    return (
      <CustomerPortal
        tokenNumber={tokenNumber}
        onExit={onExitSession}
      />
    );
  }

  // 3. Unverified / Pending Check-In Payment
  if (accessState === 'UNVERIFIED') {
    return (
      <View
        style={{ backgroundColor: colors.background }}
        className="flex-1 items-center justify-center p-6"
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="w-full max-w-sm rounded-3xl p-6 items-center shadow-lg space-y-4"
        >
          <View className="w-14 h-14 rounded-2xl bg-amber-500/10 items-center justify-center">
            <AppIcon name="credit-card" size={28} color="#D97706" />
          </View>

          <Text style={{ color: colors.textPrimary }} className="text-lg font-black text-center">
            Payment Verification Pending
          </Text>

          <Text style={{ color: colors.textMuted }} className="text-xs text-center leading-relaxed">
            Your table check-in has been registered, but entry payment verification is still in progress.
          </Text>

          <TouchableOpacity
            onPress={handleRecheck}
            disabled={isRechecking}
            style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
            className="w-full py-3 rounded-xl items-center justify-center flex-row gap-2 shadow-md mt-2"
          >
            {isRechecking ? (
              <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
            ) : (
              <>
                <AppIcon name="refresh-cw" size={16} color={isDark ? '#000000' : '#FFFFFF'} />
                <Text
                  style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                  className="text-xs font-black"
                >
                  Re-check Verification
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onExitSession}
            className="py-2"
          >
            <Text style={{ color: colors.textMuted }} className="text-xs font-bold">
              Back to Home
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 4. Closed Session State
  if (accessState === 'CLOSED') {
    return (
      <View
        style={{ backgroundColor: colors.background }}
        className="flex-1 items-center justify-center p-6"
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="w-full max-w-sm rounded-3xl p-6 items-center shadow-lg space-y-4"
        >
          <View className="w-14 h-14 rounded-2xl bg-emerald-500/10 items-center justify-center">
            <AppIcon name="check-circle-2" size={28} color="#10B981" />
          </View>

          <Text style={{ color: colors.textPrimary }} className="text-lg font-black text-center">
            Dining Session Concluded
          </Text>

          <Text style={{ color: colors.textMuted }} className="text-xs text-center leading-relaxed">
            This table session has already been settled and closed. Thank you for dining with Pegs N Bottles!
          </Text>

          <TouchableOpacity
            onPress={onExitSession}
            style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
            className="w-full py-3 rounded-xl items-center justify-center shadow-md mt-2"
          >
            <Text
              style={{ color: isDark ? '#000000' : '#FFFFFF' }}
              className="text-xs font-black"
            >
              Start New Experience
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 5. Error State
  return (
    <View
      style={{ backgroundColor: colors.background }}
      className="flex-1 items-center justify-center p-6"
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
        }}
        className="w-full max-w-sm rounded-3xl p-6 items-center shadow-lg space-y-4"
      >
        <View className="w-14 h-14 rounded-2xl bg-rose-500/10 items-center justify-center">
          <AppIcon name="alert-triangle" size={28} color="#E11D48" />
        </View>

        <Text style={{ color: colors.textPrimary }} className="text-lg font-black text-center">
          Unable to Access Session
        </Text>

        <Text style={{ color: colors.textMuted }} className="text-xs text-center leading-relaxed">
          {errorMessage || 'Something went wrong while verifying this session.'}
        </Text>

        <TouchableOpacity
          onPress={handleRecheck}
          disabled={isRechecking}
          style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
          className="w-full py-3 rounded-xl items-center justify-center flex-row gap-2 shadow-md mt-2"
        >
          {isRechecking ? (
            <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
          ) : (
            <>
              <AppIcon name="refresh-cw" size={16} color={isDark ? '#000000' : '#FFFFFF'} />
              <Text
                style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                className="text-xs font-black"
              >
                Try Again
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onExitSession}
          className="py-2"
        >
          <Text style={{ color: colors.textMuted }} className="text-xs font-bold">
            Back to Home
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
