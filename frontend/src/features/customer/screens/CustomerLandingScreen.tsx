import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';
import { api } from '../../../services/api';

interface CustomerLandingScreenProps {
  onSessionFound: (tokenNumber: string) => void;
  onStaffLoginPress?: () => void;
}

export const CustomerLandingScreen: React.FC<CustomerLandingScreenProps> = ({
  onSessionFound,
  onStaffLoginPress,
}) => {
  const { colors, isDark, toggleTheme } = useTheme();

  const [activeModal, setActiveModal] = useState<'NONE' | 'CODE' | 'PHONE' | 'TOKEN'>('NONE');
  const [codeInput, setCodeInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Submit 6-digit access code
  const handleCodeSubmit = async () => {
    const cleaned = codeInput.trim();
    if (!cleaned) {
      setErrorMessage('Please enter your 6-digit access code.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.recoverCustomerSession({ accessCode: cleaned });
      if (res.tokenNumber) {
        setActiveModal('NONE');
        onSessionFound(res.tokenNumber);
      } else {
        setActiveModal('NONE');
        onSessionFound(cleaned);
      }
    } catch (err: any) {
      // Fallback: pass the code directly
      setActiveModal('NONE');
      onSessionFound(cleaned);
    } finally {
      setIsLoading(false);
    }
  };

  // Submit phone number
  const handlePhoneSubmit = async () => {
    const cleaned = phoneInput.trim().replace(/[^\d]/g, '');
    if (cleaned.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.recoverCustomerSession({ phoneNumber: cleaned });
      if (res.tokenNumber) {
        setActiveModal('NONE');
        onSessionFound(res.tokenNumber);
      } else {
        setErrorMessage(res.error || 'No active dining session found with this phone number.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to find session. Please contact reception.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit token code directly
  const handleTokenSubmit = () => {
    let cleaned = tokenInput.trim();
    if (!cleaned) {
      setErrorMessage('Please enter your table pass code or token.');
      return;
    }
    if (/^\d{6}$/.test(cleaned)) {
      cleaned = `#${cleaned}`;
    }
    setActiveModal('NONE');
    onSessionFound(cleaned);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Bar with Theme Toggle and optional Staff Login */}
        <View className="flex-row items-center justify-between mb-8">
          <TouchableOpacity
            onPress={toggleTheme}
            activeOpacity={0.7}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="p-2.5 rounded-2xl shadow-xs"
          >
            <AppIcon
              name={isDark ? 'sun' : 'moon'}
              size={20}
              color={isDark ? '#D4AF37' : '#7C3AED'}
            />
          </TouchableOpacity>

          {onStaffLoginPress && (
            <TouchableOpacity
              onPress={onStaffLoginPress}
              activeOpacity={0.7}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
              }}
              className="px-3 py-1.5 rounded-2xl shadow-xs flex-row items-center gap-1.5"
            >
              <AppIcon name="user" size={14} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted }} className="text-xs font-bold">
                Staff Portal
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Brand / Hero Header */}
        <View className="items-center mb-8">
          <View
            style={{
              backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(124,58,237,0.1)',
              borderColor: isDark ? 'rgba(212,175,55,0.3)' : 'rgba(124,58,237,0.2)',
              borderWidth: 1,
            }}
            className="w-16 h-16 rounded-3xl items-center justify-center mb-4 shadow-sm"
          >
            <AppIcon
              name="sparkles"
              size={32}
              color={isDark ? '#D4AF37' : '#7C3AED'}
            />
          </View>
          <Text
            style={{ color: colors.textPrimary }}
            className="text-2xl sm:text-3xl font-black text-center tracking-tight"
          >
            Pegs N Bottles
          </Text>
          <Text
            style={{ color: colors.textMuted }}
            className="text-xs sm:text-sm font-medium text-center mt-1 max-w-xs"
          >
            Digital Dining & TableFlow Ordering Experience
          </Text>
        </View>

        {/* Access Method Cards */}
        <View className="space-y-3.5 max-w-sm w-full mx-auto">
          {/* 1. Enter 6-Digit Access Code */}
          <TouchableOpacity
            onPress={() => {
              setErrorMessage(null);
              setCodeInput('');
              setActiveModal('CODE');
            }}
            activeOpacity={0.85}
            style={{
              backgroundColor: isDark ? '#D4AF37' : '#7C3AED',
              shadowColor: isDark ? '#D4AF37' : '#7C3AED',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
            className="w-full p-4 rounded-2xl flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3 flex-1 min-w-0">
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)',
                }}
                className="w-10 h-10 rounded-xl items-center justify-center"
              >
                <AppIcon
                  name="key-round"
                  size={20}
                  color={isDark ? '#000000' : '#FFFFFF'}
                />
              </View>
              <View className="flex-1 min-w-0">
                <Text
                  style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                  className="text-sm font-black truncate"
                >
                  Enter 6-Digit Access Code
                </Text>
                <Text
                  style={{
                    color: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)',
                  }}
                  className="text-[11px] font-medium truncate mt-0.5"
                >
                  Found on your check-in SMS or receipt
                </Text>
              </View>
            </View>
            <AppIcon
              name="arrow-right"
              size={18}
              color={isDark ? '#000000' : '#FFFFFF'}
            />
          </TouchableOpacity>

          {/* 2. Find Session with Phone Number */}
          <TouchableOpacity
            onPress={() => {
              setErrorMessage(null);
              setPhoneInput('');
              setActiveModal('PHONE');
            }}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="w-full p-4 rounded-2xl flex-row items-center justify-between shadow-xs"
          >
            <View className="flex-row items-center gap-3 flex-1 min-w-0">
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                }}
                className="w-10 h-10 rounded-xl items-center justify-center"
              >
                <AppIcon name="phone" size={20} color={colors.primary} />
              </View>
              <View className="flex-1 min-w-0">
                <Text
                  style={{ color: colors.textPrimary }}
                  className="text-sm font-bold truncate"
                >
                  Find by Mobile Number
                </Text>
                <Text
                  style={{ color: colors.textMuted }}
                  className="text-[11px] font-medium truncate mt-0.5"
                >
                  Lookup via registered 10-digit number
                </Text>
              </View>
            </View>
            <AppIcon name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {/* 3. Enter Token / Pass Code */}
          <TouchableOpacity
            onPress={() => {
              setErrorMessage(null);
              setTokenInput('');
              setActiveModal('TOKEN');
            }}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="w-full p-4 rounded-2xl flex-row items-center justify-between shadow-xs"
          >
            <View className="flex-row items-center gap-3 flex-1 min-w-0">
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                }}
                className="w-10 h-10 rounded-xl items-center justify-center"
              >
                <AppIcon name="ticket" size={20} color={colors.primary} />
              </View>
              <View className="flex-1 min-w-0">
                <Text
                  style={{ color: colors.textPrimary }}
                  className="text-sm font-bold truncate"
                >
                  Enter Table Pass Code
                </Text>
                <Text
                  style={{ color: colors.textMuted }}
                  className="text-[11px] font-medium truncate mt-0.5"
                >
                  e.g. TOK-XXXX or direct NFC token
                </Text>
              </View>
            </View>
            <AppIcon name="chevron-right" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Footer Note */}
        <View className="items-center mt-12">
          <Text style={{ color: colors.textMuted }} className="text-[11px] text-center">
            Need help? Ask any floor server or visit reception.
          </Text>
        </View>
      </ScrollView>

      {/* Code / Phone / Token Modal */}
      <Modal
        visible={activeModal !== 'NONE'}
        transparent
        animationType="slide"
        onRequestClose={() => !isLoading && setActiveModal('NONE')}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/70 justify-end"
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderTopWidth: 1,
            }}
            className="rounded-t-3xl p-6 space-y-4"
          >
            {/* Modal Header */}
            <View className="flex-row items-center justify-between pb-2 border-b border-border/50">
              <Text style={{ color: colors.textPrimary }} className="text-base font-black">
                {activeModal === 'CODE' && 'Enter 6-Digit Code'}
                {activeModal === 'PHONE' && 'Mobile Number Lookup'}
                {activeModal === 'TOKEN' && 'Table Pass Code'}
              </Text>
              <TouchableOpacity
                onPress={() => !isLoading && setActiveModal('NONE')}
                className="p-1 rounded-full"
              >
                <AppIcon name="x" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex-row items-center gap-2">
                <AppIcon name="alert-circle" size={16} color="#E11D48" />
                <Text className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex-1">
                  {errorMessage}
                </Text>
              </View>
            )}

            {/* Form Content */}
            {activeModal === 'CODE' && (
              <View className="space-y-4">
                <Text style={{ color: colors.textMuted }} className="text-xs">
                  Enter the 6-digit access code provided at check-in (e.g. 123456 or #123456).
                </Text>
                <TextInput
                  value={codeInput}
                  onChangeText={setCodeInput}
                  placeholder="e.g. 849201"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={7}
                  autoFocus
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                    color: colors.textPrimary,
                  }}
                  className="w-full p-3.5 rounded-xl text-center text-lg font-mono font-bold tracking-widest"
                />
                <TouchableOpacity
                  onPress={handleCodeSubmit}
                  disabled={isLoading}
                  style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
                  className="w-full py-3.5 rounded-xl items-center justify-center flex-row gap-2 shadow-md"
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
                  ) : (
                    <Text
                      style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                      className="text-sm font-extrabold"
                    >
                      Verify & Open Menu
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {activeModal === 'PHONE' && (
              <View className="space-y-4">
                <Text style={{ color: colors.textMuted }} className="text-xs">
                  Enter the 10-digit mobile number used during registration.
                </Text>
                <TextInput
                  value={phoneInput}
                  onChangeText={setPhoneInput}
                  placeholder="e.g. 9876543210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoFocus
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                    color: colors.textPrimary,
                  }}
                  className="w-full p-3.5 rounded-xl text-center text-lg font-mono font-bold tracking-wider"
                />
                <TouchableOpacity
                  onPress={handlePhoneSubmit}
                  disabled={isLoading}
                  style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
                  className="w-full py-3.5 rounded-xl items-center justify-center flex-row gap-2 shadow-md"
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
                  ) : (
                    <Text
                      style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                      className="text-sm font-extrabold"
                    >
                      Find Active Session
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {activeModal === 'TOKEN' && (
              <View className="space-y-4">
                <Text style={{ color: colors.textMuted }} className="text-xs">
                  Enter your full token ID or NFC pass code (e.g. TOK-101-ABCD).
                </Text>
                <TextInput
                  value={tokenInput}
                  onChangeText={setTokenInput}
                  placeholder="e.g. TOK-101-XXXX"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  autoFocus
                  style={{
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    borderWidth: 1,
                    color: colors.textPrimary,
                  }}
                  className="w-full p-3.5 rounded-xl text-center text-lg font-mono font-bold"
                />
                <TouchableOpacity
                  onPress={handleTokenSubmit}
                  disabled={isLoading}
                  style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
                  className="w-full py-3.5 rounded-xl items-center justify-center flex-row gap-2 shadow-md"
                >
                  <Text
                    style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                    className="text-sm font-extrabold"
                  >
                    Open Dining Portal
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};
