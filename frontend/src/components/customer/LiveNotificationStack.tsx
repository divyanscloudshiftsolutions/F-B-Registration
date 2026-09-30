import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { AppIcon } from '../common/AppIcon';
import { CustomerNotification } from '../../context/CustomerContext';

interface LiveNotificationStackProps {
  notifications: CustomerNotification[];
  activeNotification: CustomerNotification | null;
  onDismissActive: () => void;
  onNotificationPress?: (notification: CustomerNotification) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const NotificationCard: React.FC<{
  notification: CustomerNotification;
  onDismiss: () => void;
  onPress?: () => void;
}> = ({ notification, onDismiss, onPress }) => {
  const { colors, isDark } = useTheme();
  const panX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Auto-dismiss after 5s
    const timer = setTimeout(() => {
      handleDismiss();
    }, 5000);

    return () => clearTimeout(timer);
  }, [notification.id]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(panX, {
        toValue: SCREEN_WIDTH,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        panX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 80) {
          const target = gestureState.dx > 0 ? SCREEN_WIDTH : -SCREEN_WIDTH;
          Animated.parallel([
            Animated.timing(panX, {
              toValue: target,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start(() => {
            onDismiss();
          });
        } else {
          Animated.spring(panX, {
            toValue: 0,
            bounciness: 8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Type styling
  const getTypeIcon = () => {
    switch (notification.type) {
      case 'order_placed':
      case 'order_preparing':
        return 'flame';
      case 'order_ready':
      case 'order_served':
        return 'check-circle-2';
      case 'bill_requested':
      case 'bill_settled':
        return 'receipt';
      case 'waiter_called':
      case 'waiter_acknowledged':
        return 'phone-call';
      case 'session_warning':
      case 'session_closed':
        return 'alert-triangle';
      default:
        return 'sparkles';
    }
  };

  const getTypeColor = () => {
    switch (notification.type) {
      case 'order_ready':
      case 'order_served':
      case 'bill_settled':
        return '#10B981'; // emerald
      case 'session_warning':
        return '#D97706'; // amber
      case 'session_closed':
        return '#E11D48'; // rose
      default:
        return colors.primary;
    }
  };

  const iconName = getTypeIcon();
  const iconColor = getTypeColor();

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        transform: [{ translateX: panX }],
        opacity,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.4 : 0.12,
        shadowRadius: 10,
        elevation: 10,
      }}
      className="w-full max-w-sm rounded-2xl p-3.5 flex-row items-start gap-3"
    >
      <View
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderColor: colors.border,
          borderWidth: 1,
        }}
        className="w-8 h-8 rounded-xl items-center justify-center shrink-0 mt-0.5"
      >
        <AppIcon name={iconName} size={16} color={iconColor} />
      </View>

      <TouchableOpacity
        onPress={() => {
          if (onPress) onPress();
        }}
        activeOpacity={0.8}
        className="flex-1 min-w-0"
      >
        <Text
          style={{ color: colors.textPrimary }}
          className="text-xs font-black leading-tight"
          numberOfLines={1}
        >
          {notification.title || 'Table Update'}
        </Text>
        <Text
          style={{ color: colors.textMuted }}
          className="text-[11px] leading-snug mt-0.5"
          numberOfLines={2}
        >
          {notification.message}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        className="p-1 -mr-1 -mt-1 rounded-full opacity-60"
      >
        <AppIcon name="x" size={14} color={colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
};

export const LiveNotificationStack: React.FC<LiveNotificationStackProps> = ({
  notifications,
  activeNotification,
  onDismissActive,
  onNotificationPress,
}) => {
  const { colors, isDark } = useTheme();

  if (!notifications || notifications.length === 0 || !activeNotification) {
    return null;
  }

  const stackedBehind = notifications.slice(1, 3);

  return (
    <View
      pointerEvents="box-none"
      className="absolute top-4 left-0 right-0 z-50 items-center px-4"
    >
      <View className="relative w-full max-w-sm items-center">
        {/* Layered stacked background cards */}
        {stackedBehind.map((item, idx) => {
          const depth = idx + 1;
          const translateY = depth * -6;
          const scale = 1 - depth * 0.04;
          const opacity = depth === 1 ? 0.6 : 0.35;

          return (
            <View
              key={item.id}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                transform: [{ translateY }, { scale }],
                opacity,
                zIndex: 40 - depth * 10,
              }}
              className="absolute top-0 w-full rounded-2xl p-3.5 shadow-sm"
            >
              <Text
                style={{ color: colors.textPrimary }}
                className="text-xs font-bold truncate"
              >
                {item.title || item.message}
              </Text>
            </View>
          );
        })}

        {/* Foreground active card */}
        <View className="w-full z-50">
          <NotificationCard
            key={activeNotification.id}
            notification={activeNotification}
            onDismiss={onDismissActive}
            onPress={() => onNotificationPress?.(activeNotification)}
          />
        </View>
      </View>
    </View>
  );
};
