import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';
import { useCustomer } from '../../../context/CustomerContext';
import { EmptyState } from '../../../components/common/EmptyState';

interface CustomerBillScreenProps {
  onCallWaiterPress: () => void;
  onExploreMenu: () => void;
}

export const CustomerBillScreen: React.FC<CustomerBillScreenProps> = ({
  onCallWaiterPress,
  onExploreMenu,
}) => {
  const { colors, isDark } = useTheme();
  const {
    activeBill,
    tableNumber,
    tokenNumber,
    tableStatus,
    refreshBill,
    requestBill,
    isOrderingLocked,
    orderHistory,
  } = useCustomer();

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshBill();
    setIsRefreshing(false);
  };

  const handleConfirmRequestBill = async () => {
    setIsRequesting(true);
    try {
      await requestBill();
      setIsConfirmModalOpen(false);
    } catch (err) {
      // Error handled
    } finally {
      setIsRequesting(false);
    }
  };

  // Status computation
  const isBillRequested = tableStatus === 'BILL_REQUESTED';
  const isSettling = tableStatus === 'SETTLING';
  const isSettled = tableStatus === 'PAID' || tableStatus === 'RELEASED';

  // Math calculations
  const subtotal = activeBill?.subtotal !== undefined
    ? Number(activeBill.subtotal)
    : orderHistory.reduce((sum, i) => sum + (Number(i.unitPrice || i.price || 0) * (i.quantity || 1)), 0);

  const serviceCharge = activeBill?.serviceCharge !== undefined
    ? Number(activeBill.serviceCharge)
    : subtotal * 0.05;

  const gst = activeBill?.gst !== undefined
    ? Number(activeBill.gst)
    : (subtotal + serviceCharge) * 0.05;

  const prepaidCredit = activeBill?.prepaidCredit !== undefined
    ? Number(activeBill.prepaidCredit)
    : 0;

  const calculatedTotal = Math.max(0, subtotal + serviceCharge + gst - prepaidCredit);
  const grandTotal = activeBill?.grandTotal !== undefined
    ? Number(activeBill.grandTotal)
    : calculatedTotal;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <View>
          <Text style={{ color: colors.textPrimary }} className="text-base font-black">
            Bill & Payment
          </Text>
          <Text style={{ color: colors.textMuted }} className="text-xs font-medium mt-0.5">
            Table {tableNumber || '--'} • Token {tokenNumber}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleRefresh}
          disabled={isRefreshing}
          activeOpacity={0.7}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="p-2 rounded-xl flex-row items-center gap-1.5 shadow-xs"
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <AppIcon name="refresh-cw" size={13} color={colors.primary} />
              <Text style={{ color: colors.primary }} className="text-[11px] font-bold">
                Refresh
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 120 }}
        className="flex-1"
      >
        {/* Status Indicator Card */}
        {isSettled ? (
          <View className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex-row items-center gap-3 mb-4">
            <AppIcon name="check-circle-2" size={24} color="#10B981" />
            <View className="flex-1">
              <Text className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                Bill Settled & Paid
              </Text>
              <Text className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                Thank you for your visit! Your payment has been processed.
              </Text>
            </View>
          </View>
        ) : isBillRequested || isSettling ? (
          <View className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex-row items-center gap-3 mb-4">
            <AppIcon name="receipt" size={24} color="#D97706" />
            <View className="flex-1">
              <Text className="text-xs font-black text-amber-800 dark:text-amber-300">
                Bill Requested
              </Text>
              <Text className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                Your waiter has been notified and is preparing your final printed bill.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Itemized Bill Breakdown */}
        {orderHistory.length === 0 && subtotal === 0 ? (
          <EmptyState
            title="No Billable Items"
            description="No items have been ordered yet for this dining session."
            actionLabel="Explore Menu"
            onAction={onExploreMenu}
          />
        ) : (
          <View className="space-y-4">
            {/* Ordered Items Summary */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
              }}
              className="p-4 rounded-2xl shadow-xs space-y-2.5"
            >
              <Text style={{ color: colors.textPrimary }} className="text-xs font-black uppercase tracking-wider mb-1">
                Ordered Items
              </Text>

              {orderHistory.map((item: any, idx: number) => {
                const qty = item.quantity || 1;
                const price = Number(item.unitPrice || item.price || 0);
                const lineTotal = price * qty;

                return (
                  <View key={item.id || idx} className="flex-row items-center justify-between py-1">
                    <View className="flex-1 mr-2">
                      <Text style={{ color: colors.textPrimary }} className="text-xs font-bold" numberOfLines={1}>
                        {item.name || item.menuItem?.name || 'Dish Item'}
                      </Text>
                      <Text style={{ color: colors.textMuted }} className="text-[10px] font-mono">
                        {qty} × ₹{price.toFixed(0)}
                      </Text>
                    </View>
                    <Text style={{ color: colors.textPrimary }} className="text-xs font-mono font-bold">
                      ₹{lineTotal.toFixed(2)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Calculations Card */}
            <View
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
              }}
              className="p-4 rounded-2xl shadow-xs space-y-2.5"
            >
              <Text style={{ color: colors.textPrimary }} className="text-xs font-black uppercase tracking-wider mb-1">
                Taxes & Summary
              </Text>

              <View className="flex-row justify-between">
                <Text style={{ color: colors.textMuted }} className="text-xs">
                  Subtotal
                </Text>
                <Text style={{ color: colors.textPrimary }} className="text-xs font-mono font-bold">
                  ₹{subtotal.toFixed(2)}
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
                  GST (5%)
                </Text>
                <Text style={{ color: colors.textPrimary }} className="text-xs font-mono font-bold">
                  ₹{gst.toFixed(2)}
                </Text>
              </View>

              {prepaidCredit > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    Prepaid Check-In Credit
                  </Text>
                  <Text className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    -₹{prepaidCredit.toFixed(2)}
                  </Text>
                </View>
              )}

              <View className="pt-2.5 border-t border-border/60 flex-row justify-between items-center">
                <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
                  Total Payable
                </Text>
                <Text
                  style={{ color: colors.primary }}
                  className="text-lg font-black font-mono"
                >
                  ₹{grandTotal.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Actions */}
      {orderHistory.length > 0 && !isSettled && (
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
          {isBillRequested ? (
            <TouchableOpacity
              onPress={onCallWaiterPress}
              activeOpacity={0.85}
              style={{
                backgroundColor: isDark ? '#D4AF37' : '#7C3AED',
              }}
              className="w-full py-4 rounded-2xl items-center justify-center flex-row gap-2 shadow-md"
            >
              <AppIcon name="phone-call" size={18} color={isDark ? '#000000' : '#FFFFFF'} />
              <Text
                style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                className="text-sm font-black"
              >
                Call Waiter for Assistance
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setIsConfirmModalOpen(true)}
              activeOpacity={0.85}
              style={{
                backgroundColor: isDark ? '#D4AF37' : '#7C3AED',
                shadowColor: isDark ? '#D4AF37' : '#7C3AED',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              className="w-full py-4 rounded-2xl items-center justify-center flex-row gap-2"
            >
              <AppIcon name="receipt" size={18} color={isDark ? '#000000' : '#FFFFFF'} />
              <Text
                style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                className="text-sm font-black"
              >
                Request Bill • ₹{grandTotal.toFixed(0)}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Request Bill Confirmation Modal */}
      <Modal
        visible={isConfirmModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !isRequesting && setIsConfirmModalOpen(false)}
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
            <View
              style={{
                backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(124,58,237,0.1)',
              }}
              className="w-14 h-14 rounded-2xl items-center justify-center"
            >
              <AppIcon name="receipt" size={26} color={colors.primary} />
            </View>

            <Text style={{ color: colors.textPrimary }} className="text-base font-black text-center">
              Request Bill from Waiter?
            </Text>

            <Text style={{ color: colors.textMuted }} className="text-xs text-center leading-relaxed">
              Requesting the bill will pause further ordering for Table {tableNumber}. Please confirm you have finished your meal.
            </Text>

            <View className="flex-row gap-3 w-full pt-2">
              <TouchableOpacity
                onPress={() => setIsConfirmModalOpen(false)}
                disabled={isRequesting}
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                className="flex-1 py-3 rounded-xl items-center justify-center"
              >
                <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                  Keep Ordering
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmRequestBill}
                disabled={isRequesting}
                style={{ backgroundColor: isDark ? '#D4AF37' : '#7C3AED' }}
                className="flex-1 py-3 rounded-xl items-center justify-center flex-row gap-1.5 shadow-md"
              >
                {isRequesting ? (
                  <ActivityIndicator size="small" color={isDark ? '#000000' : '#FFFFFF'} />
                ) : (
                  <Text
                    style={{ color: isDark ? '#000000' : '#FFFFFF' }}
                    className="text-xs font-black"
                  >
                    Yes, Request Bill
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
