import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { AppIcon } from '../common/AppIcon';

interface CustomerSessionTimerProps {
  endTime?: string | null;
  startTime?: string | null;
  showIcon?: boolean;
}

export const CustomerSessionTimer: React.FC<CustomerSessionTimerProps> = ({
  endTime,
  startTime,
  showIcon = true,
}) => {
  const { colors, isDark } = useTheme();
  const [timeLeft, setTimeLeft] = useState<string>('--:--:--');
  const [isWarning, setIsWarning] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    let endTimestamp: number | null = null;
    if (endTime) {
      const parsed = new Date(endTime).getTime();
      if (!isNaN(parsed)) endTimestamp = parsed;
    }
    if (!endTimestamp && startTime) {
      const parsedStart = new Date(startTime).getTime();
      if (!isNaN(parsedStart)) endTimestamp = parsedStart + 2 * 60 * 60 * 1000;
    }

    if (!endTimestamp) {
      setTimeLeft('--:--:--');
      return;
    }

    const calculate = () => {
      const diffMs = endTimestamp! - Date.now();
      if (diffMs <= 0) {
        setTimeLeft('00:00:00');
        setIsWarning(false);
        setIsExpired(true);
        return;
      }
      setIsExpired(false);
      const totalSecs = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;

      setIsWarning(totalSecs <= 15 * 60);
      setTimeLeft(
        `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      );
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [endTime, startTime]);

  if (isExpired) {
    return (
      <View className="flex-row items-center gap-1">
        {showIcon && <AppIcon name="clock" size={13} color="#E11D48" />}
        <Text className="text-[11px] font-mono font-bold text-rose-600 dark:text-rose-400">
          Session Ended
        </Text>
      </View>
    );
  }

  const textColor = isWarning
    ? '#D97706' // amber-600
    : colors.primary;

  return (
    <View className="flex-row items-center gap-1">
      {showIcon && <AppIcon name="clock" size={13} color={textColor} />}
      <Text
        style={{ color: textColor }}
        className="text-[12px] font-mono font-bold tracking-tight"
      >
        {timeLeft}
      </Text>
    </View>
  );
};
