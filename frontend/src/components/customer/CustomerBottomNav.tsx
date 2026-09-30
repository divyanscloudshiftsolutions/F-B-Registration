import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { AppIcon } from '../common/AppIcon';

export type CustomerNavTab = 'home' | 'repeat' | 'orders' | 'bill' | 'eat' | 'drink' | 'merch' | 'cart' | 'account';

interface CustomerBottomNavProps {
  activeTab: CustomerNavTab;
  onSelectTab: (tab: CustomerNavTab) => void;
  onCallWaiterPress: () => void;
  activeRequestsCount?: number;
  pendingOrdersCount?: number;
}

export const CustomerBottomNav: React.FC<CustomerBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onCallWaiterPress,
  activeRequestsCount = 0,
  pendingOrdersCount = 0,
}) => {
  const { colors, isDark } = useTheme();

  const isHomeActive = activeTab === 'home' || activeTab === 'eat' || activeTab === 'drink' || activeTab === 'merch';
  const isRepeatActive = activeTab === 'repeat';
  const isOrdersActive = activeTab === 'orders';
  const isBillActive = activeTab === 'bill';

  const activeColor = colors.primary;
  const inactiveColor = colors.textMuted;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: isDark ? 0.35 : 0.08,
        shadowRadius: 12,
        elevation: 16,
      }}
      className="w-full pb-3 pt-1.5 px-2"
    >
      <View className="flex-row items-end justify-around">
        {/* 1. Home */}
        <TouchableOpacity
          onPress={() => onSelectTab('home')}
          activeOpacity={0.7}
          className="flex-1 items-center justify-center py-1"
        >
          <AppIcon
            name="home"
            size={20}
            color={isHomeActive ? activeColor : inactiveColor}
          />
          <Text
            style={{
              color: isHomeActive ? activeColor : inactiveColor,
              fontWeight: isHomeActive ? '800' : '600',
            }}
            className="text-[11px] mt-1"
          >
            Home
          </Text>
        </TouchableOpacity>

        {/* 2. Repeat */}
        <TouchableOpacity
          onPress={() => onSelectTab('repeat')}
          activeOpacity={0.7}
          className="flex-1 items-center justify-center py-1"
        >
          <AppIcon
            name="rotate-ccw"
            size={20}
            color={isRepeatActive ? activeColor : inactiveColor}
          />
          <Text
            style={{
              color: isRepeatActive ? activeColor : inactiveColor,
              fontWeight: isRepeatActive ? '800' : '600',
            }}
            className="text-[11px] mt-1"
          >
            Repeat
          </Text>
        </TouchableOpacity>

        {/* 3. Call Waiter (Center Elevated Button) */}
        <View className="flex-1 items-center justify-center -mt-6">
          <TouchableOpacity
            onPress={onCallWaiterPress}
            activeOpacity={0.85}
            style={{
              backgroundColor: isDark ? '#D4AF37' : '#7C3AED',
              borderColor: colors.surface,
              borderWidth: 4,
              shadowColor: isDark ? '#D4AF37' : '#7C3AED',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 8,
            }}
            className="w-14 h-14 rounded-full items-center justify-center relative"
          >
            <AppIcon
              name="phone-call"
              size={24}
              color={isDark ? '#000000' : '#FFFFFF'}
            />
            {activeRequestsCount > 0 && (
              <View
                style={{
                  backgroundColor: isDark ? '#7C3AED' : '#D4AF37',
                  borderColor: colors.surface,
                  borderWidth: 2,
                }}
                className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full items-center justify-center"
              >
                <Text
                  style={{ color: isDark ? '#FFFFFF' : '#000000' }}
                  className="text-[10px] font-black"
                >
                  {activeRequestsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <Text
            style={{ color: colors.primary }}
            className="text-[10px] font-extrabold mt-1 tracking-tight"
          >
            Call Waiter
          </Text>
        </View>

        {/* 4. My Orders */}
        <TouchableOpacity
          onPress={() => onSelectTab('orders')}
          activeOpacity={0.7}
          className="flex-1 items-center justify-center py-1"
        >
          <View className="relative">
            <AppIcon
              name="clipboard-list"
              size={20}
              color={isOrdersActive ? activeColor : inactiveColor}
            />
            {pendingOrdersCount > 0 && (
              <View
                style={{
                  backgroundColor: isDark ? '#7C3AED' : '#D4AF37',
                }}
                className="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-0.5 rounded-full items-center justify-center"
              >
                <Text
                  style={{ color: isDark ? '#FFFFFF' : '#000000' }}
                  className="text-[9px] font-black"
                >
                  {pendingOrdersCount}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={{
              color: isOrdersActive ? activeColor : inactiveColor,
              fontWeight: isOrdersActive ? '800' : '600',
            }}
            className="text-[11px] mt-1"
          >
            My Orders
          </Text>
        </TouchableOpacity>

        {/* 5. Pay Bill */}
        <TouchableOpacity
          onPress={() => onSelectTab('bill')}
          activeOpacity={0.7}
          className="flex-1 items-center justify-center py-1"
        >
          <AppIcon
            name="receipt"
            size={20}
            color={isBillActive ? activeColor : inactiveColor}
          />
          <Text
            style={{
              color: isBillActive ? activeColor : inactiveColor,
              fontWeight: isBillActive ? '800' : '600',
            }}
            className="text-[11px] mt-1"
          >
            Pay Bill
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
