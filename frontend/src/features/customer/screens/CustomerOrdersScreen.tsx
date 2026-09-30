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
import { VegBadge } from '../../../components/customer/VegBadge';
import { EmptyState } from '../../../components/common/EmptyState';

interface CustomerOrdersScreenProps {
  onExploreMenu: () => void;
}

export const CustomerOrdersScreen: React.FC<CustomerOrdersScreenProps> = ({
  onExploreMenu,
}) => {
  const { colors, isDark } = useTheme();
  const {
    activeOrders,
    orderHistory,
    isHistoryLoading,
    refreshOrders,
    refreshOrderHistory,
    cancelOrderItem,
  } = useCustomer();

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const [cancellingItemId, setCancellingItemId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshOrders(), refreshOrderHistory()]);
    setIsRefreshing(false);
  };

  const handleConfirmCancel = async () => {
    if (!itemToDelete) return;
    setCancellingItemId(itemToDelete.id);
    try {
      await cancelOrderItem(itemToDelete.id);
      setItemToDelete(null);
    } catch (err) {
      // Error handled
    } finally {
      setCancellingItemId(null);
    }
  };

  // Helper for Status Badge
  const renderStatusBadge = (status: string) => {
    const s = (status || 'PENDING').toUpperCase();
    let bg = 'bg-amber-500/10';
    let text = 'text-amber-600 dark:text-amber-400';
    let border = 'border-amber-500/20';
    let label = 'Placed';

    if (s === 'ACCEPTED') {
      bg = 'bg-blue-500/10';
      text = 'text-blue-600 dark:text-blue-400';
      border = 'border-blue-500/20';
      label = 'Accepted';
    } else if (s === 'PREPARING') {
      bg = 'bg-purple-500/10';
      text = 'text-purple-600 dark:text-purple-400';
      border = 'border-purple-500/20';
      label = 'Preparing';
    } else if (s === 'READY') {
      bg = 'bg-emerald-500/10';
      text = 'text-emerald-600 dark:text-emerald-400';
      border = 'border-emerald-500/20';
      label = 'Ready to Serve';
    } else if (s === 'SERVED') {
      bg = 'bg-zinc-500/10';
      text = 'text-zinc-500 dark:text-zinc-400';
      border = 'border-zinc-500/20';
      label = 'Served';
    } else if (s === 'CANCELLED') {
      bg = 'bg-rose-500/10';
      text = 'text-rose-600 dark:text-rose-400';
      border = 'border-rose-500/20';
      label = 'Cancelled';
    }

    return (
      <View className={`px-2.5 py-0.5 rounded-full border ${bg} ${border}`}>
        <Text className={`text-[10px] font-black ${text}`}>
          {label}
        </Text>
      </View>
    );
  };

  // Flatten active order items
  const activeItems = activeOrders.flatMap((order) =>
    (order.items || []).map((item: any) => ({
      ...item,
      orderNumber: order.orderNumber,
      orderCreatedAt: order.createdAt,
    }))
  );

  const displayItems = activeTab === 'ACTIVE' ? activeItems : orderHistory;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Top Bar with Refresh & Subtabs */}
      <View className="px-4 pt-3 pb-2 space-y-2.5">
        <View className="flex-row items-center justify-between">
          <Text style={{ color: colors.textPrimary }} className="text-base font-black">
            Order Status
          </Text>
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

        {/* Subtabs: Active Orders vs Order History */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
          }}
          className="p-1 rounded-2xl flex-row"
        >
          <TouchableOpacity
            onPress={() => setActiveTab('ACTIVE')}
            style={{
              backgroundColor: activeTab === 'ACTIVE' ? (isDark ? '#D4AF37' : '#7C3AED') : 'transparent',
            }}
            className="flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1.5"
          >
            <Text
              style={{
                color: activeTab === 'ACTIVE' ? (isDark ? '#000000' : '#FFFFFF') : colors.textMuted,
                fontWeight: activeTab === 'ACTIVE' ? '800' : '600',
              }}
              className="text-xs"
            >
              Active Orders ({activeItems.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('HISTORY')}
            style={{
              backgroundColor: activeTab === 'HISTORY' ? (isDark ? '#D4AF37' : '#7C3AED') : 'transparent',
            }}
            className="flex-1 py-2 rounded-xl items-center justify-center flex-row gap-1.5"
          >
            <Text
              style={{
                color: activeTab === 'HISTORY' ? (isDark ? '#000000' : '#FFFFFF') : colors.textMuted,
                fontWeight: activeTab === 'HISTORY' ? '800' : '600',
              }}
              className="text-xs"
            >
              All Items ({orderHistory.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Orders List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 100 }}
        className="flex-1"
      >
        {displayItems.length === 0 ? (
          <EmptyState
            title={activeTab === 'ACTIVE' ? 'No Active Orders' : 'No Order History'}
            description={
              activeTab === 'ACTIVE'
                ? 'You do not have any items currently being prepared. Browse the menu to place an order.'
                : 'No past orders recorded for this table session.'
            }
            actionLabel="Explore Menu"
            onAction={onExploreMenu}
          />
        ) : (
          <View className="space-y-3">
            {displayItems.map((item: any, idx: number) => {
              const status = (item.status || 'PENDING').toUpperCase();
              const isPending = status === 'PENDING';
              const name = item.name || item.menuItem?.name || 'Dish Item';
              const qty = item.quantity || 1;
              const price = Number(item.unitPrice || item.price || 0);

              return (
                <View
                  key={item.id || idx}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                  className="p-3.5 rounded-2xl shadow-xs"
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center gap-1.5">
                        {item.foodType && <VegBadge type={item.foodType} size="sm" />}
                        <Text
                          style={{ color: colors.textPrimary }}
                          className="text-xs font-bold flex-1"
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                      </View>
                      <Text style={{ color: colors.textMuted }} className="text-[11px] font-mono mt-0.5">
                        Qty: {qty} • ₹{(price * qty).toFixed(0)}
                      </Text>
                    </View>

                    {renderStatusBadge(status)}
                  </View>

                  {/* Modifiers info */}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <View className="flex-row flex-wrap gap-1 mt-2">
                      {item.modifiers.map((m: any, mIdx: number) => (
                        <View
                          key={mIdx}
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          }}
                          className="px-2 py-0.5 rounded-md"
                        >
                          <Text style={{ color: colors.textMuted }} className="text-[10px]">
                            +{m.optionName || m.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Cancel Button (Only if still PENDING) */}
                  {isPending && activeTab === 'ACTIVE' && (
                    <View className="flex-row justify-end mt-2 pt-2 border-t border-border/50">
                      <TouchableOpacity
                        onPress={() => setItemToDelete({ id: item.id, name })}
                        activeOpacity={0.7}
                        className="px-3 py-1 rounded-lg bg-rose-500/10 flex-row items-center gap-1"
                      >
                        <AppIcon name="trash-2" size={12} color="#E11D48" />
                        <Text className="text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          Cancel Item
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Remove Item Modal */}
      <Modal
        visible={!!itemToDelete}
        transparent
        animationType="fade"
        onRequestClose={() => !cancellingItemId && setItemToDelete(null)}
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
            <View className="w-14 h-14 rounded-2xl bg-rose-500/10 items-center justify-center">
              <AppIcon name="trash-2" size={26} color="#E11D48" />
            </View>

            <Text style={{ color: colors.textPrimary }} className="text-base font-black text-center">
              Remove Item from Order?
            </Text>

            <Text style={{ color: colors.textMuted }} className="text-xs text-center leading-relaxed">
              Are you sure you want to remove "{itemToDelete?.name}"?
            </Text>

            <View className="flex-row gap-3 w-full pt-2">
              <TouchableOpacity
                onPress={() => setItemToDelete(null)}
                disabled={Boolean(cancellingItemId)}
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
                className="flex-1 py-3 rounded-xl items-center justify-center"
              >
                <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                  Keep Item
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmCancel}
                disabled={Boolean(cancellingItemId)}
                className="flex-1 py-3 rounded-xl bg-rose-600 items-center justify-center flex-row gap-1.5"
              >
                {cancellingItemId ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-xs font-black text-white">
                    Remove
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
