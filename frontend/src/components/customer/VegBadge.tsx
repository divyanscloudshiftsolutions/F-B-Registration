import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Wine } from 'lucide-react-native';

interface VegBadgeProps {
  type: string;
  size?: 'sm' | 'md' | 'lg';
}

export const VegBadge: React.FC<VegBadgeProps> = ({ type, size = 'sm' }) => {
  const normType = (type || '').toUpperCase();

  const isVeg = normType === 'VEG' || normType === 'VEGETARIAN';
  const isNonVeg = normType === 'NON_VEG' || normType === 'NON-VEG' || normType === 'NON_VEGETARIAN';
  const isEgg = normType === 'EGG' || normType === 'CONTAINS_EGG';
  const isBeverage = normType === 'BEVERAGE' || normType === 'DRINK' || normType === 'ALCOHOLIC' || normType === 'NON_ALCOHOLIC';

  const dim = size === 'lg' ? 18 : size === 'md' ? 14 : 11;
  const innerDim = size === 'lg' ? 8 : size === 'md' ? 6 : 5;

  if (isBeverage) {
    return (
      <View style={[styles.container, { width: dim, height: dim, borderColor: '#3B82F6' }]}>
        <Wine size={size === 'lg' ? 12 : 8} color="#3B82F6" />
      </View>
    );
  }

  if (isEgg) {
    return (
      <View style={[styles.container, { width: dim, height: dim, borderColor: '#F59E0B' }]}>
        <View style={[styles.circle, { width: innerDim, height: innerDim, backgroundColor: '#F59E0B' }]} />
      </View>
    );
  }

  if (isNonVeg) {
    return (
      <View style={[styles.container, { width: dim, height: dim, borderColor: '#EF4444' }]}>
        <View style={[styles.triangle, { borderBottomWidth: innerDim + 1, borderLeftWidth: (innerDim + 1) / 2, borderRightWidth: (innerDim + 1) / 2 }]} />
      </View>
    );
  }

  // Default to Veg
  return (
    <View style={[styles.container, { width: dim, height: dim, borderColor: '#10B981' }]}>
      <View style={[styles.circle, { width: innerDim, height: innerDim, backgroundColor: '#10B981' }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  circle: {
    borderRadius: 999,
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#EF4444',
  },
});

export default VegBadge;
