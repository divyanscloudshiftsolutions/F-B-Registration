import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { AppIcon } from './AppIcon';

interface AppBadgeProps {
  label: string;
  variant?: 'online' | 'offline' | 'gold' | 'role' | 'neutral' | 'danger';
  icon?: string;
  dot?: boolean;
  style?: ViewStyle;
}

export const AppBadge: React.FC<AppBadgeProps> = ({
  label,
  variant = 'online',
  icon,
  dot = false,
  style,
}) => {
  const { colors, isDark } = useTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'online':
        return {
          bg: '#06261B',
          border: 'rgba(16, 185, 129, 0.3)',
          text: '#10B981',
          dotColor: '#10B981',
        };
      case 'offline':
        return {
          bg: 'rgba(142, 142, 147, 0.15)',
          border: 'rgba(142, 142, 147, 0.3)',
          text: '#8E8E93',
          dotColor: '#8E8E93',
        };
      case 'gold':
        return {
          bg: isDark ? 'rgba(141, 110, 229, 0.15)' : 'rgba(124, 58, 237, 0.12)',
          border: isDark ? 'rgba(141, 110, 229, 0.3)' : 'rgba(124, 58, 237, 0.2)',
          text: colors.primary,
          dotColor: colors.primary,
        };
      case 'role':
        return {
          bg: isDark ? 'rgba(141, 110, 229, 0.1)' : 'rgba(124, 58, 237, 0.08)',
          border: isDark ? 'rgba(141, 110, 229, 0.25)' : 'rgba(124, 58, 237, 0.15)',
          text: colors.primary,
          dotColor: colors.primary,
        };
      case 'danger':
        return {
          bg: 'rgba(239, 68, 68, 0.15)',
          border: 'rgba(239, 68, 68, 0.3)',
          text: '#EF4444',
          dotColor: '#EF4444',
        };
      case 'neutral':
        return {
          bg: colors.secondarySurface,
          border: colors.border,
          text: colors.text,
          dotColor: colors.text,
        };
    }
  };

  const vStyle = getVariantStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: vStyle.bg,
          borderColor: vStyle.border,
          borderWidth: 1,
        },
        style,
      ]}
    >
      {dot && (
        <View style={[styles.dot, { backgroundColor: vStyle.dotColor }]} />
      )}
      {icon && (
        <AppIcon name={icon} color={vStyle.text} size={14} />
      )}
      <Text style={[styles.text, { color: vStyle.text }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
