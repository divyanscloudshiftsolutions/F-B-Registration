import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { AppIcon } from '../../../components/common/AppIcon';
import { api } from '../../../services/api';
import { onSocketEvent } from '../../../services/socket';
import { servedUndoManager, useServedUndo } from '../../../services/servedUndoManager';
import { VegBadge } from '../../../components/customer/VegBadge';
import { EmptyState } from '../../../components/common/EmptyState';

export const KitchenKDSScreen: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
  const { colors, isDark, toggleTheme } = useTheme();

  const [orders, setOrders] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stationFilter, setStationFilter] = useState<'ALL' | 'KITCHEN' | 'BAR'>('ALL');
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);

  // Undo manager
  const undoEntries = useServedUndo();

  const fetchKdsData = useCallback(async () => {
    try {
      const [kData, mData] = await Promise.all([
        api.getKdsOrders(),
        api.getMenuCatalog(),
      ]);
      setOrders(kData || []);
      setMenu(mData || []);
    } catch (err) {
      // Error handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKdsData();

    const unsubNew = onSocketEvent('kds:order_new', fetchKdsData);
    const unsubUpdate = onSocketEvent('kds:order_updated', fetchKdsData);

    return () => {
      unsubNew();
      unsubUpdate();
    };
  }, [fetchKdsData]);

  // Transition item status
  const handleItemBump = async (item: any, currentStatus: string) => {
    let nextStatus = 'ACCEPTED';
    if (currentStatus === 'PLACED' || currentStatus === 'PENDING') nextStatus = 'ACCEPTED';
    else if (currentStatus === 'ACCEPTED') nextStatus = 'PREPARING';
    else if (currentStatus === 'PREPARING') nextStatus = 'READY';
    else if (currentStatus === 'READY') nextStatus = 'SERVED';

    if (nextStatus === 'SERVED') {
      await servedUndoManager.markItemAsServed(
        item.id,
        {
          itemName: item.name || item.menuItem?.name || 'Dish',
          tableName: item.tableName || 'Table',
          station: item.station,
          quantity: item.quantity || 1,
        },
        async () => {
          await api.updateOrderItemStatus(item.id, 'SERVED');
        },
        async () => {
          await api.updateOrderItemStatus(item.id, 'READY');
          fetchKdsData();
        }
      );
      fetchKdsData();
      return;
    }

    try {
      await api.updateOrderItemStatus(item.id, nextStatus);
      fetchKdsData();
    } catch (err) {}
  };

  // Toggle item stock (86ing)
  const handleToggleStock = async (item: any) => {
    const nextAvail = item.isAvailable === false ? true : false;
    try {
      await api.toggleMenuItemAvailability(item.id, nextAvail);
      setMenu((prev) =>
        prev.map((m) => (m.id === item.id ? { ...m, isAvailable: nextAvail } : m))
      );
    } catch (err) {}
  };

  // Filter orders by station
  const filteredOrders = orders.filter((ord) => {
    if (stationFilter === 'ALL') return true;
    return (ord.items || []).some((i: any) => (i.station || 'KITCHEN').toUpperCase() === stationFilter);
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.surface}
      />

      {/* Top Header */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        }}
        className="px-4 py-3 flex-row items-center justify-between"
      >
        <View className="flex-row items-center gap-2.5">
          <View
            style={{
              backgroundColor: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(124,58,237,0.1)',
            }}
            className="w-9 h-9 rounded-xl items-center justify-center"
          >
            <AppIcon name="flame" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
              Kitchen Display (KDS)
            </Text>
            <Text style={{ color: colors.textMuted }} className="text-[10px] font-medium">
              Live Preparation Tickets
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {/* 86 / Stock button */}
          <TouchableOpacity
            onPress={() => setIsStockModalOpen(true)}
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="px-2.5 py-1.5 rounded-xl flex-row items-center gap-1"
          >
            <AppIcon name="filter" size={13} color={colors.textPrimary} />
            <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
              Stock (86)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleTheme}
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderColor: colors.border,
              borderWidth: 1,
            }}
            className="w-9 h-9 rounded-xl items-center justify-center"
          >
            <AppIcon
              name={isDark ? 'sun' : 'moon'}
              size={18}
              color={isDark ? '#D4AF37' : '#7C3AED'}
            />
          </TouchableOpacity>

          {onLogout && (
            <TouchableOpacity
              onPress={onLogout}
              style={{
                backgroundColor: 'rgba(225,29,72,0.1)',
                borderColor: 'rgba(225,29,72,0.2)',
                borderWidth: 1,
              }}
              className="px-2.5 py-1.5 rounded-xl flex-row items-center gap-1"
            >
              <AppIcon name="log-out" size={14} color="#E11D48" />
              <Text className="text-xs font-bold text-rose-600 dark:text-rose-400">
                Exit
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Station Filter Tabs */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
        }}
        className="px-3 py-1.5 flex-row gap-2"
      >
        {(['ALL', 'KITCHEN', 'BAR'] as const).map((st) => (
          <TouchableOpacity
            key={st}
            onPress={() => setStationFilter(st)}
            style={{
              backgroundColor: stationFilter === st ? (isDark ? '#D4AF37' : '#7C3AED') : 'transparent',
            }}
            className="px-4 py-1.5 rounded-xl items-center justify-center"
          >
            <Text
              style={{
                color: stationFilter === st ? (isDark ? '#000000' : '#FFFFFF') : colors.textMuted,
                fontWeight: stationFilter === st ? '800' : '600',
              }}
              className="text-xs"
            >
              {st === 'ALL' ? 'All Stations' : st === 'KITCHEN' ? 'Kitchen Only' : 'Bar Only'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Served Undo Banner */}
      {undoEntries.length > 0 && (
        <View className="px-4 pt-2 space-y-1.5">
          {undoEntries.map((entry) => (
            <View
              key={entry.itemId}
              className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex-row items-center justify-between"
            >
              <Text className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex-1 mr-2">
                Served: {entry.metadata.itemName} ({Math.ceil(entry.remainingMs / 1000)}s)
              </Text>
              <TouchableOpacity
                onPress={() => servedUndoManager.undoServed(entry.itemId)}
                className="px-3 py-1 bg-emerald-600 rounded-lg"
              >
                <Text className="text-[11px] font-black text-white">
                  Undo
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* KDS Active Tickets List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        className="flex-1"
      >
        {filteredOrders.length === 0 ? (
          <EmptyState
            title="All Orders Cleared"
            description="There are no active preparation tickets in the queue."
          />
        ) : (
          <View className="space-y-4">
            {filteredOrders.map((ord) => {
              const activeOrderItems = (ord.items || []).filter((i: any) => i.status !== 'SERVED');
              if (activeOrderItems.length === 0) return null;

              return (
                <View
                  key={ord.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 1,
                  }}
                  className="rounded-2xl p-4 shadow-xs space-y-3"
                >
                  {/* Ticket Header */}
                  <View className="flex-row items-center justify-between pb-2 border-b border-border/50">
                    <View>
                      <Text style={{ color: colors.textPrimary }} className="text-sm font-black">
                        {ord.tableName || ord.table?.name || `Table ${ord.tableId}`}
                      </Text>
                      <Text style={{ color: colors.textMuted }} className="text-[10px] font-mono">
                        #{ord.orderNumber || ord.id.slice(-6).toUpperCase()}
                      </Text>
                    </View>
                    <View className="px-2.5 py-1 rounded-lg bg-amber-500/15">
                      <Text className="text-[10px] font-black text-amber-700 dark:text-amber-400">
                        {activeOrderItems.length} active items
                      </Text>
                    </View>
                  </View>

                  {/* Items in ticket */}
                  <View className="space-y-2">
                    {activeOrderItems.map((item: any) => {
                      const status = (item.status || 'PLACED').toUpperCase();

                      return (
                        <View
                          key={item.id}
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                          }}
                          className="p-3 rounded-xl flex-row items-center justify-between"
                        >
                          <View className="flex-1 mr-2">
                            <View className="flex-row items-center gap-1.5">
                              {item.foodType && <VegBadge type={item.foodType} size="sm" />}
                              <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                                {item.name || item.menuItem?.name} × {item.quantity || 1}
                              </Text>
                            </View>
                            {item.modifiers && item.modifiers.length > 0 && (
                              <Text style={{ color: colors.textMuted }} className="text-[10px] mt-0.5">
                                + {item.modifiers.map((m: any) => m.optionName || m.name).join(', ')}
                              </Text>
                            )}
                          </View>

                          {/* Bump Action Button */}
                          <TouchableOpacity
                            onPress={() => handleItemBump(item, status)}
                            style={{
                              backgroundColor:
                                status === 'READY'
                                  ? '#10B981'
                                  : status === 'PREPARING'
                                  ? '#8B5CF6'
                                  : status === 'ACCEPTED'
                                  ? '#3B82F6'
                                  : '#F59E0B',
                            }}
                            className="px-3 py-1.5 rounded-xl shadow-xs"
                          >
                            <Text className="text-xs font-black text-white uppercase">
                              {status === 'READY'
                                ? 'Serve'
                                : status === 'PREPARING'
                                ? 'Ready'
                                : status === 'ACCEPTED'
                                ? 'Prep'
                                : 'Accept'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* 86 Stock Availability Modal */}
      <Modal
        visible={isStockModalOpen}
        animationType="slide"
        onRequestClose={() => setIsStockModalOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
            }}
            className="p-4 flex-row items-center justify-between"
          >
            <Text style={{ color: colors.textPrimary }} className="text-base font-black">
              Item Stock & Availability (86ing)
            </Text>
            <TouchableOpacity onPress={() => setIsStockModalOpen(false)} className="p-1">
              <AppIcon name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4" contentContainerStyle={{ paddingBottom: 60 }}>
            <View className="space-y-2">
              {menu.map((item) => {
                const isAvailable = item.isAvailable !== false;

                return (
                  <View
                    key={item.id}
                    style={{
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                    }}
                    className="p-3 rounded-2xl flex-row items-center justify-between"
                  >
                    <View className="flex-1 mr-2">
                      <Text style={{ color: colors.textPrimary }} className="text-xs font-bold">
                        {item.name}
                      </Text>
                      <Text style={{ color: colors.textMuted }} className="text-[10px]">
                        {item.sectionSlug || 'eat'} • {item.station || 'KITCHEN'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleToggleStock(item)}
                      style={{
                        backgroundColor: isAvailable ? 'rgba(16,185,129,0.15)' : 'rgba(225,29,72,0.15)',
                        borderColor: isAvailable ? 'rgba(16,185,129,0.3)' : 'rgba(225,29,72,0.3)',
                        borderWidth: 1,
                      }}
                      className="px-3 py-1.5 rounded-xl"
                    >
                      <Text
                        style={{ color: isAvailable ? '#10B981' : '#E11D48' }}
                        className="text-xs font-black"
                      >
                        {isAvailable ? 'In Stock' : '86 / Out'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};
