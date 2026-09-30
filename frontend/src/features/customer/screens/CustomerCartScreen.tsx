import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';
import { useCustomer } from '../../../context/CustomerContext';
import { VegBadge } from '../../../components/customer/VegBadge';
import { EmptyState } from '../../../components/common/EmptyState';

interface CustomerCartScreenProps {
  onExploreMenu: () => void;
  onOrderSuccess?: () => void;
}

export const CustomerCartScreen: React.FC<CustomerCartScreenProps> = ({
  onExploreMenu,
  onOrderSuccess,
}) => {
  const { colors, isDark } = useTheme();
  const {
    cart,
    cartTotal,
    cartCount,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    placeOrder,
    isOrdering,
    isOrderingLocked,
    isSessionWarning,
  } = useCustomer();

  const [orderError, setOrderError] = useState<string | null>(null);

  // Compute live tax breakdown
  // Compound math: itemTaxableBasis = lineTotal * (1 + 0.05), gst = itemTaxableBasis * 0.05
  const serviceCharge = cartTotal * 0.05;
  const taxableBasis = cartTotal + serviceCharge;
  const estimatedGst = taxableBasis * 0.05;
  const grandTotal = cartTotal + serviceCharge + estimatedGst;

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || isOrderingLocked) return;
    setOrderError(null);

    try {
      await placeOrder();
      if (onOrderSuccess) onOrderSuccess();
    } catch (err: any) {
      setOrderError(err.message || 'Failed to place order. Please try again.');
    }
  };

  if (cart.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }} className="p-4 justify-center">
        <EmptyState
          title="Your Cart is Empty"
          description="Browse our food and drinks menu to add delicious items to your table order."
          actionLabel="Explore Menu"
          onAction={onExploreMenu}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
        className="flex-1"
      >
        {/* Header with Cart Count and Clear Action */}
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            <AppIcon name="shopping-cart" size={18} color={colors.primary} />
            <Text style={{ color: colors.textPrimary }} className="text-base font-black">
              Table Cart ({cartCount} {cartCount === 1 ? 'item' : 'items'})
            </Text>
          </View>
          <TouchableOpacity
            onPress={clearCart}
            activeOpacity={0.7}
            className="flex-row items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10"
          >
            <AppIcon name="trash-2" size={12} color="#E11D48" />
            <Text className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
              Clear All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Lockout / Cutoff Banner */}
        {isOrderingLocked && (
          <View className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex-row items-start gap-2.5 mb-4">
            <AppIcon name="alert-circle" size={18} color="#D97706" />
            <View className="flex-1">
              <Text className="text-xs font-black text-amber-800 dark:text-amber-300">
                Ordering is currently closed
              </Text>
              <Text className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 leading-snug">
                Bill has been requested or the dining session cutoff has been reached. Please contact your waiter to reopen ordering.
              </Text>
            </View>
          </View>
        )}

        {/* Error banner */}
        {orderError && (
          <View className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex-row items-start gap-2.5 mb-4">
            <AppIcon name="alert-circle" size={18} color="#E11D48" />
            <Text className="text-xs font-bold text-rose-600 dark:text-rose-400 flex-1">
              {orderError}
            </Text>
          </View>
        )}

        {/* Itemized Cart Items */}
        <View className="space-y-3">
          {cart.map((item) => {
            const lineTotal = item.unitPrice * item.quantity;

            return (
              <View
                key={item.id}
                style={{
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                className="p-3.5 rounded-2xl shadow-xs"
              >
                {/* Title & Dietary Row */}
                <View className="flex-row items-start justify-between">
                  <View className="flex-row items-center gap-2 flex-1 mr-2">
                    {item.foodType && (
                      <VegBadge type={item.foodType} size="sm" />
                    )}
                    <Text
                      style={{ color: colors.textPrimary }}
                      className="text-xs font-bold flex-1"
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </View>
                  <Text
                    style={{ color: colors.textPrimary }}
                    className="text-xs font-black font-mono"
                  >
                    ₹{lineTotal.toFixed(0)}
                  </Text>
                </View>

                {/* Variant & Modifiers Pill Breakdown */}
                {(item.variantName || (item.modifiers && item.modifiers.length > 0)) && (
                  <View className="flex-row flex-wrap gap-1.5 mt-2">
                    {item.variantName && (
                      <View
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
                        className="px-2 py-0.5 rounded-md"
                      >
                        <Text style={{ color: colors.textPrimary }} className="text-[10px] font-bold">
                          Size: {item.variantName}
                        </Text>
                      </View>
                    )}
                    {item.modifiers?.map((m: any, idx: number) => (
                      <View
                        key={idx}
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
                        className="px-2 py-0.5 rounded-md"
                      >
                        <Text style={{ color: colors.textMuted }} className="text-[10px] font-medium">
                          +{m.optionName || m.name}
                          {Number(m.priceDelta) > 0 && ` (₹${m.priceDelta})`}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Special Instructions Note */}
                {item.specialInstructions ? (
                  <Text style={{ color: colors.textMuted }} className="text-[10px] italic mt-1.5">
                    Note: {item.specialInstructions}
                  </Text>
                ) : null}

                {/* Bottom Stepper & Unit Price Row */}
                <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-border/50">
                  <Text style={{ color: colors.textMuted }} className="text-[11px] font-mono">
                    ₹{item.unitPrice.toFixed(0)} each
                  </Text>

                  {/* Quantity Stepper */}
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      onPress={() => updateCartQuantity(item.id, -1)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      }}
                      className="w-7 h-7 rounded-lg items-center justify-center"
                    >
                      {item.quantity === 1 ? (
                        <AppIcon name="trash-2" size={13} color="#E11D48" />
                      ) : (
                        <AppIcon name="minus" size={13} color={colors.textPrimary} />
                      )}
                    </TouchableOpacity>

                    <Text
                      style={{ color: colors.textPrimary }}
                      className="text-xs font-black min-w-[20px] text-center"
                    >
                      {item.quantity}
                    </Text>

                    <TouchableOpacity
                      onPress={() => updateCartQuantity(item.id, 1)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      }}
                      className="w-7 h-7 rounded-lg items-center justify-center"
                    >
                      <AppIcon name="plus" size={13} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Live Bill Breakdown Card */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="p-4 rounded-2xl mt-5 space-y-2 shadow-xs"
        >
          <Text style={{ color: colors.textPrimary }} className="text-xs font-black uppercase tracking-wider mb-1">
            Order Price Breakdown
          </Text>

          <View className="flex-row justify-between">
            <Text style={{ color: colors.textMuted }} className="text-xs">
              Items Subtotal
            </Text>
            <Text style={{ color: colors.textPrimary }} className="text-xs font-mono font-bold">
              ₹{cartTotal.toFixed(2)}
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text style={{ color: colors.textMuted }} className="text-xs">
              Service Charge (5%)
            </Text>
            <Text style={{ color: colors.textPrimary }} className="text-xs font-mono font-bold">
              ₹{serviceCharge.toFixed(2)}
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text style={{ color: colors.textMuted }} className="text-xs">
              Estimated GST (5%)
            </Text>
            <Text style={{ color: colors.textPrimary }} className="text-xs font-mono font-bold">
              ₹{estimatedGst.toFixed(2)}
            </Text>
          </View>

          <View className="pt-2 border-t border-border/60 flex-row justify-between items-center">
            <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
              Estimated Total
            </Text>
            <Text
              style={{ color: colors.primary }}
              className="text-base font-black font-mono"
            >
              ₹{grandTotal.toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Place Order CTA */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.3 : 0.08,
          shadowRadius: 8,
          elevation: 10,
        }}
        className="absolute bottom-0 left-0 right-0 p-4"
      >
        <TouchableOpacity
          onPress={handlePlaceOrder}
          disabled={isOrdering || isOrderingLocked}
          activeOpacity={0.85}
          style={{
            backgroundColor: isOrderingLocked
              ? colors.border
              : isDark
              ? '#D4AF37'
              : '#7C3AED',
            shadowColor: isDark ? '#D4AF37' : '#7C3AED',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isOrderingLocked ? 0 : 0.3,
            shadowRadius: 8,
            elevation: isOrderingLocked ? 0 : 6,
          }}
          className="w-full py-4 rounded-2xl items-center justify-center flex-row gap-2"
        >
          {isOrdering ? (
            <>
              <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
              <Text
                style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                className="text-sm font-black"
              >
                Sending Order to Kitchen...
              </Text>
            </>
          ) : (
            <>
              <AppIcon
                name="clipboard-list"
                size={18}
                color={isOrderingLocked ? colors.textMuted : isDark ? '#000000' : '#FFFFFF'}
              />
              <Text
                style={{
                  color: isOrderingLocked ? colors.textMuted : isDark ? '#000000' : '#FFFFFF',
                }}
                className="text-sm font-black"
              >
                {isOrderingLocked
                  ? 'Ordering Closed'
                  : `Send Order to Kitchen • ₹${grandTotal.toFixed(0)}`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};
