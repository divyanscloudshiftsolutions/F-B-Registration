import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';
import { useCustomer } from '../../../context/CustomerContext';
import { CustomerSessionTimer } from '../../../components/customer/CustomerSessionTimer';

interface CustomerAccountScreenProps {
  onCallWaiterPress: () => void;
  onExitSession: () => void;
}

export const CustomerAccountScreen: React.FC<CustomerAccountScreenProps> = ({
  onCallWaiterPress,
  onExitSession,
}) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const {
    tokenNumber,
    tableNumber,
    sessionData,
    logout,
  } = useCustomer();

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const guestName = sessionData?.customerName || sessionData?.guestName || 'Guest Customer';
  const guestPhone = sessionData?.customerPhone || sessionData?.phoneNumber || sessionData?.phone || 'Not provided';
  const startTime = sessionData?.token?.startTime || sessionData?.startTime;
  const endTime = sessionData?.token?.endTime || sessionData?.endTime;

  const handleCopyToken = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirmLogout = () => {
    setIsLogoutModalOpen(false);
    logout();
    onExitSession();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-4 pt-3 pb-2">
        <Text style={{ color: colors.textPrimary }} className="text-base font-black">
          Table & Session Info
        </Text>
        <Text style={{ color: colors.textMuted }} className="text-xs font-medium mt-0.5">
          Dining session details and settings
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 }}
        className="flex-1 space-y-4"
      >
        {/* 1. Active Dining Card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="p-4 rounded-2xl shadow-xs space-y-3"
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
                Table {tableNumber || '--'}
              </Text>
              <Text style={{ color: colors.textMuted }} className="text-[11px] font-medium mt-0.5">
                Pegs N Bottles Floor
              </Text>
            </View>

            {/* Session Timer */}
            <View
              style={{
                backgroundColor: isDark ? 'rgba(212,175,55,0.12)' : 'rgba(124,58,237,0.08)',
              }}
              className="px-3 py-1.5 rounded-xl flex-row items-center gap-1.5"
            >
              <CustomerSessionTimer endTime={endTime} startTime={startTime} />
            </View>
          </View>

          {/* Token Copy Chip */}
          <TouchableOpacity
            onPress={handleCopyToken}
            activeOpacity={0.7}
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="p-2.5 rounded-xl flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-2">
              <AppIcon name="ticket" size={16} color={colors.primary} />
              <Text style={{ color: colors.textMuted }} className="text-[11px] font-mono">
                Token: <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{tokenNumber}</Text>
              </Text>
            </View>
            <Text style={{ color: colors.primary }} className="text-[10px] font-black">
              {copied ? 'Copied!' : 'Tap to Copy'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Customer Profile Details */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="p-4 rounded-2xl shadow-xs space-y-3"
        >
          <Text style={{ color: colors.textPrimary }} className="text-xs font-black uppercase tracking-wider">
            Guest Details
          </Text>

          <View className="flex-row items-center justify-between py-1 border-b border-border/50">
            <Text style={{ color: colors.textMuted }} className="text-xs">
              Guest Name
            </Text>
            <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
              {guestName}
            </Text>
          </View>

          <View className="flex-row items-center justify-between py-1">
            <Text style={{ color: colors.textMuted }} className="text-xs">
              Phone Number
            </Text>
            <Text style={{ color: colors.textPrimary }} className="text-xs font-mono font-bold">
              {guestPhone}
            </Text>
          </View>
        </View>

        {/* 3. Appearance & Theme */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="p-4 rounded-2xl shadow-xs space-y-3"
        >
          <Text style={{ color: colors.textPrimary }} className="text-xs font-black uppercase tracking-wider">
            Preferences
          </Text>

          <TouchableOpacity
            onPress={toggleTheme}
            activeOpacity={0.7}
            className="flex-row items-center justify-between py-1"
          >
            <View className="flex-row items-center gap-2.5">
              <AppIcon
                name={isDark ? 'moon' : 'sun'}
                size={18}
                color={colors.primary}
              />
              <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                Theme Appearance
              </Text>
            </View>
            <View
              style={{
                backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(124,58,237,0.1)',
              }}
              className="px-2.5 py-1 rounded-full"
            >
              <Text
                style={{ color: colors.primary }}
                className="text-[11px] font-black uppercase"
              >
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 4. Floor Support & Call Waiter */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="p-4 rounded-2xl shadow-xs space-y-3"
        >
          <Text style={{ color: colors.textPrimary }} className="text-xs font-black uppercase tracking-wider">
            Table Assistance
          </Text>

          <TouchableOpacity
            onPress={onCallWaiterPress}
            activeOpacity={0.7}
            className="flex-row items-center justify-between py-1"
          >
            <View className="flex-row items-center gap-2.5">
              <AppIcon name="phone-call" size={18} color={colors.primary} />
              <View>
                <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                  Call Waiter
                </Text>
                <Text style={{ color: colors.textMuted }} className="text-[10px]">
                  Request water, cutlery, or order assistance
                </Text>
              </View>
            </View>
            <AppIcon name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* 5. Leave Session Action */}
        <TouchableOpacity
          onPress={() => setIsLogoutModalOpen(true)}
          activeOpacity={0.7}
          className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex-row items-center justify-center gap-2 mt-2"
        >
          <AppIcon name="log-out" size={16} color="#E11D48" />
          <Text className="text-xs font-black text-rose-600 dark:text-rose-400">
            Leave Session / Exit Table
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={isLogoutModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLogoutModalOpen(false)}
      >
        <View className="flex-1 bg-black/70 items-center justify-center p-4">
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="w-full max-w-sm rounded-3xl p-6 items-center shadow-2xl space-y-4"
          >
            <View className="w-14 h-14 rounded-2xl bg-rose-500/10 items-center justify-center">
              <AppIcon name="log-out" size={26} color="#E11D48" />
            </View>

            <Text style={{ color: colors.textPrimary }} className="text-base font-black text-center">
              Leave Dining Session?
            </Text>

            <Text style={{ color: colors.textMuted }} className="text-xs text-center leading-relaxed">
              Are you sure you want to disconnect from Table {tableNumber}? You will need your access code or phone number to return.
            </Text>

            <View className="flex-row gap-3 w-full pt-2">
              <TouchableOpacity
                onPress={() => setIsLogoutModalOpen(false)}
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                className="flex-1 py-3 rounded-xl items-center justify-center"
              >
                <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                  Stay Here
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmLogout}
                className="flex-1 py-3 rounded-xl bg-rose-600 items-center justify-center shadow-md"
              >
                <Text className="text-xs font-black text-white">
                  Leave Table
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
