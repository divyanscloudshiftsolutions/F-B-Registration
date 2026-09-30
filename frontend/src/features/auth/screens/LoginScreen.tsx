import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useBar } from '../../../context/BarContext';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';

type RoleCode = 'ADM' | 'REC' | 'BAR' | 'CHF' | 'WTR' | 'MGR';

export const LoginScreen: React.FC<{ onCustomerModePress?: () => void }> = ({
  onCustomerModePress,
}) => {
  const { login } = useBar();
  const { colors, isDark, toggleTheme } = useTheme();

  const roles: RoleCode[] = ['ADM', 'REC', 'BAR', 'CHF', 'WTR', 'MGR'];
  const [selectedRole, setSelectedRole] = useState<RoleCode>('ADM');
  const [username, setUsername] = useState('admin');
  const [pin, setPin] = useState('admin123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const roleCredentials: Record<RoleCode, { user: string; pin: string; label: string }> = {
    ADM: { user: 'admin', pin: 'admin123', label: 'Admin' },
    REC: { user: 'receptionist', pin: 'recep123', label: 'Reception' },
    BAR: { user: 'bartender', pin: 'bar123', label: 'Bartender' },
    CHF: { user: 'chef', pin: 'chef123', label: 'Chef / Kitchen' },
    WTR: { user: 'waiter', pin: 'waiter123', label: 'Waiter' },
    MGR: { user: 'manager', pin: 'manager123', label: 'Manager' },
  };

  const handleRoleSelect = (role: RoleCode) => {
    setSelectedRole(role);
    setErrorMsg('');
    if (roleCredentials[role]) {
      setUsername(roleCredentials[role].user);
      setPin(roleCredentials[role].pin);
    }
  };

  const handleSignIn = async () => {
    if (!username.trim() || !pin.trim()) {
      setErrorMsg('Please enter a valid Employee Code and Security PIN.');
      return;
    }

    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const success = await login(username.trim(), pin.trim());
      if (!success) {
        setErrorMsg('Login failed. Please check your credentials and try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Header with Theme Toggle & Customer Switch */}
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity
              onPress={toggleTheme}
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

            {onCustomerModePress && (
              <TouchableOpacity
                onPress={onCustomerModePress}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                className="px-3 py-1.5 rounded-2xl shadow-xs flex-row items-center gap-1.5"
              >
                <AppIcon name="sparkles" size={14} color={colors.primary} />
                <Text style={{ color: colors.primary }} className="text-xs font-bold">
                  Customer Dining View
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Brand Hero */}
          <View className="items-center mb-6">
            <View
              style={{
                backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(124,58,237,0.1)',
                borderColor: isDark ? 'rgba(212,175,55,0.3)' : 'rgba(124,58,237,0.2)',
                borderWidth: 1,
              }}
              className="w-16 h-16 rounded-3xl items-center justify-center mb-3.5 shadow-sm"
            >
              <AppIcon
                name="sparkles"
                size={32}
                color={isDark ? '#D4AF37' : '#7C3AED'}
              />
            </View>
            <Text
              style={{ color: colors.textPrimary }}
              className="text-2xl font-black text-center tracking-tight"
            >
              Staff Portal Login
            </Text>
            <Text
              style={{ color: colors.textMuted }}
              className="text-xs font-medium text-center mt-1"
            >
              Pegs N Bottles Management & Operations
            </Text>
          </View>

          {/* Role Preset Pills */}
          <View className="mb-6">
            <Text style={{ color: colors.textMuted }} className="text-xs font-bold mb-2 uppercase tracking-wider text-center">
              Select Role Preset
            </Text>
            <View className="flex-row flex-wrap justify-center gap-1.5">
              {roles.map((r) => {
                const isRoleActive = selectedRole === r;
                return (
                  <TouchableOpacity
                    key={r}
                    onPress={() => handleRoleSelect(r)}
                    style={{
                      backgroundColor: isRoleActive
                        ? isDark
                          ? '#D4AF37'
                          : '#7C3AED'
                        : colors.surface,
                      borderColor: isRoleActive
                        ? isDark
                          ? '#D4AF37'
                          : '#7C3AED'
                        : colors.border,
                      borderWidth: 1,
                    }}
                    className="px-3 py-1.5 rounded-xl shadow-xs"
                  >
                    <Text
                      style={{
                        color: isRoleActive
                          ? isDark
                            ? '#000000'
                            : '#FFFFFF'
                          : colors.textPrimary,
                        fontWeight: isRoleActive ? '800' : '600',
                      }}
                      className="text-xs"
                    >
                      {roleCredentials[r].label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Login Form Card */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="w-full max-w-sm mx-auto rounded-3xl p-6 shadow-md space-y-4"
          >
            {/* Error Message */}
            {errorMsg ? (
              <View className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex-row items-center gap-2">
                <AppIcon name="alert-circle" size={16} color="#E11D48" />
                <Text className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex-1">
                  {errorMsg}
                </Text>
              </View>
            ) : null}

            {/* Username / Employee Code */}
            <View className="space-y-1.5">
              <Text style={{ color: colors.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                Employee Code / Username
              </Text>
              <View
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                className="h-12 px-3.5 rounded-xl flex-row items-center gap-2.5"
              >
                <AppIcon name="user" size={18} color={colors.textMuted} />
                <TextInput
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter employee code"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  style={{ color: colors.textPrimary }}
                  className="flex-1 text-sm font-medium h-full p-0"
                />
              </View>
            </View>

            {/* Password / PIN */}
            <View className="space-y-1.5">
              <Text style={{ color: colors.textMuted }} className="text-xs font-bold uppercase tracking-wider">
                Security PIN / Password
              </Text>
              <View
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                className="h-12 px-3.5 rounded-xl flex-row items-center gap-2.5"
              >
                <AppIcon name="key-round" size={18} color={colors.textMuted} />
                <TextInput
                  value={pin}
                  onChangeText={setPin}
                  placeholder="Enter security PIN"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={{ color: colors.textPrimary }}
                  className="flex-1 text-sm font-medium h-full p-0"
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSignIn}
              disabled={isSubmitting}
              activeOpacity={0.85}
              style={{
                backgroundColor: isDark ? '#D4AF37' : '#7C3AED',
                shadowColor: isDark ? '#D4AF37' : '#7C3AED',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              className="w-full py-3.5 rounded-xl items-center justify-center flex-row gap-2 mt-2"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
              ) : (
                <>
                  <Text
                    style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                    className="text-sm font-black"
                  >
                    Authenticate & Enter
                  </Text>
                  <AppIcon
                    name="arrow-right"
                    size={16}
                    color={isDark ? '#000000' : '#FFFFFF'}
                  />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
