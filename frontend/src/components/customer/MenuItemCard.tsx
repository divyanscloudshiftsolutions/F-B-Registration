import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import { VegBadge } from './VegBadge';
import { useTheme } from '../../context/ThemeContext';

export interface MenuItemData {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  finalPrice?: number;
  discountMode?: string;
  discountValue?: number;
  foodType: string;
  station: string;
  image?: string;
  imageUrl?: string;
  sectionSlug?: string;
  isAvailable?: boolean;
  stockQuantity?: number;
  availableStock?: number;
  popular?: boolean;
  isPopular?: boolean;
  featured?: boolean;
  isFeatured?: boolean;
  isSignature?: boolean;
  variants?: Array<{
    id: string;
    name: string;
    priceDelta: number;
  }>;
  modifierGroups?: Array<{
    id: string;
    name: string;
    isRequired?: boolean;
    isMulti?: boolean;
    options: Array<{
      id: string;
      name: string;
      priceDelta: number;
    }>;
  }>;
}

interface MenuItemCardProps {
  item: MenuItemData;
  cartQuantity?: number;
  isOrderingDisabled?: boolean;
  onOpenDetails?: (item: MenuItemData) => void;
  onOpenCustomizer: (item: MenuItemData) => void;
  onDirectAdd: (item: MenuItemData) => void;
  onIncrement?: (item: MenuItemData) => void;
  onDecrement?: (item: MenuItemData) => void;
  onOrderingBlockedClick?: () => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({
  item,
  cartQuantity = 0,
  isOrderingDisabled = false,
  onOpenDetails,
  onOpenCustomizer,
  onDirectAdd,
  onIncrement,
  onDecrement,
  onOrderingBlockedClick,
}) => {
  const { colors, isDark } = useTheme();

  const hasModifiers =
    (item.variants && item.variants.length > 0) ||
    (item.modifierGroups && item.modifierGroups.length > 0);

  const isManualAvailable = item.isAvailable !== false;
  const physicalStock = Number(item.stockQuantity ?? 50);
  const rawAvailable = item.availableStock !== undefined ? Number(item.availableStock) : physicalStock;
  const customerOwnReserved = cartQuantity;
  const effectivePurchasableForCustomer = Math.min(physicalStock, rawAvailable + customerOwnReserved);
  const isPhysicalOutOfStock = !isManualAvailable || physicalStock <= 0;
  const isReservedOutForOthers = !isPhysicalOutOfStock && effectivePurchasableForCustomer <= 0;
  const isLowStock = !isPhysicalOutOfStock && rawAvailable > 0 && rawAvailable < 10;
  const isMaxReached = !isPhysicalOutOfStock && customerOwnReserved >= effectivePurchasableForCustomer;

  const isPopular = Boolean(item.popular ?? item.isPopular);
  const isFeatured = Boolean(item.featured ?? item.isFeatured ?? item.isSignature);

  const rawImage = item.image || item.imageUrl;
  const numBasePrice = Number(item.basePrice || 0);
  const numFinalPrice = Number(item.finalPrice ?? item.basePrice ?? 0);
  const hasDiscount = numBasePrice > 0 && numFinalPrice >= 0 && numFinalPrice < numBasePrice;
  const discountPercentage = hasDiscount
    ? Math.round(((numBasePrice - numFinalPrice) / numBasePrice) * 100)
    : 0;
  const isOfferValid = discountPercentage > 0 && discountPercentage < 100;

  const handleCardPress = () => {
    if (onOpenDetails) {
      onOpenDetails(item);
    }
  };

  const handleAddClick = () => {
    if (isOrderingDisabled) {
      if (onOrderingBlockedClick) onOrderingBlockedClick();
      return;
    }
    if (isPhysicalOutOfStock || isReservedOutForOthers) return;
    if (hasModifiers) {
      onOpenCustomizer(item);
    } else {
      onDirectAdd(item);
    }
  };

  const handleIncrementClick = () => {
    if (isOrderingDisabled) {
      if (onOrderingBlockedClick) onOrderingBlockedClick();
      return;
    }
    if (isMaxReached) return;
    if (onIncrement) {
      onIncrement(item);
    } else if (hasModifiers) {
      onOpenCustomizer(item);
    } else {
      onDirectAdd(item);
    }
  };

  const handleDecrementClick = () => {
    if (isOrderingDisabled) {
      if (onOrderingBlockedClick) onOrderingBlockedClick();
      return;
    }
    if (onDecrement) {
      onDecrement(item);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handleCardPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? colors.border : 'rgba(124, 58, 237, 0.25)',
        },
      ]}
    >
      {/* 1:1 Square Image Window */}
      <View style={styles.imageContainer}>
        <View style={[styles.innerImageWrapper, { backgroundColor: isDark ? '#27272A' : '#F3F4F6' }]}>
          {rawImage ? (
            <Image
              source={{ uri: rawImage }}
              style={[
                styles.image,
                isPhysicalOutOfStock ? { opacity: 0.5 } : undefined,
              ]}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderText}>🍽️</Text>
            </View>
          )}

          {/* Out of Stock Overlay */}
          {isPhysicalOutOfStock && (
            <View style={styles.outOfStockOverlay}>
              <Text style={styles.outOfStockOverlayText}>OUT OF STOCK</Text>
            </View>
          )}
        </View>

        {/* Left-Side Overlapping Floating Badges (-left-1 offset) */}
        <View style={styles.badgeColumn}>
          {isOfferValid && !isPhysicalOutOfStock && (
            <View style={styles.offerBadge}>
              <Text style={styles.badgeText}>{discountPercentage}% OFF</Text>
            </View>
          )}
          {isLowStock && !isPhysicalOutOfStock && (
            <View style={styles.lowStockBadge}>
              <Text style={styles.badgeText}>{rawAvailable} LEFT</Text>
            </View>
          )}
        </View>

        {/* Top-Right Veg Badge */}
        {item.foodType ? (
          <View style={styles.vegBadgeWrapper}>
            <VegBadge type={item.foodType} size="sm" />
          </View>
        ) : null}

        {/* Bottom-Right Signature / Popular Badge */}
        {(isPopular || isFeatured) && !isPhysicalOutOfStock && (
          <View
            style={[
              styles.popularBadge,
              { backgroundColor: isDark ? '#D4AF37' : 'rgba(0,0,0,0.85)' },
            ]}
          >
            <Text
              style={[
                styles.popularBadgeText,
                { color: isDark ? '#000000' : '#FFFFFF' },
              ]}
            >
              {isFeatured ? 'Signature' : 'Popular'}
            </Text>
          </View>
        )}
      </View>

      {/* Info Area (Clamped Title + Price & Action) */}
      <View style={styles.infoArea}>
        <View style={styles.titleContainer}>
          <Text
            numberOfLines={2}
            style={[styles.itemName, { color: colors.text }]}
          >
            {item.name}
          </Text>
        </View>

        {/* Price and Action Button Row */}
        <View style={[styles.actionRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
          <View style={styles.priceContainer}>
            <Text style={[styles.finalPrice, { color: colors.primary }]}>
              ₹{numFinalPrice}
            </Text>
            {hasDiscount && (
              <Text style={[styles.basePrice, { color: colors.muted }]}>
                ₹{numBasePrice}
              </Text>
            )}
          </View>

          <View style={styles.buttonCell}>
            {isPhysicalOutOfStock ? (
              <View style={styles.outOfStockPill}>
                <Text style={styles.outOfStockPillText}>Out of Stock</Text>
              </View>
            ) : isOrderingDisabled ? (
              <TouchableOpacity
                onPress={handleAddClick}
                style={[styles.actionBtn, { backgroundColor: isDark ? '#27272A' : '#EAECEF', borderColor: colors.border }]}
              >
                <Text style={[styles.actionBtnText, { color: colors.muted }]}>LOCKED</Text>
              </TouchableOpacity>
            ) : isReservedOutForOthers && cartQuantity === 0 ? (
              <View style={styles.reservedPill}>
                <Text style={styles.reservedPillText}>Reserved</Text>
              </View>
            ) : cartQuantity > 0 ? (
              <View
                style={[
                  styles.stepperContainer,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.primaryLight,
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={handleDecrementClick}
                  style={styles.stepperBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Minus size={11} color={colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.stepperQty, { color: colors.primary }]}>
                  {cartQuantity}
                </Text>
                <TouchableOpacity
                  onPress={handleIncrementClick}
                  disabled={isMaxReached}
                  style={[styles.stepperBtn, isMaxReached ? { opacity: 0.3 } : undefined]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Plus size={11} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={handleAddClick}
                style={[
                  styles.actionBtn,
                  {
                    borderColor: colors.primary,
                    backgroundColor: 'transparent',
                  },
                ]}
              >
                <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                  {hasModifiers ? 'ADD +' : 'ADD'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 8,
    flexDirection: 'column',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 10,
    width: '100%',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  innerImageWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 32,
  },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  outOfStockOverlayText: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  badgeColumn: {
    position: 'absolute',
    top: 6,
    left: -4,
    zIndex: 10,
    gap: 4,
  },
  offerBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  lowStockBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  vegBadgeWrapper: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 2,
    borderRadius: 4,
  },
  popularBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    zIndex: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  popularBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  infoArea: {
    paddingTop: 8,
    flex: 1,
    justifyContent: 'space-between',
  },
  titleContainer: {
    height: 34,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemName: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  finalPrice: {
    fontSize: 13,
    fontWeight: '900',
  },
  basePrice: {
    fontSize: 10,
    textDecorationLine: 'line-through',
  },
  buttonCell: {
    height: 26,
    justifyContent: 'center',
  },
  actionBtn: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 6,
    gap: 6,
  },
  stepperBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperQty: {
    fontSize: 11,
    fontWeight: '900',
    minWidth: 12,
    textAlign: 'center',
  },
  outOfStockPill: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outOfStockPillText: {
    color: '#EF4444',
    fontSize: 8.5,
    fontWeight: '800',
  },
  reservedPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  reservedPillText: {
    color: '#F59E0B',
    fontSize: 8.5,
    fontWeight: '800',
  },
});

export default MenuItemCard;
